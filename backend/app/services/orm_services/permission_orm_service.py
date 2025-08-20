"""
Permission ORM Service - Clean Architecture Implementation.

Provides transaction-managed permission operations using existing User role system.
Designed to be extensible for future integration with external identity providers.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.models.user import User, UserRole
from app.services.orm_repositories.user_repository import UserRepository
from app.schemas.services.permission_schemas import (
    PermissionServiceSchema,
    UserPermissionSummaryServiceSchema,
)
from .base_orm_service import BaseOrmService


class PermissionOrmService(BaseOrmService[User, UserRepository]):
    """
    Permission ORM Service managing role-based permissions with Clean Architecture.

    Responsibilities:
    - User role management with transaction safety
    - Permission validation and business rules
    - Role change logging and audit trails
    - Extensible design for future external permission systems

    Uses UserRepository for all data access operations.
    """

    def __init__(self, session: AsyncSession, repository: UserRepository):
        """Initialize Permission ORM Service with session and repository."""
        super().__init__(session, repository)

    # Permission Management Operations

    async def get_user_permissions(
        self, user_id: uuid.UUID
    ) -> UserPermissionSummaryServiceSchema | None:
        """
        Get comprehensive permission summary for a user.

        Args:
            user_id: User UUID

        Returns:
            UserPermissionSummaryServiceSchema if user found, None otherwise

        Raises:
            RuntimeError: If operation fails
        """
        try:
            user = await self.repository.get_by_id(user_id)
            if not user:
                return None

            return UserPermissionSummaryServiceSchema.from_user_role(
                user_id, user.role
            )

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user permissions: {e}") from e

    async def update_user_role(
        self, user_id: uuid.UUID, new_role: UserRole, changed_by: uuid.UUID
    ) -> PermissionServiceSchema:
        """
        Update user role with audit trail.

        Args:
            user_id: Target user UUID
            new_role: New role to assign
            changed_by: User making the change

        Returns:
            PermissionServiceSchema with change details

        Raises:
            ValueError: If user not found or invalid role change
            RuntimeError: If operation fails
        """
        try:
            user = await self.repository.get_by_id(user_id)
            if not user:
                raise ValueError(f"User not found: {user_id}")

            previous_role = user.role

            # Validate role change
            if previous_role == new_role:
                raise ValueError("New role must be different from current role")

            # Update user role
            updated_user = await self.repository.update_by_id(
                user_id, role=new_role, updated_at=datetime.now(timezone.utc)
            )

            if not updated_user:
                raise RuntimeError("Failed to update user role")

            await self.session.commit()

            # Create permission change record
            permission_change = PermissionServiceSchema.from_user_role_change(
                user_id=user_id,
                new_role=new_role,
                previous_role=previous_role,
                changed_by=changed_by,
                change_reason="Role updated via permission management"
            )

            return permission_change

        except ValueError:
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update user role: {e}") from e

    async def validate_role_change(
        self,
        user_id: uuid.UUID,
        new_role: UserRole,
        changer_id: uuid.UUID
    ) -> bool:
        """
        Validate if a role change is permitted.

        Args:
            user_id: Target user UUID
            new_role: Proposed new role
            changer_id: User making the change

        Returns:
            True if role change is allowed, False otherwise

        Raises:
            RuntimeError: If validation fails
        """
        try:
            # Get both users
            target_user = await self.repository.get_by_id(user_id)
            changer_user = await self.repository.get_by_id(changer_id)

            if not target_user or not changer_user:
                return False

            # Only admins can change roles
            if changer_user.role != UserRole.ADMIN:
                return False

            # Prevent admins from demoting themselves
            if user_id == changer_id and new_role != UserRole.ADMIN:
                return False

            return True

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to validate role change: {e}") from e

    async def get_users_with_role(
        self, role: UserRole, limit: int = 100, offset: int = 0
    ) -> list[User]:
        """
        Get all users with a specific role.

        Args:
            role: Target role
            limit: Maximum results to return
            offset: Number of results to skip

        Returns:
            List of User objects with the specified role

        Raises:
            RuntimeError: If operation fails
        """
        try:
            return await self.repository.find_by_field("role", role.value)

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get users with role: {e}") from e

    async def get_permission_summary(
        self, user_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """
        Get detailed permission summary for external systems.

        Args:
            user_id: User UUID

        Returns:
            Permission summary dictionary if user found, None otherwise
        """
        permission_summary = await self.get_user_permissions(user_id)
        if not permission_summary:
            return None

        return {
            "user_id": str(user_id),
            "role": permission_summary.role.value,
            "permissions": permission_summary.permissions,
            "content_states_access": permission_summary.get_allowed_content_states(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            # Extensibility fields for future external providers
            "external_permissions": permission_summary.external_permissions,
            "permission_groups": permission_summary.permission_groups,
            "granular_permissions": permission_summary.granular_permissions,
        }

    async def get_user_permission_summary(
        self, user_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """Alias for get_permission_summary for test compatibility."""
        return await self.get_permission_summary(user_id)

    async def get_detailed_user_permissions(
        self, user_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        """
        Get detailed list of user permissions.

        Args:
            user_id: User UUID

        Returns:
            List of permission dictionaries
        """
        permission_summary = await self.get_user_permissions(user_id)
        if not permission_summary:
            return []

        # Convert permissions to detailed list format
        detailed_permissions = []
        for permission in permission_summary.permissions:
            detailed_permissions.append({
                "permission": permission,
                "granted": True,
                "source": "role_based",
                "role": permission_summary.role.value
            })

        return detailed_permissions

    async def create_role_change_record(
        self,
        user_id: uuid.UUID,
        previous_role: UserRole,
        new_role: UserRole,
        changed_by: uuid.UUID,
        change_reason: str | None = None
    ) -> PermissionServiceSchema:
        """
        Create role change record.

        Args:
            user_id: Target user UUID
            previous_role: Previous role
            new_role: New role
            changed_by: User making the change
            change_reason: Optional reason for the change

        Returns:
            PermissionServiceSchema with change details
        """
        return PermissionServiceSchema.from_user_role_change(
            user_id=user_id,
            new_role=new_role,
            previous_role=previous_role,
            changed_by=changed_by,
            change_reason=change_reason or "Role updated"
        )

    # Future extensibility methods

    async def sync_with_external_provider(
        self,
        user_id: uuid.UUID,
        provider: str,
        external_role_mapping: dict[str, UserRole]
    ) -> PermissionServiceSchema | None:
        """
        Sync permissions with external identity provider (future feature).

        Args:
            user_id: User UUID
            provider: External provider name (e.g., "keycloak")
            external_role_mapping: Mapping of external roles to internal roles

        Returns:
            PermissionServiceSchema if sync occurred, None otherwise

        Note:
            This is a placeholder for future integration with external systems
            like Keycloak that may have their own role/permission stores.
        """
        # For now, just return current permissions
        # In future, this could:
        # - Query external provider for user roles
        # - Map external roles to internal roles
        # - Update local user role if needed
        # - Handle conflicts between systems
        user_permissions = await self.get_user_permissions(user_id)
        if not user_permissions:
            return None

        return PermissionServiceSchema(
            user_id=user_id,
            role=user_permissions.role,
            previous_role=None,
            changed_by=user_id,  # Self-sync
            external_provider=provider,
            change_reason=f"Synced with {provider}"
        )

    async def create_permission_audit_log(
        self,
        permission_change: PermissionServiceSchema,
        additional_metadata: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Create audit log entry for permission changes.

        Args:
            permission_change: Permission change details
            additional_metadata: Extra audit information

        Returns:
            Audit log entry data
        """
        audit_entry = {
            "change_id": str(uuid.uuid4()),
            "user_id": str(permission_change.user_id),
            "action": "role_change",
            "previous_role": (
                permission_change.previous_role.value
                if permission_change.previous_role
                else None
            ),
            "new_role": permission_change.role.value,
            "changed_by": str(permission_change.changed_by),
            "change_reason": permission_change.change_reason,
            "external_provider": permission_change.external_provider,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": additional_metadata or {},
        }

        # In a future implementation, this could be stored in a dedicated
        # audit log table or sent to an external audit system
        return audit_entry

    # Abstract method implementations (required by BaseOrmService)

    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """
        Validate permission-related entity data.

        Args:
            **kwargs: Entity data to validate

        Returns:
            Validated data

        Raises:
            ValueError: If validation fails
        """
        validated_data = {}

        if "role" in kwargs:
            role = kwargs["role"]
            if not isinstance(role, UserRole):
                raise ValueError(f"Invalid role type: {type(role)}")
            validated_data["role"] = role

        if "user_id" in kwargs:
            user_id = kwargs["user_id"]
            if not isinstance(user_id, uuid.UUID):
                try:
                    user_id = uuid.UUID(str(user_id))
                except (ValueError, TypeError):
                    raise ValueError(f"Invalid user_id format: {user_id}")
            validated_data["user_id"] = user_id

        return validated_data

    async def handle_entity_relationships(self, entity: User) -> User:
        """
        Handle User entity relationships for permission context.

        Args:
            entity: User entity

        Returns:
            User entity with handled relationships
        """
        # For permission management, we don't need to handle complex relationships
        # The User entity already has all needed role information
        return entity
