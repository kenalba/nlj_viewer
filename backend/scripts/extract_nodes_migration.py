#!/usr/bin/env python3
"""
Node extraction migration script for Phase 1.1 of the Node Refactor Plan.

This script extracts nodes from existing ContentItem.nlj_data JSON blobs
and creates first-class Node entities with proper relationships.

Usage:
    python scripts/extract_nodes_migration.py [--dry-run] [--activity-id UUID] [--limit N]

Arguments:
    --dry-run: Preview the migration without making changes
    --activity-id: Process only a specific activity (for testing)
    --limit: Limit the number of activities to process
"""

import argparse
import asyncio
import hashlib
import json
import logging
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent directory to path for imports
sys.path.append('../')

from app.core.database_manager import db_manager
from app.models import ContentItem, Node, ActivityNode
from app.models.user import User

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class NodeExtractor:
    """Extracts and processes nodes from NLJ scenario JSON data."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.extracted_nodes = 0
        self.created_nodes = 0
        self.duplicate_nodes = 0
        self.errors = 0

    def generate_content_hash(self, node_data: Dict[str, Any]) -> str:
        """
        Generate SHA-256 hash for node content deduplication.
        
        Hash is based on:
        - Node type
        - Core content fields (text, content, options, etc.)
        - Excluding metadata like position, ID, timestamps
        """
        # Create normalized representation for hashing
        hash_content = {
            'type': node_data.get('type'),
            'text': node_data.get('text', '').strip().lower(),
            'content': node_data.get('content', '').strip().lower(),
        }
        
        # Include type-specific fields for better deduplication
        node_type = node_data.get('type')
        
        if node_type == 'question' and 'choices' in node_data:
            # For multiple choice questions, include choice texts
            choices = sorted([choice.get('text', '').strip().lower() 
                            for choice in node_data.get('choices', [])])
            hash_content['choices'] = choices
            
        elif node_type == 'true_false':
            hash_content['correctAnswer'] = node_data.get('correctAnswer')
            
        elif node_type == 'ordering' and 'items' in node_data:
            # For ordering questions, include item texts (order-independent)
            items = sorted([item.get('text', '').strip().lower() 
                          for item in node_data.get('items', [])])
            hash_content['items'] = items
            
        elif node_type == 'matching':
            # For matching questions, include left/right items
            left_items = sorted([item.get('text', '').strip().lower() 
                               for item in node_data.get('leftItems', [])])
            right_items = sorted([item.get('text', '').strip().lower() 
                                for item in node_data.get('rightItems', [])])
            hash_content['leftItems'] = left_items
            hash_content['rightItems'] = right_items
            
        elif node_type == 'short_answer':
            # Include correct answers (case-insensitive)
            correct_answers = sorted([answer.strip().lower() 
                                    for answer in node_data.get('correctAnswers', [])])
            hash_content['correctAnswers'] = correct_answers

        # Generate hash from normalized content
        content_json = json.dumps(hash_content, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(content_json.encode('utf-8')).hexdigest()

    def extract_node_title(self, node_data: Dict[str, Any]) -> Optional[str]:
        """Extract a meaningful title from node data."""
        # Try various fields that might contain title-like content
        title_candidates = [
            node_data.get('title'),
            node_data.get('text'),
            node_data.get('content'),
        ]
        
        for candidate in title_candidates:
            if candidate and isinstance(candidate, str) and candidate.strip():
                # Limit title length and clean up
                title = candidate.strip()[:255]
                # Remove HTML tags if present (basic cleaning)
                if '<' in title and '>' in title:
                    import re
                    title = re.sub(r'<[^>]+>', '', title).strip()
                return title or None
                
        return None

    def extract_description(self, node_data: Dict[str, Any]) -> Optional[str]:
        """Extract description from node data."""
        # Look for description-like fields
        desc_candidates = [
            node_data.get('description'),
            node_data.get('instructions'),
            node_data.get('prompt'),
        ]
        
        for candidate in desc_candidates:
            if candidate and isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
                
        return None

    def estimate_difficulty_level(self, node_data: Dict[str, Any]) -> Optional[int]:
        """
        Estimate difficulty level based on node complexity.
        Returns value 1-10 or None if cannot determine.
        """
        node_type = node_data.get('type')
        
        # Basic difficulty by node type
        type_difficulty = {
            'start': 1,
            'end': 1,
            'interstitial_panel': 1,
            'true_false': 2,
            'short_answer': 3,
            'question': 4,  # Multiple choice
            'ordering': 5,
            'matching': 6,
            'likert_scale': 3,
            'rating': 3,
            'matrix': 6,
            'slider': 3,
            'text_area': 3,
            'multi_select': 5,
            'checkbox': 5,
            'connections': 8,
            'wordle': 7,
            'branch': 4,
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
        elif node_type in ['ordering', 'matching']:
            item_count = len(node_data.get('items', [])) + len(node_data.get('leftItems', []))
            if item_count > 6:
                adjustments += 1
                
        # Media presence might increase difficulty
        if node_data.get('media') or node_data.get('additionalMediaList'):
            adjustments += 0.5
            
        final_difficulty = min(10, max(1, int(base_difficulty + adjustments)))
        return final_difficulty

    async def extract_nodes_from_activity(
        self, 
        activity: ContentItem, 
        default_creator_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Extract nodes from a single activity's nlj_data.
        
        Returns list of node data dictionaries ready for database insertion.
        """
        if not activity.nlj_data or 'nodes' not in activity.nlj_data:
            logger.warning(f"Activity {activity.id} has no nodes in nlj_data")
            return []
            
        nodes_data = activity.nlj_data['nodes']
        if not isinstance(nodes_data, list):
            logger.error(f"Activity {activity.id} nodes is not a list: {type(nodes_data)}")
            self.errors += 1
            return []
            
        extracted_nodes = []
        position = 0
        
        for node_data in nodes_data:
            try:
                self.extracted_nodes += 1
                
                # Generate content hash for deduplication
                content_hash = self.generate_content_hash(node_data)
                
                # Check if node with this hash already exists
                existing_node_stmt = select(Node).where(Node.content_hash == content_hash)
                existing_node_result = await self.session.execute(existing_node_stmt)
                existing_node = existing_node_result.scalar_one_or_none()
                
                if existing_node:
                    # Node already exists, create activity relationship
                    logger.debug(f"Found duplicate node: {existing_node.id} (hash: {content_hash[:8]})")
                    self.duplicate_nodes += 1
                    
                    extracted_nodes.append({
                        'node_id': existing_node.id,
                        'activity_id': activity.id,
                        'position': position,
                        'configuration_overrides': None,
                        'is_new_node': False
                    })
                else:
                    # Create new node
                    node_id = uuid4()
                    
                    # Extract meaningful title and description
                    title = self.extract_node_title(node_data)
                    description = self.extract_description(node_data)
                    difficulty_level = self.estimate_difficulty_level(node_data)
                    
                    new_node_data = {
                        'id': node_id,
                        'node_type': node_data.get('type', 'unknown'),
                        'content': node_data,  # Store complete node data
                        'content_hash': content_hash,
                        'concept_fingerprint': None,  # Will be populated by ML analysis later
                        'title': title,
                        'description': description,
                        'difficulty_level': difficulty_level,
                        # Performance metrics start as None, updated by analytics
                        'avg_completion_time': None,
                        'success_rate': None,
                        'difficulty_score': None,
                        'engagement_score': None,
                        # Versioning fields for future use
                        'current_version_id': None,
                        'base_language': 'en-US',
                        # Audit fields
                        'created_by': activity.created_by or default_creator_id,
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'is_new_node': True
                    }
                    
                    extracted_nodes.append({
                        'node_data': new_node_data,
                        'node_id': node_id,
                        'activity_id': activity.id,
                        'position': position,
                        'configuration_overrides': None,
                        'is_new_node': True
                    })
                    
                    self.created_nodes += 1
                    logger.debug(f"Created new node: {node_id} (type: {node_data.get('type')}, hash: {content_hash[:8]})")
                
                position += 1
                
            except Exception as e:
                logger.error(f"Error extracting node from activity {activity.id}: {e}")
                self.errors += 1
                continue
                
        return extracted_nodes

    async def process_activities(
        self, 
        activity_id: Optional[UUID] = None, 
        limit: Optional[int] = None,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Process activities and extract nodes.
        
        Args:
            activity_id: Process only specific activity (for testing)
            limit: Limit number of activities to process
            dry_run: Preview changes without committing
            
        Returns:
            Dictionary with processing statistics
        """
        logger.info("Starting node extraction migration...")
        
        # Get default admin user for node creation attribution
        admin_user_stmt = select(User).where(User.username == 'admin')
        admin_user_result = await self.session.execute(admin_user_stmt)
        admin_user = admin_user_result.scalar_one_or_none()
        
        if not admin_user:
            raise ValueError("No admin user found. Please ensure admin user exists.")
            
        default_creator_id = admin_user.id
        logger.info(f"Using default creator: {admin_user.username} ({default_creator_id})")
        
        # Build query for activities to process
        if activity_id:
            activities_stmt = select(ContentItem).where(ContentItem.id == activity_id)
            logger.info(f"Processing single activity: {activity_id}")
        else:
            activities_stmt = select(ContentItem).where(ContentItem.nlj_data.isnot(None))
            if limit:
                activities_stmt = activities_stmt.limit(limit)
                logger.info(f"Processing up to {limit} activities")
            else:
                logger.info("Processing all activities with nlj_data")
        
        activities_result = await self.session.execute(activities_stmt)
        activities = activities_result.scalars().all()
        
        logger.info(f"Found {len(activities)} activities to process")
        
        if dry_run:
            logger.info("DRY RUN MODE - No changes will be committed")
        
        # Process each activity
        all_nodes_to_insert = []
        all_relationships_to_insert = []
        
        for i, activity in enumerate(activities, 1):
            logger.info(f"Processing activity {i}/{len(activities)}: {activity.title} ({activity.id})")
            
            try:
                extracted_nodes = await self.extract_nodes_from_activity(activity, default_creator_id)
                
                for node_info in extracted_nodes:
                    if node_info['is_new_node'] and 'node_data' in node_info:
                        all_nodes_to_insert.append(node_info['node_data'])
                    
                    # Create activity-node relationship
                    relationship_data = {
                        'id': uuid4(),
                        'activity_id': node_info['activity_id'],
                        'node_id': node_info['node_id'],
                        'position': node_info['position'],
                        'configuration_overrides': node_info['configuration_overrides'],
                        'created_at': datetime.utcnow()
                    }
                    all_relationships_to_insert.append(relationship_data)
                    
            except Exception as e:
                logger.error(f"Error processing activity {activity.id}: {e}")
                self.errors += 1
                continue
        
        # Insert new nodes in batch
        if all_nodes_to_insert and not dry_run:
            logger.info(f"Inserting {len(all_nodes_to_insert)} new nodes...")
            insert_stmt = insert(Node).values(all_nodes_to_insert)
            await self.session.execute(insert_stmt)
        
        # Insert activity-node relationships in batch
        if all_relationships_to_insert and not dry_run:
            logger.info(f"Inserting {len(all_relationships_to_insert)} activity-node relationships...")
            insert_stmt = insert(ActivityNode).values(all_relationships_to_insert)
            await self.session.execute(insert_stmt)
        
        if not dry_run:
            await self.session.commit()
            logger.info("Migration committed to database")
        
        # Return statistics
        stats = {
            'activities_processed': len(activities),
            'nodes_extracted': self.extracted_nodes,
            'nodes_created': self.created_nodes,
            'duplicate_nodes_found': self.duplicate_nodes,
            'relationships_created': len(all_relationships_to_insert),
            'errors': self.errors,
            'dry_run': dry_run
        }
        
        return stats


async def main():
    """Main migration execution function."""
    parser = argparse.ArgumentParser(description='Extract nodes from existing activities')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Preview migration without making changes')
    parser.add_argument('--activity-id', type=str, 
                       help='Process only specific activity ID')
    parser.add_argument('--limit', type=int, 
                       help='Limit number of activities to process')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Parse activity ID if provided
    activity_id = None
    if args.activity_id:
        try:
            activity_id = UUID(args.activity_id)
        except ValueError:
            logger.error(f"Invalid activity ID format: {args.activity_id}")
            return 1
    
    try:
        # Get database session
        async with db_manager.get_session() as session:
            extractor = NodeExtractor(session)
            
            stats = await extractor.process_activities(
                activity_id=activity_id,
                limit=args.limit,
                dry_run=args.dry_run
            )
            
        # Print results
        logger.info("Migration completed successfully!")
        logger.info("Statistics:")
        for key, value in stats.items():
            logger.info(f"  {key}: {value}")
            
        if args.dry_run:
            logger.info("\nThis was a dry run. Run without --dry-run to apply changes.")
        
        return 0
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)