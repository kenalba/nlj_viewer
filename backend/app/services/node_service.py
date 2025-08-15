"""
Node Service for CRUD operations, analytics, and activity synchronization.

This service manages first-class node entities and ensures activities
stay synchronized with their constituent nodes through various strategies:

1. Event-driven updates for real-time synchronization
2. Lazy loading with version tracking for performance
3. Backward compatibility with existing nlj_data access patterns
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID, uuid4

from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database_manager import db_manager
from app.models.content import ContentItem
from app.models.node import Node, ActivityNode, NodeInteraction
from app.models.learning_objective import LearningObjective, Keyword, NodeLearningObjective, NodeKeyword
from app.models.user import User

logger = logging.getLogger(__name__)


class NodeSyncStrategy:
    """Enumeration of node-activity synchronization strategies."""
    
    IMMEDIATE = "immediate"      # Sync activities immediately when nodes change
    LAZY = "lazy"               # Sync on access with version tracking  
    MANUAL = "manual"           # Manual synchronization only
    EVENT_DRIVEN = "event"      # Sync via background events (recommended)


class NodeService:
    """
    Service for managing first-class node entities with activity synchronization.
    
    Provides CRUD operations, analytics tracking, and maintains consistency
    between nodes and activities through configurable synchronization strategies.
    """

    def __init__(self, session: AsyncSession, sync_strategy: str = NodeSyncStrategy.EVENT_DRIVEN):
        self.session = session
        self.sync_strategy = sync_strategy
        self._sync_queue: Set[UUID] = set()  # Activities pending sync

    async def create_node(
        self, 
        node_type: str,
        content: Dict[str, Any],
        created_by: UUID,
        title: Optional[str] = None,
        description: Optional[str] = None,
        difficulty_level: Optional[int] = None,
        auto_extract_metadata: bool = True
    ) -> Node:
        """
        Create a new node with automatic metadata extraction.
        
        Args:
            node_type: Type of node (true_false, multiple_choice, etc.)
            content: Complete node content as dictionary
            created_by: User ID who created the node
            title: Optional node title (auto-extracted if None)
            description: Optional description (auto-extracted if None)
            difficulty_level: Difficulty 1-10 (auto-estimated if None)
            auto_extract_metadata: Whether to auto-extract title/description/difficulty
            
        Returns:
            Created Node entity
        """
        # Auto-extract metadata if requested
        if auto_extract_metadata:
            if not title:
                title = self._extract_node_title(content)
            if not description:
                description = self._extract_node_description(content)
            if difficulty_level is None:
                difficulty_level = self._estimate_difficulty_level(content, node_type)

        # Generate content hash for deduplication
        content_hash = self._generate_content_hash(content, node_type)
        
        # Check for existing node with same content
        existing_node = await self.get_node_by_content_hash(content_hash)
        if existing_node:
            logger.info(f"Found existing node with hash {content_hash[:8]}: {existing_node.id}")
            return existing_node

        # Create new node
        new_node = Node(
            id=uuid4(),
            node_type=node_type,
            content=content,
            content_hash=content_hash,
            title=title,
            description=description,
            difficulty_level=difficulty_level,
            created_by=created_by
        )

        self.session.add(new_node)
        await self.session.flush()  # Get the ID
        
        logger.info(f"Created new node: {new_node.id} (type: {node_type})")
        return new_node

    async def update_node(
        self, 
        node_id: UUID, 
        updates: Dict[str, Any],
        updated_by: UUID,
        sync_activities: bool = True
    ) -> Node:
        """
        Update an existing node and optionally sync associated activities.
        
        Args:
            node_id: ID of node to update
            updates: Dictionary of fields to update
            updated_by: User making the update
            sync_activities: Whether to sync activities using this node
            
        Returns:
            Updated Node entity
        """
        # Get existing node
        node = await self.get_node_by_id(node_id)
        if not node:
            raise ValueError(f"Node {node_id} not found")

        # Update content hash if content changed
        if 'content' in updates:
            updates['content_hash'] = self._generate_content_hash(
                updates['content'], 
                updates.get('node_type', node.node_type)
            )

        # Update timestamps
        updates['updated_at'] = datetime.utcnow()

        # Apply updates
        await self.session.execute(
            update(Node)
            .where(Node.id == node_id)
            .values(updates)
        )
        
        # Refresh node
        await self.session.refresh(node)

        logger.info(f"Updated node {node_id}: {list(updates.keys())}")

        # Sync activities if requested
        if sync_activities and self.sync_strategy != NodeSyncStrategy.MANUAL:
            await self._sync_activities_using_node(node_id)

        return node

    async def delete_node(self, node_id: UUID, cascade_to_activities: bool = False) -> bool:
        """
        Delete a node and optionally update activities that use it.
        
        Args:
            node_id: ID of node to delete
            cascade_to_activities: Whether to remove node from activities or prevent deletion
            
        Returns:
            True if deleted successfully
        """
        # Check if node is used by activities
        activities_using_node = await self.get_activities_using_node(node_id)
        
        if activities_using_node and not cascade_to_activities:
            raise ValueError(
                f"Cannot delete node {node_id}: used by {len(activities_using_node)} activities. "
                f"Use cascade_to_activities=True to force deletion and update activities."
            )

        if cascade_to_activities and activities_using_node:
            # Remove node from activities before deletion
            for activity in activities_using_node:
                await self._remove_node_from_activity(activity.id, node_id)

        # Delete the node (CASCADE will handle relationships)
        result = await self.session.execute(
            delete(Node).where(Node.id == node_id)
        )
        
        deleted = result.rowcount > 0
        if deleted:
            logger.info(f"Deleted node {node_id}")
        
        return deleted

    async def get_node_by_id(self, node_id: UUID, include_relationships: bool = False) -> Optional[Node]:
        """Get node by ID with optional relationship loading."""
        query = select(Node).where(Node.id == node_id)
        
        if include_relationships:
            query = query.options(
                selectinload(Node.activity_relationships),
                selectinload(Node.objective_relationships),
                selectinload(Node.keyword_relationships),
                selectinload(Node.interactions)
            )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_node_by_content_hash(self, content_hash: str) -> Optional[Node]:
        """Get node by content hash for deduplication."""
        result = await self.session.execute(
            select(Node).where(Node.content_hash == content_hash)
        )
        return result.scalar_one_or_none()

    async def get_nodes_by_activity(self, activity_id: UUID, ordered: bool = True) -> List[Tuple[Node, ActivityNode]]:
        """
        Get all nodes for an activity with their relationship metadata.
        
        Returns:
            List of (Node, ActivityNode) tuples
        """
        query = (
            select(Node, ActivityNode)
            .join(ActivityNode, Node.id == ActivityNode.node_id)
            .where(ActivityNode.activity_id == activity_id)
        )
        
        if ordered:
            query = query.order_by(ActivityNode.position)
        
        result = await self.session.execute(query)
        return result.all()

    async def get_activities_using_node(self, node_id: UUID) -> List[ContentItem]:
        """Get all activities that use a specific node."""
        result = await self.session.execute(
            select(ContentItem)
            .join(ActivityNode, ContentItem.id == ActivityNode.activity_id)
            .where(ActivityNode.node_id == node_id)
        )
        return result.scalars().all()

    async def add_node_to_activity(
        self, 
        activity_id: UUID, 
        node_id: UUID, 
        position: Optional[int] = None,
        configuration_overrides: Optional[Dict[str, Any]] = None
    ) -> ActivityNode:
        """
        Add a node to an activity at a specific position.
        
        Args:
            activity_id: Target activity ID
            node_id: Node to add
            position: Position in sequence (auto-assigned if None)
            configuration_overrides: Activity-specific node customizations
            
        Returns:
            Created ActivityNode relationship
        """
        # Auto-assign position if not provided
        if position is None:
            max_position_result = await self.session.execute(
                select(func.max(ActivityNode.position))
                .where(ActivityNode.activity_id == activity_id)
            )
            max_position = max_position_result.scalar() or -1
            position = max_position + 1

        # Create relationship
        activity_node = ActivityNode(
            id=uuid4(),
            activity_id=activity_id,
            node_id=node_id,
            position=position,
            configuration_overrides=configuration_overrides
        )

        self.session.add(activity_node)
        await self.session.flush()

        # Sync activity if needed
        if self.sync_strategy == NodeSyncStrategy.IMMEDIATE:
            await self._sync_activity_from_nodes(activity_id)
        elif self.sync_strategy == NodeSyncStrategy.EVENT_DRIVEN:
            self._queue_activity_sync(activity_id)

        logger.info(f"Added node {node_id} to activity {activity_id} at position {position}")
        return activity_node

    async def remove_node_from_activity(self, activity_id: UUID, node_id: UUID) -> bool:
        """Remove a node from an activity and resequence positions."""
        return await self._remove_node_from_activity(activity_id, node_id)

    async def sync_activity_from_nodes(self, activity_id: UUID) -> ContentItem:
        """
        Manually sync an activity's nlj_data from its constituent nodes.
        
        This rebuilds the nlj_data structure from the current node data,
        preserving activity-specific configurations and metadata.
        """
        return await self._sync_activity_from_nodes(activity_id)

    async def sync_all_activities(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Sync all activities from their nodes. Useful for migrations or cleanup.
        
        Returns:
            Statistics about the sync operation
        """
        # Get all activities that have nodes
        activities_query = (
            select(ContentItem.id)
            .join(ActivityNode, ContentItem.id == ActivityNode.activity_id)
            .distinct()
        )
        
        if limit:
            activities_query = activities_query.limit(limit)
            
        result = await self.session.execute(activities_query)
        activity_ids = [row[0] for row in result.all()]

        stats = {
            'total_activities': len(activity_ids),
            'synced_successfully': 0,
            'sync_errors': 0,
            'errors': []
        }

        for activity_id in activity_ids:
            try:
                await self._sync_activity_from_nodes(activity_id)
                stats['synced_successfully'] += 1
            except Exception as e:
                stats['sync_errors'] += 1
                stats['errors'].append({
                    'activity_id': str(activity_id),
                    'error': str(e)
                })
                logger.error(f"Failed to sync activity {activity_id}: {e}")

        logger.info(f"Activity sync completed: {stats}")
        return stats

    async def get_node_performance_summary(self, node_id: UUID) -> Dict[str, Any]:
        """Get comprehensive performance analytics for a node."""
        node = await self.get_node_by_id(node_id, include_relationships=True)
        if not node:
            raise ValueError(f"Node {node_id} not found")

        # Get interaction statistics
        interaction_stats = await self.session.execute(
            select(
                func.count(NodeInteraction.id).label('total_interactions'),
                func.avg(NodeInteraction.time_to_respond).label('avg_response_time'),
                func.avg(NodeInteraction.score).label('avg_score'),
                func.count(func.distinct(NodeInteraction.user_id)).label('unique_users')
            )
            .where(NodeInteraction.node_id == node_id)
        )
        stats = interaction_stats.first()

        return {
            **node.get_performance_summary(),
            'interaction_stats': {
                'total_interactions': stats.total_interactions or 0,
                'avg_response_time_ms': float(stats.avg_response_time) if stats.avg_response_time else None,
                'avg_score': float(stats.avg_score) if stats.avg_score else None,
                'unique_users': stats.unique_users or 0
            },
            'learning_objectives': [obj.objective.objective_text for obj in node.objective_relationships],
            'keywords': [kw.keyword.keyword_text for kw in node.keyword_relationships],
            'activities_count': len(node.activity_relationships)
        }

    # Private helper methods

    def _generate_content_hash(self, content: Dict[str, Any], node_type: str) -> str:
        """Generate SHA-256 hash for content deduplication."""
        # Create normalized representation for hashing
        hash_content = {
            'type': node_type,
            'text': content.get('text', '').strip().lower(),
            'content': content.get('content', '').strip().lower(),
        }
        
        # Include type-specific fields for better deduplication
        if node_type == 'question' and 'choices' in content:
            choices = sorted([choice.get('text', '').strip().lower() 
                            for choice in content.get('choices', [])])
            hash_content['choices'] = choices
            
        elif node_type == 'true_false':
            hash_content['correctAnswer'] = content.get('correctAnswer')
            
        elif node_type == 'ordering' and 'items' in content:
            items = sorted([item.get('text', '').strip().lower() 
                          for item in content.get('items', [])])
            hash_content['items'] = items

        # Generate hash from normalized content
        content_json = json.dumps(hash_content, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(content_json.encode('utf-8')).hexdigest()

    def _extract_node_title(self, content: Dict[str, Any]) -> Optional[str]:
        """Extract a meaningful title from node content."""
        title_candidates = [
            content.get('title'),
            content.get('text'),
            content.get('content'),
        ]
        
        for candidate in title_candidates:
            if candidate and isinstance(candidate, str) and candidate.strip():
                title = candidate.strip()[:255]
                # Basic HTML tag removal
                if '<' in title and '>' in title:
                    import re
                    title = re.sub(r'<[^>]+>', '', title).strip()
                return title or None
                
        return None

    def _extract_node_description(self, content: Dict[str, Any]) -> Optional[str]:
        """Extract description from node content."""
        desc_candidates = [
            content.get('description'),
            content.get('instructions'),
            content.get('prompt'),
        ]
        
        for candidate in desc_candidates:
            if candidate and isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
                
        return None

    def _estimate_difficulty_level(self, content: Dict[str, Any], node_type: str) -> Optional[int]:
        """Estimate difficulty level based on node complexity."""
        type_difficulty = {
            'start': 1, 'end': 1, 'interstitial_panel': 1,
            'true_false': 2, 'short_answer': 3, 'question': 4,
            'ordering': 5, 'matching': 6, 'likert_scale': 3,
            'rating': 3, 'matrix': 6, 'slider': 3, 'text_area': 3,
            'multi_select': 5, 'checkbox': 5, 'connections': 8,
            'wordle': 7, 'branch': 4,
        }
        
        base_difficulty = type_difficulty.get(node_type, 3)
        
        # Adjust based on content complexity
        adjustments = 0
        
        # Text length adjustment
        text_length = len(str(content.get('text', '') + content.get('content', '')))
        if text_length > 500:
            adjustments += 1
        elif text_length > 200:
            adjustments += 0.5
            
        # Choice/option count adjustment
        if node_type == 'question' and 'choices' in content:
            choice_count = len(content.get('choices', []))
            if choice_count > 6:
                adjustments += 1
                
        # Media presence
        if content.get('media') or content.get('additionalMediaList'):
            adjustments += 0.5
            
        return min(10, max(1, int(base_difficulty + adjustments)))

    async def _sync_activity_from_nodes(self, activity_id: UUID) -> ContentItem:
        """Rebuild activity nlj_data from constituent nodes."""
        # Get activity
        activity = await self.session.get(ContentItem, activity_id)
        if not activity:
            raise ValueError(f"Activity {activity_id} not found")

        # Get nodes in order
        nodes_with_relationships = await self.get_nodes_by_activity(activity_id, ordered=True)
        
        if not nodes_with_relationships:
            # Activity has no nodes, preserve existing nlj_data structure
            logger.warning(f"Activity {activity_id} has no associated nodes")
            return activity

        # Build new nlj_data structure
        new_nlj_data = activity.nlj_data.copy() if activity.nlj_data else {}
        
        # Rebuild nodes array
        new_nodes = []
        new_links = []
        
        for i, (node, activity_node) in enumerate(nodes_with_relationships):
            # Get base node content
            node_data = node.content.copy()
            
            # Apply activity-specific overrides
            if activity_node.configuration_overrides:
                node_data.update(activity_node.configuration_overrides)
            
            # Ensure position and ID consistency
            node_data['position'] = activity_node.position
            
            # Add to nodes array
            new_nodes.append(node_data)
            
            # Create basic links for sequential flow (if not overridden)
            if i > 0 and node_data.get('type') != 'choice':
                # Link from previous node (unless it's a choice node)
                prev_node = new_nodes[i-1]
                if prev_node.get('type') not in ['choice']:
                    new_links.append({
                        'id': f'link-{i-1}-{i}',
                        'type': 'link',
                        'sourceNodeId': prev_node['id'],
                        'targetNodeId': node_data['id'],
                        'startPoint': {'x': 0, 'y': 0},
                        'endPoint': {'x': 0, 'y': 0}
                    })

        # Update nlj_data
        new_nlj_data['nodes'] = new_nodes
        
        # Preserve existing links unless we're rebuilding them completely
        if 'links' not in new_nlj_data or not new_nlj_data['links']:
            new_nlj_data['links'] = new_links

        # Update activity
        await self.session.execute(
            update(ContentItem)
            .where(ContentItem.id == activity_id)
            .values(nlj_data=new_nlj_data, updated_at=datetime.utcnow())
        )

        await self.session.refresh(activity)
        logger.info(f"Synced activity {activity_id} from {len(new_nodes)} nodes")
        return activity

    async def _remove_node_from_activity(self, activity_id: UUID, node_id: UUID) -> bool:
        """Remove node from activity and resequence positions."""
        # Get the relationship to remove
        relationship_result = await self.session.execute(
            select(ActivityNode)
            .where(and_(
                ActivityNode.activity_id == activity_id,
                ActivityNode.node_id == node_id
            ))
        )
        relationship = relationship_result.scalar_one_or_none()
        
        if not relationship:
            return False

        removed_position = relationship.position

        # Delete the relationship
        await self.session.delete(relationship)

        # Resequence remaining nodes
        await self.session.execute(
            update(ActivityNode)
            .where(and_(
                ActivityNode.activity_id == activity_id,
                ActivityNode.position > removed_position
            ))
            .values(position=ActivityNode.position - 1)
        )

        # Sync activity
        if self.sync_strategy == NodeSyncStrategy.IMMEDIATE:
            await self._sync_activity_from_nodes(activity_id)
        elif self.sync_strategy == NodeSyncStrategy.EVENT_DRIVEN:
            self._queue_activity_sync(activity_id)

        logger.info(f"Removed node {node_id} from activity {activity_id}")
        return True

    async def _sync_activities_using_node(self, node_id: UUID) -> None:
        """Sync all activities that use a specific node."""
        activities = await self.get_activities_using_node(node_id)
        
        for activity in activities:
            try:
                if self.sync_strategy == NodeSyncStrategy.IMMEDIATE:
                    await self._sync_activity_from_nodes(activity.id)
                elif self.sync_strategy == NodeSyncStrategy.EVENT_DRIVEN:
                    self._queue_activity_sync(activity.id)
            except Exception as e:
                logger.error(f"Failed to sync activity {activity.id} after node {node_id} update: {e}")

    def _queue_activity_sync(self, activity_id: UUID) -> None:
        """Queue activity for background synchronization."""
        self._sync_queue.add(activity_id)
        # In a real implementation, this would trigger a background task
        logger.debug(f"Queued activity {activity_id} for sync")

    async def process_sync_queue(self) -> Dict[str, Any]:
        """Process queued activity synchronizations."""
        if not self._sync_queue:
            return {'processed': 0, 'errors': 0}

        activities_to_sync = list(self._sync_queue)
        self._sync_queue.clear()

        stats = {'processed': 0, 'errors': 0, 'error_details': []}

        for activity_id in activities_to_sync:
            try:
                await self._sync_activity_from_nodes(activity_id)
                stats['processed'] += 1
            except Exception as e:
                stats['errors'] += 1
                stats['error_details'].append({
                    'activity_id': str(activity_id),
                    'error': str(e)
                })
                logger.error(f"Failed to sync queued activity {activity_id}: {e}")

        return stats


# Convenience functions for common operations

async def get_node_service(
    session: Optional[AsyncSession] = None, 
    sync_strategy: str = NodeSyncStrategy.EVENT_DRIVEN
) -> NodeService:
    """Get a NodeService instance with database session."""
    if session is None:
        session = db_manager.get_session()
    
    return NodeService(session, sync_strategy)


async def create_node_from_content(
    content: Dict[str, Any],
    created_by: UUID,
    session: Optional[AsyncSession] = None
) -> Node:
    """Convenience function to create a node from content data."""
    service = await get_node_service(session)
    return await service.create_node(
        node_type=content.get('type', 'unknown'),
        content=content,
        created_by=created_by,
        auto_extract_metadata=True
    )