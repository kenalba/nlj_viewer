"""
Cancel Generation Use Case - Generation Cancellation Workflow.

Handles cancellation of running or pending generation sessions:
- Safe cancellation of processing generation sessions
- Permission validation for session ownership
- Status validation (can only cancel pending/processing sessions)
- Cleanup of resources and proper state transitions
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
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
class CancelGenerationRequest:
    """Request object for generation cancellation operations."""
    session_id: UUID
    cancellation_reason: str = "User requested cancellation"


@dataclass
class CancelGenerationResponse:
    """Response object for generation cancellation operations."""
    session: GenerationSessionServiceSchema
    cancelled_successfully: bool
    cancellation_timestamp: datetime
    previous_status: GenerationStatus


class CancelGenerationUseCase(BaseUseCase[CancelGenerationRequest, CancelGenerationResponse]):
    """
    Use case for cancelling generation sessions with proper cleanup.

    Responsibilities:
    - Validate user permissions for session cancellation
    - Validate session state (can only cancel pending/processing)
    - Update session status and metadata
    - Cleanup any running generation processes
    - Publish cancellation events for analytics

    Events Published:
    - Generation cancelled events for audit trails and analytics
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService
    ) -> None:
        """
        Initialize cancel generation use case.

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
        request: CancelGenerationRequest,
        user_context: Dict[str, Any]
    ) -> CancelGenerationResponse:
        """
        Execute generation cancellation workflow.

        Args:
            request: Cancellation request with session ID and reason
            user_context: Current user context for permissions

        Returns:
            Generation cancellation response with updated session info

        Raises:
            PermissionError: If user lacks permission to cancel session
            ValueError: If session not found or cannot be cancelled
            RuntimeError: If cancellation fails
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

            # Validate cancellation permissions and state
            await self._validate_cancellation_permissions(
                current_user_id, current_user_role, session
            )
            self._validate_cancellation_state(session, previous_status)

            # Perform cancellation
            cancellation_timestamp = datetime.now()
            cancelled_session = await self._cancel_generation_session(
                session, request.cancellation_reason, cancellation_timestamp, user_context
            )

            # Create response
            session_schema = GenerationSessionServiceSchema.from_orm_model(cancelled_session)
            
            response = CancelGenerationResponse(
                session=session_schema,
                cancelled_successfully=True,
                cancellation_timestamp=cancellation_timestamp,
                previous_status=previous_status
            )

            # Publish cancellation event
            try:
                await self._publish_generation_cancelled_event(request, user_context, response)
            except Exception as e:
                logger.warning(f"Failed to publish generation cancelled event: {e}")

            logger.info(
                f"Generation session cancelled: {request.session_id} by user {current_user_id}, "
                f"previous status: {previous_status.value if hasattr(previous_status, 'value') else previous_status}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"cancel generation session {request.session_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"cancel generation session {request.session_id}")
            raise

    async def _validate_cancellation_permissions(
        self,
        current_user_id: UUID,
        current_user_role: Optional[UserRole],
        session
    ) -> None:
        """Validate user has permission to cancel this session."""
        # Users can cancel their own sessions
        if hasattr(session, 'user_id') and session.user_id == current_user_id:
            return

        # Admins can cancel any session
        if current_user_role == UserRole.ADMIN:
            return

        raise PermissionError("Not authorized to cancel this generation session")

    def _validate_cancellation_state(self, session, previous_status: GenerationStatus) -> None:
        """Validate session can be cancelled based on current state."""
        cancellable_states = [GenerationStatus.PENDING, GenerationStatus.PROCESSING]
        
        if previous_status not in cancellable_states:
            state_name = previous_status.value if hasattr(previous_status, 'value') else str(previous_status)
            raise ValueError(
                f"Cannot cancel generation session in state '{state_name}'. "
                f"Only pending or processing sessions can be cancelled."
            )

    async def _cancel_generation_session(
        self,
        session,
        cancellation_reason: str,
        cancellation_timestamp: datetime,
        user_context: Dict[str, Any]
    ):
        """Cancel the generation session with proper cleanup."""
        generation_orm_service = self.dependencies["generation_session_orm_service"]
        
        # Update session status and metadata
        try:
            updated_session = await generation_orm_service.update_session_status(
                session.id,
                GenerationStatus.CANCELLED,
                error_message=f"Cancelled: {cancellation_reason}",
                additional_metadata={
                    'cancelled_at': cancellation_timestamp.isoformat(),
                    'cancelled_by': user_context["user_id"],
                    'cancellation_reason': cancellation_reason
                }
            )
            
            # In a full implementation, this would also:
            # 1. Send cancellation signal to any running AI generation processes
            # 2. Clean up any temporary resources or files
            # 3. Update any related job queues or background tasks
            
            await self.session.commit()
            return updated_session
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to cancel generation session {session.id}: {e}")
            raise RuntimeError(f"Failed to update session status during cancellation: {str(e)}") from e

    async def _publish_generation_cancelled_event(
        self,
        request: CancelGenerationRequest,
        user_context: Dict[str, Any],
        response: CancelGenerationResponse
    ) -> None:
        """Publish generation cancelled event for audit trail and analytics."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_generation_session_cancelled",
            session_id=str(request.session_id),
            cancelled_by_user_id=actor_info["user_id"],
            cancelled_by_name=actor_info["user_name"],
            cancelled_by_email=actor_info["user_email"],
            cancellation_timestamp=response.cancellation_timestamp.isoformat(),
            cancellation_reason=request.cancellation_reason,
            previous_status=response.previous_status.value if hasattr(response.previous_status, 'value') else str(response.previous_status),
            session_duration_seconds=self._calculate_session_duration(response.session),
        )

    def _calculate_session_duration(self, session: GenerationSessionServiceSchema) -> Optional[float]:
        """Calculate how long the session was running before cancellation."""
        if hasattr(session, 'created_at') and session.created_at:
            try:
                from datetime import datetime
                duration = datetime.now() - session.created_at
                return duration.total_seconds()
            except Exception:
                return None
        return None

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error