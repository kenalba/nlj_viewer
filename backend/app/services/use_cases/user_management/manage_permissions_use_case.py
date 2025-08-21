"""
Manage Permissions Use Case - Simplified User Role Management.

Leverages existing permission system from app/utils/permissions.py
Handles basic role changes using JWT and existing UserOrmService.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.orm_services.user_orm_service import UserOrmService
from app.services.orm_services.permission_orm_service import PermissionOrmService
from app.services.orm_services.role_orm_service import RoleOrmService
from app.schemas.services.permission_schemas import (
    PermissionServiceSchema,
    UserPermissionSummaryServiceSchema,
)
from app.utils.permissions import can_manage_users
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class PermissionAction(Enum):
    """Permission management actions."""

    CHANGE_USER_ROLE = "change_user_role"
    CHECK_PERMISSIONS = "check_permissions"
    LIST_USER_PERMISSIONS = "list_user_permissions"
    GET_ROLE_STATISTICS = "get_role_statistics"
    GET_ASSIGNABLE_ROLES = "get_assignable_roles"


@dataclass
class ManagePermissionsRequest:
    """Request object for permission management operations."""

    action: PermissionAction
    target_user_id: UUID
    new_role: UserRole | None = None
    change_reason: str | None = None


@dataclass
class ManagePermissionsResponse:
    """Response object for permission management operations."""

    action_taken: PermissionAction
    target_user_id: UUID
    user_data: dict[str, Any]
    permission_change: PermissionServiceSchema | None = None
    permission_summary: UserPermissionSummaryServiceSchema | None = None
    role_statistics: dict[str, Any] | None = None
    assignable_roles: list[dict[str, Any]] | None = None


class ManagePermissionsUseCase(BaseUseCase[ManagePermissionsRequest, ManagePermissionsResponse]):
    """
    Use case for comprehensive user permission management with Clean Architecture.

    Uses PermissionOrmService and RoleOrmService for extensible permission management
    while maintaining compatibility with existing JWT-based system.

    Responsibilities:
    - Change user roles with proper validation and audit trails
    - Check user permissions based on role
    - List user's effective permissions
    - Provide role statistics and management capabilities
    - Extensible for future external identity provider integration

    Events Published:
    - Role change events (nlj.permissions.role_changed)
    - Permission query events (nlj.permissions.permission_checked)
    """

    def __init__(
        self,
        session: AsyncSession,
        user_orm_service: UserOrmService,
        permission_orm_service: PermissionOrmService,
        role_orm_service: RoleOrmService,
    ):
        """
        Initialize manage permissions use case.

        Args:
            session: Database session for transaction management
            user_orm_service: User data access and management
            permission_orm_service: Permission operations and validation
            role_orm_service: Role management operations
        """
        super().__init__(
            session,
            user_orm_service=user_orm_service,
            permission_orm_service=permission_orm_service,
            role_orm_service=role_orm_service,
        )

    async def execute(
        self, request: ManagePermissionsRequest, user_context: dict[str, Any]
    ) -> ManagePermissionsResponse:
        """
        Execute permission management workflow.

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
            await self._validate_permission_rights(request, current_user_id)

            # Route to specific action handler
            response_data: dict[str, Any] = {}

            if request.action == PermissionAction.CHANGE_USER_ROLE:
                response_data = await self._handle_change_user_role(request, current_user_id)
            elif request.action == PermissionAction.CHECK_PERMISSIONS:
                response_data = await self._handle_check_permissions(request)
            elif request.action == PermissionAction.LIST_USER_PERMISSIONS:
                response_data = await self._handle_list_permissions(request)
            elif request.action == PermissionAction.GET_ROLE_STATISTICS:
                response_data = await self._handle_get_role_statistics(request)
            elif request.action == PermissionAction.GET_ASSIGNABLE_ROLES:
                response_data = await self._handle_get_assignable_roles(request, current_user_id)
            else:
                raise ValueError(f"Unsupported permission action: {request.action}")

            # Create standardized response
            final_response = await self._create_response(request, response_data)

            # Publish events for audit trail - wrapped for resilience
            try:
                await self._publish_permission_event(final_response, request, user_context)
            except Exception as e:
                # Log but don't fail the business operation - events are non-critical
                logger.warning(f"Failed to publish permission event: {e}")

            logger.info(f"Permission management completed: {request.action.value} for user {request.target_user_id}")
            return final_response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"permission management {request.action.value}")
            raise  # Add explicit raise to satisfy type checker
        except Exception as e:
            await self._handle_service_error(e, f"permission management {request.action.value}")
            raise  # This will never be reached but satisfies mypy

    async def _validate_permission_rights(self, request: ManagePermissionsRequest, current_user_id: UUID) -> None:
        """Validate user has rights to perform permission operations."""
        user_orm_service = self.dependencies["user_orm_service"]
        current_user = await user_orm_service.get_by_id(current_user_id)

        if not current_user:
            raise ValueError("Current user not found")

        # For role management, only admins can make changes
        if request.action in [PermissionAction.CHANGE_USER_ROLE, PermissionAction.GET_ROLE_STATISTICS]:
            if not can_manage_users(current_user):
                raise PermissionError("Admin role required for role management")

        # Prevent self-role changes to non-admin
        if (
            request.action == PermissionAction.CHANGE_USER_ROLE
            and request.target_user_id == current_user_id
            and request.new_role != UserRole.ADMIN
        ):
            raise PermissionError("Cannot change your own role from admin")

    async def _handle_change_user_role(
        self, request: ManagePermissionsRequest, current_user_id: UUID
    ) -> dict[str, Any]:
        """Handle user role change with proper ORM services."""
        if not request.new_role:
            raise ValueError("New role is required for role change")

        permission_orm_service = self.dependencies["permission_orm_service"]
        user_orm_service = self.dependencies["user_orm_service"]

        # Validate role change is allowed
        is_valid = await permission_orm_service.validate_role_change(
            request.target_user_id, request.new_role, current_user_id
        )

        if not is_valid:
            raise PermissionError("Role change not permitted")

        # Update user role using permission service
        permission_change = await permission_orm_service.update_user_role(
            user_id=request.target_user_id, new_role=request.new_role, changed_by=current_user_id
        )

        # Get updated user data
        updated_user = await user_orm_service.get_by_id(request.target_user_id)
        if not updated_user:
            raise RuntimeError("Failed to retrieve updated user")

        return {
            "permission_change": permission_change,
            "user_data": {
                "id": str(updated_user.id),
                "username": updated_user.username,
                "email": updated_user.email,
                "role": updated_user.role.value,
                "is_active": updated_user.is_active,
            },
        }

    async def _handle_check_permissions(self, request: ManagePermissionsRequest) -> dict[str, Any]:
        """Check user permissions using permission service."""
        permission_orm_service = self.dependencies["permission_orm_service"]

        permission_summary = await permission_orm_service.get_user_permissions(request.target_user_id)

        if not permission_summary:
            raise ValueError(f"User not found: {request.target_user_id}")

        user_orm_service = self.dependencies["user_orm_service"]
        user = await user_orm_service.get_by_id(request.target_user_id)

        return {
            "permission_summary": permission_summary,
            "user_data": {
                "id": str(user.id),
                "username": user.username,
                "role": user.role.value,
                "is_active": user.is_active,
            },
        }

    async def _handle_list_permissions(self, request: ManagePermissionsRequest) -> dict[str, Any]:
        """List comprehensive user permissions."""
        permission_orm_service = self.dependencies["permission_orm_service"]

        permission_summary = await permission_orm_service.get_permission_summary(request.target_user_id)

        if not permission_summary:
            raise ValueError(f"User not found: {request.target_user_id}")

        user_orm_service = self.dependencies["user_orm_service"]
        user = await user_orm_service.get_by_id(request.target_user_id)

        return {
            "permission_summary": UserPermissionSummaryServiceSchema(
                user_id=request.target_user_id,
                role=user.role,
                permissions=permission_summary["permissions"],
                granular_permissions=permission_summary.get("granular_permissions"),
                permission_groups=permission_summary.get("permission_groups"),
                external_permissions=permission_summary.get("external_permissions"),
            ),
            "user_data": {
                "id": str(user.id),
                "username": user.username,
                "role": user.role.value,
                "is_active": user.is_active,
            },
        }

    async def _handle_get_role_statistics(self, request: ManagePermissionsRequest) -> dict[str, Any]:
        """Get role statistics using role service."""
        role_orm_service = self.dependencies["role_orm_service"]

        statistics = await role_orm_service.get_role_statistics()

        return {"role_statistics": statistics, "user_data": {}}  # No specific user data for statistics

    async def _handle_get_assignable_roles(
        self, request: ManagePermissionsRequest, current_user_id: UUID
    ) -> dict[str, Any]:
        """Get roles that can be assigned by current user."""
        role_orm_service = self.dependencies["role_orm_service"]
        user_orm_service = self.dependencies["user_orm_service"]

        current_user = await user_orm_service.get_by_id(current_user_id)
        if not current_user:
            raise ValueError("Current user not found")

        assignable_roles = await role_orm_service.get_assignable_roles(current_user.role)

        return {
            "assignable_roles": assignable_roles,
            "user_data": {},  # No specific target user data for assignable roles
        }

    async def _create_response(
        self, request: ManagePermissionsRequest, response_data: dict[str, Any]
    ) -> ManagePermissionsResponse:
        """Create standardized response object."""
        return ManagePermissionsResponse(
            action_taken=request.action,
            target_user_id=request.target_user_id,
            user_data=response_data.get("user_data", {}),
            permission_change=response_data.get("permission_change"),
            permission_summary=response_data.get("permission_summary"),
            role_statistics=response_data.get("role_statistics"),
            assignable_roles=response_data.get("assignable_roles"),
        )

    async def _publish_permission_event(
        self, response: ManagePermissionsResponse, request: ManagePermissionsRequest, user_context: dict[str, Any]
    ) -> None:
        """Publish permission management events for audit trail."""
        user_info = self._extract_user_info(user_context)

        if request.action == PermissionAction.CHANGE_USER_ROLE:
            await self._publish_event(
                "publish_permissions_role_changed",
                target_user_id=str(request.target_user_id),
                new_role=request.new_role.value if request.new_role else None,
                previous_role=(
                    response.permission_change.previous_role.value
                    if response.permission_change and response.permission_change.previous_role
                    else None
                ),
                changed_by_id=user_info["user_id"],
                changed_by_name=user_info["user_name"],
                changed_by_email=user_info["user_email"],
                change_reason=request.change_reason,
                change_timestamp=datetime.now().isoformat(),
            )

        elif request.action in [PermissionAction.CHECK_PERMISSIONS, PermissionAction.LIST_USER_PERMISSIONS]:
            await self._publish_event(
                "publish_permissions_permission_checked",
                target_user_id=str(request.target_user_id),
                action=request.action.value,
                checked_by_id=user_info["user_id"],
                checked_by_name=user_info["user_name"],
                check_timestamp=datetime.now().isoformat(),
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
