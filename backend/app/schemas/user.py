"""
User-related Pydantic schemas for API requests and responses.
Uses modern Pydantic v2 with Python 3.11+ typing.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.user import UserRole


# Base schemas
class UserBase(BaseModel):
    """Base user schema with common fields."""
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="User email address")
    full_name: str | None = Field(None, max_length=255, description="Full display name")
    role: UserRole = Field(default=UserRole.PLAYER, description="User role for permissions")


class UserCreate(UserBase):
    """Schema for user creation requests."""
    password: str = Field(..., min_length=8, max_length=100, description="User password")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "johndoe",
                "email": "john@example.com",
                "full_name": "John Doe",
                "role": "CREATOR",
                "password": "securepassword123"
            }
        }
    )


class UserUpdate(BaseModel):
    """Schema for user update requests."""
    username: str | None = Field(None, min_length=3, max_length=50, description="Username")
    email: EmailStr | None = None
    full_name: str | None = Field(None, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "newemail@example.com",
                "full_name": "John Updated Doe",
                "role": "REVIEWER",
                "is_active": True
            }
        }
    )


class UserResponse(UserBase):
    """Schema for user responses (excludes sensitive data)."""
    id: uuid.UUID
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    last_login: datetime | None
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "username": "johndoe",
                "email": "john@example.com",
                "full_name": "John Doe",
                "role": "CREATOR",
                "is_active": True,
                "is_verified": False,
                "created_at": "2025-01-24T10:00:00Z",
                "updated_at": "2025-01-24T10:00:00Z",
                "last_login": None
            }
        }
    )


class UserProfile(UserResponse):
    """Extended user profile with additional details."""
    content_count: int = Field(default=0, description="Number of content items created")
    approval_count: int = Field(default=0, description="Number of approvals completed")


class UserList(BaseModel):
    """Schema for paginated user list responses."""
    users: list[UserResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "users": [],
                "total": 50,
                "page": 1,
                "per_page": 20,
                "has_next": True,
                "has_prev": False
            }
        }
    )


# Authentication schemas
class LoginRequest(BaseModel):
    """Schema for login requests."""
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="User password")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "johndoe",
                "password": "securepassword123"
            }
        }
    )


class TokenResponse(BaseModel):
    """Schema for authentication token responses."""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    user: UserResponse = Field(..., description="Authenticated user information")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "expires_in": 1800,
                "user": {
                    "id": "123e4567-e89b-12d3-a456-426614174000",
                    "username": "johndoe",
                    "email": "john@example.com",
                    "role": "CREATOR"
                }
            }
        }
    )


class PasswordChangeRequest(BaseModel):
    """Schema for password change requests."""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=100, description="New password")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "current_password": "oldpassword123",
                "new_password": "newsecurepassword456"
            }
        }
    )