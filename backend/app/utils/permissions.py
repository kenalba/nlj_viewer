"""
Backend permissions module for role-based access control.
Matches the frontend permissions system for consistency.
"""

from app.models.user import User, UserRole


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
