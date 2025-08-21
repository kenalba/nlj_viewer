"""
User Seed Service - Clean Architecture Implementation for User Seeding.

Provides user creation and management operations for database seeding using UserOrmService.
Handles essential user creation and demo user scenarios.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.orm_services.user_orm_service import UserOrmService
from .base_seed_service import BaseSeedService


class UserSeedService(BaseSeedService[UserOrmService]):
    """
    User Seed Service for creating and managing users during database seeding.

    Uses UserOrmService for all user operations, maintaining Clean Architecture
    principles and proper transaction management.

    Key Features:
    - Essential user creation (admin, creator, reviewer, etc.)
    - Demo user scenarios with varied roles and permissions
    - User validation and conflict resolution
    - Role-based user management
    """

    def __init__(self, session: AsyncSession, user_orm_service: UserOrmService):
        """
        Initialize User Seed Service.

        Args:
            session: SQLAlchemy async session
            user_orm_service: UserOrmService for user operations
        """
        super().__init__(session, user_orm_service)

    # Essential Data Implementation

    async def _has_essential_data(self) -> bool:
        """Check if essential users already exist."""
        try:
            # Check for admin user as indicator of essential data
            admin_users = await self.orm_service.get_users_by_role(UserRole.ADMIN)
            return len(admin_users) > 0

        except Exception as e:
            self.logger.error(f"Failed to check essential user data: {e}")
            return False

    async def _seed_essential_items(self) -> dict[str, Any]:
        """
        Create essential users required for system operation.

        Creates basic users for all roles: ADMIN, CREATOR, REVIEWER, PLAYER, LEARNER

        Returns:
            Dictionary with seeding results
        """
        essential_users = [
            {
                "username": "admin",
                "email": "admin@nlj-platform.com",
                "password": "Admin123!",
                "full_name": "System Administrator",
                "role": UserRole.ADMIN,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "creator",
                "email": "creator@nlj-platform.com",
                "password": "Creator123!",
                "full_name": "Content Creator",
                "role": UserRole.CREATOR,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "reviewer",
                "email": "reviewer@nlj-platform.com",
                "password": "Reviewer123!",
                "full_name": "Content Reviewer",
                "role": UserRole.REVIEWER,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "player",
                "email": "player@nlj-platform.com",
                "password": "Player123!",
                "full_name": "Test Player",
                "role": UserRole.PLAYER,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "learner",
                "email": "learner@nlj-platform.com",
                "password": "Learner123!",
                "full_name": "Training Learner",
                "role": UserRole.LEARNER,
                "is_active": True,
                "is_verified": True,
            },
        ]

        created_users = []

        for user_data in essential_users:
            try:
                # Check if user already exists
                existing = await self.orm_service.get_user_by_username(user_data["username"])
                if existing:
                    self.logger.info(f"User {user_data['username']} already exists, skipping")
                    continue

                # Create user using ORM service
                user = await self.orm_service.create_user(
                    username=user_data["username"],
                    email=user_data["email"],
                    password=user_data["password"],
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_active=user_data["is_active"],
                    is_verified=user_data["is_verified"],
                )

                created_users.append(user)
                self.logger.info(f"Created essential user: {user.username} ({user.role})")

            except Exception as e:
                self.logger.error(f"Failed to create user {user_data['username']}: {e}")
                # Continue with other users rather than failing completely
                continue

        return {
            "status": "completed",
            "items_created": len(created_users),
            "user_roles": [user.role for user in created_users],
            "usernames": [user.username for user in created_users],
        }

    async def _seed_demo_items(self, include_samples: bool) -> dict[str, Any]:
        """
        Create demo users for development and testing scenarios.

        Args:
            include_samples: Whether to create varied demo user scenarios

        Returns:
            Dictionary with demo seeding results
        """
        if not include_samples:
            return {"status": "skipped", "items_created": 0}

        demo_users = [
            {
                "username": "demo_instructor",
                "email": "instructor@demo.nlj-platform.com",
                "password": "Demo123!",
                "full_name": "Demo Instructor",
                "role": UserRole.CREATOR,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "demo_student1",
                "email": "student1@demo.nlj-platform.com",
                "password": "Demo123!",
                "full_name": "Demo Student One",
                "role": UserRole.LEARNER,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "demo_student2",
                "email": "student2@demo.nlj-platform.com",
                "password": "Demo123!",
                "full_name": "Demo Student Two",
                "role": UserRole.LEARNER,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "demo_manager",
                "email": "manager@demo.nlj-platform.com",
                "password": "Demo123!",
                "full_name": "Demo Training Manager",
                "role": UserRole.REVIEWER,
                "is_active": True,
                "is_verified": True,
            },
            {
                "username": "test_inactive",
                "email": "inactive@demo.nlj-platform.com",
                "password": "Demo123!",
                "full_name": "Test Inactive User",
                "role": UserRole.PLAYER,
                "is_active": False,  # For testing inactive user scenarios
                "is_verified": True,
            },
        ]

        created_users = []

        for user_data in demo_users:
            try:
                # Check if user already exists
                existing = await self.orm_service.get_user_by_username(user_data["username"])
                if existing:
                    self.logger.info(f"Demo user {user_data['username']} already exists, skipping")
                    continue

                # Create demo user
                user = await self.orm_service.create_user(**user_data)
                created_users.append(user)
                self.logger.info(f"Created demo user: {user.username} ({user.role})")

            except Exception as e:
                self.logger.error(f"Failed to create demo user {user_data['username']}: {e}")
                continue

        return {
            "status": "completed",
            "items_created": len(created_users),
            "user_roles": [user.role for user in created_users],
            "usernames": [user.username for user in created_users],
        }

    async def _clear_seeded_data(self) -> dict[str, Any]:
        """
        Clear seeded users with safety checks.

        Only removes users that appear to be seeded (demo users and test accounts).
        Preserves any manually created users.

        Returns:
            Dictionary with clearing results
        """
        # Define patterns for seeded users
        seeded_patterns = [
            "admin",
            "creator",
            "reviewer",
            "player",
            "learner",  # Essential users
            "demo_",
            "test_",  # Demo and test user prefixes
        ]

        removed_users = []

        for pattern in seeded_patterns:
            try:
                if pattern in ["admin", "creator", "reviewer", "player", "learner"]:
                    # Find exact matches for essential users
                    user = await self.orm_service.get_user_by_username(pattern)
                    if user:
                        await self.orm_service.delete_by_id(user.id)
                        removed_users.append(user.username)
                        self.logger.info(f"Removed seeded user: {user.username}")
                else:
                    # Find users with prefix patterns
                    all_users = await self.orm_service.get_all()
                    for user in all_users:
                        if user.username.startswith(pattern):
                            await self.orm_service.delete_by_id(user.id)
                            removed_users.append(user.username)
                            self.logger.info(f"Removed demo user: {user.username}")

            except Exception as e:
                self.logger.error(f"Failed to remove users with pattern '{pattern}': {e}")
                continue

        return {"status": "completed", "items_removed": len(removed_users), "removed_usernames": removed_users}

    async def _get_current_status(self) -> dict[str, Any]:
        """
        Get current user seeding status and statistics.

        Returns:
            Dictionary with current status information
        """
        try:
            # Get user counts by role
            role_counts = {}
            for role in UserRole:
                users = await self.orm_service.get_users_by_role(role)
                role_counts[role.value] = len(users)

            # Get total user count
            total_users = await self.orm_service.count_all()

            # Check for essential users
            essential_users = ["admin", "creator", "reviewer", "player", "learner"]
            essential_status = {}

            for username in essential_users:
                user = await self.orm_service.get_user_by_username(username)
                essential_status[username] = user is not None

            # Check for demo users
            all_users = await self.orm_service.get_all()
            demo_users = [u.username for u in all_users if u.username.startswith(("demo_", "test_"))]

            return {
                "status": "available",
                "total_users": total_users,
                "role_counts": role_counts,
                "has_essential": all(essential_status.values()),
                "essential_users": essential_status,
                "has_demo": len(demo_users) > 0,
                "demo_users": demo_users,
                "active_users": len([u for u in all_users if u.is_active]),
                "verified_users": len([u for u in all_users if u.is_verified]),
            }

        except Exception as e:
            self.logger.error(f"Failed to get user status: {e}")
            return {"status": "error", "error": str(e), "total_users": 0, "has_essential": False, "has_demo": False}
