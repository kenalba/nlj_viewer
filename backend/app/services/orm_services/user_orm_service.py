"""
User ORM Service - Clean Architecture Implementation.

Provides transaction-managed CRUD operations for User entities using repository pattern.
Handles user authentication, profile management, and role-based operations.
"""

import uuid
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole
from app.services.orm_repositories.user_repository import UserRepository
from .base_orm_service import BaseOrmService


class UserOrmService(BaseOrmService[User, UserRepository]):
    """
    User ORM Service managing User persistence with Clean Architecture.

    Responsibilities:
    - User CRUD operations with transaction management
    - User authentication and password management
    - User profile management and validation
    - Role-based user queries and operations
    - Email and username uniqueness validation

    Uses UserRepository for all data access operations.
    """

    def __init__(self, session: AsyncSession, repository: UserRepository):
        """Initialize User ORM Service with session and repository."""
        super().__init__(session, repository)

    # User-Specific CRUD Operations

    async def create_user(
        self,
        username: str,
        email: str,
        password: str,
        full_name: str | None = None,
        role: UserRole = UserRole.CREATOR,
        is_active: bool = True,
        is_verified: bool = False,
    ) -> User:
        """
        Create new user with validation and password hashing.

        Args:
            username: Unique username
            email: Unique email address
            password: Plain text password (will be hashed)
            full_name: Optional full name
            role: User role (defaults to CREATOR)
            is_active: Whether user is active (defaults to True)
            is_verified: Whether user is verified (defaults to False)

        Returns:
            Created User

        Raises:
            ValueError: If validation fails or username/email exists
            RuntimeError: If creation fails
        """
        # Validate user data
        user_data = await self.validate_entity_data(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            role=role,
            is_active=is_active,
            is_verified=is_verified,
        )

        try:
            # Check for existing username/email
            if await self.repository.username_exists(username):
                raise ValueError(f"Username '{username}' already exists")

            if await self.repository.email_exists(email):
                raise ValueError(f"Email '{email}' already exists")

            # Hash password
            user_data["hashed_password"] = get_password_hash(password)
            del user_data["password"]  # Remove plain password

            user = await self.repository.create(**user_data)
            await self.session.commit()

            return await self.handle_entity_relationships(user)

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except IntegrityError as e:
            await self.session.rollback()
            if "username" in str(e):
                raise ValueError("Username already exists") from e
            elif "email" in str(e):
                raise ValueError("Email already exists") from e
            else:
                raise RuntimeError(f"User creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create user: {e}") from e

    async def get_user_by_username(self, username: str) -> User | None:
        """
        Get user by username.

        Args:
            username: Username to search for

        Returns:
            User if found, None otherwise
        """
        try:
            return await self.repository.get_by_username(username)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user by username: {e}") from e

    async def get_user_by_email(self, email: str) -> User | None:
        """
        Get user by email address.

        Args:
            email: Email to search for

        Returns:
            User if found, None otherwise
        """
        try:
            return await self.repository.get_by_email(email)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user by email: {e}") from e

    async def get_user_by_username_or_email(self, identifier: str) -> User | None:
        """
        Get user by username or email (for login).

        Args:
            identifier: Username or email

        Returns:
            User if found, None otherwise
        """
        try:
            return await self.repository.get_by_username_or_email(identifier)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user by identifier: {e}") from e

    # Authentication Operations

    async def authenticate_user(self, username: str, password: str) -> User | None:
        """
        Authenticate user with username/email and password.

        Args:
            username: Username or email
            password: Plain text password

        Returns:
            User if authentication successful, None otherwise
        """
        try:
            user = await self.repository.get_by_username_or_email(username)
            if not user:
                return None

            if not verify_password(password, user.hashed_password):
                return None

            # Update last login timestamp
            await self.update_last_login(user.id)

            return user

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to authenticate user: {e}") from e

    async def update_last_login(self, user_id: uuid.UUID) -> bool:
        """
        Update user's last login timestamp.

        Args:
            user_id: User UUID

        Returns:
            True if successful, False if user not found
        """
        try:
            updated = await self.repository.update_by_id(user_id, last_login=datetime.now(timezone.utc))
            if updated:
                await self.session.commit()
                return True
            return False

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update last login: {e}") from e

    async def change_password(self, user_id: uuid.UUID, current_password: str, new_password: str) -> bool:
        """
        Change user password with current password verification.

        Args:
            user_id: User UUID
            current_password: Current password for verification
            new_password: New password

        Returns:
            True if successful, False if current password is wrong or user not found

        Raises:
            ValueError: If new password validation fails
            RuntimeError: If update fails
        """
        try:
            user = await self.repository.get_by_id(user_id)
            if not user:
                return False

            if not verify_password(current_password, user.hashed_password):
                return False

            # Validate new password
            await self.validate_password(new_password)

            # Update password
            updated = await self.repository.update_by_id(user_id, hashed_password=get_password_hash(new_password))

            if updated:
                await self.session.commit()
                return True
            return False

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to change password: {e}") from e

    async def reset_password(self, user_id: uuid.UUID, new_password: str) -> bool:
        """
        Reset user password (admin operation, no current password required).

        Args:
            user_id: User UUID
            new_password: New password

        Returns:
            True if successful, False if user not found

        Raises:
            ValueError: If new password validation fails
            RuntimeError: If update fails
        """
        try:
            # Validate new password
            await self.validate_password(new_password)

            updated = await self.repository.update_by_id(user_id, hashed_password=get_password_hash(new_password))

            if updated:
                await self.session.commit()
                return True
            return False

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to reset password: {e}") from e

    # User Status Management

    async def activate_user(self, user_id: uuid.UUID) -> bool:
        """Activate user account."""
        try:
            updated = await self.repository.update_by_id(user_id, is_active=True)
            if updated:
                await self.session.commit()
                return True
            return False
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to activate user: {e}") from e

    async def deactivate_user(self, user_id: uuid.UUID) -> bool:
        """Deactivate user account."""
        try:
            updated = await self.repository.update_by_id(user_id, is_active=False)
            if updated:
                await self.session.commit()
                return True
            return False
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to deactivate user: {e}") from e

    async def verify_user(self, user_id: uuid.UUID) -> bool:
        """Mark user as verified."""
        try:
            updated = await self.repository.update_by_id(user_id, is_verified=True)
            if updated:
                await self.session.commit()
                return True
            return False
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to verify user: {e}") from e

    async def unverify_user(self, user_id: uuid.UUID) -> bool:
        """Mark user as unverified."""
        try:
            updated = await self.repository.update_by_id(user_id, is_verified=False)
            if updated:
                await self.session.commit()
                return True
            return False
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to unverify user: {e}") from e
    
    async def update_user_role(self, user_id: uuid.UUID, new_role: UserRole) -> User | None:
        """Update user's role."""
        try:
            updated = await self.repository.update_by_id(user_id, role=new_role)
            if updated:
                await self.session.commit()
                return updated
            return None
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update user role: {e}") from e

    # User Queries

    async def get_users_by_role(self, role: UserRole) -> list[User]:
        """Get all users with specific role."""
        try:
            return await self.repository.get_users_by_role(role)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get users by role: {e}") from e

    async def search_users(
        self,
        search_term: str,
        role_filter: UserRole | None = None,
        active_only: bool = True,
        limit: int = 50,
    ) -> list[User]:
        """Search users by username, email, or full name."""
        try:
            return await self.repository.search_users(
                search_term=search_term,
                role_filter=role_filter,
                active_only=active_only,
                limit=limit,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to search users: {e}") from e

    async def get_active_users(self, limit: int = 100, offset: int = 0) -> list[User]:
        """Get active users with pagination."""
        try:
            return await self.repository.get_users_with_filters(
                skip=offset,
                limit=limit,
                active_only=True
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get active users: {e}") from e
    
    async def get_users_with_pagination(
        self,
        skip: int = 0,
        limit: int = 100,
        role_filter: UserRole | None = None,
        active_only: bool = False,
        search: str | None = None,
    ) -> list[User]:
        """Get users with pagination and filtering (matches UserService.get_users)."""
        try:
            return await self.repository.get_users_with_filters(
                skip=skip,
                limit=limit,
                role_filter=role_filter,
                active_only=active_only,
                search=search,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get users with pagination: {e}") from e
    
    async def get_user_count(
        self,
        role_filter: UserRole | None = None,
        active_only: bool = False,
        search: str | None = None,
    ) -> int:
        """Get total count of users with filtering (matches UserService.get_user_count)."""
        try:
            return await self.repository.get_user_count_with_filters(
                role_filter=role_filter,
                active_only=active_only,
                search=search,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user count: {e}") from e

    # Validation Methods

    async def username_exists(self, username: str) -> bool:
        """Check if username already exists."""
        try:
            return await self.repository.username_exists(username)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to check username existence: {e}") from e

    async def email_exists(self, email: str) -> bool:
        """Check if email already exists."""
        try:
            return await self.repository.email_exists(email)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to check email existence: {e}") from e

    async def validate_password(self, password: str) -> None:
        """
        Validate password strength.

        Args:
            password: Password to validate

        Raises:
            ValueError: If password doesn't meet requirements
        """
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if len(password) > 128:
            raise ValueError("Password must be less than 128 characters")

        # At least one lowercase letter
        if not re.search(r"[a-z]", password):
            raise ValueError("Password must contain at least one lowercase letter")

        # At least one uppercase letter
        if not re.search(r"[A-Z]", password):
            raise ValueError("Password must contain at least one uppercase letter")

        # At least one digit
        if not re.search(r"\d", password):
            raise ValueError("Password must contain at least one digit")

    # Profile Management Operations (for ManageProfileUseCase)

    async def update_password(self, user_id: uuid.UUID, new_password: str) -> User | None:
        """Update user password (admin operation or after current password verification)."""
        try:
            await self.validate_password(new_password)
            updated = await self.repository.update_by_id(
                user_id, 
                hashed_password=get_password_hash(new_password),
                password_changed_at=datetime.now(timezone.utc)
            )
            if updated:
                await self.session.commit()
                return updated
            return None
        except (ValueError, SQLAlchemyError):
            await self.session.rollback()
            raise

    async def enable_mfa(self, user_id: uuid.UUID, mfa_method: str, mfa_secret: str | None = None) -> User | None:
        """Enable MFA for user (placeholder implementation)."""
        try:
            update_data = {
                "mfa_enabled": True,
                "mfa_method": mfa_method,
                "updated_at": datetime.now(timezone.utc)
            }
            if mfa_secret:
                update_data["mfa_secret"] = mfa_secret
            
            updated = await self.repository.update_by_id(user_id, **update_data)
            if updated:
                await self.session.commit()
                return updated
            return None
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to enable MFA: {e}") from e

    async def disable_mfa(self, user_id: uuid.UUID) -> User | None:
        """Disable MFA for user (placeholder implementation).""" 
        try:
            updated = await self.repository.update_by_id(
                user_id, 
                mfa_enabled=False, 
                mfa_method=None, 
                mfa_secret=None,
                updated_at=datetime.now(timezone.utc)
            )
            if updated:
                await self.session.commit()
                return updated
            return None
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to disable MFA: {e}") from e

    async def add_password_history(self, user_id: uuid.UUID, password_hash: str) -> bool:
        """Add password to history (placeholder - would need password_history table)."""
        # For now, this is a no-op since we don't have a password history table
        # In a real implementation, this would store the password hash in a history table
        return True

    async def store_backup_codes(self, user_id: uuid.UUID, backup_codes: list[str]) -> bool:
        """Store MFA backup codes (placeholder implementation).""" 
        # For now, this is a no-op since we don't have a backup codes table
        # In a real implementation, this would store hashed backup codes
        return True

    async def get_recent_passwords(self, user_id: uuid.UUID, limit: int = 5) -> list[str]:
        """Get recent password hashes (placeholder - would query password_history table)."""
        # For now, return empty list since we don't have password history
        # In a real implementation, this would query the password history table
        return []

    async def update_user_preferences(self, user_id: uuid.UUID, preferences: dict[str, Any]) -> bool:
        """Update user preferences (placeholder implementation)."""
        try:
            # For now, this is a no-op since we don't have a user_preferences table
            # In a real implementation, this would update or upsert preferences in a separate table
            return True
        except Exception as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update user preferences: {e}") from e

    # Abstract Method Implementations

    async def validate_entity_data(self, **kwargs: Any) -> dict[str, Any]:
        """
        Validate user data before persistence.

        Validates required fields, formats, and business rules.
        """
        validated: dict[str, Any] = {}

        # Username validation
        if "username" in kwargs:
            username = kwargs["username"]
            if not isinstance(username, str):
                raise ValueError("Username must be a string")
            username = username.strip().lower()
            if len(username) < 3:
                raise ValueError("Username must be at least 3 characters long")
            if len(username) > 50:
                raise ValueError("Username must be less than 50 characters")
            if not re.match(r"^[a-zA-Z0-9_-]+$", username):
                raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
            validated["username"] = username

        # Email validation
        if "email" in kwargs:
            email = kwargs["email"]
            if not isinstance(email, str):
                raise ValueError("Email must be a string")
            email = email.strip().lower()
            if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
                raise ValueError("Invalid email format")
            if len(email) > 254:
                raise ValueError("Email must be less than 254 characters")
            validated["email"] = email

        # Password validation (for creation)
        if "password" in kwargs:
            password = kwargs["password"]
            if not isinstance(password, str):
                raise ValueError("Password must be a string")
            await self.validate_password(password)
            validated["password"] = password

        # Full name validation
        if "full_name" in kwargs and kwargs["full_name"] is not None:
            full_name = kwargs["full_name"]
            if not isinstance(full_name, str):
                raise ValueError("Full name must be a string")
            full_name = full_name.strip()
            if len(full_name) > 100:
                raise ValueError("Full name must be less than 100 characters")
            validated["full_name"] = full_name if full_name else None

        # Role validation
        if "role" in kwargs:
            role = kwargs["role"]
            if not isinstance(role, UserRole):
                raise ValueError("Role must be a valid UserRole enum")
            validated["role"] = role

        # Boolean validations
        for field in ["is_active", "is_verified"]:
            if field in kwargs:
                validated[field] = bool(kwargs[field])

        # Datetime validations
        if "last_login" in kwargs and kwargs["last_login"] is not None:
            if not isinstance(kwargs["last_login"], datetime):
                raise ValueError("Last login must be a datetime")
            validated["last_login"] = kwargs["last_login"]

        # String validations for updates
        if "hashed_password" in kwargs:
            if not isinstance(kwargs["hashed_password"], str):
                raise ValueError("Hashed password must be a string")
            validated["hashed_password"] = kwargs["hashed_password"]

        return validated

    async def handle_entity_relationships(self, entity: User) -> User:
        """
        Handle user entity relationships after persistence.

        For User entities, this primarily ensures the entity is properly refreshed.
        """
        try:
            # Refresh entity to get latest data
            await self.session.refresh(entity)
            return entity

        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to handle user relationships: {e}") from e
