"""
Pydantic schemas for generation API endpoints.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class GenerationSessionCreate(BaseModel):
    """Schema for creating generation sessions."""

    prompt_config: Dict[str, Any] = Field(..., description="LLM prompt configuration")
    source_document_ids: List[uuid.UUID] = Field(..., description="List of source document IDs")


class ActivityFromGenerationCreate(BaseModel):
    """Schema for creating activities from generation sessions."""

    title: str = Field(..., min_length=1, max_length=255, description="Activity title")
    description: Optional[str] = Field(None, description="Activity description")


class SourceDocumentInfo(BaseModel):
    """Summary info for source documents in generation sessions."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Document ID")
    filename: str = Field(..., description="Document filename")
    original_filename: str = Field(..., description="Original filename")
    file_type: str = Field(..., description="File type")
    file_size: int = Field(..., description="File size in bytes")
    extracted_title: Optional[str] = Field(None, description="Extracted title")


class GenerationSessionSummary(BaseModel):
    """Summary schema for generation session lists."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Session ID")
    status: str = Field(..., description="Generation status")
    created_at: datetime = Field(..., description="Creation timestamp")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")

    # Generation metadata
    total_tokens_used: Optional[int] = Field(None, description="Total tokens consumed")
    generation_time_seconds: Optional[float] = Field(None, description="Generation time")

    # Source documents
    source_documents: List[SourceDocumentInfo] = Field(default_factory=list, description="Source documents used")

    # Validation status
    has_valid_nlj: bool = Field(False, description="Whether session produced valid NLJ content")
    validation_errors: Optional[List[str]] = Field(None, description="Validation errors")

    @property
    def source_count(self) -> int:
        """Number of source documents used."""
        return len(self.source_documents)

    @property
    def is_completed(self) -> bool:
        """Check if session is completed."""
        return self.status == "completed"

    @property
    def is_failed(self) -> bool:
        """Check if session failed."""
        return self.status == "failed"


class GenerationSessionResponse(GenerationSessionSummary):
    """Full response schema for generation sessions."""

    # Additional fields for detailed view
    prompt_config: Dict[str, Any] = Field(..., description="Prompt configuration used")
    claude_conversation_id: Optional[str] = Field(None, description="Claude conversation ID")
    claude_message_id: Optional[str] = Field(None, description="Claude message ID")

    # Generation results
    generated_content: Optional[Dict[str, Any]] = Field(None, description="Raw generated content")
    validated_nlj: Optional[Dict[str, Any]] = Field(None, description="Validated NLJ scenario")

    # Error information
    error_message: Optional[str] = Field(None, description="Error message if failed")

    # User information
    user_id: uuid.UUID = Field(..., description="User ID")

    # Activity creation
    created_activities_count: int = Field(0, description="Number of activities created from this session")

    @property
    def can_create_activity(self) -> bool:
        """Check if an activity can be created from this session."""
        return self.is_completed and self.has_valid_nlj


class GenerationSessionListResponse(BaseModel):
    """Response schema for paginated generation session lists."""

    items: List[GenerationSessionSummary] = Field(..., description="List of generation sessions")
    total: int = Field(..., description="Total number of sessions")
    limit: int = Field(..., description="Items per page")
    offset: int = Field(..., description="Number of items skipped")

    @property
    def has_more(self) -> bool:
        """Check if there are more items available."""
        return self.offset + len(self.items) < self.total


class GenerationStatisticsResponse(BaseModel):
    """Response schema for generation statistics."""

    total_sessions: int = Field(..., description="Total number of sessions")
    completed_sessions: int = Field(..., description="Number of completed sessions")
    failed_sessions: int = Field(..., description="Number of failed sessions")
    success_rate: float = Field(..., description="Success rate (0.0 - 1.0)")
    total_tokens_used: int = Field(..., description="Total tokens consumed across all sessions")
    average_generation_time: Optional[float] = Field(None, description="Average generation time in seconds")
    activities_created: int = Field(..., description="Number of activities created from sessions")
