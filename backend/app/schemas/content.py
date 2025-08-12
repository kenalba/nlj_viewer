"""
Content schemas for request/response validation with modern Pydantic v2.
Handles NLJ scenario data with comprehensive validation.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict

from app.models.content import ContentState, ContentType, LearningStyle
from app.models.user import UserRole


class UserSummary(BaseModel):
    """Basic user information for content responses."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    username: str
    full_name: Optional[str] = None
    role: UserRole


class ContentBase(BaseModel):
    """Base content schema with common fields."""
    
    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Content title"
    )
    description: Optional[str] = Field(
        None,
        description="Content description"
    )
    content_type: ContentType = Field(
        default=ContentType.TRAINING,
        description="Type of content"
    )
    learning_style: Optional[LearningStyle] = Field(
        None,
        description="Primary learning style for this content"
    )
    is_template: bool = Field(
        default=False,
        description="Whether this content is a template"
    )
    template_category: Optional[str] = Field(
        None,
        max_length=100,
        description="Category for template organization"
    )


class ContentCreate(ContentBase):
    """Schema for creating new content."""
    
    nlj_data: Dict[str, Any] = Field(
        ...,
        description="Complete NLJ scenario data as JSON"
    )
    parent_content_id: Optional[uuid.UUID] = Field(
        None,
        description="Parent content ID for variants"
    )
    import_source: Optional[str] = Field(
        None,
        description="Import source type if created from import (e.g., 'trivie_xlsx', 'nlj_json')"
    )
    import_filename: Optional[str] = Field(
        None,
        description="Original filename if imported from file"
    )


class ContentUpdate(BaseModel):
    """Schema for updating existing content."""
    
    title: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Content title"
    )
    description: Optional[str] = Field(
        None,
        description="Content description"
    )
    nlj_data: Optional[Dict[str, Any]] = Field(
        None,
        description="Complete NLJ scenario data as JSON"
    )
    content_type: Optional[ContentType] = Field(
        None,
        description="Type of content"
    )
    learning_style: Optional[LearningStyle] = Field(
        None,
        description="Primary learning style for this content"
    )
    is_template: Optional[bool] = Field(
        None,
        description="Whether this content is a template"
    )
    template_category: Optional[str] = Field(
        None,
        max_length=100,
        description="Category for template organization"
    )


class ContentResponse(ContentBase):
    """Schema for content responses."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    nlj_data: Dict[str, Any]
    state: ContentState
    version: int
    created_by: uuid.UUID
    parent_content_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    view_count: int
    completion_count: int
    
    # Creator information (from relationship)
    creator: Optional[UserSummary] = None


class ContentSummary(BaseModel):
    """Lightweight content schema for list views."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    content_type: ContentType
    learning_style: Optional[LearningStyle] = None
    state: ContentState
    version: int
    created_by: uuid.UUID
    is_template: bool
    template_category: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    view_count: int
    completion_count: int
    
    # Creator name only (for performance)
    creator_name: Optional[str] = None


class ContentListResponse(BaseModel):
    """Response schema for paginated content lists."""
    
    items: List[ContentSummary]
    total: int
    page: int
    size: int
    pages: int


class ContentStateUpdate(BaseModel):
    """Schema for updating content state."""
    
    state: ContentState = Field(
        ...,
        description="New content state"
    )
    comment: Optional[str] = Field(
        None,
        max_length=500,
        description="Comment about the state change"
    )


class ContentFilters(BaseModel):
    """Query parameters for filtering content."""
    
    # Pagination
    page: int = Field(default=1, ge=1, description="Page number")
    size: int = Field(default=20, ge=1, le=100, description="Items per page")
    
    # Filters
    state: Optional[ContentState] = Field(None, description="Filter by state")
    content_type: Optional[ContentType] = Field(None, description="Filter by type")
    learning_style: Optional[LearningStyle] = Field(None, description="Filter by learning style")
    is_template: Optional[bool] = Field(None, description="Filter templates only")
    template_category: Optional[str] = Field(None, description="Filter by template category")
    created_by: Optional[uuid.UUID] = Field(None, description="Filter by creator")
    
    # Search
    search: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Search in title and description"
    )
    
    # Sorting
    sort_by: Optional[str] = Field(
        default="created_at",
        description="Sort field: created_at, updated_at, title, view_count"
    )
    sort_order: Optional[str] = Field(
        default="desc",
        pattern="^(asc|desc)$",
        description="Sort order: asc or desc"
    )