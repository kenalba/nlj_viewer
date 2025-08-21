"""
FastStream event handlers for content generation events.
Converts existing content generation event handlers to FastStream subscribers.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import UUID, uuid4

from faststream import Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.brokers.kafka_broker import broker
from app.core.database_manager import db_manager
from app.models.generation_session import GenerationSession, GenerationStatus
from app.models.source_document import SourceDocument
from app.services.claude_service import claude_service
from app.services.elasticsearch_service import get_elasticsearch_service, ElasticsearchService
from app.models.content import ContentItem
from app.utils.node_extractor import NodeExtractor

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
        elif generation_status == "progress" or generation_status == "progressing":
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
        logger.error(f"Event details: status={generation_status}, verb={verb_id}")
        logger.error(f"Exception type: {type(e).__name__}")
        logger.error(f"Exception details: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise
    finally:
        if db:
            await db.close()


async def _process_generation_requested(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.requested event - ensure generation session exists and start processing"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    user_id = UUID(event.actor["account"]["name"])
    
    # Check if session already exists (created by the API)
    session = await db.get(GenerationSession, session_id)
    
    if not session:
        # Create session if it doesn't exist (fallback case)
        logger.info(f"Creating new generation session: {session_id}")
        
        # Get source documents from extensions
        source_doc_ids = extensions.get("http://nlj.platform/extensions/source_documents", [])
        source_documents = []
        
        if source_doc_ids:
            for doc_id in source_doc_ids:
                doc = await db.get(SourceDocument, UUID(doc_id))
                if doc:
                    source_documents.append(doc)
        
        # Create generation session with proper field mapping
        prompt_config = {
            "generated_prompt_text": extensions.get("http://nlj.platform/extensions/prompt_text", ""),
            "generation_type": extensions.get("http://nlj.platform/extensions/generation_type", "scenario"),
            "source_documents": source_documents or [],
        }
        
        session = GenerationSession(
            id=session_id,
            user_id=user_id,
            status=GenerationStatus.PENDING,
            prompt_config=prompt_config,
        )
        
        # Associate source documents with the session
        if source_documents:
            session.source_documents = source_documents
        
        db.add(session)
        await db.commit()
        logger.info(f"Created generation session: {session_id}")
    else:
        logger.info(f"Generation session already exists: {session_id}")
    
    # Now publish the "started" event to begin actual generation
    from app.services.events import get_event_service
    from app.models.user import User
    
    event_service = await get_event_service()
    user = await db.get(User, user_id)
    
    if user:
        await event_service.publish_content_generation_started(
            session_id=str(session_id),
            user_id=str(user_id),
            user_email=user.email,
            user_name=user.full_name or user.username,
            content_type=session.prompt_config.get("generation_type", "scenario"),
        )


async def _process_generation_started(event: XAPIEvent, db: AsyncSession) -> None:
    """Process content.generation.started event - begin actual Claude API generation"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    
    # Update session status and begin actual generation
    session = await db.get(GenerationSession, session_id)
    if session:
        # Set up logging context for the session
        from app.utils.logging_context import with_session_context, get_session_logger
        from app.models.user import User
        
        user = await db.get(User, session.user_id)
        user_email = user.email if user else "unknown"
        
        with with_session_context(
            session_id=str(session_id),
            user_id=str(session.user_id),
            user_email=user_email,
            operation="faststream_generation",
            event_type="generation_started"
        ):
            session_logger = get_session_logger(__name__)
            
            session.status = GenerationStatus.PROCESSING
            session.started_at = datetime.now(timezone.utc)
            await db.commit()
            
            session_logger.info("🚀 Starting Claude API content generation")
            
            # Perform the actual Claude API generation (from event_consumers.py logic)
            try:
                await _perform_claude_content_generation(session, db)
            except Exception as e:
                from app.utils.logging_context import log_error_with_context
                log_error_with_context(session_logger, e, "claude_generation", session_id=str(session_id))
                
                session.status = GenerationStatus.FAILED
                session.error_message = str(e)
                await db.commit()
                
                # Publish failure event
                from app.services.events import get_event_service
                event_service = await get_event_service()
                
                if user:
                    await event_service.publish_content_generation_failed(
                        session_id=str(session.id),
                        user_id=str(user.id),
                        user_email=user.email,
                        user_name=user.full_name or user.username,
                        error_message=str(e),
                        error_type="generation_error"
                    )
        
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


async def _perform_claude_content_generation(session: GenerationSession, db: AsyncSession) -> None:
    """Perform the actual content generation using Claude API (ported from event_consumers.py)"""
    
    logger.info(f"🚀 STARTING Claude content generation for session {session.id}")
    logger.info(f"  - Session user ID: {session.user_id}")
    logger.info(f"  - Session status: {session.status}")
    logger.info(f"  - Session prompt config keys: {list(session.prompt_config.keys()) if session.prompt_config else []}")
    logger.info(f"  - Session created at: {session.created_at}")
    
    try:
        # Publish progress event
        logger.info(f"📡 Publishing progress event: 25% - Preparing documents...")
        await _publish_progress_event(str(session.id), session.user_id, 25, "Preparing documents...", db)

        # Get source documents through the relationship
        from app.models.generation_session import generation_session_sources
        from sqlalchemy import select

        stmt = (
            select(SourceDocument)
            .join(
                generation_session_sources,
                SourceDocument.id == generation_session_sources.c.source_document_id,
            )
            .where(generation_session_sources.c.generation_session_id == session.id)
        )
        result = await db.execute(stmt)
        source_docs = result.scalars().all()

        logger.info(f"Found {len(source_docs)} source documents for session {session.id}")
        
        # Prepare Claude API call with source documents
        file_ids = []
        for doc in source_docs:
            logger.info(f"Source doc: {doc.original_filename}, Claude ID: {doc.claude_file_id}, Size: {doc.file_size}")
            if doc.claude_file_id:
                file_ids.append(doc.claude_file_id)
                logger.info(f"✅ Added source document {doc.original_filename} (Claude ID: {doc.claude_file_id})")
            else:
                logger.warning(f"⚠️ Source document {doc.original_filename} has no Claude file ID")

        if not file_ids:
            logger.error(f"❌ No Claude file IDs found in {len(source_docs)} source documents")
            for doc in source_docs:
                logger.error(f"  - {doc.original_filename}: claude_file_id={doc.claude_file_id}")
            raise ValueError("No Claude file IDs found in source documents")

        # Publish progress event
        logger.info(f"📡 Publishing progress event: 50% - Generating content with Claude API...")
        await _publish_progress_event(str(session.id), session.user_id, 50, "Generating content with Claude API...", db)

        # Extract prompt from session config
        prompt_config = session.prompt_config or {}
        generated_prompt = prompt_config.get("generated_prompt_text", "")

        logger.info(f"📝 Extracted prompt configuration:")
        logger.info(f"  - Prompt config available: {bool(prompt_config)}")
        logger.info(f"  - Generated prompt available: {bool(generated_prompt)}")
        logger.info(f"  - Generated prompt length: {len(generated_prompt)} characters")

        if not generated_prompt:
            logger.error(f"❌ No generated prompt text found in session config")
            logger.error(f"  - Available prompt config keys: {list(prompt_config.keys())}")
            raise ValueError("No generated prompt text found in session config")

        # Call Claude API for content generation
        import time
        start_time = time.time()

        logger.info(f"🤖 Preparing Claude API call for content generation:")
        logger.info(f"  - Model: claude-sonnet-4-20250514")
        logger.info(f"  - Max tokens: 8192")
        logger.info(f"  - Temperature: 0.1")
        logger.info(f"  - File IDs: {file_ids}")
        logger.info(f"  - Prompt length: {len(generated_prompt)} characters")
        logger.info(f"  - Prompt preview (first 500 chars): {generated_prompt[:500]}...")
        
        logger.info(f"🔄 Making Claude API call...")
        generated_content, error_message, tokens_used = await claude_service.generate_content(
            prompt_text=generated_prompt,
            file_ids=file_ids,
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            temperature=0.1,
        )
        
        logger.info(f"🤖 Claude API response received:")
        logger.info(f"  - Tokens used: {tokens_used}")
        logger.info(f"  - Error message: {error_message}")
        logger.info(f"  - Generated content type: {type(generated_content)}")
        logger.info(f"  - Generated content length: {len(str(generated_content)) if generated_content else 0}")
        if generated_content:
            logger.info(f"  - Generated content preview (first 1000 chars): {str(generated_content)[:1000]}...")
        else:
            logger.warning(f"  - Generated content is None or empty!")

        generation_time = time.time() - start_time
        logger.info(f"⏱️ Generation completed in {generation_time:.2f} seconds")

        if error_message or not generated_content:
            logger.error(f"❌ Claude generation failed:")
            logger.error(f"  - Error message: {error_message}")
            logger.error(f"  - Generated content exists: {bool(generated_content)}")
            raise ValueError(f"Claude API generation failed: {error_message or 'No content generated'}")

        # Publish progress event
        await _publish_progress_event(str(session.id), session.user_id, 75, "Validating generated content...", db)

        # Store the Claude response for Use Case processing
        logger.info(f"✅ Claude generation completed successfully")
        logger.info(f"  - Generated content type: {type(generated_content)}")
        logger.info(f"  - Generated content keys (if dict): {list(generated_content.keys()) if isinstance(generated_content, dict) else 'N/A'}")
        
        # Note: JSON extraction and NLJ validation now happens in the Use Case layer
        # The handler just stores the raw Claude response for later processing

        # Update session with completed status and raw Claude response
        logger.info(f"💾 Updating session with completed status and generated content...")
        session.status = GenerationStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)
        
        # Store the complete Claude response for Use Case processing
        # The generated_content field will contain everything needed for JSON extraction and validation
        session.generated_content = generated_content
        session.total_tokens_used = tokens_used
        session.generation_time_seconds = generation_time

        logger.info(f"💾 Committing session changes to database...")
        await db.commit()
        logger.info(f"✅ Session successfully committed to database")

        logger.info(f"🎉 Content generation completed for session {session.id}:")
        logger.info(f"  - Tokens used: {tokens_used}")
        logger.info(f"  - Generation time: {generation_time:.2f}s")
        logger.info(f"  - Session status: {session.status}")
        logger.info(f"  - Generated content type: {type(session.generated_content)}")
        logger.info(f"  - Generated content keys: {list(session.generated_content.keys()) if isinstance(session.generated_content, dict) else 'N/A'}")

        # Extract nodes from generated content and create activity
        await _extract_nodes_and_create_activity(session, db)

        # Publish completion event
        await _publish_completion_event(str(session.id), session.user_id, db)

    except Exception as e:
        logger.error(f"💥 Content generation failed for session {session.id}: {e}")
        logger.error(f"  - Error type: {type(e).__name__}")
        logger.error(f"  - Error details: {str(e)}")
        import traceback
        logger.error(f"  - Full traceback: {traceback.format_exc()}")
        
        # Update session with detailed error information
        session.status = GenerationStatus.FAILED
        session.completed_at = datetime.now(timezone.utc)
        session.error_message = f"{type(e).__name__}: {str(e)}"
        
        # Add more detailed error context for specific error types
        if "Claude API" in str(e):
            session.error_message = f"Claude API Error: {str(e)}"
        elif "500" in str(e) or "Internal server error" in str(e):
            session.error_message = f"Claude Server Error (500): {str(e)}. This is likely temporary - please retry."
        elif "file" in str(e).lower() and "not found" in str(e).lower():
            session.error_message = f"Source Document Error: {str(e)}. Please re-upload your source documents."
        elif "prompt" in str(e).lower():
            session.error_message = f"Prompt Configuration Error: {str(e)}. Please check your generation settings."
        
        logger.info(f"💾 Updating session {session.id} with error status: {session.error_message}")
        await db.commit()
        
        # Publish failure event
        logger.info(f"📡 Publishing failure event for session {session.id}")
        await _publish_failure_event(str(session.id), session.user_id, session.error_message, db)
        
        # Don't re-raise - we want the handler to complete successfully after recording the error
        logger.info(f"❌ Session {session.id} marked as failed, handler completing")


async def _publish_progress_event(session_id: str, user_id: UUID, progress: int, step: str, db: AsyncSession) -> None:
    """Publish content generation progress event"""
    try:
        from app.services.events import get_event_service
        from app.models.user import User
        
        event_service = await get_event_service()
        user = await db.get(User, user_id)
        
        if user:
            await event_service.publish_content_generation_progress(
                session_id=session_id,
                user_id=str(user_id),
                user_email=user.email,
                user_name=user.full_name or user.username,
                progress_percentage=progress,
                current_step=step,
            )
    except Exception as e:
        logger.error(f"Failed to publish progress event: {e}")


async def _publish_completion_event(session_id: str, user_id: UUID, db: AsyncSession) -> None:
    """Publish content generation completed event"""
    try:
        from app.services.events import get_event_service
        from app.models.user import User
        
        event_service = await get_event_service()
        user = await db.get(User, user_id)
        
        if user:
            await event_service.publish_content_generation_completed(
                session_id=session_id,
                user_id=str(user_id),
                user_email=user.email,
                user_name=user.full_name or user.username,
            )
    except Exception as e:
        logger.error(f"Failed to publish completion event: {e}")


async def _publish_failure_event(session_id: str, user_id: UUID, error: str, db: AsyncSession) -> None:
    """Publish content generation failed event"""
    try:
        from app.services.events import get_event_service
        from app.models.user import User
        
        event_service = await get_event_service()
        user = await db.get(User, user_id)
        
        if user:
            await event_service.publish_content_generation_failed(
                session_id=session_id,
                user_id=str(user_id),
                user_email=user.email,
                user_name=user.full_name or user.username,
                error_message=error,
                error_type="generation_error",
            )
    except Exception as e:
        logger.error(f"Failed to publish failure event: {e}")


async def _extract_nodes_and_create_activity(session: GenerationSession, db: AsyncSession) -> None:
    """Create activity from generation session using Use Case pattern."""
    try:
        if not session.generated_content:
            logger.warning(f"No generated content available for session {session.id}")
            return

        logger.info(f"🔄 Using Create Activity From Generation Use Case for session {session.id}")
        
        # Use the proper Use Case for creating activity from generation
        from app.services.use_cases.content.create_activity_from_generation_use_case import (
            CreateActivityFromGenerationUseCase,
            CreateActivityFromGenerationRequest
        )
        from app.services.orm_services.content_orm_service import ContentOrmService
        from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
        
        # Initialize ORM services
        content_orm_service = ContentOrmService(db)
        generation_session_orm_service = GenerationSessionOrmService(db)
        
        # Create Use Case instance
        use_case = CreateActivityFromGenerationUseCase(
            session=db,
            generation_session_orm_service=generation_session_orm_service,
            content_orm_service=content_orm_service
        )
        
        # Create request
        request = CreateActivityFromGenerationRequest(
            session_id=session.id,
            activity_title=f"Generated Activity - {session.created_at.strftime('%m/%d/%Y')}",
            activity_description="AI-generated learning activity",
            add_generation_metadata=True
        )
        
        # User context for the session owner
        user_context = {
            "user_id": str(session.user_id),
            "user_role": None  # Will be looked up by Use Case if needed
        }
        
        # Execute the Use Case
        response = await use_case.execute(request, user_context)
        
        if response.creation_successful:
            logger.info(f"✅ Activity {response.activity.id} created successfully from session {session.id}")
            logger.info(f"  - Data quality: {response.generation_data_quality}")
            logger.info(f"  - Validation warnings: {len(response.validation_warnings)}")
            
            # Extract nodes using NodeExtractor if activity was created
            if response.activity and hasattr(response.activity, 'id'):
                # Get the actual ContentItem from the database
                content_item = await db.get(ContentItem, response.activity.id)
                if content_item:
                    node_extractor = NodeExtractor(db)
                    extracted_pairs = await node_extractor.extract_from_activity(
                        activity=content_item,
                        default_creator=session.user_id
                    )
                    
                    logger.info(f"Extracted {len(extracted_pairs)} nodes from generated content")
                    
                    # Trigger auto-tagging for the newly created nodes
                    if extracted_pairs:
                        node_ids = [str(node.id) for node, _ in extracted_pairs]
                        await _trigger_auto_tagging_for_nodes(
                            node_ids=node_ids,
                            session=session,
                            db=db
                        )
        else:
            logger.error(f"❌ Failed to create activity from session {session.id}")
            
    except Exception as e:
        logger.error(f"Failed to extract nodes and create activity for session {session.id}: {e}")
        logger.error(f"  - Error type: {type(e).__name__}")
        logger.error(f"  - Error details: {str(e)}")
        import traceback
        logger.error(f"  - Traceback: {traceback.format_exc()}")
        # Don't re-raise - we don't want to fail the entire generation process
        # if activity creation fails


async def _trigger_auto_tagging_for_nodes(
    node_ids: list[str], 
    session: GenerationSession, 
    db: AsyncSession
) -> None:
    """Trigger auto-tagging for newly created nodes using generation context."""
    try:
        from app.services.events import get_event_service
        from app.models.user import User
        
        # Get user details for event publishing
        user = await db.get(User, session.user_id)
        if not user:
            logger.warning(f"User {session.user_id} not found for auto-tagging")
            return
            
        # Get event service to publish auto-tagging events
        event_service = await get_event_service()
        
        # Trigger auto-tagging for each node
        for node_id in node_ids:
            tagging_id = str(uuid4())
            
            # Use generation context to inform tagging strategy
            # If source documents were used, use comprehensive strategy
            # If generation has custom keywords/objectives, use balanced strategy
            
            # Get source documents count safely without triggering lazy loading
            from app.models.generation_session import generation_session_sources
            from sqlalchemy import select, func
            
            stmt = select(func.count()).select_from(generation_session_sources).where(
                generation_session_sources.c.generation_session_id == session.id
            )
            result = await db.execute(stmt)
            source_doc_count = result.scalar() or 0
            
            strategy = "COMPREHENSIVE" if source_doc_count > 0 else "BALANCED"
            
            # Extract candidate tags from source documents and generation context
            candidate_tags = await _extract_candidate_tags_from_session(session, db)
            
            await event_service.publish_auto_tagging_started(
                tagging_id=tagging_id,
                node_id=node_id,
                user_id=str(user.id),
                user_email=user.email,
                user_name=user.full_name or user.username,
                strategy=strategy,
                candidate_keywords=candidate_tags.get("keywords", []),
                candidate_objectives=candidate_tags.get("objectives", [])
            )
            
        logger.info(f"Triggered auto-tagging for {len(node_ids)} nodes with {strategy} strategy")
        
    except Exception as e:
        logger.error(f"Failed to trigger auto-tagging for nodes: {e}")
        # Don't re-raise - auto-tagging failure shouldn't break content generation


async def _extract_candidate_tags_from_session(session: GenerationSession, db: AsyncSession) -> dict[str, list[str]]:
    """Extract candidate tags from generation session context for auto-tagging disambiguation."""
    candidate_tags = {"keywords": [], "objectives": []}
    
    try:
        # Extract from source document metadata - get documents via proper query to avoid lazy loading
        from app.models.generation_session import generation_session_sources
        from app.models.source_document import SourceDocument
        from sqlalchemy import select
        
        stmt = (
            select(SourceDocument)
            .join(
                generation_session_sources,
                SourceDocument.id == generation_session_sources.c.source_document_id,
            )
            .where(generation_session_sources.c.generation_session_id == session.id)
        )
        result = await db.execute(stmt)
        source_docs = result.scalars().all()
        
        for source_doc in source_docs:
            # Extract keywords directly from source document fields
            if source_doc.keywords:
                candidate_tags["keywords"].extend(source_doc.keywords)
            
            # Extract learning objectives directly from source document fields
            if source_doc.learning_objectives:
                candidate_tags["objectives"].extend(source_doc.learning_objectives)
            
            # Extract from summary or description
            summary = source_doc.summary or source_doc.description or ""
            if summary:
                # Simple keyword extraction from summary
                import re
                words = re.findall(r'\b[a-zA-Z]{4,}\b', summary.lower())
                # Filter out common words and keep domain-specific terms
                domain_words = [w for w in words if w not in {
                    'that', 'this', 'with', 'will', 'from', 'they', 'have', 
                    'been', 'were', 'said', 'each', 'which', 'their', 'time',
                    'would', 'there', 'could', 'other', 'after', 'first',
                    'well', 'also', 'some', 'what', 'then', 'them', 'into'
                }]
                candidate_tags["keywords"].extend(domain_words[:5])  # Top 5 terms
        
        # Extract from generation prompt configuration
        prompt_config = session.prompt_config or {}
        
        # Look for explicit keywords in the prompt config
        if "keywords" in prompt_config:
            keywords = prompt_config["keywords"]
            if isinstance(keywords, list):
                candidate_tags["keywords"].extend(keywords)
            elif isinstance(keywords, str):
                candidate_tags["keywords"].extend(keywords.split(","))
        
        # Look for learning objectives in the prompt config  
        if "learning_objectives" in prompt_config:
            objectives = prompt_config["learning_objectives"]
            if isinstance(objectives, list):
                candidate_tags["objectives"].extend(objectives)
            elif isinstance(objectives, str):
                candidate_tags["objectives"].extend([obj.strip() for obj in objectives.split(";")])
        
        # Remove duplicates and empty strings
        candidate_tags["keywords"] = list(set(tag.strip() for tag in candidate_tags["keywords"] if tag.strip()))
        candidate_tags["objectives"] = list(set(tag.strip() for tag in candidate_tags["objectives"] if tag.strip()))
        
        logger.info(f"Extracted {len(candidate_tags['keywords'])} candidate keywords and {len(candidate_tags['objectives'])} candidate objectives from session {session.id}")
        
    except Exception as e:
        logger.error(f"Failed to extract candidate tags from session {session.id}: {e}")
    
    return candidate_tags


logger.info("Content generation event handlers registered with FastStream")