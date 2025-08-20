"""
Manage Permissions Use Case - Simplified User Role Management.

Leverages existing permission system from app/utils/permissions.py
Handles basic role changes using JWT and existing UserOrmService.
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.orm_services.user_orm_service import UserOrmService
from app.utils.permissions import can_manage_users, can_edit_content, can_review_content, can_approve_content
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class PermissionAction(Enum):
    """Permission management actions (simplified)."""
    CHANGE_USER_ROLE = "change_user_role"
    CHECK_PERMISSIONS = "check_permissions"
    LIST_USER_PERMISSIONS = "list_user_permissions"


@dataclass
class ManagePermissionsRequest:
    """Request object for permission management operations (simplified)."""
    action: PermissionAction
    target_user_id: UUID
    new_role: Optional[UserRole] = None


@dataclass
class ManagePermissionsResponse:
    """Response object for permission management operations (simplified)."""
    action_taken: PermissionAction
    target_user_id: UUID
    user_data: Dict[str, Any]
    previous_role: Optional[str] = None
    new_role: Optional[str] = None
    permissions: Optional[Dict[str, bool]] = None


class ManagePermissionsUseCase(BaseUseCase[ManagePermissionsRequest, ManagePermissionsResponse]):
    """
    Use case for simplified user permission management.

    Uses existing app/utils/permissions.py functions and UserOrmService.
    Leverages JWT tokens for permission enforcement at API level.

    Responsibilities:
    - Change user roles (admin only)
    - Check user permissions based on role
    - List user's effective permissions

    Events Published:
    - Role change events (nlj.user.role_changed)
    """

    def __init__(
        self,
        session: AsyncSession,
        user_orm_service: UserOrmService
    ):
        """
        Initialize manage permissions use case.

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
        request: ManagePermissionsRequest,
        user_context: Dict[str, Any]
    ) -> ManagePermissionsResponse:
        """
        Execute permission management workflow (simplified).

        Args:
            request: Permission management request
            user_context: Current user context for authorization

        Returns:
            Permission management response

        Raises:
            PermissionError: If user lacks permission for operation
            ValueError: If request validation fails
            RuntimeError: If operation fails
        """
        try:
            # Validate permissions for the operation
            current_user_id = UUID(user_context["user_id"])
            user_orm_service = self.dependencies["user_orm_service"]
            current_user = await user_orm_service.get_by_id(current_user_id)
            
            if not current_user:
                raise ValueError("Current user not found")

            # Route to specific action handler
            if request.action == PermissionAction.CHANGE_USER_ROLE:
                response_data = await self._handle_change_user_role(request, current_user)
            elif request.action == PermissionAction.CHECK_PERMISSIONS:
                response_data = await self._handle_check_permissions(request)
            elif request.action == PermissionAction.LIST_USER_PERMISSIONS:
                response_data = await self._handle_list_permissions(request)
            else:
                raise ValueError(f"Unsupported permission action: {request.action}")

            # Publish permission change event if applicable
            if request.action == PermissionAction.CHANGE_USER_ROLE and response_data.get("role_changed"):
                await self._publish_role_change_event(request, response_data, user_context)

            logger.info(
                f"Permission management completed: {request.action.value} for user {request.target_user_id}"
            )
            return response_data

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"permission management {request.action.value}")
        except Exception as e:
            await self._handle_service_error(e, f"permission management {request.action.value}")
            raise  # This will never be reached but satisfies mypy

    async def _handle_change_user_role(
        self,
        request: ManagePermissionsRequest,
        current_user: Any
    ) -> ManagePermissionsResponse:
        """Handle user role change (admin only)."""
        # Check if current user can manage users
        if not can_manage_users(current_user):
            raise PermissionError("Only administrators can change user roles")

        if not request.new_role:
            raise ValueError("New role is required for role change operation")

        # Get target user
        user_orm_service = self.dependencies["user_orm_service"]
        target_user = await user_orm_service.get_by_id(request.target_user_id)
        
        if not target_user:
            raise ValueError(f"Target user not found: {request.target_user_id}")

        # Prevent admins from demoting themselves
        if target_user.id == current_user.id and request.new_role != UserRole.ADMIN:
            raise PermissionError("Administrators cannot change their own role")

        # Store previous role for response
        previous_role = target_user.role.value

        # Update user role using existing UserOrmService method
        success = await user_orm_service.update_by_id(
            request.target_user_id, 
            role=request.new_role
        )
        
        if not success:
            raise RuntimeError("Failed to update user role")

        # Get updated user for response
        updated_user = await user_orm_service.get_by_id(request.target_user_id)

        return ManagePermissionsResponse(
            action_taken=request.action,
            target_user_id=request.target_user_id,
            user_data={
                "id": str(updated_user.id),
                "username": updated_user.username,
                "email": updated_user.email,
                "role": updated_user.role.value,
                "is_active": updated_user.is_active
            },
            previous_role=previous_role,
            new_role=updated_user.role.value
        )

    async def _handle_check_permissions(
        self,
        request: ManagePermissionsRequest
    ) -> ManagePermissionsResponse:
        """Check user permissions based on their role."""
        # Get target user
        user_orm_service = self.dependencies["user_orm_service"]
        target_user = await user_orm_service.get_by_id(request.target_user_id)
        
        if not target_user:
            raise ValueError(f"Target user not found: {request.target_user_id}")

        # Use existing permission functions to check capabilities
        permissions = {
            "can_edit_content": can_edit_content(target_user),
            "can_review_content": can_review_content(target_user),
            "can_approve_content": can_approve_content(target_user),
            "can_manage_users": can_manage_users(target_user),
        }

        return ManagePermissionsResponse(
            action_taken=request.action,
            target_user_id=request.target_user_id,
            user_data={
                "id": str(target_user.id),
                "username": target_user.username,
                "role": target_user.role.value,
                "is_active": target_user.is_active
            },
            permissions=permissions
        )

    async def _handle_list_permissions(
        self,
        request: ManagePermissionsRequest
    ) -> ManagePermissionsResponse:
        """List all permissions available to user based on role."""
        # Get target user
        user_orm_service = self.dependencies["user_orm_service"]
        target_user = await user_orm_service.get_by_id(request.target_user_id)
        
        if not target_user:
            raise ValueError(f"Target user not found: {request.target_user_id}")

        # Define role-based permission matrix
        role_permissions = {
            UserRole.PLAYER: {
                "can_view_content": True,
                "can_play_scenarios": True,
            },
            UserRole.LEARNER: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_access_training": True,
            },
            UserRole.CREATOR: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_create_content": True,
                "can_access_training": True,
            },
            UserRole.REVIEWER: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_review_content": True,
                "can_access_training": True,
                "can_view_analytics": True,
            },
            UserRole.APPROVER: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_review_content": True,
                "can_approve_content": True,
                "can_access_training": True,
                "can_view_analytics": True,
            },
            UserRole.ADMIN: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_review_content": True,
                "can_approve_content": True,
                "can_manage_users": True,
                "can_access_training": True,
                "can_view_analytics": True,
                "can_manage_system": True,
            },
        }

        user_permissions = role_permissions.get(target_user.role, {})

        return ManagePermissionsResponse(
            action_taken=request.action,
            target_user_id=request.target_user_id,
            user_data={
                "id": str(target_user.id),
                "username": target_user.username,
                "role": target_user.role.value,
                "is_active": target_user.is_active
            },
            permissions=user_permissions
        )

    async def _publish_role_change_event(
        self,
        request: ManagePermissionsRequest,
        response_data: ManagePermissionsResponse,
        user_context: Dict[str, Any]
    ) -> None:
        """Publish role change event."""
        admin_info = self._extract_user_info(user_context)

        await self._publish_event(
            "publish_user_role_changed",
            target_user_id=str(request.target_user_id),
            previous_role=response_data.previous_role,
            new_role=response_data.new_role,
            changed_by_id=admin_info["user_id"],
            changed_by_name=admin_info["user_name"],
            changed_by_email=admin_info["user_email"],
            change_timestamp=request.action.value
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