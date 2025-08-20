"""
Role ORM Service - Clean Architecture Implementation.

Provides role management operations for user role definitions and metadata.
Designed to be extensible for future role hierarchy and custom role systems.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.models.user import User, UserRole
from app.services.orm_repositories.user_repository import UserRepository
from .base_orm_service import BaseOrmService


class RoleOrmService(BaseOrmService[User, UserRepository]):
    """
    Role ORM Service managing role definitions and metadata with Clean Architecture.

    Responsibilities:
    - Role definition and metadata management
    - Role hierarchy validation and business rules
    - Role statistics and reporting
    - Extensible design for future custom role systems

    Uses UserRepository for data access operations since roles are User attributes.
    """

    def __init__(self, session: AsyncSession, repository: UserRepository):
        """Initialize Role ORM Service with session and repository."""
        super().__init__(session, repository)

    # Role Management Operations

    async def get_all_roles(self) -> list[dict[str, Any]]:
        """
        Get all available roles with metadata.

        Returns:
            List of role definitions with metadata

        Raises:
            RuntimeError: If operation fails
        """
        try:
            # Define role metadata (extensible for future custom roles)
            role_definitions = []
            
            for role in UserRole:
                role_info = {
                    "name": role.value,
                    "display_name": self._get_role_display_name(role),
                    "description": self._get_role_description(role),
                    "level": self._get_role_level(role),
                    "permissions": self._get_role_permissions(role),
                    "can_be_assigned_by": self._get_assignable_by_roles(role),
                }
                role_definitions.append(role_info)

            return sorted(role_definitions, key=lambda x: x["level"])

        except Exception as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get role definitions: {e}") from e

    async def get_role_statistics(self) -> dict[str, Any]:
        """
        Get statistics about role distribution.

        Returns:
            Role statistics including user counts by role

        Raises:
            RuntimeError: If operation fails
        """
        try:
            stats = {"total_users": 0, "roles": {}, "last_updated": datetime.now(timezone.utc).isoformat()}

            # Get counts for each role
            for role in UserRole:
                users_with_role = await self.repository.find_by_field("role", role.value)
                count = len(users_with_role)
                stats["roles"][role.value] = {
                    "count": count,
                    "percentage": 0,  # Will calculate after getting total
                    "display_name": self._get_role_display_name(role),
                }
                stats["total_users"] += count

            # Calculate percentages
            if stats["total_users"] > 0:
                for role_name in stats["roles"]:
                    role_count = stats["roles"][role_name]["count"]
                    stats["roles"][role_name]["percentage"] = round(
                        (role_count / stats["total_users"]) * 100, 1
                    )

            return stats

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get role statistics: {e}") from e

    async def validate_role_hierarchy(self, current_role: UserRole, target_role: UserRole) -> bool:
        """
        Validate if current role can assign target role.

        Args:
            current_role: Role of user making the assignment
            target_role: Role being assigned

        Returns:
            True if assignment is valid, False otherwise
        """
        # Role hierarchy: ADMIN > APPROVER > REVIEWER > CREATOR > LEARNER > PLAYER
        role_hierarchy = {
            UserRole.ADMIN: 6,
            UserRole.APPROVER: 5,
            UserRole.REVIEWER: 4,
            UserRole.CREATOR: 3,
            UserRole.LEARNER: 2,
            UserRole.PLAYER: 1,
        }

        current_level = role_hierarchy.get(current_role, 0)
        target_level = role_hierarchy.get(target_role, 0)

        # Only admins can assign roles currently
        if current_role != UserRole.ADMIN:
            return False

        # Admins can assign any role
        return current_level >= target_level

    async def get_assignable_roles(self, user_role: UserRole) -> list[dict[str, Any]]:
        """
        Get roles that can be assigned by the given user role.

        Args:
            user_role: Role of user who wants to assign roles

        Returns:
            List of assignable roles with metadata

        Raises:
            RuntimeError: If operation fails
        """
        try:
            assignable = []
            all_roles = await self.get_all_roles()

            for role_info in all_roles:
                role_enum = UserRole(role_info["name"])
                if await self.validate_role_hierarchy(user_role, role_enum):
                    assignable.append(role_info)

            return assignable

        except Exception as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get assignable roles: {e}") from e

    async def get_role_transitions(self, from_role: UserRole) -> dict[str, Any]:
        """
        Get valid role transitions from current role.

        Args:
            from_role: Current role

        Returns:
            Dictionary of valid transitions with metadata

        Raises:
            RuntimeError: If operation fails
        """
        try:
            transitions = {
                "current_role": from_role.value,
                "valid_transitions": [],
                "restricted_transitions": [],
                "promotion_path": [],
            }

            # Define promotion paths (extensible for future role systems)
            promotion_paths = {
                UserRole.PLAYER: [UserRole.LEARNER],
                UserRole.LEARNER: [UserRole.CREATOR],
                UserRole.CREATOR: [UserRole.REVIEWER],
                UserRole.REVIEWER: [UserRole.APPROVER],
                UserRole.APPROVER: [UserRole.ADMIN],
                UserRole.ADMIN: [],  # Admin is highest level
            }

            # Get promotion path
            current_path = []
            current = from_role
            while current in promotion_paths and promotion_paths[current]:
                next_role = promotion_paths[current][0]
                current_path.append({
                    "role": next_role.value,
                    "display_name": self._get_role_display_name(next_role),
                    "description": self._get_role_description(next_role),
                })
                current = next_role

            transitions["promotion_path"] = current_path

            # For now, all roles can be assigned by admin (valid transitions)
            for role in UserRole:
                if role != from_role:
                    transitions["valid_transitions"].append({
                        "role": role.value,
                        "display_name": self._get_role_display_name(role),
                        "requires_admin": True,
                    })

            return transitions

        except Exception as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get role transitions: {e}") from e

    # Future extensibility methods

    async def create_custom_role(
        self, name: str, permissions: list[str], created_by: uuid.UUID
    ) -> dict[str, Any]:
        """
        Create custom role definition (future feature).

        Args:
            name: Custom role name
            permissions: List of permissions for the role
            created_by: User creating the custom role

        Returns:
            Custom role definition

        Note:
            This is a placeholder for future custom role systems
            that go beyond the current enum-based roles.
        """
        # For now, return a placeholder indicating this feature is not yet implemented
        return {
            "name": name,
            "permissions": permissions,
            "created_by": str(created_by),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "not_implemented",
            "message": "Custom roles will be supported in a future version",
        }

    # Helper methods for role metadata

    def _get_role_display_name(self, role: UserRole) -> str:
        """Get human-readable role name."""
        display_names = {
            UserRole.PLAYER: "Player",
            UserRole.LEARNER: "Learner",
            UserRole.CREATOR: "Content Creator", 
            UserRole.REVIEWER: "Content Reviewer",
            UserRole.APPROVER: "Content Approver",
            UserRole.ADMIN: "Administrator",
        }
        return display_names.get(role, role.value.title())

    def _get_role_description(self, role: UserRole) -> str:
        """Get role description."""
        descriptions = {
            UserRole.PLAYER: "Can view and play published content",
            UserRole.LEARNER: "Can access learning content and training programs",
            UserRole.CREATOR: "Can create and edit content, access training",
            UserRole.REVIEWER: "Can review content submissions and approve drafts",
            UserRole.APPROVER: "Can approve content for publication and manage workflows",
            UserRole.ADMIN: "Full system access including user and system management",
        }
        return descriptions.get(role, f"User with {role.value} permissions")

    def _get_role_level(self, role: UserRole) -> int:
        """Get numeric role level for sorting."""
        levels = {
            UserRole.PLAYER: 1,
            UserRole.LEARNER: 2,
            UserRole.CREATOR: 3,
            UserRole.REVIEWER: 4,
            UserRole.APPROVER: 5,
            UserRole.ADMIN: 6,
        }
        return levels.get(role, 0)

    def _get_role_permissions(self, role: UserRole) -> list[str]:
        """Get list of permissions for role."""
        permissions = {
            UserRole.PLAYER: ["view_content", "play_scenarios"],
            UserRole.LEARNER: ["view_content", "play_scenarios", "access_training"],
            UserRole.CREATOR: [
                "view_content", "play_scenarios", "access_training",
                "create_content", "edit_content", "view_analytics"
            ],
            UserRole.REVIEWER: [
                "view_content", "play_scenarios", "access_training", 
                "create_content", "edit_content", "review_content", "view_analytics"
            ],
            UserRole.APPROVER: [
                "view_content", "play_scenarios", "access_training",
                "create_content", "edit_content", "review_content", 
                "approve_content", "view_analytics"
            ],
            UserRole.ADMIN: [
                "view_content", "play_scenarios", "access_training",
                "create_content", "edit_content", "review_content", 
                "approve_content", "manage_users", "view_analytics", "manage_system"
            ],
        }
        return permissions.get(role, [])

    def _get_assignable_by_roles(self, role: UserRole) -> list[str]:
        """Get roles that can assign this role."""
        # Currently only admin can assign roles
        return ["ADMIN"]

    # Abstract method implementations (required by BaseOrmService)

    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """
        Validate role-related entity data.

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
            if isinstance(role, str):
                try:
                    role = UserRole(role)
                except ValueError:
                    raise ValueError(f"Invalid role value: {role}")
            elif not isinstance(role, UserRole):
                raise ValueError(f"Invalid role type: {type(role)}")
            validated_data["role"] = role

        return validated_data

    async def handle_entity_relationships(self, entity: User) -> User:
        """
        Handle User entity relationships for role context.

        Args:
            entity: User entity

        Returns:
            User entity with handled relationships
        """
        # For role management, we don't need to handle complex relationships
        # The User entity already has all needed role information
        return entity