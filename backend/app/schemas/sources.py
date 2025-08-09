"""
Pydantic schemas for source document API endpoints.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class SourceDocumentBase(BaseModel):
    """Base schema for source documents."""
    filename: str = Field(..., description="Current filename")
    original_filename: str = Field(..., description="Original uploaded filename")
    description: Optional[str] = Field(None, description="Document description")
    tags: List[str] = Field(default_factory=list, description="Document tags")


class SourceDocumentCreate(SourceDocumentBase):
    """Schema for creating source documents."""
    pass


class SourceDocumentUpdate(BaseModel):
    """Schema for updating source document metadata."""
    extracted_title: Optional[str] = Field(None, description="Updated extracted title")
    description: Optional[str] = Field(None, description="Updated description")
    tags: Optional[List[str]] = Field(None, description="Updated tags")


class SourceDocumentSummary(BaseModel):
    """Summary schema for source document lists."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID = Field(..., description="Document ID")
    filename: str = Field(..., description="Current filename")
    original_filename: str = Field(..., description="Original uploaded filename")
    file_type: str = Field(..., description="File type")
    original_file_type: str = Field(..., description="Original file type before conversion")
    conversion_status: str = Field(..., description="Conversion status")
    file_size: int = Field(..., description="File size in bytes")
    
    # Metadata
    extracted_title: Optional[str] = Field(None, description="Extracted document title")
    extracted_author: Optional[str] = Field(None, description="Extracted document author")
    page_count: Optional[int] = Field(None, description="Number of pages")
    description: Optional[str] = Field(None, description="User description")
    tags: List[str] = Field(default_factory=list, description="User-defined tags")
    
    # AI-generated metadata
    summary: Optional[str] = Field(None, description="AI-generated summary")
    keywords: Optional[List[str]] = Field(None, description="AI-extracted keywords")
    learning_objectives: Optional[List[str]] = Field(None, description="Potential learning objectives")
    content_type_classification: Optional[str] = Field(None, description="AI-classified content type")
    difficulty_level: Optional[str] = Field(None, description="Content difficulty level")
    estimated_reading_time: Optional[int] = Field(None, description="Estimated reading time in minutes")
    key_concepts: Optional[List[str]] = Field(None, description="Main concepts for questions")
    target_audience: Optional[str] = Field(None, description="Intended audience")
    subject_matter_areas: Optional[List[str]] = Field(None, description="Subject areas covered")
    actionable_items: Optional[List[str]] = Field(None, description="Actionable steps/processes")
    assessment_opportunities: Optional[List[str]] = Field(None, description="Assessment possibilities")
    content_gaps: Optional[List[str]] = Field(None, description="Missing information needs")
    
    # Usage tracking
    usage_count: int = Field(0, description="Number of times used")
    last_used_at: Optional[datetime] = Field(None, description="Last used timestamp")
    
    # Claude integration
    claude_file_id: Optional[str] = Field(None, description="Claude Files API ID")
    uploaded_to_claude_at: Optional[datetime] = Field(None, description="Claude upload timestamp")
    expires_at: Optional[datetime] = Field(None, description="Claude file expiration")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    @property
    def display_name(self) -> str:
        """Get the best display name for this document."""
        return self.extracted_title or self.original_filename
    
    @property
    def is_uploaded_to_claude(self) -> bool:
        """Check if uploaded to Claude."""
        return self.claude_file_id is not None
    
    @property
    def is_expired(self) -> bool:
        """Check if Claude upload is expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at
    
    @property
    def needs_reupload(self) -> bool:
        """Check if needs re-upload to Claude."""
        return not self.is_uploaded_to_claude or self.is_expired


class SourceDocumentResponse(SourceDocumentSummary):
    """Full response schema for source documents."""
    
    # Additional fields for detailed view
    file_path: str = Field(..., description="Local file path")
    conversion_error: Optional[str] = Field(None, description="Conversion error message")
    user_id: uuid.UUID = Field(..., description="Owner user ID")


class SourceDocumentListResponse(BaseModel):
    """Response schema for paginated source document lists."""
    items: List[SourceDocumentSummary] = Field(..., description="List of source documents")
    total: int = Field(..., description="Total number of documents")
    limit: int = Field(..., description="Items per page")
    offset: int = Field(..., description="Number of items skipped")
    
    @property
    def has_more(self) -> bool:
        """Check if there are more items available."""
        return self.offset + len(self.items) < self.total