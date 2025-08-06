"""
Pydantic schemas for API request/response models.
Uses modern Pydantic v2 syntax with Python 3.11+ typing.
"""

from .user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserList,
    TokenResponse,
    LoginRequest,
    PasswordChangeRequest
)

from .content import (
    ContentBase,
    ContentCreate,
    ContentUpdate,
    ContentResponse,
    ContentSummary,
    ContentListResponse,
    ContentStateUpdate,
    ContentFilters
)

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
    "ContentFilters"
]