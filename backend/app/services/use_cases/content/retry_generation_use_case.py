"""
Retry Generation Use Case - Failed Generation Session Retry Workflow.

Handles retrying failed or cancelled generation sessions:
- Validation of session state and permissions
- Session state reset and cleanup
- Status transition to PROCESSING and event publishing
- Error history preservation for debugging
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
class RetryGenerationRequest:
    """Request object for retrying generation operations."""
    session_id: UUID
    reset_configuration: bool = False  # Reset prompt configuration to defaults
    preserve_error_history: bool = True  # Keep previous error information for debugging


@dataclass
class RetryGenerationResponse:
    """Response object for retrying generation operations."""
    session: GenerationSessionServiceSchema
    retry_successful: bool
    previous_status: GenerationStatus
    previous_error_message: Optional[str]
    retry_count: int
    source_document_ids: List[str]
    event_published: bool


class RetryGenerationUseCase(BaseUseCase[RetryGenerationRequest, RetryGenerationResponse]):
    """
    Use case for retrying failed generation sessions with proper cleanup and state management.

    Responsibilities:
    - Validate session exists and user has permission to retry it
    - Validate session is in a retryable state (FAILED or CANCELLED)
    - Reset session state while preserving error history if requested
    - Transition session status to PROCESSING
    - Publish retry events for workflow tracking and debugging
    - Return updated session information with retry context

    Events Published:
    - Generation retry requested events for workflow orchestration
    - xAPI events for learning analytics tracking
    - Error recovery events for system monitoring
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService
    ) -> None:
        """
        Initialize retry generation use case.

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
        request: RetryGenerationRequest,
        user_context: Dict[str, Any]
    ) -> RetryGenerationResponse:
        """
        Execute generation session retry workflow.

        Args:
            request: Retry request with session ID and options
            user_context: Current user context for permissions

        Returns:
            Generation retry response with updated session info

        Raises:
            PermissionError: If user lacks permission to retry session
            ValueError: If session not found or cannot be retried
            RuntimeError: If generation retry fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get and validate session
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            session = await generation_orm_service.get_by_id(request.session_id)

            if not session:
                raise ValueError(f"Generation session not found: {request.session_id}")

            # Store original status and error information
            previous_status = session.status
            previous_error_message = getattr(session, 'error_message', None)

            # Validate retry permissions and session state
            await self._validate_retry_permissions(
                current_user_id, current_user_role, session
            )
            self._validate_session_for_retry(session)

            # Reset and restart the generation session
            retried_session = await self._retry_generation_session(
                session, request, user_context
            )

            # Extract source document IDs and calculate retry count
            source_document_ids = self._extract_source_document_ids(retried_session)
            retry_count = self._calculate_retry_count(retried_session)

            # Create response
            session_schema = GenerationSessionServiceSchema.from_orm_model(retried_session)
            
            response = RetryGenerationResponse(
                session=session_schema,
                retry_successful=True,
                previous_status=previous_status,
                previous_error_message=previous_error_message,
                retry_count=retry_count,
                source_document_ids=source_document_ids,
                event_published=False  # Will be set after successful event publishing
            )

            # Publish generation retry events
            try:
                await self._publish_generation_retry_events(request, user_context, response)
                response.event_published = True
            except Exception as e:
                logger.warning(f"Failed to publish generation retry events: {e}")

            logger.info(
                f"Generation session retried: {request.session_id} by user {current_user_id}, "
                f"previous status: {previous_status.value if hasattr(previous_status, 'value') else previous_status}, "
                f"retry count: {retry_count}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"retry generation session {request.session_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"retry generation session {request.session_id}")
            raise

    async def _validate_retry_permissions(
        self,
        current_user_id: UUID,
        current_user_role: Optional[UserRole],
        session: Any
    ) -> None:
        """Validate user has permission to retry this session."""
        # Users can retry their own sessions
        if hasattr(session, 'user_id') and session.user_id == current_user_id:
            return

        # Admins can retry any session
        if current_user_role == UserRole.ADMIN:
            return

        raise PermissionError("Not authorized to retry this generation session")

    def _validate_session_for_retry(self, session: Any) -> None:
        """Validate session can be retried based on current state."""
        retryable_statuses = [GenerationStatus.FAILED, GenerationStatus.CANCELLED]
        
        if session.status not in retryable_statuses:
            status_str = session.status.value if hasattr(session.status, 'value') else str(session.status)
            retryable_str = ", ".join([s.value if hasattr(s, 'value') else str(s) for s in retryable_statuses])
            raise ValueError(
                f"Cannot retry generation session with status '{status_str}'. "
                f"Only sessions with status {retryable_str} can be retried."
            )

    async def _retry_generation_session(
        self,
        session: Any,
        request: RetryGenerationRequest,
        user_context: Dict[str, Any]
    ) -> Any:
        """Reset and restart the generation session with proper state cleanup."""
        generation_orm_service = self.dependencies["generation_session_orm_service"]
        
        try:
            # Prepare update data for session reset
            update_data = {
                "status": GenerationStatus.PROCESSING,
                "progress": 0,
                "current_step": "Retrying generation process"
            }

            # Clear previous run data but preserve error history if requested
            if not request.preserve_error_history:
                update_data["error_message"] = None
            else:
                # Append retry information to error history
                existing_error = getattr(session, 'error_message', '')
                retry_info = f"\n[Retry requested at {datetime.now().isoformat()}]"
                if existing_error:
                    update_data["error_message"] = existing_error + retry_info
                else:
                    update_data["error_message"] = None

            # Reset timestamps
            update_data["started_at"] = None
            update_data["completed_at"] = None

            # Reset configuration if requested
            if request.reset_configuration and hasattr(session, 'prompt_config'):
                # This would reset to default configuration
                # Implementation depends on how default configs are managed
                logger.info(f"Configuration reset requested for session {session.id}")

            # Update the session with reset data
            retried_session = await generation_orm_service.update_session_status(
                session.id,
                GenerationStatus.PROCESSING,
                progress=0,
                current_step="Retrying generation process"
            )

            if not retried_session:
                raise RuntimeError("Failed to reset generation session for retry")

            await self.session.commit()
            return retried_session
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to retry generation session {session.id}: {e}")
            raise RuntimeError(f"Failed to reset session state for retry: {str(e)}") from e

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

    def _calculate_retry_count(self, session: Any) -> int:
        """Calculate how many times this session has been retried."""
        try:
            # Look for retry information in error message or metadata
            error_message = getattr(session, 'error_message', '')
            if error_message:
                retry_markers = error_message.count('[Retry requested at')
                return retry_markers
            
            # Could also be stored in session metadata if implemented
            if hasattr(session, 'metadata') and session.metadata:
                retry_count = session.metadata.get('retry_count', 0)
                return int(retry_count) if retry_count is not None else 0
            
            return 0
        except Exception:
            return 0

    async def _publish_generation_retry_events(
        self,
        request: RetryGenerationRequest,
        user_context: Dict[str, Any],
        response: RetryGenerationResponse
    ) -> None:
        """Publish generation retry events for workflow orchestration and monitoring."""
        actor_info = self._extract_user_info(user_context)
        
        # Generation session retry requested event
        await self._publish_event(
            "publish_content_generation_requested",
            session_id=str(request.session_id),
            user_id=actor_info["user_id"],
            user_email=actor_info["user_email"],
            user_name=actor_info["user_name"],
            retried_by_user_id=actor_info["user_id"],
            retried_by_name=actor_info["user_name"],
            retry_timestamp=datetime.now().isoformat(),
            previous_status=response.previous_status.value if hasattr(response.previous_status, 'value') else str(response.previous_status),
            previous_error_message=response.previous_error_message,
            retry_count=response.retry_count,
            source_document_ids=response.source_document_ids,
            prompt_config=response.session.prompt_config if hasattr(response.session, 'prompt_config') else {},
            is_retry=True,
            reset_configuration=request.reset_configuration,
            preserve_error_history=request.preserve_error_history
        )

        # Error recovery event
        await self._publish_event(
            "publish_generation_error_recovery",
            session_id=str(request.session_id),
            recovery_user_id=actor_info["user_id"],
            recovery_user_name=actor_info["user_name"],
            recovery_timestamp=datetime.now().isoformat(),
            previous_error=response.previous_error_message,
            retry_count=response.retry_count,
            recovery_method="manual_retry"
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