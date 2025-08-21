"""
Get Generation Session Use Case - Single Session Retrieval Workflow.

Handles secure retrieval of individual generation sessions:
- Single session retrieval by ID with access control
- Permission validation (users can see their own sessions, admins see any)
- Session existence validation
- Comprehensive session metadata and progress information
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.schemas.services.generation_schemas import GenerationSessionServiceSchema
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class GetGenerationSessionRequest:
    """Request object for generation session retrieval operations."""
    session_id: UUID
    include_activity_data: bool = False  # Include linked activity information


@dataclass
class GetGenerationSessionResponse:
    """Response object for generation session retrieval operations."""
    session: GenerationSessionServiceSchema
    can_modify: bool  # Whether the requesting user can modify this session
    can_cancel: bool  # Whether the session can be cancelled
    can_retry: bool   # Whether the session can be retried
    can_create_activity: bool  # Whether activity can be created from this session
    activity_count: int = 0  # Number of activities created from this session


class GetGenerationSessionUseCase(BaseUseCase[GetGenerationSessionRequest, GetGenerationSessionResponse]):
    """
    Use case for secure generation session retrieval with permission validation.

    Responsibilities:
    - Validate user access permissions (own sessions or admin)
    - Retrieve session data through ORM service
    - Determine available actions based on session state and permissions
    - Return structured session information with metadata

    Events Published:
    - Generation session view events for audit trails
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService
    ) -> None:
        """
        Initialize get generation session use case.

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
        request: GetGenerationSessionRequest,
        user_context: Dict[str, Any]
    ) -> GetGenerationSessionResponse:
        """
        Execute generation session retrieval workflow.

        Args:
            request: Session retrieval request with target session ID
            user_context: Current user context for permissions

        Returns:
            Generation session retrieval response with session data and permissions

        Raises:
            PermissionError: If user lacks permission to view target session
            ValueError: If target session not found
            RuntimeError: If session retrieval fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get target session
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            session = await generation_orm_service.get_by_id(request.session_id)

            if not session:
                raise ValueError(f"Generation session not found: {request.session_id}")

            # Validate permissions
            await self._validate_view_permissions(
                current_user_id, current_user_role, session
            )

            # Determine available actions
            can_modify = self._can_modify_session(current_user_id, current_user_role, session)
            can_cancel = self._can_cancel_session(session, can_modify)
            can_retry = self._can_retry_session(session, can_modify)
            can_create_activity = self._can_create_activity(session, can_modify)

            # Get activity count if needed
            activity_count = 0
            if request.include_activity_data:
                activity_count = await self._get_activity_count(request.session_id)

            # Convert to service schema
            session_schema = GenerationSessionServiceSchema.from_orm_model(session)

            response = GetGenerationSessionResponse(
                session=session_schema,
                can_modify=can_modify,
                can_cancel=can_cancel,
                can_retry=can_retry,
                can_create_activity=can_create_activity,
                activity_count=activity_count
            )

            # Publish session view event
            try:
                await self._publish_session_view_event(request, user_context, response)
            except Exception as e:
                logger.warning(f"Failed to publish session view event: {e}")

            logger.info(f"Generation session retrieved: {request.session_id} by user {current_user_id}")
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"get generation session {request.session_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"get generation session {request.session_id}")
            raise

    async def _validate_view_permissions(
        self,
        current_user_id: UUID,
        current_user_role: Optional[UserRole],
        session
    ) -> None:
        """Validate session view permissions."""
        # Users can view their own sessions
        if hasattr(session, 'user_id') and session.user_id == current_user_id:
            return

        # Admins can view any session
        if current_user_role == UserRole.ADMIN:
            return

        raise PermissionError("Not authorized to view this generation session")

    def _can_modify_session(
        self,
        current_user_id: UUID,
        current_user_role: Optional[UserRole],
        session
    ) -> bool:
        """Determine if user can modify this session."""
        # Session owner can modify
        if hasattr(session, 'user_id') and session.user_id == current_user_id:
            return True
        
        # Admins can modify any session
        if current_user_role == UserRole.ADMIN:
            return True
            
        return False

    def _can_cancel_session(self, session, can_modify: bool) -> bool:
        """Determine if session can be cancelled."""
        if not can_modify:
            return False
            
        # Can cancel if processing or pending
        from app.models.generation_session import GenerationStatus
        if hasattr(session, 'status'):
            return session.status in [GenerationStatus.PENDING, GenerationStatus.PROCESSING]
            
        return False

    def _can_retry_session(self, session, can_modify: bool) -> bool:
        """Determine if session can be retried."""
        if not can_modify:
            return False
            
        # Can retry if failed
        from app.models.generation_session import GenerationStatus
        if hasattr(session, 'status'):
            return session.status == GenerationStatus.FAILED
            
        return False

    def _can_create_activity(self, session, can_modify: bool) -> bool:
        """Determine if activity can be created from this session."""
        if not can_modify:
            return False
            
        # Can create activity if completed successfully
        from app.models.generation_session import GenerationStatus
        if hasattr(session, 'status'):
            return (session.status == GenerationStatus.COMPLETED and 
                   hasattr(session, 'generated_content') and 
                   session.generated_content is not None)
            
        return False

    async def _get_activity_count(self, session_id: UUID) -> int:
        """Get count of activities created from this session."""
        # In a full implementation, this would query the content table
        # for activities linked to this generation session
        # For now, return 0 as placeholder
        return 0

    async def _publish_session_view_event(
        self,
        request: GetGenerationSessionRequest,
        user_context: Dict[str, Any],
        response: GetGenerationSessionResponse
    ) -> None:
        """Publish generation session view event for audit trail."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_generation_session_viewed",
            viewed_session_id=str(request.session_id),
            viewer_user_id=actor_info["user_id"],
            viewer_name=actor_info["user_name"],
            viewer_email=actor_info["user_email"],
            view_timestamp=datetime.now().isoformat(),
            session_status=response.session.status.value if hasattr(response.session.status, 'value') else str(response.session.status),
            can_modify=response.can_modify,
            can_cancel=response.can_cancel,
            can_retry=response.can_retry,
            can_create_activity=response.can_create_activity
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