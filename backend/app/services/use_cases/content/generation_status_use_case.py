"""
Generation Status Use Case - Real-time Status Polling Workflow.

Handles real-time status checking for generation sessions:
- Lightweight status polling for UI updates
- Progress information and current processing step
- Error status and failure reasons
- Completion detection and results availability
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generation_session import GenerationStatus
from app.models.user import UserRole
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class GenerationStatusRequest:
    """Request object for generation status checking operations."""
    session_id: UUID
    include_progress_details: bool = True
    include_error_details: bool = True


@dataclass
class GenerationStatusResponse:
    """Response object for generation status checking operations."""
    session_id: UUID
    status: GenerationStatus
    progress_percentage: Optional[int] = None
    current_step: Optional[str] = None
    error_message: Optional[str] = None
    is_completed: bool = False
    is_failed: bool = False
    has_generated_content: bool = False
    estimated_completion_time: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    total_processing_time_seconds: Optional[float] = None


class GenerationStatusUseCase(BaseUseCase[GenerationStatusRequest, GenerationStatusResponse]):
    """
    Use case for real-time generation status checking with minimal overhead.

    Responsibilities:
    - Validate user permissions for status checking
    - Retrieve current session status and progress
    - Calculate processing metrics and estimates
    - Return lightweight status information for UI polling

    Events Published:
    - Minimal status check events (only for audit, not for each poll)
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService
    ) -> None:
        """
        Initialize generation status use case.

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
        request: GenerationStatusRequest,
        user_context: Dict[str, Any]
    ) -> GenerationStatusResponse:
        """
        Execute generation status checking workflow.

        Args:
            request: Status request with session ID and detail flags
            user_context: Current user context for permissions

        Returns:
            Generation status response with current state and progress

        Raises:
            PermissionError: If user lacks permission to check session status
            ValueError: If session not found
            RuntimeError: If status retrieval fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get session with minimal data for performance
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            session = await generation_orm_service.get_by_id(request.session_id)

            if not session:
                raise ValueError(f"Generation session not found: {request.session_id}")

            # Validate permissions (lightweight check)
            await self._validate_status_permissions(
                current_user_id, current_user_role, session
            )

            # Build status response
            response = await self._build_status_response(request, session)

            # Only publish status check events occasionally (not on every poll) 
            # to avoid overwhelming the event system
            if self._should_publish_status_event(session):
                try:
                    await self._publish_status_check_event(request, user_context, response)
                except Exception as e:
                    logger.warning(f"Failed to publish status check event: {e}")

            # Use debug level logging to avoid spam
            logger.debug(
                f"Generation status checked: {request.session_id} -> {response.status.value if hasattr(response.status, 'value') else response.status}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"check generation status {request.session_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"check generation status {request.session_id}")
            raise

    async def _validate_status_permissions(
        self,
        current_user_id: UUID,
        current_user_role: Optional[UserRole],
        session
    ) -> None:
        """Validate user has permission to check this session's status."""
        # Users can check their own session status
        if hasattr(session, 'user_id') and session.user_id == current_user_id:
            return

        # Admins can check any session status
        if current_user_role == UserRole.ADMIN:
            return

        raise PermissionError("Not authorized to check this generation session's status")

    async def _build_status_response(
        self,
        request: GenerationStatusRequest,
        session
    ) -> GenerationStatusResponse:
        """Build comprehensive status response from session data."""
        # Basic status information
        status = session.status
        is_completed = status == GenerationStatus.COMPLETED
        is_failed = status == GenerationStatus.FAILED
        has_generated_content = (is_completed and 
                               hasattr(session, 'generated_content') and 
                               session.generated_content is not None)

        # Progress calculation
        progress_percentage = self._calculate_progress_percentage(status, session)
        current_step = self._determine_current_step(status, session)

        # Error information
        error_message = None
        if request.include_error_details and is_failed:
            error_message = getattr(session, 'error_message', 'Generation failed')

        # Timing information
        processing_started_at = getattr(session, 'started_at', None)
        total_processing_time = None
        estimated_completion_time = None

        if processing_started_at and is_completed:
            # Calculate actual processing time
            completed_at = getattr(session, 'completed_at', datetime.now())
            if completed_at:
                total_processing_time = (completed_at - processing_started_at).total_seconds()

        elif processing_started_at and status == GenerationStatus.PROCESSING:
            # Estimate completion time based on progress
            estimated_completion_time = self._estimate_completion_time(
                processing_started_at, progress_percentage
            )

        return GenerationStatusResponse(
            session_id=session.id,
            status=status,
            progress_percentage=progress_percentage,
            current_step=current_step,
            error_message=error_message,
            is_completed=is_completed,
            is_failed=is_failed,
            has_generated_content=has_generated_content,
            estimated_completion_time=estimated_completion_time,
            processing_started_at=processing_started_at,
            total_processing_time_seconds=total_processing_time
        )

    def _calculate_progress_percentage(self, status: GenerationStatus, session) -> Optional[int]:
        """Calculate progress percentage based on status and session metadata."""
        if status == GenerationStatus.PENDING:
            return 0
        elif status == GenerationStatus.PROCESSING:
            # Check for progress metadata from session
            progress = getattr(session, 'progress_percentage', None)
            if progress is not None:
                return min(95, max(10, int(progress)))  # Cap at 95% until truly complete
            return 50  # Default progress for processing
        elif status == GenerationStatus.COMPLETED:
            return 100
        elif status == GenerationStatus.FAILED:
            return None  # Don't show progress for failed sessions
        elif status == GenerationStatus.CANCELLED:
            return None  # Don't show progress for cancelled sessions
        else:
            return None

    def _determine_current_step(self, status: GenerationStatus, session) -> Optional[str]:
        """Determine current processing step description."""
        if status == GenerationStatus.PENDING:
            return "Waiting to start generation..."
        elif status == GenerationStatus.PROCESSING:
            # Check for step metadata from session
            step = getattr(session, 'current_step', None)
            if step:
                return step
            return "Generating content..."
        elif status == GenerationStatus.COMPLETED:
            return "Generation completed successfully"
        elif status == GenerationStatus.FAILED:
            return "Generation failed"
        elif status == GenerationStatus.CANCELLED:
            return "Generation was cancelled"
        else:
            return "Unknown status"

    def _estimate_completion_time(
        self, 
        started_at: datetime, 
        progress_percentage: Optional[int]
    ) -> Optional[datetime]:
        """Estimate completion time based on current progress."""
        if not progress_percentage or progress_percentage <= 0:
            return None

        try:
            elapsed = datetime.now() - started_at
            total_estimated = elapsed.total_seconds() * (100 / progress_percentage)
            remaining = total_estimated - elapsed.total_seconds()
            
            if remaining > 0:
                return datetime.now() + timedelta(seconds=remaining)
        except Exception:
            pass
        
        return None

    def _should_publish_status_event(self, session) -> bool:
        """Determine if we should publish a status check event (avoid spam)."""
        # Only publish events for significant status changes or occasionally
        # This prevents overwhelming the event system with polling requests
        
        # You could implement logic like:
        # - Publish only on status transitions
        # - Publish only every Nth check
        # - Publish only for certain session types
        
        # For now, minimize event publishing for status checks
        return False  # Only publish on actual status changes, not polls

    async def _publish_status_check_event(
        self,
        request: GenerationStatusRequest,
        user_context: Dict[str, Any],
        response: GenerationStatusResponse
    ) -> None:
        """Publish generation status check event (used sparingly)."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_generation_status_checked",
            session_id=str(request.session_id),
            checker_user_id=actor_info["user_id"],
            checker_name=actor_info["user_name"],
            check_timestamp=datetime.now().isoformat(),
            current_status=response.status.value if hasattr(response.status, 'value') else str(response.status),
            progress_percentage=response.progress_percentage,
            is_completed=response.is_completed,
            is_failed=response.is_failed
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