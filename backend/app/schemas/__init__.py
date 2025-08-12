"""
Pydantic schemas for API request/response models.
Uses modern Pydantic v2 syntax with Python 3.11+ typing.
"""

from .content import (
    ContentBase,
    ContentCreate,
    ContentFilters,
    ContentListResponse,
    ContentResponse,
    ContentStateUpdate,
    ContentSummary,
    ContentUpdate,
)
from .user import LoginRequest, PasswordChangeRequest, TokenResponse, UserCreate, UserList, UserResponse, UserUpdate

__all__ = [
    # User schemas
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserList",
    "TokenResponse",
    "LoginRequest",
    "PasswordChangeRequest",
    # Content schemas
    "ContentBase",
    "ContentCreate",
    "ContentUpdate",
    "ContentResponse",
    "ContentSummary",
    "ContentListResponse",
    "ContentStateUpdate",
    "ContentFilters",
]
