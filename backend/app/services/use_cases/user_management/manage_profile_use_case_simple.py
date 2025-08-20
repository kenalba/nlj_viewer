"""
Manage Profile Use Case - Simplified User Profile Management.

Leverages existing UserOrmService for basic profile operations.
Handles profile updates and password changes using JWT authentication.
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class ProfileAction(Enum):
    """Profile management actions (simplified)."""
    UPDATE_INFO = "update_info"
    CHANGE_PASSWORD = "change_password"
    GET_PROFILE = "get_profile"


@dataclass
class ManageProfileRequest:
    """Request object for profile management operations (simplified)."""
    action: ProfileAction
    user_id: UUID
    
    # For UPDATE_INFO
    full_name: Optional[str] = None
    email: Optional[str] = None
    
    # For CHANGE_PASSWORD
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@dataclass
class ManageProfileResponse:
    """Response object for profile management operations (simplified)."""
    action_taken: ProfileAction
    user_id: UUID
    user_data: Dict[str, Any]
    updated_fields: Optional[list[str]] = None
    password_changed: bool = False


class ManageProfileUseCase(BaseUseCase[ManageProfileRequest, ManageProfileResponse]):
    """
    Use case for simplified user profile management.

    Uses existing UserOrmService methods for profile operations.
    Supports basic profile updates and password changes.

    Responsibilities:
    - Update user profile information
    - Change user passwords with validation
    - Retrieve user profile data

    Events Published:
    - Profile update events (nlj.user.profile_updated)
    - Password change events (nlj.user.password_changed)
    """

    def __init__(
        self,
        session: AsyncSession,
        user_orm_service: UserOrmService
    ):
        """
        Initialize manage profile use case.

        Args:
            session: Database session for transaction management
            user_orm_service: User data access and management
        """
        super().__init__(
            session,
            user_orm_service=user_orm_service
        )

    async def execute(
        self,
        request: ManageProfileRequest,
        user_context: Dict[str, Any]
    ) -> ManageProfileResponse:
        """
        Execute profile management workflow (simplified).

        Args:
            request: Profile management request
            user_context: Current user context for authorization

        Returns:
            Profile management response

        Raises:
            PermissionError: If user lacks permission for operation
            ValueError: If request validation fails
            RuntimeError: If operation fails
        """
        try:
            # Validate permissions - users can only edit their own profile or admins can edit any
            await self._validate_profile_permissions(request, user_context)

            # Route to specific action handler
            if request.action == ProfileAction.UPDATE_INFO:
                response_data = await self._handle_update_info(request, user_context)
            elif request.action == ProfileAction.CHANGE_PASSWORD:
                response_data = await self._handle_change_password(request, user_context)
            elif request.action == ProfileAction.GET_PROFILE:
                response_data = await self._handle_get_profile(request)
            else:
                raise ValueError(f"Unsupported profile action: {request.action}")

            # Publish profile change event if applicable
            if request.action in [ProfileAction.UPDATE_INFO, ProfileAction.CHANGE_PASSWORD]:
                await self._publish_profile_change_event(request, response_data, user_context)

            logger.info(
                f"Profile management completed: {request.action.value} for user {request.user_id}"
            )
            return response_data

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"profile management {request.action.value}")
        except Exception as e:
            await self._handle_service_error(e, f"profile management {request.action.value}")
            raise  # This will never be reached but satisfies mypy

    async def _validate_profile_permissions(
        self,
        request: ManageProfileRequest,
        user_context: Dict[str, Any]
    ) -> None:
        """Validate user can perform profile operation."""
        current_user_id = UUID(user_context["user_id"])
        current_user_role = user_context.get("user_role")
        
        # Users can edit their own profile, or admins can edit any profile
        if request.user_id != current_user_id:
            if current_user_role != "ADMIN":
                raise PermissionError("Users can only edit their own profile unless they are administrators")

    async def _handle_update_info(
        self,
        request: ManageProfileRequest,
        user_context: Dict[str, Any]
    ) -> ManageProfileResponse:
        """Handle profile information update."""
        user_orm_service = self.dependencies["user_orm_service"]
        
        # Get current user data
        user = await user_orm_service.get_by_id(request.user_id)
        if not user:
            raise ValueError(f"User not found: {request.user_id}")

        # Build update data
        update_data = {}
        updated_fields = []

        if request.full_name is not None and request.full_name != user.full_name:
            update_data["full_name"] = request.full_name.strip()
            updated_fields.append("full_name")

        if request.email is not None and request.email != user.email:
            # Validate email format (basic validation)
            if "@" not in request.email or "." not in request.email:
                raise ValueError("Invalid email format")
            
            # Check if email is already taken
            existing_user = await user_orm_service.get_user_by_email(request.email)
            if existing_user and existing_user.id != request.user_id:
                raise ValueError("Email address is already in use")
            
            update_data["email"] = request.email.strip().lower()
            updated_fields.append("email")

        # Apply updates if any
        if update_data:
            success = await user_orm_service.update_by_id(request.user_id, **update_data)
            if not success:
                raise RuntimeError("Failed to update user profile")

        # Get updated user data
        updated_user = await user_orm_service.get_by_id(request.user_id)

        return ManageProfileResponse(
            action_taken=request.action,
            user_id=request.user_id,
            user_data={
                "id": str(updated_user.id),
                "username": updated_user.username,
                "email": updated_user.email,
                "full_name": updated_user.full_name,
                "role": updated_user.role.value,
                "is_active": updated_user.is_active,
                "last_login": updated_user.last_login.isoformat() if updated_user.last_login else None,
                "created_at": updated_user.created_at.isoformat() if updated_user.created_at else None
            },
            updated_fields=updated_fields
        )

    async def _handle_change_password(
        self,
        request: ManageProfileRequest,
        user_context: Dict[str, Any]
    ) -> ManageProfileResponse:
        """Handle password change."""
        if not request.current_password or not request.new_password:
            raise ValueError("Both current password and new password are required")

        user_orm_service = self.dependencies["user_orm_service"]
        
        # Use existing UserOrmService method for password change
        success = await user_orm_service.change_password(
            request.user_id,
            request.current_password,
            request.new_password
        )

        if not success:
            raise ValueError("Current password is incorrect or user not found")

        # Get updated user data
        user = await user_orm_service.get_by_id(request.user_id)

        return ManageProfileResponse(
            action_taken=request.action,
            user_id=request.user_id,
            user_data={
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
                "is_active": user.is_active,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "created_at": user.created_at.isoformat() if user.created_at else None
            },
            password_changed=True
        )

    async def _handle_get_profile(
        self,
        request: ManageProfileRequest
    ) -> ManageProfileResponse:
        """Handle profile data retrieval."""
        user_orm_service = self.dependencies["user_orm_service"]
        
        user = await user_orm_service.get_by_id(request.user_id)
        if not user:
            raise ValueError(f"User not found: {request.user_id}")

        return ManageProfileResponse(
            action_taken=request.action,
            user_id=request.user_id,
            user_data={
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
        )

    async def _publish_profile_change_event(
        self,
        request: ManageProfileRequest,
        response_data: ManageProfileResponse,
        user_context: Dict[str, Any]
    ) -> None:
        """Publish profile change event."""
        user_info = self._extract_user_info(user_context)

        if request.action == ProfileAction.UPDATE_INFO:
            await self._publish_event(
                "publish_user_profile_updated",
                user_id=str(request.user_id),
                updated_fields=response_data.updated_fields or [],
                updated_by_id=user_info["user_id"],
                updated_by_name=user_info["user_name"],
                updated_by_email=user_info["user_email"],
                update_timestamp=response_data.action_taken.value
            )
        elif request.action == ProfileAction.CHANGE_PASSWORD:
            await self._publish_event(
                "publish_user_password_changed",
                user_id=str(request.user_id),
                changed_by_id=user_info["user_id"],
                changed_by_name=user_info["user_name"],
                change_timestamp=response_data.action_taken.value
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