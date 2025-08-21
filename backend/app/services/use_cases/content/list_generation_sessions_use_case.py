"""
List Generation Sessions Use Case - Generation Session History Workflow.

Handles paginated listing of user's generation sessions with filtering:
- User's generation session history with pagination
- Status-based filtering (pending, processing, completed, failed)
- Permission validation for session access
- Session metadata and progress information
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, List, Optional
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generation_session import GenerationStatus
from app.models.user import UserRole
from app.schemas.services.generation_schemas import GenerationSessionServiceSchema
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class ListGenerationSessionsRequest:
    """Request object for generation session listing operations."""
    user_id: Optional[UUID] = None  # None = current user, UUID = specific user (admin only)
    status_filter: Optional[GenerationStatus] = None
    limit: int = 20
    offset: int = 0
    include_completed: bool = True
    include_failed: bool = True
    
    def __post_init__(self):
        """Validate request parameters."""
        if self.limit < 1 or self.limit > 100:
            raise ValueError("Limit must be between 1 and 100")
        if self.offset < 0:
            raise ValueError("Offset must be non-negative")


@dataclass  
class ListGenerationSessionsResponse:
    """Response object for generation session listing operations."""
    sessions: List[GenerationSessionServiceSchema]
    total_count: int
    limit: int
    offset: int
    has_next: bool
    has_prev: bool
    filtered_by_status: Optional[GenerationStatus] = None


class ListGenerationSessionsUseCase(BaseUseCase[ListGenerationSessionsRequest, ListGenerationSessionsResponse]):
    """
    Use case for paginated generation session listing with filtering.

    Responsibilities:
    - Validate user access permissions for session listing
    - Apply status-based filtering and pagination
    - Retrieve session metadata and progress information
    - Return structured list with pagination metadata

    Events Published:
    - Generation session list accessed events for audit trails
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService
    ) -> None:
        """
        Initialize list generation sessions use case.

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
        request: ListGenerationSessionsRequest,
        user_context: Dict[str, Any]
    ) -> ListGenerationSessionsResponse:
        """
        Execute generation session listing workflow.

        Args:
            request: Session listing request with filters and pagination
            user_context: Current user context for permissions

        Returns:
            Generation session listing response with paginated results

        Raises:
            PermissionError: If user lacks permission to list sessions
            ValueError: If request validation fails
            RuntimeError: If session listing fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")
            
            # Determine target user ID with permission validation
            target_user_id = await self._validate_and_get_target_user(
                request, current_user_id, current_user_role
            )

            # Get sessions from ORM service
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            
            sessions, total_count = await generation_orm_service.get_user_sessions(
                user_id=target_user_id,
                status=request.status_filter,
                limit=request.limit,
                offset=request.offset
            )

            # Convert to service schemas
            session_schemas = []
            for session in sessions:
                session_schema = GenerationSessionServiceSchema.from_orm_model(session)
                session_schemas.append(session_schema)

            # Calculate pagination metadata
            has_next = (request.offset + request.limit) < total_count
            has_prev = request.offset > 0

            response = ListGenerationSessionsResponse(
                sessions=session_schemas,
                total_count=total_count,
                limit=request.limit,
                offset=request.offset,
                has_next=has_next,
                has_prev=has_prev,
                filtered_by_status=request.status_filter
            )

            # Publish session list access event
            try:
                await self._publish_session_list_event(request, user_context, response)
            except Exception as e:
                logger.warning(f"Failed to publish session list event: {e}")

            logger.info(
                f"Generation sessions listed: {len(session_schemas)} sessions for user {target_user_id}, "
                f"by user {current_user_id}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, "list generation sessions")
            raise
        except Exception as e:
            await self._handle_service_error(e, "list generation sessions")
            raise

    async def _validate_and_get_target_user(
        self,
        request: ListGenerationSessionsRequest,
        current_user_id: UUID,
        current_user_role: Optional[UserRole]
    ) -> UUID:
        """Validate permissions and determine target user ID."""
        target_user_id = request.user_id or current_user_id
        
        # Users can list their own sessions
        if target_user_id == current_user_id:
            return target_user_id
            
        # Admins can list any user's sessions
        if current_user_role == UserRole.ADMIN:
            return target_user_id
            
        raise PermissionError("Not authorized to list other users' generation sessions")

    async def _publish_session_list_event(
        self,
        request: ListGenerationSessionsRequest,
        user_context: Dict[str, Any],
        response: ListGenerationSessionsResponse
    ) -> None:
        """Publish generation session list access event for audit trail."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_generation_session_list_accessed",
            accessor_user_id=actor_info["user_id"],
            accessor_name=actor_info["user_name"],
            accessor_email=actor_info["user_email"],
            access_timestamp=datetime.now().isoformat(),
            target_user_id=str(request.user_id) if request.user_id else actor_info["user_id"],
            total_sessions=response.total_count,
            status_filter=request.status_filter.value if request.status_filter else None,
            limit=request.limit,
            offset=request.offset
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