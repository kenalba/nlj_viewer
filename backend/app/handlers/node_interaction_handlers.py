"""
FastStream event handlers for node-level interaction tracking.

This module processes xAPI statements with node metadata, enabling
granular analytics on individual learning components while maintaining
backward compatibility with existing activity-based tracking.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from faststream import Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.brokers.kafka_broker import broker
from app.core.database_manager import db_manager
from app.models.node import Node, NodeInteraction
from app.models.user import User
from app.services.elasticsearch_service import get_elasticsearch_service, ElasticsearchService
from app.services.node_service import get_node_service, NodeService

logger = logging.getLogger(__name__)


class NodeXAPIEvent(BaseModel):
    """Enhanced xAPI event with node metadata"""
    id: str
    version: str = "1.0.3"
    timestamp: str
    actor: Dict[str, Any]
    verb: Dict[str, Any]
    object: Dict[str, Any]
    result: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)


async def get_db_session() -> AsyncSession:
    """Get database session for dependency injection"""
    await db_manager.ensure_initialized()
    return db_manager.get_session()


# =========================================================================
# NODE INTERACTION HANDLERS
# =========================================================================

@broker.subscriber("nlj.node.interactions", group_id="nlj-node-analytics")
async def handle_node_interaction_events(
    event: NodeXAPIEvent,
    db: AsyncSession = Depends(get_db_session),
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service),
    node_service: NodeService = Depends(lambda: get_node_service())
) -> None:
    """
    Handle node-level interaction events with dual-write to PostgreSQL and Elasticsearch.
    
    Processes xAPI statements that target individual nodes and tracks:
    - Individual node performance metrics 
    - Learning interaction patterns
    - Content effectiveness analytics
    - User progress through nodes
    """
    try:
        # Extract node ID from object
        node_id_str = _extract_node_id_from_object(event.object)
        if not node_id_str:
            logger.debug(f"Event {event.id} does not target a node - skipping node processing")
            return

        node_id = UUID(node_id_str)
        
        # Get user ID from actor
        user_id = _extract_user_id_from_actor(event.actor)
        
        # Route event based on verb type
        verb_id = event.verb["id"]
        
        if "answered" in verb_id or "responded" in verb_id:
            await _process_node_interaction(event, node_id, user_id, db, node_service)
        elif "experienced" in verb_id or "visited" in verb_id:
            await _process_node_experience(event, node_id, user_id, db, node_service)
        elif "completed" in verb_id:
            await _process_node_completion(event, node_id, user_id, db, node_service)
        elif "skipped" in verb_id:
            await _process_node_skip(event, node_id, user_id, db, node_service)
        else:
            logger.debug(f"Unhandled verb for node analytics: {verb_id}")
        
        # Store enhanced xAPI statement in Elasticsearch with node metadata
        await _store_enhanced_xapi_statement(event, node_id, elasticsearch_service, db)
        
        # Update node performance metrics in PostgreSQL
        await _update_node_performance_metrics(node_id, event, db)
        
        logger.debug(f"Processed node interaction event {event.id} for node {node_id}")
        
    except Exception as e:
        logger.error(f"Error processing node interaction event {event.id}: {e}")
        raise
    finally:
        if db:
            await db.close()


async def _process_node_interaction(
    event: NodeXAPIEvent, 
    node_id: UUID, 
    user_id: Optional[UUID],
    db: AsyncSession,
    node_service: NodeService
) -> None:
    """Process node interaction events (answered, responded)"""
    
    # Extract interaction details
    result = event.result or {}
    response_data = result.get('response', '')
    is_correct = result.get('success', False)
    score = result.get('score', {}).get('raw') if result.get('score') else None
    
    # Calculate time to respond from context extensions
    extensions = event.context.get('extensions', {})
    time_to_respond = extensions.get('http://nlj.platform/extensions/response_time_ms')
    attempts = extensions.get('http://nlj.platform/extensions/attempts', 1)
    
    # Get activity and session info
    activity_id_str = extensions.get('http://nlj.platform/extensions/activity_id')
    activity_id = UUID(activity_id_str) if activity_id_str else None
    session_id = extensions.get('http://nlj.platform/extensions/session_id', event.id)
    
    # Create node interaction record
    interaction = NodeInteraction(
        node_id=node_id,
        user_id=user_id,
        activity_id=activity_id,
        session_id=session_id,
        response_data={
            'response': response_data,
            'event_type': 'answered',
            'xapi_statement_id': event.id
        },
        is_correct=is_correct,
        score=float(score) if score is not None else None,
        time_to_respond=int(time_to_respond) if time_to_respond else None,
        attempts=int(attempts)
    )
    
    db.add(interaction)
    await db.flush()
    
    logger.info(f"Created node interaction: {interaction.id} (node: {node_id}, correct: {is_correct})")


async def _process_node_experience(
    event: NodeXAPIEvent,
    node_id: UUID,
    user_id: Optional[UUID], 
    db: AsyncSession,
    node_service: NodeService
) -> None:
    """Process node experience events (experienced, visited)"""
    
    extensions = event.context.get('extensions', {})
    activity_id_str = extensions.get('http://nlj.platform/extensions/activity_id')
    activity_id = UUID(activity_id_str) if activity_id_str else None
    session_id = extensions.get('http://nlj.platform/extensions/session_id', event.id)
    
    # Create experience tracking record
    interaction = NodeInteraction(
        node_id=node_id,
        user_id=user_id,
        activity_id=activity_id,
        session_id=session_id,
        response_data={
            'event_type': 'experienced',
            'xapi_statement_id': event.id
        },
        is_correct=None,  # Not applicable for experience
        score=None,
        time_to_respond=None,
        attempts=1
    )
    
    db.add(interaction)
    await db.flush()
    
    logger.debug(f"Tracked node experience: {node_id}")


async def _process_node_completion(
    event: NodeXAPIEvent,
    node_id: UUID,
    user_id: Optional[UUID],
    db: AsyncSession, 
    node_service: NodeService
) -> None:
    """Process node completion events"""
    
    result = event.result or {}
    extensions = event.context.get('extensions', {})
    
    # Extract completion details
    completion_score = result.get('score', {}).get('raw') if result.get('score') else None
    time_spent = result.get('duration')  # Milliseconds
    activity_id_str = extensions.get('http://nlj.platform/extensions/activity_id')
    activity_id = UUID(activity_id_str) if activity_id_str else None
    session_id = extensions.get('http://nlj.platform/extensions/session_id', event.id)
    
    # Create completion record
    interaction = NodeInteraction(
        node_id=node_id,
        user_id=user_id,
        activity_id=activity_id,
        session_id=session_id,
        response_data={
            'event_type': 'completed',
            'xapi_statement_id': event.id,
            'completion_data': result
        },
        is_correct=result.get('success', True),
        score=float(completion_score) if completion_score is not None else None,
        time_to_respond=int(time_spent) if time_spent else None,
        attempts=1
    )
    
    db.add(interaction)
    await db.flush()
    
    logger.info(f"Tracked node completion: {node_id} (score: {completion_score})")


async def _process_node_skip(
    event: NodeXAPIEvent,
    node_id: UUID,
    user_id: Optional[UUID],
    db: AsyncSession,
    node_service: NodeService
) -> None:
    """Process node skip events"""
    
    extensions = event.context.get('extensions', {})
    activity_id_str = extensions.get('http://nlj.platform/extensions/activity_id')
    activity_id = UUID(activity_id_str) if activity_id_str else None
    session_id = extensions.get('http://nlj.platform/extensions/session_id', event.id)
    
    # Create skip record
    interaction = NodeInteraction(
        node_id=node_id,
        user_id=user_id,
        activity_id=activity_id,
        session_id=session_id,
        response_data={
            'event_type': 'skipped',
            'xapi_statement_id': event.id
        },
        is_correct=False,
        score=0.0,
        time_to_respond=None,
        attempts=0
    )
    
    db.add(interaction)
    await db.flush()
    
    logger.info(f"Tracked node skip: {node_id}")


async def _store_enhanced_xapi_statement(
    event: NodeXAPIEvent,
    node_id: UUID,
    elasticsearch_service: ElasticsearchService,
    db: AsyncSession
) -> None:
    """Store xAPI statement in Elasticsearch with enhanced node metadata"""
    
    # Get node details for enrichment
    node = await db.get(Node, node_id)
    if not node:
        logger.warning(f"Node {node_id} not found for xAPI enrichment")
        return
    
    # Create enhanced statement
    enhanced_statement = event.dict()
    
    # Add node metadata to object definition extensions
    object_extensions = enhanced_statement.get('object', {}).get('definition', {}).get('extensions', {})
    object_extensions.update({
        'http://nlj.platform/extensions/node_metadata': {
            'node_id': str(node_id),
            'node_type': node.node_type,
            'content_hash': node.content_hash,
            'title': node.title,
            'difficulty_level': node.difficulty_level,
            'success_rate': float(node.success_rate) if node.success_rate else None,
            'avg_completion_time': node.avg_completion_time,
            'created_at': node.created_at.isoformat() if node.created_at else None
        },
        'http://nlj.platform/extensions/performance_context': {
            'node_historical_success_rate': float(node.success_rate) if node.success_rate else None,
            'node_difficulty_score': float(node.difficulty_score) if node.difficulty_score else None,
            'node_engagement_score': float(node.engagement_score) if node.engagement_score else None
        }
    })
    
    # Ensure the nested structure exists
    if 'object' not in enhanced_statement:
        enhanced_statement['object'] = {}
    if 'definition' not in enhanced_statement['object']:
        enhanced_statement['object']['definition'] = {}
    enhanced_statement['object']['definition']['extensions'] = object_extensions
    
    # Store in Elasticsearch with node-specific routing
    await elasticsearch_service.store_xapi_statement(enhanced_statement, index_suffix=f'node-{node_id}')


async def _update_node_performance_metrics(
    node_id: UUID,
    event: NodeXAPIEvent, 
    db: AsyncSession
) -> None:
    """Update aggregated performance metrics for the node"""
    
    try:
        # Get current node
        node = await db.get(Node, node_id)
        if not node:
            logger.warning(f"Node {node_id} not found for performance update")
            return
        
        # Extract performance data
        result = event.result or {}
        is_correct = result.get('success', False)
        response_time = event.context.get('extensions', {}).get('http://nlj.platform/extensions/response_time_ms')
        
        # Simple incremental updates (real implementation would use more sophisticated aggregation)
        if is_correct is not None:
            # Update success rate (simplified - should use proper statistical aggregation)
            current_success_rate = node.success_rate or 0.0
            # This is a simplified update - real implementation would track total attempts
            node.success_rate = (current_success_rate + (1.0 if is_correct else 0.0)) / 2.0
        
        if response_time is not None:
            # Update average completion time
            current_avg = node.avg_completion_time or 0
            node.avg_completion_time = (current_avg + int(response_time)) // 2 if current_avg > 0 else int(response_time)
        
        # Update timestamp
        node.updated_at = datetime.utcnow()
        
        await db.flush()
        logger.debug(f"Updated performance metrics for node {node_id}")
        
    except Exception as e:
        logger.error(f"Failed to update node performance metrics for {node_id}: {e}")


def _extract_node_id_from_object(obj: Dict[str, Any]) -> Optional[str]:
    """Extract node ID from xAPI object, supporting multiple formats"""
    
    # Check for node:// URI format
    object_id = obj.get('id', '')
    if object_id.startswith('node://'):
        return object_id.replace('node://', '')
    
    # Check for extensions
    definition = obj.get('definition', {})
    extensions = definition.get('extensions', {})
    
    # Look for node metadata in extensions
    node_metadata = extensions.get('http://nlj.platform/extensions/node_metadata', {})
    if node_metadata.get('node_id'):
        return node_metadata['node_id']
    
    # Look for node ID directly in extensions
    node_id = extensions.get('http://nlj.platform/extensions/node_id')
    if node_id:
        return node_id
    
    # Check if object ID looks like a UUID that might be a node ID
    try:
        UUID(object_id)
        # If it's a valid UUID, assume it might be a node ID
        # Real implementation might want additional validation
        return object_id
    except ValueError:
        pass
    
    return None


def _extract_user_id_from_actor(actor: Dict[str, Any]) -> Optional[UUID]:
    """Extract user ID from xAPI actor"""
    
    try:
        # Check account name first
        account = actor.get('account', {})
        if account.get('name'):
            return UUID(account['name'])
        
        # Check mbox for email-based identification
        mbox = actor.get('mbox', '')
        if mbox.startswith('mailto:'):
            # This would need to be mapped to a user ID
            # For now, return None and let the system handle anonymous tracking
            pass
        
        return None
        
    except (ValueError, TypeError):
        return None


logger.info("Node interaction event handlers registered with FastStream")