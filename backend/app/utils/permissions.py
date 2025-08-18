"""
Backend permissions module for role-based access control.
Matches the frontend permissions system for consistency.
"""

from enum import Enum
from functools import wraps
from typing import Callable, Optional

from fastapi import Depends, HTTPException, status

from app.models.user import User, UserRole
from app.core.deps import get_current_user


class PermissionLevel(Enum):
    """Permission levels for access control."""
    PLAYER = "player"
    CREATOR = "creator" 
    REVIEWER = "reviewer"
    APPROVER = "approver"
    ADMIN = "admin"


def can_view_analytics(user: User) -> bool:
    """Check if user can view analytics data."""
    if not user:
        return False
    return user.role in [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]


def can_manage_users(user: User) -> bool:
    """Check if user can manage other users."""
    if not user:
        return False
    return user.role == UserRole.ADMIN


def can_edit_content(user: User) -> bool:
    """Check if user can edit content."""
    if not user:
        return False
    return user.role in [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]


def can_review_content(user: User) -> bool:
    """Check if user can review content."""
    if not user:
        return False
    return user.role in [UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]


def can_approve_content(user: User) -> bool:
    """Check if user can approve content."""
    if not user:
        return False
    return user.role in [UserRole.APPROVER, UserRole.ADMIN]


def can_manage_system(user: User) -> bool:
    """Check if user can manage system settings (databases, backups, etc)."""
    if not user:
        return False
    return user.role == UserRole.ADMIN


def require_permission(level: PermissionLevel) -> Callable:
    """FastAPI dependency to require specific permission level."""
    
    def permission_dependency(user: User = Depends(get_current_user)) -> User:
        """Check if user has required permission level."""
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
            
        # Map permission levels to role checks
        if level == PermissionLevel.PLAYER:
            # All authenticated users are at least players
            return user
        elif level == PermissionLevel.CREATOR:
            if not can_edit_content(user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Creator permissions required"
                )
        elif level == PermissionLevel.REVIEWER:
            if not can_review_content(user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Reviewer permissions required"
                )
        elif level == PermissionLevel.APPROVER:
            if not can_approve_content(user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Approver permissions required"
                )
        elif level == PermissionLevel.ADMIN:
            if not can_manage_users(user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Administrator permissions required"
                )
        
        return user
    
    return permission_dependency
