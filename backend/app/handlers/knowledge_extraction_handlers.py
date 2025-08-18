"""
Knowledge Extraction Event Handlers - Process knowledge extraction events via Kafka.

Event-driven handlers that process knowledge extraction requests following the same
pattern as content generation. Integrates with the existing Kafka/FastStream architecture.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Dict, Any

from app.brokers.kafka_broker import broker
from app.core.database_manager import db_manager
from app.models.content import ContentItem
from app.models.node import Node
from app.services.knowledge_extraction_service import KnowledgeExtractionService
from app.services.kafka_service import get_xapi_event_service
import logging
from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)


@broker.subscriber("nlj.knowledge.extraction")
async def handle_knowledge_extraction_event(event: Dict[str, Any]):
    """
    Handle knowledge extraction events from Kafka.
    
    Processes extraction requests and publishes progress/completion events
    following the same pattern as content generation events.
    """
    try:
        event_type = event.get("event_type")
        extraction_id = event.get("object", {}).get("definition", {}).get("extensions", {}).get("extraction_id")
        
        if not extraction_id:
            logger.error(f"No extraction_id found in event: {event}")
            return
        
        logger.info(f"Processing knowledge extraction event: {event_type} for extraction {extraction_id}")
        
        if event_type == "knowledge_extraction_started":
            await process_extraction_started(event, extraction_id)
        else:
            logger.debug(f"Ignoring event type: {event_type}")
            
    except Exception as e:
        logger.error(f"Error handling knowledge extraction event: {e}")
        logger.exception("Full traceback:")


async def process_extraction_started(event: Dict[str, Any], extraction_id: str):
    """Process a knowledge extraction started event."""
    try:
        # Extract event details
        actor = event.get("actor", {})
        user_email = actor.get("mbox", "").replace("mailto:", "") if actor.get("mbox") else ""
        user_name = actor.get("name", "Unknown User")
        
        extensions = event.get("object", {}).get("definition", {}).get("extensions", {})
        extraction_type = extensions.get("extraction_type", "unknown")
        target_id = extensions.get("target_id")
        target_count = extensions.get("target_count", 1)
        
        logger.info(f"Starting knowledge extraction: {extraction_type} for {target_count} items")
        
        # Initialize services
        extraction_service = KnowledgeExtractionService()
        event_service = get_xapi_event_service()
        
        start_time = datetime.now()
        
        # Process based on extraction type
        if extraction_type == "node" and target_id:
            await process_single_node_extraction(
                extraction_id, target_id, extraction_service, event_service, 
                user_email, user_name, start_time
            )
        elif extraction_type == "activity" and target_id:
            await process_single_activity_extraction(
                extraction_id, target_id, extraction_service, event_service,
                user_email, user_name, start_time
            )
        elif extraction_type == "bulk":
            await process_bulk_extraction(
                extraction_id, target_id, target_count, extraction_service, event_service,
                user_email, user_name, start_time
            )
        else:
            raise ValueError(f"Unknown extraction type: {extraction_type}")
            
    except Exception as e:
        logger.error(f"Error processing extraction {extraction_id}: {e}")
        
        # Publish failure event
        try:
            event_service = get_xapi_event_service()
            duration = int((datetime.now() - start_time).total_seconds()) if 'start_time' in locals() else 0
            
            await event_service.publish_knowledge_extraction_failed(
                extraction_id=extraction_id,
                user_id="system",
                user_email=user_email,
                user_name=user_name,
                extraction_type=extraction_type,
                error_message=str(e),
                items_processed=0,
                duration_seconds=duration
            )
        except Exception as publish_error:
            logger.error(f"Failed to publish extraction failure event: {publish_error}")


async def process_single_node_extraction(
    extraction_id: str,
    node_id: str,
    extraction_service: KnowledgeExtractionService,
    event_service,
    user_email: str,
    user_name: str,
    start_time: datetime
):
    """Process extraction for a single node."""
    async with db_manager.get_session() as session:
        # Get the node
        stmt = select(Node).where(Node.id == uuid.UUID(node_id))
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()
        
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        # Publish progress
        await event_service.publish_knowledge_extraction_progress(
            extraction_id=extraction_id,
            user_id="system",
            progress_percentage=25,
            current_step="Extracting node content",
            items_processed=0,
            items_total=1
        )
        
        # Extract text from node
        content_text = _extract_text_from_node_content(node.content)
        if not content_text.strip():
            logger.warning(f"No extractable text found in node {node_id}")
            content_text = f"{node.node_type} node"  # Fallback
        
        # Extract metadata
        await event_service.publish_knowledge_extraction_progress(
            extraction_id=extraction_id,
            user_id="system",
            progress_percentage=50,
            current_step="Analyzing content with LLM",
            items_processed=0,
            items_total=1
        )
        
        metadata = await extraction_service.extract_content_metadata(
            content=content_text,
            content_type=node.node_type,
            context={
                'title': node.title or f"{node.node_type} node",
                'node_type': node.node_type
            }
        )
        
        # Normalize and store
        await event_service.publish_knowledge_extraction_progress(
            extraction_id=extraction_id,
            user_id="system",
            progress_percentage=75,
            current_step="Normalizing and storing metadata",
            items_processed=0,
            items_total=1,
            objectives_extracted=len(metadata.learning_objectives),
            keywords_extracted=len(metadata.keywords)
        )
        
        normalized = await extraction_service.normalize_and_store_metadata(
            extracted=metadata,
            content_id=None,
            node_id=node.id,
            auto_apply=True
        )
        
        # Calculate results
        objectives_created = sum(1 for t in normalized['learning_objectives'] if t.action_taken == 'created')
        objectives_matched = sum(1 for t in normalized['learning_objectives'] if t.action_taken == 'matched')
        keywords_created = sum(1 for t in normalized['keywords'] if t.action_taken == 'created')
        keywords_matched = sum(1 for t in normalized['keywords'] if t.action_taken == 'matched')
        
        # Publish completion
        duration = int((datetime.now() - start_time).total_seconds())
        
        await event_service.publish_knowledge_extraction_completed(
            extraction_id=extraction_id,
            user_id="system",
            user_email=user_email,
            user_name=user_name,
            extraction_type="node",
            total_objectives_extracted=len(metadata.learning_objectives),
            total_keywords_extracted=len(metadata.keywords),
            objectives_created=objectives_created,
            keywords_created=keywords_created,
            objectives_matched=objectives_matched,
            keywords_matched=keywords_matched,
            items_processed=1,
            duration_seconds=duration
        )
        
        logger.info(f"Node extraction completed: {len(metadata.learning_objectives)} objectives, {len(metadata.keywords)} keywords")


async def process_single_activity_extraction(
    extraction_id: str,
    activity_id: str,
    extraction_service: KnowledgeExtractionService,
    event_service,
    user_email: str,
    user_name: str,
    start_time: datetime
):
    """Process extraction for a single activity."""
    async with db_manager.get_session() as session:
        # Get the activity
        stmt = select(ContentItem).where(ContentItem.id == uuid.UUID(activity_id))
        result = await session.execute(stmt)
        activity = result.scalar_one_or_none()
        
        if not activity:
            raise ValueError(f"Activity {activity_id} not found")
        
        # Publish progress
        await event_service.publish_knowledge_extraction_progress(
            extraction_id=extraction_id,
            user_id="system",
            progress_percentage=20,
            current_step="Extracting activity content",
            items_processed=0,
            items_total=1
        )
        
        # Extract activity-level content
        activity_text = _extract_activity_text(activity)
        if not activity_text.strip():
            logger.warning(f"No extractable text found in activity {activity_id}")
            activity_text = activity.title or "Untitled activity"
        
        # Extract metadata
        await event_service.publish_knowledge_extraction_progress(
            extraction_id=extraction_id,
            user_id="system",
            progress_percentage=50,
            current_step="Analyzing content with LLM",
            items_processed=0,
            items_total=1
        )
        
        metadata = await extraction_service.extract_content_metadata(
            content=activity_text,
            content_type=str(activity.content_type.value),
            context={
                'title': activity.title,
                'description': activity.description,
                'content_type': str(activity.content_type.value)
            }
        )
        
        # Normalize and store
        await event_service.publish_knowledge_extraction_progress(
            extraction_id=extraction_id,
            user_id="system",
            progress_percentage=75,
            current_step="Normalizing and storing metadata",
            items_processed=0,
            items_total=1,
            objectives_extracted=len(metadata.learning_objectives),
            keywords_extracted=len(metadata.keywords)
        )
        
        normalized = await extraction_service.normalize_and_store_metadata(
            extracted=metadata,
            content_id=activity.id,
            node_id=None,
            auto_apply=False  # Activity-level metadata doesn't auto-apply to specific nodes
        )
        
        # Calculate results
        objectives_created = sum(1 for t in normalized['learning_objectives'] if t.action_taken == 'created')
        objectives_matched = sum(1 for t in normalized['learning_objectives'] if t.action_taken == 'matched')
        keywords_created = sum(1 for t in normalized['keywords'] if t.action_taken == 'created')
        keywords_matched = sum(1 for t in normalized['keywords'] if t.action_taken == 'matched')
        
        # Publish completion
        duration = int((datetime.now() - start_time).total_seconds())
        
        await event_service.publish_knowledge_extraction_completed(
            extraction_id=extraction_id,
            user_id="system",
            user_email=user_email,
            user_name=user_name,
            extraction_type="activity",
            total_objectives_extracted=len(metadata.learning_objectives),
            total_keywords_extracted=len(metadata.keywords),
            objectives_created=objectives_created,
            keywords_created=keywords_created,
            objectives_matched=objectives_matched,
            keywords_matched=keywords_matched,
            items_processed=1,
            duration_seconds=duration
        )
        
        logger.info(f"Activity extraction completed: {len(metadata.learning_objectives)} objectives, {len(metadata.keywords)} keywords")


async def process_bulk_extraction(
    extraction_id: str,
    bulk_type: str,
    target_count: int,
    extraction_service: KnowledgeExtractionService,
    event_service,
    user_email: str,
    user_name: str,
    start_time: datetime
):
    """Process bulk extraction for multiple items."""
    try:
        total_objectives = 0
        total_keywords = 0
        objectives_created = 0
        objectives_matched = 0
        keywords_created = 0
        keywords_matched = 0
        items_processed = 0
        
        async with db_manager.get_session() as session:
            
            if bulk_type == "all_nodes":
                # Process all nodes
                stmt = select(Node).limit(target_count or 1000)
                result = await session.execute(stmt)
                nodes = result.scalars().all()
                
                total_items = len(nodes)
                
                for i, node in enumerate(nodes):
                    try:
                        # Update progress
                        progress = int((i / total_items) * 100) if total_items > 0 else 0
                        await event_service.publish_knowledge_extraction_progress(
                            extraction_id=extraction_id,
                            user_id="system",
                            progress_percentage=progress,
                            current_step=f"Processing node {i+1}/{total_items}",
                            items_processed=i,
                            items_total=total_items,
                            objectives_extracted=total_objectives,
                            keywords_extracted=total_keywords
                        )
                        
                        # Extract and process node
                        content_text = _extract_text_from_node_content(node.content)
                        if content_text.strip():
                            metadata = await extraction_service.extract_content_metadata(
                                content=content_text,
                                content_type=node.node_type,
                                context={'title': node.title or f"{node.node_type} node"}
                            )
                            
                            normalized = await extraction_service.normalize_and_store_metadata(
                                extracted=metadata,
                                node_id=node.id,
                                auto_apply=True
                            )
                            
                            # Update counters
                            total_objectives += len(metadata.learning_objectives)
                            total_keywords += len(metadata.keywords)
                            objectives_created += sum(1 for t in normalized['learning_objectives'] if t.action_taken == 'created')
                            objectives_matched += sum(1 for t in normalized['learning_objectives'] if t.action_taken == 'matched')
                            keywords_created += sum(1 for t in normalized['keywords'] if t.action_taken == 'created')
                            keywords_matched += sum(1 for t in normalized['keywords'] if t.action_taken == 'matched')
                        
                        items_processed += 1
                        
                        # Small delay to prevent overwhelming the LLM API
                        await asyncio.sleep(0.1)
                        
                    except Exception as e:
                        logger.error(f"Error processing node {node.id}: {e}")
                        continue
                
            # Similar logic for activities would go here...
        
        # Publish completion
        duration = int((datetime.now() - start_time).total_seconds())
        
        await event_service.publish_knowledge_extraction_completed(
            extraction_id=extraction_id,
            user_id="system",
            user_email=user_email,
            user_name=user_name,
            extraction_type="bulk",
            total_objectives_extracted=total_objectives,
            total_keywords_extracted=total_keywords,
            objectives_created=objectives_created,
            keywords_created=keywords_created,
            objectives_matched=objectives_matched,
            keywords_matched=keywords_matched,
            items_processed=items_processed,
            duration_seconds=duration
        )
        
        logger.info(f"Bulk extraction completed: {items_processed} items, {total_objectives} objectives, {total_keywords} keywords")
        
    except Exception as e:
        logger.error(f"Error in bulk extraction: {e}")
        raise


def _extract_text_from_node_content(content: Dict[str, Any]) -> str:
    """Extract meaningful text from node content JSON."""
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
        
        # Extract from other structured content
        for key, value in content.items():
            if isinstance(value, str) and len(value) > 10:
                text_parts.append(value)
    
    return ' '.join(text_parts)


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
        for node in nodes[:10]:  # Limit to first 10 nodes to avoid excessive text
            node_text = _extract_text_from_node_content(node)
            if node_text:
                text_parts.append(node_text)
    
    return ' '.join(text_parts)