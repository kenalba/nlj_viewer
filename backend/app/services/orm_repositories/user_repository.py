"""
User repository for user-related database operations.
Handles user queries, authentication, and role management.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select

from app.models.user import User, UserRole
from .base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User entities with authentication and role management."""
    
    @property
    def model(self) -> type[User]:
        return User
    
    async def get_by_username(self, username: str) -> User | None:
        """Get user by username."""
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> User | None:
        """Get user by email address."""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_username_or_email(self, identifier: str) -> User | None:
        """Get user by username or email (for login)."""
        result = await self.session.execute(
            select(User).where(
                or_(
                    User.username == identifier,
                    User.email == identifier
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def username_exists(self, username: str) -> bool:
        """Check if username already exists."""
        result = await self.session.execute(
            select(func.count(User.id)).where(User.username == username)
        )
        return result.scalar() > 0
    
    async def email_exists(self, email: str) -> bool:
        """Check if email already exists."""
        result = await self.session.execute(
            select(func.count(User.id)).where(User.email == email)
        )
        return result.scalar() > 0
    
    async def get_active_users(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[User]:
        """Get all active users."""
        query = select(User).where(User.is_active)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_users_by_role(
        self,
        role: UserRole,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[User]:
        """Get users by their role."""
        query = select(User).where(User.role == role)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def search_users(
        self,
        search_term: str,
        role_filter: UserRole | None = None,
        active_only: bool = True,
        limit: int | None = None
    ) -> list[User]:
        """Search users by username, email, or full name."""
        search_condition = or_(
            User.username.ilike(f"%{search_term}%"),
            User.email.ilike(f"%{search_term}%"),
            User.full_name.ilike(f"%{search_term}%")
        )
        
        conditions = [search_condition]
        
        if active_only:
            conditions.append(User.is_active)
        if role_filter:
            conditions.append(User.role == role_filter)
        
        query = select(User).where(and_(*conditions))
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_verified_users(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[User]:
        """Get all verified users."""
        query = select(User).where(User.is_verified)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_unverified_users(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[User]:
        """Get all unverified users."""
        query = select(User).where(not User.is_verified)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def activate_user(self, user_id: UUID) -> bool:
        """Activate a user account."""
        return await self.update_by_id(user_id, is_active=True) is not None
    
    async def deactivate_user(self, user_id: UUID) -> bool:
        """Deactivate a user account."""
        return await self.update_by_id(user_id, is_active=False) is not None
    
    async def verify_user(self, user_id: UUID) -> bool:
        """Mark a user as verified."""
        return await self.update_by_id(user_id, is_verified=True) is not None
    
    async def change_user_role(self, user_id: UUID, new_role: UserRole) -> bool:
        """Change a user's role."""
        return await self.update_by_id(user_id, role=new_role) is not None
    
    async def update_password(self, user_id: UUID, hashed_password: str) -> bool:
        """Update user's password hash."""
        return await self.update_by_id(user_id, hashed_password=hashed_password) is not None
    
    async def get_users_with_filters(
        self,
        skip: int = 0,
        limit: int = 100,
        role_filter: UserRole | None = None,
        active_only: bool = False,
        search: str | None = None
    ) -> list[User]:
        """
        Get users with filtering, pagination, and search.
        
        Args:
            skip: Number of users to skip (for pagination)
            limit: Maximum number of users to return
            role_filter: Filter by user role  
            active_only: Only return active users
            search: Search users by username, email, or full name
            
        Returns:
            List of users matching the criteria
        """
        query = select(User)
        
        # Apply filters
        conditions = []
        
        if active_only:
            conditions.append(User.is_active)
            
        if role_filter:
            conditions.append(User.role == role_filter)
            
        if search:
            search_term = f"%{search.lower()}%"
            search_condition = or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term), 
                User.full_name.ilike(search_term)
            )
            conditions.append(search_condition)
            
        if conditions:
            query = query.where(and_(*conditions))
            
        # Apply pagination and ordering
        query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_user_count_with_filters(
        self,
        role_filter: UserRole | None = None,
        active_only: bool = False,
        search: str | None = None
    ) -> int:
        """
        Get count of users with filtering and search.
        
        Args:
            role_filter: Filter by user role
            active_only: Only count active users  
            search: Search users by username, email, or full name
            
        Returns:
            Total count of users matching the criteria
        """
        query = select(func.count(User.id))
        
        # Apply same filters as get_users_with_filters
        conditions = []
        
        if active_only:
            conditions.append(User.is_active)
            
        if role_filter:
            conditions.append(User.role == role_filter)
            
        if search:
            search_term = f"%{search.lower()}%"
            search_condition = or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term),
                User.full_name.ilike(search_term)
            )
            conditions.append(search_condition)
            
        if conditions:
            query = query.where(and_(*conditions))
            
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_user_statistics(self) -> dict[str, Any]:
        """Get user statistics for analytics."""
        # Count by role
        role_counts = await self.session.execute(
            select(User.role, func.count(User.id))
            .group_by(User.role)
        )
        
        # Count active/inactive
        active_count = await self.session.execute(
            select(func.count(User.id)).where(User.is_active)
        )
        
        inactive_count = await self.session.execute(
            select(func.count(User.id)).where(not User.is_active)
        )
        
        # Count verified/unverified
        verified_count = await self.session.execute(
            select(func.count(User.id)).where(User.is_verified)
        )
        
        unverified_count = await self.session.execute(
            select(func.count(User.id)).where(not User.is_verified)
        )
        
        # Total count
        total_count = await self.count_all()
        
        return {
            "total_users": total_count,
            "active_users": active_count.scalar(),
            "inactive_users": inactive_count.scalar(),
            "verified_users": verified_count.scalar(),
            "unverified_users": unverified_count.scalar(),
            "by_role": {role.value: count for role, count in role_counts.all()}
        }