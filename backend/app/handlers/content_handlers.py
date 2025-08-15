"""
FastStream event handlers for content generation events.
Converts existing content generation event handlers to FastStream subscribers.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import UUID

from faststream import Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.brokers.kafka_broker import broker
from app.core.database_manager import db_manager
from app.models.generation_session import GenerationSession, GenerationStatus
from app.models.source_document import SourceDocument
from app.services.claude_service import claude_service
from app.services.elasticsearch_service import get_elasticsearch_service, ElasticsearchService

logger = logging.getLogger(__name__)


class XAPIEvent(BaseModel):
    """Base xAPI event structure for validation"""
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
# CONTENT GENERATION HANDLERS
# =========================================================================

@broker.subscriber("nlj.content.generation", group_id="nlj-content-generation")
async def handle_content_generation_events(
    event: XAPIEvent,
    db: AsyncSession = Depends(get_db_session),
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> None:
    """Handle content generation pipeline events"""
    
    try:
        verb_id = event.verb["id"]
        extensions = event.context.get("extensions", {})
        generation_status = extensions.get("http://nlj.platform/extensions/generation_status")
        
        # Route based on generation status rather than verb
        if generation_status == "requested":
            await _process_generation_requested(event, db)
        elif generation_status == "started":
            await _process_generation_started(event, db)
        elif generation_status == "progress":
            await _process_generation_progress(event, db)
        elif generation_status == "completed":
            await _process_generation_completed(event, db)
        elif generation_status == "failed":
            await _process_generation_failed(event, db)
        elif generation_status == "modified":
            await _process_generation_modified(event, db)
        elif generation_status == "imported":
            await _process_generation_imported(event, db)
        elif generation_status == "reviewed":
            await _process_generation_reviewed(event, db)
        else:
            logger.warning(f"Unhandled generation status: {generation_status}")
            return
        
        # Store xAPI statement for analytics
        await elasticsearch_service.store_xapi_statement(event.dict())
        
        logger.info(f"Content generation event {event.id} ({generation_status}): success")
        
    except Exception as e:
        logger.error(f"Error processing content generation event {event.id}: {e}")
        raise
    finally:
        if db:
            await db.close()


async def _process_generation_requested(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.requested event - create generation session"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    user_id = UUID(event.actor["account"]["name"])
    
    # Get source documents from extensions
    source_doc_ids = extensions.get("http://nlj.platform/extensions/source_documents", [])
    source_documents = []
    
    if source_doc_ids:
        for doc_id in source_doc_ids:
            doc = await db.get(SourceDocument, UUID(doc_id))
            if doc:
                source_documents.append(doc)
    
    # Create generation session
    generation_session = GenerationSession(
        id=session_id,
        user_id=user_id,
        status=GenerationStatus.REQUESTED,
        prompt_text=extensions.get("http://nlj.platform/extensions/prompt_text", ""),
        generation_type=extensions.get("http://nlj.platform/extensions/generation_type", "scenario"),
        source_documents=source_documents,
        created_at=datetime.now(timezone.utc),
    )
    
    db.add(generation_session)
    await db.commit()
    
    logger.info(f"Created generation session: {session_id}")


async def _process_generation_started(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.started event - update session status"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    
    # Update session status
    session = await db.get(GenerationSession, session_id)
    if session:
        session.status = GenerationStatus.IN_PROGRESS
        session.started_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(f"Started generation session: {session_id}")
    else:
        logger.error(f"Generation session not found: {session_id}")


async def _process_generation_progress(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.progress event - update progress"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    progress = extensions.get("http://nlj.platform/extensions/progress", 0)
    
    # Update session progress
    session = await db.get(GenerationSession, session_id)
    if session:
        session.progress = progress
        session.last_updated = datetime.now(timezone.utc)
        
        # Store progress message if provided
        progress_message = extensions.get("http://nlj.platform/extensions/progress_message")
        if progress_message:
            session.progress_messages = session.progress_messages or []
            session.progress_messages.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": progress_message
            })
        
        await db.commit()
        logger.info(f"Updated generation progress: {session_id} - {progress}%")
    else:
        logger.error(f"Generation session not found: {session_id}")


async def _process_generation_completed(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.completed event - finalize session"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    
    # Update session status and store results
    session = await db.get(GenerationSession, session_id)
    if session:
        session.status = GenerationStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)
        session.progress = 100
        
        # Store generated content
        generated_content = extensions.get("http://nlj.platform/extensions/generated_content")
        if generated_content:
            session.generated_content = generated_content
        
        # Store content metadata
        content_metadata = extensions.get("http://nlj.platform/extensions/content_metadata", {})
        session.result_metadata = content_metadata
        
        await db.commit()
        logger.info(f"Completed generation session: {session_id}")
    else:
        logger.error(f"Generation session not found: {session_id}")


async def _process_generation_failed(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.failed event - handle failure"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    error_message = extensions.get("http://nlj.platform/extensions/error_message", "Unknown error")
    
    # Update session status with error
    session = await db.get(GenerationSession, session_id)
    if session:
        session.status = GenerationStatus.FAILED
        session.failed_at = datetime.now(timezone.utc)
        session.error_message = error_message
        
        await db.commit()
        logger.error(f"Generation session failed: {session_id} - {error_message}")
    else:
        logger.error(f"Generation session not found: {session_id}")


async def _process_generation_modified(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.modified event - track modifications"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    modification_type = extensions.get("http://nlj.platform/extensions/modification_type", "edited")
    
    # Update session with modification info
    session = await db.get(GenerationSession, session_id)
    if session:
        session.last_updated = datetime.now(timezone.utc)
        
        # Track modification history
        if not session.modification_history:
            session.modification_history = []
        
        session.modification_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": modification_type,
            "user_id": event.actor["account"]["name"]
        })
        
        await db.commit()
        logger.info(f"Tracked modification: {session_id} - {modification_type}")
    else:
        logger.error(f"Generation session not found: {session_id}")


async def _process_generation_imported(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.imported event - handle import actions"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    import_target = extensions.get("http://nlj.platform/extensions/import_target", "flow_editor")
    
    # Update session with import info
    session = await db.get(GenerationSession, session_id)
    if session:
        session.last_updated = datetime.now(timezone.utc)
        
        # Track import actions
        if not session.import_history:
            session.import_history = []
        
        session.import_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target": import_target,
            "user_id": event.actor["account"]["name"]
        })
        
        await db.commit()
        logger.info(f"Tracked import: {session_id} - {import_target}")
    else:
        logger.error(f"Generation session not found: {session_id}")


async def _process_generation_reviewed(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.reviewed event - handle review actions"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    review_action = extensions.get("http://nlj.platform/extensions/review_action", "reviewed")
    review_comments = extensions.get("http://nlj.platform/extensions/review_comments", "")
    
    # Update session with review info
    session = await db.get(GenerationSession, session_id)
    if session:
        session.last_updated = datetime.now(timezone.utc)
        
        # Track review actions
        if not session.review_history:
            session.review_history = []
        
        session.review_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": review_action,
            "comments": review_comments,
            "reviewer_id": event.actor["account"]["name"]
        })
        
        await db.commit()
        logger.info(f"Tracked review: {session_id} - {review_action}")
    else:
        logger.error(f"Generation session not found: {session_id}")


logger.info("Content generation event handlers registered with FastStream")