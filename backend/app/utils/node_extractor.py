"""
Node extraction utilities for converting NLJ JSON data to first-class entities.

This module provides utilities for extracting nodes from existing nlj_data
and creating the proper database relationships while maintaining data integrity.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentItem
from app.models.node import Node, ActivityNode
from app.models.user import User

logger = logging.getLogger(__name__)


class NodeExtractor:
    """
    Utility class for extracting nodes from NLJ scenario data.
    
    Handles content analysis, deduplication, and metadata extraction
    while maintaining referential integrity.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.extracted_count = 0
        self.duplicate_count = 0
        self.error_count = 0

    async def extract_from_activity(
        self, 
        activity: ContentItem,
        default_creator: Optional[UUID] = None,
        preserve_ids: bool = False
    ) -> List[Tuple[Node, ActivityNode]]:
        """
        Extract all nodes from an activity's nlj_data.
        
        Args:
            activity: ContentItem to extract nodes from
            default_creator: Default user for node creation if activity.created_by is None
            preserve_ids: Whether to preserve original node IDs from nlj_data
            
        Returns:
            List of (Node, ActivityNode) tuples created
        """
        if not activity.nlj_data or 'nodes' not in activity.nlj_data:
            logger.warning(f"Activity {activity.id} has no nodes to extract")
            return []

        nodes_data = activity.nlj_data['nodes']
        if not isinstance(nodes_data, list):
            logger.error(f"Activity {activity.id} nodes is not a list")
            return []

        creator_id = activity.created_by or default_creator
        if not creator_id:
            # Get admin user as fallback
            admin_result = await self.session.execute(
                select(User).where(User.username == 'admin')
            )
            admin_user = admin_result.scalar_one_or_none()
            if admin_user:
                creator_id = admin_user.id
            else:
                raise ValueError("No creator specified and no admin user found")

        extracted_pairs = []
        position = 0

        for node_data in nodes_data:
            try:
                # Skip structural nodes (start/end) as they don't contain semantic content
                node_type = node_data.get('type', '').lower()
                if node_type in ['start', 'end']:
                    logger.debug(f"Skipping structural node of type '{node_type}' from activity {activity.id}")
                    continue
                
                # Extract or find existing node
                node = await self.extract_single_node(
                    node_data=node_data,
                    created_by=creator_id,
                    preserve_id=preserve_ids
                )

                # Create activity-node relationship
                activity_node = ActivityNode(
                    id=uuid.uuid4(),
                    activity_id=activity.id,
                    node_id=node.id,
                    position=position,
                    configuration_overrides=self._extract_activity_overrides(node_data)
                )

                self.session.add(activity_node)
                extracted_pairs.append((node, activity_node))
                position += 1

            except Exception as e:
                logger.error(f"Failed to extract node {position} from activity {activity.id}: {e}")
                self.error_count += 1
                continue

        await self.session.flush()
        logger.info(f"Extracted {len(extracted_pairs)} nodes from activity {activity.id}")
        return extracted_pairs

    async def extract_single_node(
        self,
        node_data: Dict[str, Any],
        created_by: UUID,
        preserve_id: bool = False
    ) -> Node:
        """
        Extract a single node from node data.
        
        Args:
            node_data: Node data dictionary
            created_by: User creating the node
            preserve_id: Whether to preserve the original node ID
            
        Returns:
            Node entity (new or existing)
        """
        # Generate content hash for deduplication
        content_hash = self.generate_content_hash(node_data)
        
        # Check for existing node with same content
        existing_node = await self.session.execute(
            select(Node).where(Node.content_hash == content_hash)
        )
        existing_node = existing_node.scalar_one_or_none()
        
        if existing_node:
            logger.debug(f"Found duplicate node: {existing_node.id} (hash: {content_hash[:8]})")
            self.duplicate_count += 1
            return existing_node

        # Create new node
        node_id = uuid.UUID(node_data['id']) if preserve_id and 'id' in node_data else uuid.uuid4()
        
        new_node = Node(
            id=node_id,
            node_type=node_data.get('type', 'unknown'),
            content=self._clean_node_content(node_data),
            content_hash=content_hash,
            concept_fingerprint=None,  # Will be populated later by ML analysis
            title=self.extract_title(node_data),
            description=self.extract_description(node_data),
            difficulty_level=self.estimate_difficulty(node_data),
            # Performance metrics start as None
            avg_completion_time=None,
            success_rate=None,
            difficulty_score=None,
            engagement_score=None,
            # Version control fields
            current_version_id=None,
            base_language='en-US',
            # Audit fields
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        self.session.add(new_node)
        self.extracted_count += 1
        
        logger.debug(f"Created new node: {new_node.id} (type: {node_data.get('type')})")
        return new_node

    def generate_content_hash(self, node_data: Dict[str, Any]) -> str:
        """
        Generate SHA-256 hash for node content deduplication.
        
        Hash is based on semantic content, not positioning or metadata.
        """
        node_type = node_data.get('type', 'unknown')
        
        # Create normalized representation for hashing
        hash_content = {
            'type': node_type,
            'text': node_data.get('text', '').strip().lower(),
            'content': node_data.get('content', '').strip().lower(),
        }
        
        # Include type-specific fields for better deduplication
        if node_type == 'question' and 'choices' in node_data:
            # For multiple choice, include choice texts (order-independent)
            choices = sorted([
                choice.get('text', '').strip().lower() 
                for choice in node_data.get('choices', [])
            ])
            hash_content['choices'] = choices
            
        elif node_type == 'true_false':
            hash_content['correctAnswer'] = node_data.get('correctAnswer')
            
        elif node_type == 'ordering' and 'items' in node_data:
            # For ordering, include items (order-independent for content hash)
            items = sorted([
                item.get('text', '').strip().lower() 
                for item in node_data.get('items', [])
            ])
            hash_content['items'] = items
            
        elif node_type == 'matching':
            # For matching, include both sides
            left_items = sorted([
                item.get('text', '').strip().lower() 
                for item in node_data.get('leftItems', [])
            ])
            right_items = sorted([
                item.get('text', '').strip().lower() 
                for item in node_data.get('rightItems', [])
            ])
            hash_content['leftItems'] = left_items
            hash_content['rightItems'] = right_items
            
        elif node_type == 'short_answer':
            # Include correct answers (case-insensitive)
            correct_answers = sorted([
                answer.strip().lower() 
                for answer in node_data.get('correctAnswers', [])
            ])
            hash_content['correctAnswers'] = correct_answers
            
        elif node_type == 'connections':
            # For connections games, include groups and words
            game_data = node_data.get('gameData', {})
            groups = []
            for group in game_data.get('groups', []):
                group_content = {
                    'category': group.get('category', '').strip().lower(),
                    'words': sorted([w.strip().lower() for w in group.get('words', [])])
                }
                groups.append(group_content)
            hash_content['connections_groups'] = sorted(groups, key=lambda x: x['category'])
            
        elif node_type == 'wordle':
            # For wordle games, include target word and constraints
            game_data = node_data.get('gameData', {})
            hash_content['wordle_target'] = game_data.get('targetWord', '').strip().lower()
            hash_content['wordle_length'] = game_data.get('wordLength', 5)

        # Generate hash from normalized content
        content_json = json.dumps(hash_content, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(content_json.encode('utf-8')).hexdigest()

    def extract_title(self, node_data: Dict[str, Any]) -> Optional[str]:
        """Extract a meaningful title from node data."""
        title_candidates = [
            node_data.get('title'),
            node_data.get('text'),
            node_data.get('content'),
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

    def extract_description(self, node_data: Dict[str, Any]) -> Optional[str]:
        """Extract description from node data."""
        desc_candidates = [
            node_data.get('description'),
            node_data.get('instructions'),
            node_data.get('prompt'),
        ]
        
        for candidate in desc_candidates:
            if candidate and isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
                
        return None

    def estimate_difficulty(self, node_data: Dict[str, Any]) -> Optional[int]:
        """
        Estimate difficulty level based on node complexity.
        Returns value 1-10 or None if cannot determine.
        """
        node_type = node_data.get('type')
        
        # Base difficulty by node type
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
        text_length = len(str(node_data.get('text', '') + node_data.get('content', '')))
        if text_length > 500:
            adjustments += 1
        elif text_length > 200:
            adjustments += 0.5
            
        # Choice/option count adjustment
        if node_type == 'question' and 'choices' in node_data:
            choice_count = len(node_data.get('choices', []))
            if choice_count > 6:
                adjustments += 1
        elif node_type == 'ordering' and 'items' in node_data:
            item_count = len(node_data.get('items', []))
            if item_count > 6:
                adjustments += 1
        elif node_type == 'matching':
            item_count = len(node_data.get('leftItems', [])) + len(node_data.get('rightItems', []))
            if item_count > 8:
                adjustments += 1
                
        # Media presence might increase difficulty
        if node_data.get('media') or node_data.get('additionalMediaList'):
            adjustments += 0.5
            
        # Game complexity
        if node_type == 'connections':
            # Connections difficulty based on category obscurity (hard to assess automatically)
            adjustments += 0.5
        elif node_type == 'wordle':
            # Wordle difficulty based on word length and constraints
            game_data = node_data.get('gameData', {})
            word_length = game_data.get('wordLength', 5)
            if word_length > 6:
                adjustments += 1
            elif word_length < 4:
                adjustments -= 0.5
                
        final_difficulty = min(10, max(1, int(base_difficulty + adjustments)))
        return final_difficulty

    def _clean_node_content(self, node_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean node content for storage, removing activity-specific metadata.
        """
        # Create a copy to avoid modifying original
        cleaned_content = node_data.copy()
        
        # Remove activity-specific fields that shouldn't be in node content
        activity_specific_fields = [
            'position',  # This goes in ActivityNode
            'activityId',  # Not needed in node content
        ]
        
        for field in activity_specific_fields:
            cleaned_content.pop(field, None)
            
        return cleaned_content

    def _extract_activity_overrides(self, node_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extract activity-specific overrides that should go in ActivityNode.
        """
        # For now, we don't extract overrides from the initial nlj_data
        # This would be used when activities have customized versions of shared nodes
        return None

    def get_extraction_stats(self) -> Dict[str, int]:
        """Get statistics about the extraction process."""
        return {
            'extracted_count': self.extracted_count,
            'duplicate_count': self.duplicate_count,
            'error_count': self.error_count,
            'total_processed': self.extracted_count + self.duplicate_count + self.error_count
        }


# Convenience functions

async def extract_all_activities(
    session: AsyncSession,
    activity_ids: Optional[List[UUID]] = None,
    limit: Optional[int] = None,
    default_creator: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Extract nodes from all activities (or specified subset).
    
    Args:
        session: Database session
        activity_ids: Specific activities to process (None for all)
        limit: Maximum number of activities to process
        default_creator: Default creator for nodes
        
    Returns:
        Statistics about the extraction process
    """
    # Build query
    query = select(ContentItem).where(ContentItem.nlj_data.isnot(None))
    
    if activity_ids:
        query = query.where(ContentItem.id.in_(activity_ids))
    
    if limit:
        query = query.limit(limit)
    
    # Execute query
    result = await session.execute(query)
    activities = result.scalars().all()
    
    if not activities:
        return {
            'total_activities': 0,
            'extracted_count': 0,
            'duplicate_count': 0,
            'error_count': 0,
            'errors': []
        }
    
    # Process activities
    extractor = NodeExtractor(session)
    errors = []
    
    for activity in activities:
        try:
            await extractor.extract_from_activity(activity, default_creator)
        except Exception as e:
            logger.error(f"Failed to extract activity {activity.id}: {e}")
            errors.append({
                'activity_id': str(activity.id),
                'activity_title': activity.title,
                'error': str(e)
            })
    
    # Commit changes
    await session.commit()
    
    # Return statistics
    stats = extractor.get_extraction_stats()
    stats.update({
        'total_activities': len(activities),
        'errors': errors
    })
    
    logger.info(f"Extraction completed: {stats}")
    return stats


async def extract_single_activity(
    session: AsyncSession,
    activity_id: UUID,
    default_creator: Optional[UUID] = None
) -> Tuple[ContentItem, List[Tuple[Node, ActivityNode]]]:
    """
    Extract nodes from a single activity.
    
    Returns:
        Tuple of (activity, extracted_node_pairs)
    """
    activity = await session.get(ContentItem, activity_id)
    if not activity:
        raise ValueError(f"Activity {activity_id} not found")
    
    extractor = NodeExtractor(session)
    extracted_pairs = await extractor.extract_from_activity(activity, default_creator)
    
    await session.commit()
    return activity, extracted_pairs