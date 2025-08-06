"""
User service for database operations.
Uses modern SQLAlchemy 2.0 async patterns with Python 3.11+ typing.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    """Service class for user-related database operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        """Get user by ID."""
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.created_content))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_username(self, username: str) -> User | None:
        """Get user by username."""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_email(self, email: str) -> User | None:
        """Get user by email."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_username_or_email(self, identifier: str) -> User | None:
        """Get user by username or email (for login)."""
        result = await self.db.execute(
            select(User).where(
                (User.username == identifier) | (User.email == identifier)
            )
        )
        return result.scalar_one_or_none()
    
    async def authenticate_user(
        self, 
        username: str, 
        password: str
    ) -> User | None:
        """
        Authenticate user with username/email and password.
        
        Args:
            username: Username or email
            password: Plain text password
            
        Returns:
            User if authentication successful, None otherwise
        """
        user = await self.get_user_by_username_or_email(username)
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        # Update last login timestamp
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()
        
        return user
    
    async def create_user(self, user_create: UserCreate) -> User:
        """
        Create a new user.
        
        Args:
            user_create: User creation data
            
        Returns:
            Created user
        """
        hashed_password = get_password_hash(user_create.password)
        
        db_user = User(
            username=user_create.username,
            email=user_create.email,
            full_name=user_create.full_name,
            role=user_create.role,
            hashed_password=hashed_password,
        )
        
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        
        return db_user
    
    async def update_user(
        self, 
        user_id: uuid.UUID, 
        user_update: UserUpdate
    ) -> User | None:
        """
        Update user information.
        
        Args:
            user_id: User ID to update
            user_update: Update data
            
        Returns:
            Updated user or None if not found
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            return None
        
        # Update only provided fields
        update_data = user_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await self.db.commit()
        await self.db.refresh(user)
        
        return user
    
    async def change_password(
        self, 
        user_id: uuid.UUID, 
        current_password: str, 
        new_password: str
    ) -> bool:
        """
        Change user password.
        
        Args:
            user_id: User ID
            current_password: Current password for verification
            new_password: New password
            
        Returns:
            True if successful, False if current password is wrong
        """
        user = await self.get_user_by_id(user_id)
        if not user:
            return False
        
        if not verify_password(current_password, user.hashed_password):
            return False
        
        user.hashed_password = get_password_hash(new_password)
        await self.db.commit()
        
        return True
    
    async def activate_user(self, user_id: uuid.UUID) -> bool:
        """Activate user account."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return False
        
        user.is_active = True
        await self.db.commit()
        return True
    
    async def deactivate_user(self, user_id: uuid.UUID) -> bool:
        """Deactivate user account."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return False
        
        user.is_active = False
        await self.db.commit()
        return True
    
    async def get_users(
        self,
        skip: int = 0,
        limit: int = 100,
        role_filter: UserRole | None = None,
        active_only: bool = False,
        search: str | None = None
    ) -> list[User]:
        """
        Get list of users with filtering and pagination.
        
        Args:
            skip: Number of users to skip
            limit: Maximum number of users to return
            role_filter: Filter by user role
            active_only: Only return active users
            search: Search users by username, email, or full name
            
        Returns:
            List of users
        """
        query = select(User)
        
        if active_only:
            query = query.where(User.is_active == True)
        
        if role_filter:
            query = query.where(User.role == role_filter)
        
        if search:
            search_term = f"%{search.lower()}%"
            query = query.where(
                (User.username.ilike(search_term)) |
                (User.email.ilike(search_term)) |
                (User.full_name.ilike(search_term))
            )
        
        query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_user_count(
        self,
        role_filter: UserRole | None = None,
        active_only: bool = False,
        search: str | None = None
    ) -> int:
        """Get total count of users with filtering."""
        query = select(func.count(User.id))
        
        if active_only:
            query = query.where(User.is_active == True)
        
        if role_filter:
            query = query.where(User.role == role_filter)
        
        if search:
            search_term = f"%{search.lower()}%"
            query = query.where(
                (User.username.ilike(search_term)) |
                (User.email.ilike(search_term)) |
                (User.full_name.ilike(search_term))
            )
        
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def username_exists(self, username: str) -> bool:
        """Check if username already exists."""
        result = await self.db.execute(
            select(User.id).where(User.username == username)
        )
        return result.first() is not None
    
    async def email_exists(self, email: str) -> bool:
        """Check if email already exists."""
        result = await self.db.execute(
            select(User.id).where(User.email == email)
        )
        return result.first() is not None