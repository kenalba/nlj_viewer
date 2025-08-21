"""
Start Generation Use Case - Generation Session Initiation Workflow.

Handles starting pending generation sessions with event publishing:
- Validation of session state and permissions
- Status transition from PENDING to PROCESSING
- Event publishing for generation workflow tracking
- Source document and configuration validation
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generation_session import GenerationStatus
from app.models.user import UserRole
from app.schemas.services.generation_schemas import GenerationSessionServiceSchema
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class StartGenerationRequest:
    """Request object for starting generation operations."""
    session_id: UUID
    force_restart: bool = False  # Allow restarting failed sessions


@dataclass
class StartGenerationResponse:
    """Response object for starting generation operations."""
    session: GenerationSessionServiceSchema
    generation_started: bool
    previous_status: GenerationStatus
    source_document_ids: List[str]
    event_published: bool


class StartGenerationUseCase(BaseUseCase[StartGenerationRequest, StartGenerationResponse]):
    """
    Use case for starting generation sessions with proper state management.

    Responsibilities:
    - Validate session exists and user has permission to start it
    - Validate session is in a state that can be started (PENDING or FAILED if force_restart)
    - Transition session status to PROCESSING with metadata
    - Publish generation start events for workflow tracking
    - Return updated session information

    Events Published:
    - Generation session started events for workflow orchestration
    - xAPI events for learning analytics tracking
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService
    ) -> None:
        """
        Initialize start generation use case.

        Args:
            session: Database session for transaction management
            generation_session_orm_service: Generation session data access service
        """
        super().__init__(
            session,
            generation_session_orm_service=generation_session_orm_service
        )

    async def execute(
        self,
        request: StartGenerationRequest,
        user_context: Dict[str, Any]
    ) -> StartGenerationResponse:
        """
        Execute generation session start workflow.

        Args:
            request: Start request with session ID and options
            user_context: Current user context for permissions

        Returns:
            Generation start response with updated session info

        Raises:
            PermissionError: If user lacks permission to start session
            ValueError: If session not found or cannot be started
            RuntimeError: If generation start fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get and validate session
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            session = await generation_orm_service.get_by_id(request.session_id)

            if not session:
                raise ValueError(f"Generation session not found: {request.session_id}")

            # Store original status
            previous_status = session.status

            # Validate start permissions and session state
            await self._validate_start_permissions(
                current_user_id, current_user_role, session
            )
            self._validate_session_for_start(session, request.force_restart)

            # Start the generation session
            started_session = await self._start_generation_session(
                session, user_context
            )

            # Extract source document IDs for event publishing
            source_document_ids = self._extract_source_document_ids(started_session)

            # Create response
            session_schema = GenerationSessionServiceSchema.from_orm_model(started_session)
            
            response = StartGenerationResponse(
                session=session_schema,
                generation_started=True,
                previous_status=previous_status,
                source_document_ids=source_document_ids,
                event_published=False  # Will be set after successful event publishing
            )

            # Publish generation start events
            try:
                await self._publish_generation_start_events(request, user_context, response)
                response.event_published = True
            except Exception as e:
                logger.warning(f"Failed to publish generation start events: {e}")

            logger.info(
                f"Generation session started: {request.session_id} by user {current_user_id}, "
                f"previous status: {previous_status.value if hasattr(previous_status, 'value') else previous_status}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"start generation session {request.session_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"start generation session {request.session_id}")
            raise

    async def _validate_start_permissions(
        self,
        current_user_id: UUID,
        current_user_role: Optional[UserRole],
        session: Any
    ) -> None:
        """Validate user has permission to start this session."""
        # Users can start their own sessions
        if hasattr(session, 'user_id') and session.user_id == current_user_id:
            return

        # Admins can start any session
        if current_user_role == UserRole.ADMIN:
            return

        raise PermissionError("Not authorized to start this generation session")

    def _validate_session_for_start(self, session: Any, force_restart: bool) -> None:
        """Validate session can be started based on current state."""
        if session.status == GenerationStatus.PENDING:
            # Normal case - session is ready to start
            return
        
        if force_restart and session.status == GenerationStatus.FAILED:
            # Allow restarting failed sessions if force_restart is enabled
            return
        
        # Check for already running/completed sessions
        if session.status == GenerationStatus.PROCESSING:
            raise ValueError("Generation session is already processing")
        
        if session.status == GenerationStatus.COMPLETED:
            raise ValueError("Generation session has already completed successfully")
        
        if session.status == GenerationStatus.CANCELLED:
            raise ValueError("Cannot start cancelled generation session")
            
        # Default case for other statuses
        status_str = session.status.value if hasattr(session.status, 'value') else str(session.status)
        if force_restart:
            raise ValueError(
                f"Cannot start generation session with status '{status_str}'. "
                f"Only PENDING or FAILED sessions can be started."
            )
        else:
            raise ValueError(
                f"Cannot start generation session with status '{status_str}'. "
                f"Only PENDING sessions can be started. Use force_restart=True for FAILED sessions."
            )

    async def _start_generation_session(
        self,
        session: Any,
        user_context: Dict[str, Any]
    ) -> Any:
        """Start the generation session with proper state transitions."""
        generation_orm_service = self.dependencies["generation_session_orm_service"]
        
        try:
            # Update session to PROCESSING status
            started_session = await generation_orm_service.start_session(session.id)
            
            if not started_session:
                raise RuntimeError("Failed to start generation session - session not found")

            await self.session.commit()
            return started_session
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to start generation session {session.id}: {e}")
            raise RuntimeError(f"Failed to update session status during start: {str(e)}") from e

    def _extract_source_document_ids(self, session: Any) -> List[str]:
        """Extract source document IDs from the session for event publishing."""
        try:
            # Try to get source document IDs from relationships
            if hasattr(session, 'source_documents') and session.source_documents:
                return [str(doc.id) for doc in session.source_documents]
            
            # Try to extract from activity_sources relationship (legacy)
            if hasattr(session, 'activity_sources') and session.activity_sources:
                return [str(source.source_document_id) for source in session.activity_sources]
            
            # Try to extract from prompt config
            if hasattr(session, 'prompt_config') and session.prompt_config:
                config = session.prompt_config
                if isinstance(config, dict) and 'source_document_ids' in config:
                    return [str(doc_id) for doc_id in config['source_document_ids']]
            
            return []
        except Exception as e:
            logger.warning(f"Failed to extract source document IDs from session {session.id}: {e}")
            return []

    async def _publish_generation_start_events(
        self,
        request: StartGenerationRequest,
        user_context: Dict[str, Any],
        response: StartGenerationResponse
    ) -> None:
        """Publish generation start events for workflow orchestration and analytics."""
        actor_info = self._extract_user_info(user_context)
        
        # Generation session started event
        await self._publish_event(
            "publish_content_generation_requested",
            session_id=str(request.session_id),
            user_id=actor_info["user_id"],
            user_email=actor_info["user_email"],
            user_name=actor_info["user_name"],
            started_by_user_id=actor_info["user_id"],
            started_by_name=actor_info["user_name"],
            start_timestamp=datetime.now().isoformat(),
            previous_status=response.previous_status.value if hasattr(response.previous_status, 'value') else str(response.previous_status),
            source_document_ids=response.source_document_ids,
            prompt_config=response.session.prompt_config if hasattr(response.session, 'prompt_config') else {},
            force_restart=request.force_restart
        )

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error