#!/usr/bin/env python3
"""
Normalize Existing Content - Extract and normalize metadata from existing activities and nodes.

This script processes all existing content in the database to extract learning objectives
and keywords using the Knowledge Extraction Service, then normalizes them to prevent
taxonomy proliferation.

Usage:
    python scripts/normalize_existing_content.py [--dry-run] [--limit N] [--activity-id UUID]
    
Options:
    --dry-run: Show what would be processed without making changes
    --limit N: Process only N activities (for testing)
    --activity-id UUID: Process only the specified activity
    --model MODEL: Override the default extraction model
"""

import argparse
import asyncio
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database_manager import db_manager
from app.models.content import ContentItem
from app.models.node import Node
from app.models.learning_objective import LearningObjective, Keyword
from app.services.knowledge_extraction_service import KnowledgeExtractionService, LLMConfig
from app.utils.logging_config import get_logger

logger = get_logger(__name__)


class ContentNormalizationReport:
    """Track normalization progress and results."""
    
    def __init__(self):
        self.activities_processed = 0
        self.nodes_processed = 0
        self.objectives_created = 0
        self.keywords_created = 0
        self.objectives_matched = 0
        self.keywords_matched = 0
        self.errors = []
        self.start_time = datetime.now()
    
    def add_error(self, error: str, context: str = ""):
        self.errors.append(f"{context}: {error}" if context else error)
        logger.error(f"Normalization error - {context}: {error}")
    
    def print_summary(self):
        duration = datetime.now() - self.start_time
        
        print(f"\n{'='*60}")
        print(f"Content Normalization Complete")
        print(f"{'='*60}")
        print(f"Duration: {duration.total_seconds():.1f} seconds")
        print(f"Activities Processed: {self.activities_processed}")
        print(f"Nodes Processed: {self.nodes_processed}")
        print(f"\nLearning Objectives:")
        print(f"  Created: {self.objectives_created}")
        print(f"  Matched: {self.objectives_matched}")
        print(f"  Total: {self.objectives_created + self.objectives_matched}")
        print(f"\nKeywords:")
        print(f"  Created: {self.keywords_created}")
        print(f"  Matched: {self.keywords_matched}")
        print(f"  Total: {self.keywords_created + self.keywords_matched}")
        
        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(self.errors) > 10:
                print(f"  ... and {len(self.errors) - 10} more errors")
        
        print(f"{'='*60}\n")


async def normalize_activity_content(
    activity: ContentItem,
    extraction_service: KnowledgeExtractionService,
    report: ContentNormalizationReport,
    dry_run: bool = False
) -> None:
    """Process a single activity and its nodes for metadata extraction."""
    try:
        logger.info(f"Processing activity: {activity.title} ({activity.id})")
        
        # Extract text content from activity
        activity_text = _extract_activity_text(activity)
        if not activity_text.strip():
            logger.warning(f"No extractable text found in activity {activity.id}")
            return
        
        # Extract metadata from activity-level content
        metadata = await extraction_service.extract_content_metadata(
            content=activity_text,
            content_type=str(activity.content_type.value),
            context={
                'title': activity.title,
                'description': activity.description,
                'content_type': str(activity.content_type.value)
            }
        )
        
        logger.info(f"Extracted {len(metadata.learning_objectives)} objectives, {len(metadata.keywords)} keywords from activity")
        
        if not dry_run and (metadata.learning_objectives or metadata.keywords):
            # Normalize and store activity-level metadata
            normalized = await extraction_service.normalize_and_store_metadata(
                extracted=metadata,
                content_id=activity.id,
                node_id=None,
                auto_apply=False  # Don't auto-apply to specific nodes from activity-level
            )
            
            # Update counters
            for obj_term in normalized['learning_objectives']:
                if obj_term.action_taken == 'created':
                    report.objectives_created += 1
                else:
                    report.objectives_matched += 1
            
            for kw_term in normalized['keywords']:
                if kw_term.action_taken == 'created':
                    report.keywords_created += 1
                else:
                    report.keywords_matched += 1
        
        # Process individual nodes if they exist
        if hasattr(activity, 'nlj_data') and activity.nlj_data:
            nodes_data = activity.nlj_data.get('nodes', [])
            for node_data in nodes_data:
                await process_activity_node(
                    node_data, activity.id, extraction_service, report, dry_run
                )
                
        report.activities_processed += 1
        
    except Exception as e:
        report.add_error(str(e), f"Activity {activity.id}")


async def process_activity_node(
    node_data: dict,
    activity_id: uuid.UUID,
    extraction_service: KnowledgeExtractionService,
    report: ContentNormalizationReport,
    dry_run: bool = False
) -> None:
    """Process a node from activity JSON data."""
    try:
        node_text = _extract_node_text(node_data)
        if not node_text.strip():
            return
        
        # Extract metadata from node content
        metadata = await extraction_service.extract_content_metadata(
            content=node_text,
            content_type=node_data.get('type', 'unknown'),
            context={
                'title': node_data.get('title', node_data.get('text', 'Untitled Node')),
                'node_type': node_data.get('type'),
                'activity_id': str(activity_id)
            }
        )
        
        if metadata.learning_objectives or metadata.keywords:
            logger.info(f"Node {node_data.get('id', 'unknown')}: {len(metadata.learning_objectives)} objectives, {len(metadata.keywords)} keywords")
            
            if not dry_run:
                # Normalize and store - no node_id since these are from JSON, not extracted Node entities
                normalized = await extraction_service.normalize_and_store_metadata(
                    extracted=metadata,
                    content_id=activity_id,
                    node_id=None,
                    auto_apply=False
                )
                
                # Update counters (but don't double-count with activity-level)
                # These will contribute to the overall knowledge base
        
        report.nodes_processed += 1
        
    except Exception as e:
        report.add_error(str(e), f"Node {node_data.get('id', 'unknown')} in activity {activity_id}")


async def normalize_extracted_nodes(
    extraction_service: KnowledgeExtractionService,
    report: ContentNormalizationReport,
    dry_run: bool = False,
    limit: Optional[int] = None
) -> None:
    """Process extracted Node entities (from Phase 1)."""
    async with db_manager.get_session() as session:
        # Get extracted nodes
        stmt = select(Node)
        if limit:
            stmt = stmt.limit(limit)
            
        result = await session.execute(stmt)
        nodes = result.scalars().all()
        
        logger.info(f"Processing {len(nodes)} extracted nodes")
        
        for node in nodes:
            try:
                node_text = _extract_node_content_text(node.content)
                if not node_text.strip():
                    continue
                
                # Extract metadata
                metadata = await extraction_service.extract_content_metadata(
                    content=node_text,
                    content_type=node.node_type,
                    context={
                        'title': node.title,
                        'node_type': node.node_type
                    }
                )
                
                if metadata.learning_objectives or metadata.keywords:
                    logger.info(f"Node {node.id}: {len(metadata.learning_objectives)} objectives, {len(metadata.keywords)} keywords")
                    
                    if not dry_run:
                        # Normalize and store with node relationships
                        normalized = await extraction_service.normalize_and_store_metadata(
                            extracted=metadata,
                            content_id=None,
                            node_id=node.id,
                            auto_apply=True  # Create node relationships for extracted nodes
                        )
                        
                        # Update counters
                        for obj_term in normalized['learning_objectives']:
                            if obj_term.action_taken == 'created':
                                report.objectives_created += 1
                            else:
                                report.objectives_matched += 1
                        
                        for kw_term in normalized['keywords']:
                            if kw_term.action_taken == 'created':
                                report.keywords_created += 1
                            else:
                                report.keywords_matched += 1
                
                report.nodes_processed += 1
                
            except Exception as e:
                report.add_error(str(e), f"Extracted Node {node.id}")


def _extract_activity_text(activity: ContentItem) -> str:
    """Extract meaningful text from activity content."""
    text_parts = []
    
    # Basic metadata
    if activity.title:
        text_parts.append(activity.title)
    if activity.description:
        text_parts.append(activity.description)
    
    # Extract from NLJ data
    if activity.nlj_data:
        # Activity-level metadata
        if activity.nlj_data.get('name'):
            text_parts.append(activity.nlj_data['name'])
        if activity.nlj_data.get('description'):
            text_parts.append(activity.nlj_data['description'])
        
        # Extract text from all nodes
        nodes = activity.nlj_data.get('nodes', [])
        for node in nodes:
            node_text = _extract_node_text(node)
            if node_text:
                text_parts.append(node_text)
    
    return ' '.join(text_parts)


def _extract_node_text(node_data: dict) -> str:
    """Extract text from node data structure."""
    text_parts = []
    
    # Common text fields
    for field in ['text', 'content', 'title', 'description', 'question']:
        if field in node_data and node_data[field]:
            text_parts.append(str(node_data[field]))
    
    # Extract from choices/options
    if 'choices' in node_data:
        for choice in node_data['choices']:
            if isinstance(choice, dict) and 'text' in choice:
                text_parts.append(choice['text'])
    
    # Extract from other structured content
    for key, value in node_data.items():
        if isinstance(value, str) and len(value) > 10 and key not in ['id', 'type', 'x', 'y']:
            text_parts.append(value)
    
    return ' '.join(text_parts)


def _extract_node_content_text(content: dict) -> str:
    """Extract text from Node entity content field."""
    text_parts = []
    
    if isinstance(content, dict):
        for key in ['text', 'content', 'title', 'description', 'question', 'prompt']:
            if key in content and content[key]:
                text_parts.append(str(content[key]))
        
        # Extract from choices/options
        if 'choices' in content:
            for choice in content['choices']:
                if isinstance(choice, dict) and 'text' in choice:
                    text_parts.append(choice['text'])
    
    return ' '.join(text_parts)


async def main():
    """Main normalization script."""
    parser = argparse.ArgumentParser(description="Normalize existing content with knowledge extraction")
    parser.add_argument('--dry-run', action='store_true', help="Show what would be processed without making changes")
    parser.add_argument('--limit', type=int, help="Limit number of activities to process")
    parser.add_argument('--activity-id', help="Process only the specified activity ID")
    parser.add_argument('--model', help="Override the extraction model (e.g., claude-3-sonnet-20240229)")
    parser.add_argument('--skip-activities', action='store_true', help="Skip activity processing, only do extracted nodes")
    parser.add_argument('--skip-nodes', action='store_true', help="Skip extracted node processing, only do activities")
    
    args = parser.parse_args()
    
    # Initialize database
    await db_manager.initialize()
    
    # Configure extraction service
    llm_config = None
    if args.model:
        llm_config = LLMConfig(
            model_name=args.model,
            max_tokens=1000,
            temperature=0.1
        )
    
    extraction_service = KnowledgeExtractionService(llm_config=llm_config)
    report = ContentNormalizationReport()
    
    print(f"\n{'='*60}")
    print(f"Content Normalization {'(DRY RUN)' if args.dry_run else ''}")
    print(f"Model: {extraction_service.llm_config.model_name}")
    print(f"{'='*60}")
    
    try:
        # Process activities
        if not args.skip_activities:
            async with db_manager.get_session() as session:
                # Build query
                stmt = select(ContentItem).options(selectinload(ContentItem.creator))
                
                if args.activity_id:
                    stmt = stmt.where(ContentItem.id == uuid.UUID(args.activity_id))
                elif args.limit:
                    stmt = stmt.limit(args.limit)
                
                result = await session.execute(stmt)
                activities = result.scalars().all()
                
                print(f"Processing {len(activities)} activities...")
                
                for activity in activities:
                    await normalize_activity_content(activity, extraction_service, report, args.dry_run)
        
        # Process extracted nodes
        if not args.skip_nodes:
            print(f"Processing extracted nodes...")
            await normalize_extracted_nodes(extraction_service, report, args.dry_run, args.limit)
        
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        report.add_error(str(e), "Main process")
    finally:
        report.print_summary()
        await db_manager.close()


if __name__ == "__main__":
    asyncio.run(main())