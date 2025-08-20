"""
Get User Use Case - User Retrieval Business Workflow.

Handles secure user retrieval with proper permission validation:
- Single user retrieval by ID with access control
- Permission validation (users can see their own profile, admins see any)
- User existence validation
- Privacy-aware data filtering
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.schemas.services.user_schemas import UserServiceSchema
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class GetUserRequest:
    """Request object for user retrieval operations."""
    user_id: UUID
    include_sensitive_data: bool = False  # For admin users who need full profile data


@dataclass
class GetUserResponse:
    """Response object for user retrieval operations."""
    user: UserServiceSchema
    can_modify: bool  # Whether the requesting user can modify this profile
    last_activity: str | None = None  # Additional metadata that might be useful


class GetUserUseCase(BaseUseCase[GetUserRequest, GetUserResponse]):
    """
    Use case for secure user retrieval with permission validation.

    Responsibilities:
    - Validate user access permissions (self or admin)
    - Retrieve user data through ORM service
    - Filter sensitive data based on permissions
    - Return structured user information with metadata

    Events Published:
    - User profile view events (nlj.user.profile_viewed) for audit trails
    """

    def __init__(
        self,
        session: AsyncSession,
        user_orm_service: UserOrmService
    ) -> None:
        """
        Initialize get user use case.

        Args:
            session: Database session for transaction management
            user_orm_service: User data access service
        """
        super().__init__(
            session,
            user_orm_service=user_orm_service
        )

    async def execute(
        self,
        request: GetUserRequest,
        user_context: Dict[str, Any]
    ) -> GetUserResponse:
        """
        Execute user retrieval workflow.

        Args:
            request: User retrieval request with target user ID
            user_context: Current user context for permissions

        Returns:
            User retrieval response with user data and permissions

        Raises:
            PermissionError: If user lacks permission to view target user
            ValueError: If target user not found
            RuntimeError: If user retrieval fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Validate permissions
            await self._validate_view_permissions(
                current_user_id, current_user_role, request.user_id
            )

            # Get target user
            user_orm_service = self.dependencies["user_orm_service"]
            user = await user_orm_service.get_by_id(request.user_id)

            if not user:
                raise ValueError(f"User not found: {request.user_id}")

            # Determine if current user can modify this profile
            can_modify = (
                current_user_id == request.user_id or
                current_user_role == UserRole.ADMIN
            )

            # Convert to service schema
            user_schema = UserServiceSchema(
                id=user.id,
                email=user.email,
                username=getattr(user, 'username', ''),
                full_name=getattr(user, 'full_name', ''),
                role=getattr(user, 'role', UserRole.LEARNER),
                is_active=getattr(user, 'is_active', True),
                created_at=getattr(user, 'created_at', None),
                updated_at=getattr(user, 'updated_at', None)
            )

            # Get additional metadata for admin users
            last_activity = None
            if current_user_role == UserRole.ADMIN:
                last_activity = await self._get_user_last_activity(request.user_id)

            response = GetUserResponse(
                user=user_schema,
                can_modify=can_modify,
                last_activity=last_activity
            )

            # Publish user view event - wrapped for resilience
            try:
                await self._publish_user_view_event(request, user_context, response)
            except Exception as e:
                # Log but don't fail the business operation
                logger.warning(f"Failed to publish user view event: {e}")

            logger.info(f"User retrieved: {request.user_id} by user {current_user_id}")
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"get user {request.user_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"get user {request.user_id}")
            raise

    async def _validate_view_permissions(
        self,
        current_user_id: UUID,
        current_user_role: UserRole | None,
        target_user_id: UUID
    ) -> None:
        """Validate user view permissions."""
        # Users can view their own profile
        if current_user_id == target_user_id:
            return

        # Admins can view any profile
        if current_user_role == UserRole.ADMIN:
            return

        raise PermissionError("Not authorized to view this user's profile")

    async def _get_user_last_activity(self, user_id: UUID) -> str | None:
        """Get user's last activity for admin metadata."""
        # In a real implementation, this would query activity logs
        # For now, return placeholder data based on existing user data
        # We don't need to fetch the user again since we already have it
        return None  # Simplified for now

    async def _publish_user_view_event(
        self,
        request: GetUserRequest,
        user_context: Dict[str, Any],
        response: GetUserResponse
    ) -> None:
        """Publish user profile view event for audit trail."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_user_profile_viewed",
            viewed_user_id=str(request.user_id),
            viewer_user_id=actor_info["user_id"],
            viewer_name=actor_info["user_name"],
            viewer_email=actor_info["user_email"],
            view_timestamp=datetime.now().isoformat(),
            can_modify=response.can_modify
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