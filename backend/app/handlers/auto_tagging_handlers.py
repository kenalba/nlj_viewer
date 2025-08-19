"""
Auto-Tagging Event Handlers - Process auto-tagging events via Kafka.

Event-driven handlers that process auto-tagging requests following the same
pattern as knowledge extraction. Integrates with the existing Kafka/FastStream architecture.
"""

import uuid
from datetime import datetime
from typing import Dict, Any

from app.brokers.kafka_broker import broker
from app.core.database_manager import db_manager
from app.models.node import Node
from app.services.node_auto_tagger import (
    NodeAutoTaggerService, AutoTaggingConfig, TaggingStrategy
)
from app.services.kafka_service import get_xapi_event_service
import logging
from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)


@broker.subscriber("nlj.auto.tagging")
async def handle_auto_tagging_event(event: Dict[str, Any]):
    """
    Handle auto-tagging events from Kafka.
    
    Processes tagging requests and publishes progress/completion events
    following the same pattern as knowledge extraction events.
    """
    try:
        event_type = event.get("event_type")
        
        if not event_type:
            logger.error(f"No event_type found in event: {event}")
            return
        
        logger.info(f"Processing auto-tagging event: {event_type}")
        
        if event_type == "auto_tagging_started":
            await process_single_node_tagging(event)
        elif event_type == "batch_auto_tagging_started":
            await process_batch_tagging(event)
        else:
            logger.debug(f"Ignoring event type: {event_type}")
            
    except Exception as e:
        logger.error(f"Error handling auto-tagging event: {e}")
        logger.exception("Full traceback:")


async def process_single_node_tagging(event: Dict[str, Any]):
    """Process a single node auto-tagging started event."""
    try:
        # Extract event details
        actor = event.get("actor", {})
        user_email = actor.get("mbox", "").replace("mailto:", "") if actor.get("mbox") else ""
        user_name = actor.get("name", "Unknown User")
        
        extensions = event.get("object", {}).get("definition", {}).get("extensions", {})
        tagging_id = extensions.get("tagging_id")
        node_id = extensions.get("target_node_id")
        strategy = extensions.get("tagging_strategy", "balanced")
        
        if not tagging_id or not node_id:
            logger.error(f"Missing tagging_id or node_id in event: {event}")
            return
        
        logger.info(f"Starting auto-tagging for node {node_id} with strategy {strategy}")
        
        # Initialize auto-tagger service
        tagging_strategy = TaggingStrategy(strategy)
        config = AutoTaggingConfig(strategy=tagging_strategy)
        auto_tagger = NodeAutoTaggerService(config)
        
        start_time = datetime.now()
        
        # Perform auto-tagging
        result = await auto_tagger.auto_tag_node(
            node_id=uuid.UUID(node_id),
            user_id="system",
            force_retag=False,  # Can be made configurable
            custom_strategy=tagging_strategy
        )
        
        # Publish completion event
        event_service = get_xapi_event_service()
        await event_service.publish_auto_tagging_completed(
            node_id=node_id,
            user_id="system",
            strategy=result.strategy_used.value,
            quality=result.overall_quality.value,
            objectives_added=len(result.objectives_added),
            keywords_added=len(result.keywords_added),
            confidence_score=result.confidence_score,
            processing_time_seconds=result.total_processing_time
        )
        
        logger.info(f"Auto-tagging completed for node {node_id}: {len(result.objectives_added)} objectives, {len(result.keywords_added)} keywords")
        
    except Exception as e:
        logger.error(f"Error processing single node tagging: {e}")
        logger.exception("Full traceback:")
        
        # Publish failure event if we have enough context
        try:
            extensions = event.get("object", {}).get("definition", {}).get("extensions", {})
            tagging_id = extensions.get("tagging_id")
            if tagging_id:
                # In a real implementation, publish a tagging failure event
                logger.error(f"Auto-tagging {tagging_id} failed: {e}")
        except Exception as publish_error:
            logger.error(f"Failed to publish tagging failure event: {publish_error}")


async def process_batch_tagging(event: Dict[str, Any]):
    """Process a batch auto-tagging started event."""
    try:
        # Extract event details
        actor = event.get("actor", {})
        user_email = actor.get("mbox", "").replace("mailto:", "") if actor.get("mbox") else ""
        user_name = actor.get("name", "Unknown User")
        
        extensions = event.get("object", {}).get("definition", {}).get("extensions", {})
        batch_id = extensions.get("batch_id")
        node_count = extensions.get("node_count", 0)
        strategy = extensions.get("tagging_strategy", "balanced")
        
        if not batch_id:
            logger.error(f"Missing batch_id in event: {event}")
            return
        
        logger.info(f"Starting batch auto-tagging: {batch_id} with {node_count} nodes using {strategy} strategy")
        
        # Initialize auto-tagger service
        tagging_strategy = TaggingStrategy(strategy)
        config = AutoTaggingConfig(strategy=tagging_strategy)
        auto_tagger = NodeAutoTaggerService(config)
        
        start_time = datetime.now()
        event_service = get_xapi_event_service()
        
        # Get candidate nodes for tagging
        candidates = await auto_tagger.get_auto_tagging_candidates(
            limit=node_count,
            exclude_recently_tagged=True,
            min_content_length=20
        )
        
        if not candidates:
            logger.warning(f"No tagging candidates found for batch {batch_id}")
            return
        
        # Extract node IDs from candidates
        node_ids = [uuid.UUID(candidate['node_id']) for candidate in candidates[:node_count]]
        actual_count = len(node_ids)
        
        logger.info(f"Processing {actual_count} nodes for batch {batch_id}")
        
        # Progress tracking
        total_objectives_added = 0
        total_keywords_added = 0
        nodes_processed = 0
        successful_nodes = 0
        
        async def batch_progress_callback(progress: float, processed: int, total: int):
            nonlocal total_objectives_added, total_keywords_added, nodes_processed
            nodes_processed = processed
            
            # Publish progress event
            await event_service.publish_batch_auto_tagging_progress(
                batch_id=batch_id,
                user_id="system",
                progress_percentage=int(progress * 100),
                nodes_processed=processed,
                nodes_total=total,
                total_objectives_added=total_objectives_added,
                total_keywords_added=total_keywords_added
            )
        
        # Process batch with progress tracking
        results = await auto_tagger.auto_tag_batch(
            node_ids=node_ids,
            user_id="system",
            strategy=tagging_strategy,
            progress_callback=batch_progress_callback
        )
        
        # Aggregate results
        for result in results:
            if result.extraction_metadata.get('status') not in ['error', 'empty']:
                successful_nodes += 1
                total_objectives_added += len(result.objectives_added)
                total_keywords_added += len(result.keywords_added)
        
        # Calculate final metrics
        duration_seconds = int((datetime.now() - start_time).total_seconds())
        success_rate = successful_nodes / max(len(results), 1)
        average_confidence = sum(r.confidence_score for r in results) / max(len(results), 1)
        
        # Publish completion event
        await event_service.publish_batch_auto_tagging_completed(
            batch_id=batch_id,
            user_id="system",
            user_email=user_email,
            user_name=user_name,
            nodes_processed=len(results),
            total_objectives_added=total_objectives_added,
            total_keywords_added=total_keywords_added,
            average_confidence=average_confidence,
            duration_seconds=duration_seconds,
            success_rate=success_rate
        )
        
        logger.info(f"Batch auto-tagging completed: {batch_id} processed {len(results)} nodes, success rate: {success_rate:.2f}")
        
    except Exception as e:
        logger.error(f"Error processing batch tagging: {e}")
        logger.exception("Full traceback:")
        
        # Publish failure event if we have enough context
        try:
            extensions = event.get("object", {}).get("definition", {}).get("extensions", {})
            batch_id = extensions.get("batch_id")
            if batch_id:
                # In a real implementation, publish a batch tagging failure event
                logger.error(f"Batch auto-tagging {batch_id} failed: {e}")
        except Exception as publish_error:
            logger.error(f"Failed to publish batch tagging failure event: {publish_error}")


@broker.subscriber("nlj.manual.tagging")
async def handle_manual_tagging_event(event: Dict[str, Any]):
    """
    Handle manual tagging events (tag approvals, rejections, overrides).
    
    This handles events from manual tagging operations like approving
    auto-tag suggestions or manual tag additions/removals.
    """
    try:
        event_type = event.get("event_type")
        
        if not event_type:
            logger.debug("No event_type in manual tagging event, skipping")
            return
        
        logger.info(f"Processing manual tagging event: {event_type}")
        
        if event_type == "tag_suggestion_approved":
            await process_tag_suggestion_approval(event)
        elif event_type == "manual_tag_added":
            await process_manual_tag_addition(event)
        elif event_type == "manual_tag_removed":
            await process_manual_tag_removal(event)
        else:
            logger.debug(f"Ignoring manual tagging event type: {event_type}")
            
    except Exception as e:
        logger.error(f"Error handling manual tagging event: {e}")
        logger.exception("Full traceback:")


async def process_tag_suggestion_approval(event: Dict[str, Any]):
    """Process tag suggestion approval events."""
    try:
        # Extract approval details from event
        extensions = event.get("result", {}).get("extensions", {})
        approved_objectives = extensions.get("approved_objectives", 0)
        approved_keywords = extensions.get("approved_keywords", 0)
        approval_confidence = extensions.get("approval_confidence", 1.0)
        
        # Extract node ID from object
        object_id = event.get("object", {}).get("id", "")
        if "/tag-suggestions" in object_id:
            node_id = object_id.replace("nlj://node/", "").replace("/tag-suggestions", "")
            
            logger.info(f"Tag suggestions approved for node {node_id}: {approved_objectives} objectives, {approved_keywords} keywords")
            
            # Could trigger additional processing like quality metric updates
            # or learning algorithm improvements based on approvals
            
    except Exception as e:
        logger.error(f"Error processing tag suggestion approval: {e}")


async def process_manual_tag_addition(event: Dict[str, Any]):
    """Process manual tag addition events."""
    try:
        # Log manual tag additions for quality analysis
        actor = event.get("actor", {})
        user_name = actor.get("name", "Unknown User")
        
        extensions = event.get("context", {}).get("extensions", {})
        tag_type = extensions.get("tag_type", "unknown")
        tag_count = extensions.get("tag_count", 0)
        
        logger.info(f"Manual tags added by {user_name}: {tag_count} {tag_type} tags")
        
        # Could be used to improve auto-tagging algorithms by learning
        # from manual additions that weren't suggested automatically
        
    except Exception as e:
        logger.error(f"Error processing manual tag addition: {e}")


async def process_manual_tag_removal(event: Dict[str, Any]):
    """Process manual tag removal events."""
    try:
        # Log manual tag removals for quality analysis
        actor = event.get("actor", {})
        user_name = actor.get("name", "Unknown User")
        
        extensions = event.get("context", {}).get("extensions", {})
        tag_type = extensions.get("tag_type", "unknown")
        removal_reason = extensions.get("removal_reason", "unspecified")
        
        logger.info(f"Manual tags removed by {user_name}: {tag_type} tags (reason: {removal_reason})")
        
        # Could be used to identify patterns in auto-tagging that need improvement
        # if certain tags are frequently removed by users
        
    except Exception as e:
        logger.error(f"Error processing manual tag removal: {e}")


# Helper functions for event processing
async def get_node_by_id(node_id: str) -> Node:
    """Get a node by ID with relationships loaded."""
    async with db_manager.get_session() as session:
        stmt = select(Node).options(
            selectinload(Node.learning_objective_relationships),
            selectinload(Node.keyword_relationships)
        ).where(Node.id == uuid.UUID(node_id))
        
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()
        
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        return node


async def publish_tagging_failure_event(tagging_id: str, error_message: str, event_type: str = "auto_tagging_failed"):
    """Publish a tagging failure event."""
    try:
        event_service = get_xapi_event_service()
        
        # Create a generic failure event
        failure_event = {
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "actor": {
                "account": {"homePage": "http://nlj-platform.com", "name": "system"},
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/failed",
                "display": {"en-US": "failed"},
            },
            "object": {
                "id": f"nlj://auto-tagging/{tagging_id}",
                "definition": {
                    "name": {"en-US": "Auto-Tagging Failed"},
                    "type": "http://nlj-platform.com/activitytype/auto-tagging",
                }
            },
            "result": {
                "completion": False,
                "success": False,
                "response": error_message,
                "extensions": {
                    "error_message": error_message,
                    "failure_type": "processing_error"
                }
            },
            "timestamp": datetime.now().isoformat(),
        }
        
        await event_service.kafka.publish_event(
            topic="nlj.auto.tagging",
            event=failure_event,
            key=tagging_id
        )
        
    except Exception as e:
        logger.error(f"Failed to publish tagging failure event: {e}")