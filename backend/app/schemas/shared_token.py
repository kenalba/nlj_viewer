"""
Pydantic schemas for shared token operations.
Handles validation and serialization for public activity sharing.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator


class SharedTokenCreate(BaseModel):
    """Schema for creating a new shared token."""

    description: Optional[str] = Field(None, max_length=500, description="Optional description for the share")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date (null = permanent)")

    @field_validator("expires_at")
    @classmethod
    def validate_expiration(cls, v):
        if v is not None and v <= datetime.now():
            raise ValueError("Expiration date must be in the future")
        return v


class SharedTokenUpdate(BaseModel):
    """Schema for updating a shared token."""

    description: Optional[str] = Field(None, max_length=500)
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

    @field_validator("expires_at")
    @classmethod
    def validate_expiration(cls, v):
        if v is not None and v <= datetime.now():
            raise ValueError("Expiration date must be in the future")
        return v


class SharedTokenResponse(BaseModel):
    """Schema for shared token response."""

    id: uuid.UUID
    content_id: uuid.UUID
    token: str
    created_by: uuid.UUID
    created_at: datetime
    expires_at: Optional[datetime]
    is_active: bool
    access_count: int
    last_accessed_at: Optional[datetime]
    description: Optional[str]
    is_expired: bool
    is_valid: bool

    # Public URL generation
    public_url: str
    qr_code_url: Optional[str] = None  # Will be generated on demand

    model_config = ConfigDict(from_attributes=True)


class PublicActivityResponse(BaseModel):
    """Schema for public activity data (no sensitive information)."""

    id: uuid.UUID
    title: str
    description: Optional[str]
    content_type: str
    nlj_data: dict  # The actual NLJ scenario data
    created_at: datetime

    # Analytics (optional)
    view_count: int = 0
    completion_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ShareAnalytics(BaseModel):
    """Analytics data for a shared activity."""

    total_shares: int
    total_public_views: int
    total_public_completions: int
    last_shared_at: Optional[datetime]
    most_recent_access: Optional[datetime]


class CreateShareRequest(BaseModel):
    """Request schema for creating a share."""

    description: Optional[str] = Field(None, max_length=500)
    expires_at: Optional[datetime] = None


class CreateShareResponse(BaseModel):
    """Response schema for creating a share."""

    success: bool
    token: SharedTokenResponse
    public_url: str
    message: str = "Share created successfully"
