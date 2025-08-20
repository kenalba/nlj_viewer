"""
User context utilities for Clean Architecture boundaries.

Converts User models to service-level user context dictionaries.
"""

from app.models.user import User, UserRole


def extract_user_context(user: User) -> dict[str, str | UserRole]:
    """
    Extract user context for use case execution from User model.
    
    Args:
        user: Authenticated user model
        
    Returns:
        Dictionary containing user context for use cases
    """
    return {
        "user_id": str(user.id),
        "user_role": user.role,
        "user_name": user.full_name or user.username,
        "user_email": user.email,
    }