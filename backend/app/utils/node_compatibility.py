"""
Backward compatibility utilities for seamless nlj_data access.

This module provides transparent access to activity nodes through the traditional
nlj_data interface while leveraging the new node-first architecture behind the scenes.
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentItem
from app.services.node_service import NodeService, NodeSyncStrategy

logger = logging.getLogger(__name__)


class NodeCompatibilityLayer:
    """
    Provides backward-compatible access to nlj_data while using node-first architecture.
    
    This layer intercepts nlj_data access and automatically:
    1. Extracts nodes from JSON when activities are accessed
    2. Rebuilds nlj_data from nodes when requested
    3. Keeps data synchronized between both representations
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.node_service = NodeService(session, NodeSyncStrategy.LAZY)
        self._extracted_activities: set[UUID] = set()

    async def get_activity_nlj_data(self, activity: ContentItem, force_sync: bool = False) -> Dict[str, Any]:
        """
        Get nlj_data for an activity, automatically syncing from nodes if needed.
        
        Args:
            activity: ContentItem to get data for
            force_sync: Force rebuild from nodes even if nlj_data exists
            
        Returns:
            Complete nlj_data dictionary with current node data
        """
        # Check if activity has been extracted to nodes
        has_nodes = await self._activity_has_extracted_nodes(activity.id)
        
        if has_nodes and (force_sync or await self._needs_sync(activity)):
            # Rebuild nlj_data from current node data
            logger.debug(f"Rebuilding nlj_data for activity {activity.id} from nodes")
            activity = await self.node_service.sync_activity_from_nodes(activity.id)
            
        elif not has_nodes and activity.nlj_data:
            # Extract nodes from nlj_data for first time
            logger.debug(f"Extracting nodes from nlj_data for activity {activity.id}")
            await self._extract_nodes_from_activity(activity)
            
        return activity.nlj_data or {}

    async def update_activity_nlj_data(
        self, 
        activity_id: UUID, 
        nlj_data: Dict[str, Any],
        updated_by: UUID
    ) -> ContentItem:
        """
        Update activity nlj_data and sync changes to individual nodes.
        
        Args:
            activity_id: Activity to update
            nlj_data: New nlj_data content
            updated_by: User making the update
            
        Returns:
            Updated ContentItem
        """
        # Update the activity record first
        from sqlalchemy import update
        await self.session.execute(
            update(ContentItem)
            .where(ContentItem.id == activity_id)
            .values(nlj_data=nlj_data)
        )
        
        # Get updated activity
        activity = await self.session.get(ContentItem, activity_id)
        if not activity:
            raise ValueError(f"Activity {activity_id} not found")

        # Extract/update nodes from new nlj_data
        await self._extract_nodes_from_activity(activity, updated_by)
        
        logger.info(f"Updated activity {activity_id} nlj_data and synced to nodes")
        return activity

    async def ensure_activity_extracted(self, activity: ContentItem, created_by: Optional[UUID] = None) -> bool:
        """
        Ensure an activity has been extracted to nodes.
        
        Returns:
            True if extraction was performed, False if already extracted
        """
        if activity.id in self._extracted_activities:
            return False

        has_nodes = await self._activity_has_extracted_nodes(activity.id)
        if has_nodes:
            self._extracted_activities.add(activity.id)
            return False

        if not activity.nlj_data or 'nodes' not in activity.nlj_data:
            logger.warning(f"Activity {activity.id} has no nlj_data to extract")
            return False

        # Perform extraction
        extracted_by = created_by or activity.created_by
        await self._extract_nodes_from_activity(activity, extracted_by)
        self._extracted_activities.add(activity.id)
        
        logger.info(f"Extracted {len(activity.nlj_data['nodes'])} nodes from activity {activity.id}")
        return True

    async def get_node_data_for_activity(self, activity_id: UUID, include_overrides: bool = True) -> List[Dict[str, Any]]:
        """
        Get current node data for an activity directly from node entities.
        
        Args:
            activity_id: Activity ID
            include_overrides: Whether to apply activity-specific overrides
            
        Returns:
            List of node data dictionaries
        """
        nodes_with_relationships = await self.node_service.get_nodes_by_activity(activity_id, ordered=True)
        
        node_data = []
        for node, activity_node in nodes_with_relationships:
            # Start with node content
            data = node.content.copy()
            
            # Apply activity-specific overrides if requested
            if include_overrides and activity_node.configuration_overrides:
                data.update(activity_node.configuration_overrides)
            
            # Ensure position is current
            data['position'] = activity_node.position
            
            node_data.append(data)
        
        return node_data

    async def _activity_has_extracted_nodes(self, activity_id: UUID) -> bool:
        """Check if an activity has been extracted to individual nodes."""
        from sqlalchemy import select, func
        from app.models.node import ActivityNode
        
        result = await self.session.execute(
            select(func.count(ActivityNode.id))
            .where(ActivityNode.activity_id == activity_id)
        )
        
        count = result.scalar()
        return count > 0

    async def _needs_sync(self, activity: ContentItem) -> bool:
        """
        Check if activity nlj_data needs to be rebuilt from nodes.
        
        This is a simple version check - could be enhanced with more sophisticated
        change detection in the future.
        """
        if not activity.nlj_data:
            return True
            
        # Check if any constituent nodes have been updated more recently than the activity
        from sqlalchemy import select, func
        from app.models.node import Node, ActivityNode
        
        result = await self.session.execute(
            select(func.max(Node.updated_at))
            .join(ActivityNode, Node.id == ActivityNode.node_id)
            .where(ActivityNode.activity_id == activity.id)
        )
        
        latest_node_update = result.scalar()
        if not latest_node_update:
            return False
            
        # If any node is newer than the activity, we need to sync
        return latest_node_update > activity.updated_at

    async def _extract_nodes_from_activity(self, activity: ContentItem, created_by: Optional[UUID] = None) -> None:
        """Extract nodes from activity nlj_data into individual node entities."""
        if not activity.nlj_data or 'nodes' not in activity.nlj_data:
            logger.warning(f"Activity {activity.id} has no nodes to extract")
            return

        nodes_data = activity.nlj_data['nodes']
        if not isinstance(nodes_data, list):
            logger.error(f"Activity {activity.id} nodes data is not a list")
            return

        # Use activity creator if no specific user provided
        extractor_id = created_by or activity.created_by

        # Clear existing relationships
        from sqlalchemy import delete
        from app.models.node import ActivityNode
        await self.session.execute(
            delete(ActivityNode).where(ActivityNode.activity_id == activity.id)
        )

        # Extract each node
        position = 0
        for node_data in nodes_data:
            try:
                # Create or find existing node
                node = await self.node_service.create_node(
                    node_type=node_data.get('type', 'unknown'),
                    content=node_data,
                    created_by=extractor_id,
                    auto_extract_metadata=True
                )

                # Create activity-node relationship
                await self.node_service.add_node_to_activity(
                    activity_id=activity.id,
                    node_id=node.id,
                    position=position,
                    configuration_overrides=None  # No overrides during initial extraction
                )

                position += 1

            except Exception as e:
                logger.error(f"Failed to extract node {position} from activity {activity.id}: {e}")
                continue

        logger.info(f"Extracted {position} nodes from activity {activity.id}")


class CompatibleContentItem:
    """
    Wrapper around ContentItem that provides transparent node-first access
    while maintaining backward compatibility with existing nlj_data usage.
    """

    def __init__(self, content_item: ContentItem, compatibility_layer: NodeCompatibilityLayer):
        self._content_item = content_item
        self._compatibility_layer = compatibility_layer
        self._nlj_data_cache: Optional[Dict[str, Any]] = None

    def __getattr__(self, name):
        """Delegate attribute access to the underlying ContentItem."""
        return getattr(self._content_item, name)

    @property
    async def nlj_data(self) -> Dict[str, Any]:
        """Get nlj_data with automatic node synchronization."""
        if self._nlj_data_cache is None:
            self._nlj_data_cache = await self._compatibility_layer.get_activity_nlj_data(
                self._content_item
            )
        return self._nlj_data_cache

    async def set_nlj_data(self, nlj_data: Dict[str, Any], updated_by: UUID) -> None:
        """Set nlj_data and sync to nodes."""
        await self._compatibility_layer.update_activity_nlj_data(
            self._content_item.id, 
            nlj_data, 
            updated_by
        )
        self._nlj_data_cache = nlj_data

    async def refresh_from_nodes(self) -> None:
        """Force refresh nlj_data from current node state."""
        self._nlj_data_cache = await self._compatibility_layer.get_activity_nlj_data(
            self._content_item, 
            force_sync=True
        )

    async def get_node_data(self) -> List[Dict[str, Any]]:
        """Get current node data directly from node entities."""
        return await self._compatibility_layer.get_node_data_for_activity(
            self._content_item.id
        )

    async def ensure_extracted(self) -> bool:
        """Ensure this activity has been extracted to nodes."""
        return await self._compatibility_layer.ensure_activity_extracted(
            self._content_item
        )


# Convenience functions

async def create_compatibility_layer(session: AsyncSession) -> NodeCompatibilityLayer:
    """Create a NodeCompatibilityLayer instance."""
    return NodeCompatibilityLayer(session)


async def get_compatible_activity(
    activity: ContentItem, 
    session: AsyncSession
) -> CompatibleContentItem:
    """Wrap a ContentItem with backward compatibility features."""
    compatibility_layer = await create_compatibility_layer(session)
    return CompatibleContentItem(activity, compatibility_layer)


async def ensure_all_activities_extracted(
    session: AsyncSession,
    limit: Optional[int] = None,
    created_by: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Ensure all activities in the database have been extracted to nodes.
    Useful for migrations and system initialization.
    """
    from sqlalchemy import select
    
    # Get activities that have nlj_data but might not be extracted
    query = select(ContentItem).where(ContentItem.nlj_data.isnot(None))
    if limit:
        query = query.limit(limit)
    
    result = await session.execute(query)
    activities = result.scalars().all()
    
    compatibility_layer = await create_compatibility_layer(session)
    
    stats = {
        'total_activities': len(activities),
        'already_extracted': 0,
        'newly_extracted': 0,
        'extraction_errors': 0,
        'errors': []
    }
    
    for activity in activities:
        try:
            was_extracted = await compatibility_layer.ensure_activity_extracted(
                activity, created_by
            )
            if was_extracted:
                stats['newly_extracted'] += 1
            else:
                stats['already_extracted'] += 1
                
        except Exception as e:
            stats['extraction_errors'] += 1
            stats['errors'].append({
                'activity_id': str(activity.id),
                'activity_title': activity.title,
                'error': str(e)
            })
            logger.error(f"Failed to extract activity {activity.id}: {e}")
    
    await session.commit()
    logger.info(f"Activity extraction completed: {stats}")
    return stats