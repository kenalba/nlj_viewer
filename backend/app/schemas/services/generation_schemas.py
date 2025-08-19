"""
Generation Service Schemas - Business Logic Layer.

Provides service-level schemas for AI content generation session management with business
validation rules, status lifecycle management, and conversion utilities.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models.generation_session import GenerationStatus
from app.schemas.generation import (
    GenerationSessionCreate, GenerationSessionResponse
)
from .common import (
    ServiceSchemaBase,
    ValidationMixin,
    ConversionMixin,
    TimestampMixin,
    IdentityMixin,
    PaginationServiceSchema,
    SortingServiceSchema,
    SearchServiceSchema,
)


class GenerationSessionServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
    ConversionMixin[GenerationSessionResponse],
):
    """
    Core service schema for AI content generation session management.
    
    Provides business-level validation and status lifecycle management for generation entities.
    """
    
    # Generation configuration
    prompt_config: dict[str, Any] = Field(..., description="LLM prompt configuration used for generation")
    
    # Claude API integration
    claude_conversation_id: str | None = Field(None, max_length=255, description="Claude conversation ID for continuity")
    claude_message_id: str | None = Field(None, max_length=255, description="Claude message ID for the generation request")
    
    # Generation results
    generated_content: dict[str, Any] | None = Field(None, description="Raw response from Claude API")
    validated_nlj: dict[str, Any] | None = Field(None, description="Validated NLJ scenario data")
    validation_errors: list[str] | None = Field(None, description="Validation errors if NLJ schema validation failed")
    
    # Generation metadata
    total_tokens_used: int | None = Field(None, ge=0, description="Total tokens consumed in generation")
    generation_time_seconds: float | None = Field(None, ge=0, description="Time taken for generation in seconds")
    
    # Status tracking
    status: GenerationStatus = Field(default=GenerationStatus.PENDING, description="Generation status")
    error_message: str | None = Field(None, description="Error message if failed")
    
    # Ownership and timestamps
    user_id: uuid.UUID = Field(..., description="User ID who created the session")
    started_at: datetime | None = Field(None, description="When generation process started")
    completed_at: datetime | None = Field(None, description="When generation process completed")
    
    @field_validator("prompt_config")
    @classmethod
    def validate_prompt_config(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate prompt configuration structure."""
        if not isinstance(v, dict):
            raise ValueError("Prompt config must be a dictionary")
        if not v:
            raise ValueError("Prompt config cannot be empty")
        return v
    
    @field_validator("claude_conversation_id", "claude_message_id")
    @classmethod
    def validate_claude_ids(cls, v: str | None) -> str | None:
        """Validate Claude API IDs if provided."""
        if v is not None:
            stripped = v.strip()
            if not stripped:
                return None
            if len(stripped) > 255:
                raise ValueError("Claude ID must be less than 255 characters")
            return stripped
        return v
    
    @field_validator("validation_errors")
    @classmethod
    def validate_validation_errors(cls, v: list[str] | None) -> list[str] | None:
        """Validate validation errors list."""
        if v is not None:
            if not isinstance(v, list):
                raise ValueError("Validation errors must be a list")
            return [error.strip() for error in v if error.strip()]
        return v
    
    @field_validator("error_message")
    @classmethod
    def validate_error_message(cls, v: str | None) -> str | None:
        """Validate error message if provided."""
        if v is not None:
            stripped = v.strip()
            return stripped if stripped else None
        return v
    
    def is_pending(self) -> bool:
        """Check if generation is pending (mirrors GenerationSession.is_pending)."""
        return self.status == GenerationStatus.PENDING
    
    def is_processing(self) -> bool:
        """Check if generation is in progress (mirrors GenerationSession.is_processing)."""
        return self.status == GenerationStatus.PROCESSING
    
    def is_completed(self) -> bool:
        """Check if generation completed successfully (mirrors GenerationSession.is_completed)."""
        return self.status == GenerationStatus.COMPLETED
    
    def is_failed(self) -> bool:
        """Check if generation failed (mirrors GenerationSession.is_failed)."""
        return self.status == GenerationStatus.FAILED
    
    def is_cancelled(self) -> bool:
        """Check if generation was cancelled."""
        return self.status == GenerationStatus.CANCELLED
    
    def has_valid_nlj(self) -> bool:
        """Check if session produced valid NLJ content (mirrors GenerationSession.has_valid_nlj)."""
        return self.validated_nlj is not None and not self.validation_errors
    
    def can_transition_to_status(self, new_status: GenerationStatus) -> bool:
        """Check if status transition is valid."""
        valid_transitions = {
            GenerationStatus.PENDING: [GenerationStatus.PROCESSING, GenerationStatus.FAILED, GenerationStatus.CANCELLED],
            GenerationStatus.PROCESSING: [GenerationStatus.COMPLETED, GenerationStatus.FAILED, GenerationStatus.CANCELLED],
            GenerationStatus.COMPLETED: [],  # Terminal state
            GenerationStatus.FAILED: [],  # Terminal state
            GenerationStatus.CANCELLED: [],  # Terminal state
        }
        return new_status in valid_transitions.get(self.status, [])
    
    def start_processing(self) -> None:
        """Mark session as processing (mirrors GenerationSession.start_processing)."""
        if not self.can_transition_to_status(GenerationStatus.PROCESSING):
            raise ValueError(f"Cannot transition from {self.status} to PROCESSING")
        self.status = GenerationStatus.PROCESSING
        self.started_at = datetime.now(timezone.utc)
        self.update_timestamps()
    
    def complete_successfully(
        self, 
        generated_content: dict, 
        validated_nlj: dict, 
        tokens_used: int = None, 
        generation_time: float = None
    ) -> None:
        """Mark session as completed successfully (mirrors GenerationSession.complete_successfully)."""
        if not self.can_transition_to_status(GenerationStatus.COMPLETED):
            raise ValueError(f"Cannot transition from {self.status} to COMPLETED")
        self.status = GenerationStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc)
        self.generated_content = generated_content
        self.validated_nlj = validated_nlj
        self.validation_errors = None
        if tokens_used:
            self.total_tokens_used = tokens_used
        if generation_time:
            self.generation_time_seconds = generation_time
        self.update_timestamps()
    
    def fail_with_error(self, error_message: str, validation_errors: list[str] = None) -> None:
        """Mark session as failed with error details (mirrors GenerationSession.fail_with_error)."""
        if not self.can_transition_to_status(GenerationStatus.FAILED):
            raise ValueError(f"Cannot transition from {self.status} to FAILED")
        self.status = GenerationStatus.FAILED
        self.completed_at = datetime.now(timezone.utc)
        self.error_message = error_message
        if validation_errors:
            self.validation_errors = validation_errors
        self.update_timestamps()
    
    def cancel(self) -> None:
        """Cancel the generation session (mirrors GenerationSession.cancel)."""
        if not self.can_transition_to_status(GenerationStatus.CANCELLED):
            raise ValueError(f"Cannot transition from {self.status} to CANCELLED")
        self.status = GenerationStatus.CANCELLED
        self.completed_at = datetime.now(timezone.utc)
        self.update_timestamps()
    
    def get_generation_summary(self) -> dict:
        """Get a summary of the generation session (mirrors GenerationSession.get_generation_summary)."""
        return {
            "id": str(self.id),
            "status": self.status.value if hasattr(self.status, 'value') else self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "has_valid_content": self.has_valid_nlj(),
            "generation_time": self.generation_time_seconds,
            "tokens_used": self.total_tokens_used,
        }
    
    @classmethod
    def from_api_schema(cls, api_schema: GenerationSessionCreate, **extra_data) -> "GenerationSessionServiceSchema":
        """Convert from API schema to service schema."""
        # Extract data from API schema
        api_data = api_schema.model_dump(exclude_none=True)
        
        # Merge with extra data (e.g., user info, system fields)
        merged_data = {**api_data, **extra_data}
        
        # Apply service-level defaults
        if "status" not in merged_data:
            merged_data["status"] = GenerationStatus.PENDING
        
        return cls.model_validate(merged_data)
    
    def to_api_schema(self, api_schema_class=GenerationSessionResponse) -> GenerationSessionResponse:
        """Convert service schema to API response schema."""
        # Get all data for API response
        api_data = self.model_dump()
        
        # Add computed properties
        api_data["has_valid_nlj"] = self.has_valid_nlj()
        api_data["created_activities_count"] = 0  # This would come from relationships in real usage
        api_data["source_documents"] = []  # This would come from relationships in real usage
        
        return api_schema_class.model_validate(api_data)


class GenerationSessionCreateServiceSchema(GenerationSessionServiceSchema):
    """Service schema for generation session creation operations."""
    
    # Override to make ID optional for creation
    id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    
    # Required for creation via API
    user_id: uuid.UUID = Field(..., description="User creating the session")
    prompt_config: dict[str, Any] = Field(..., description="Prompt configuration")
    
    # Source documents (many-to-many relationship)
    source_document_ids: list[uuid.UUID] = Field(..., min_length=1, description="Source document IDs")
    
    @field_validator("source_document_ids")
    @classmethod
    def validate_source_document_ids(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        """Validate source document IDs list."""
        if not v:
            raise ValueError("At least one source document is required")
        if len(v) > 10:  # Reasonable limit
            raise ValueError("Too many source documents (max 10)")
        return v
    
    @model_validator(mode="after")
    def validate_creation_rules(self):
        """Apply creation-specific validation."""
        # Set creation defaults
        if not self.id:
            self.id = uuid.uuid4()
        
        self.update_timestamps(creating=True)
        
        # Ensure proper initial state
        if not self.status:
            self.status = GenerationStatus.PENDING
        
        return self


class GenerationSessionUpdateServiceSchema(ServiceSchemaBase):
    """Service schema for generation session update operations."""
    
    # Status management fields
    status: GenerationStatus | None = None
    error_message: str | None = None
    validation_errors: list[str] | None = None
    
    # Generation results
    generated_content: dict[str, Any] | None = None
    validated_nlj: dict[str, Any] | None = None
    
    # Claude API fields
    claude_conversation_id: str | None = None
    claude_message_id: str | None = None
    
    # Metadata
    total_tokens_used: int | None = Field(None, ge=0)
    generation_time_seconds: float | None = Field(None, ge=0)
    
    # Timestamps
    started_at: datetime | None = None
    completed_at: datetime | None = None
    
    def apply_to_session(self, session: GenerationSessionServiceSchema) -> GenerationSessionServiceSchema:
        """Apply updates to existing session with validation."""
        update_data = self.model_dump(exclude_none=True)
        
        # If status is being updated, validate the transition
        if "status" in update_data:
            new_status = update_data["status"]
            if not session.can_transition_to_status(new_status):
                raise ValueError(f"Cannot transition from {session.status} to {new_status}")
        
        # Create updated session
        current_data = session.model_dump()
        merged_data = {**current_data, **update_data}
        
        updated_session = GenerationSessionServiceSchema.model_validate(merged_data)
        updated_session.update_timestamps()
        
        return updated_session


class GenerationSessionFilterServiceSchema(ServiceSchemaBase):
    """Service schema for generation session filtering and search operations."""
    
    # Pagination
    pagination: PaginationServiceSchema = Field(default_factory=PaginationServiceSchema)
    
    # Sorting (based on actual API usage)
    sorting: SortingServiceSchema = Field(default_factory=lambda: SortingServiceSchema(
        sort_by="created_at", sort_order="desc"
    ))
    
    # Search
    search: SearchServiceSchema | None = None
    
    # Generation-specific filters (based on actual GenerationService.get_user_sessions parameters)
    status: GenerationStatus | None = None
    user_id: uuid.UUID | None = None
    has_valid_nlj: bool | None = None
    
    @model_validator(mode="after")
    def validate_filter_combination(self):
        """Validate filter combinations make sense."""
        # Validate sorting field is allowed for generation sessions
        allowed_sort_fields = [
            "created_at", "updated_at", "status", "started_at", "completed_at",
            "total_tokens_used", "generation_time_seconds"
        ]
        
        if not self.sorting.validate_sort_field(allowed_sort_fields):
            raise ValueError(f"Invalid sort field: {self.sorting.sort_by}")
        
        return self
    
    def build_filter_criteria(self) -> dict[str, Any]:
        """Build filter criteria for repository queries."""
        criteria = {
            "limit": self.pagination.size,
            "offset": self.pagination.get_offset(),
        }
        
        # Status filter
        if self.status is not None:
            criteria["status"] = self.status
            
        # User filter
        if self.user_id is not None:
            criteria["user_id"] = self.user_id
        
        # Search criteria
        if self.search:
            criteria["search_term"] = self.search.query
        
        return criteria


class GenerationSessionAnalyticsServiceSchema(ServiceSchemaBase):
    """Service schema for generation session analytics operations."""
    
    total_sessions: int = Field(default=0, description="Total number of sessions")
    completed_sessions: int = Field(default=0, description="Number of completed sessions")
    failed_sessions: int = Field(default=0, description="Number of failed sessions")
    success_rate: float = Field(default=0.0, description="Success rate percentage")
    total_tokens_used: int = Field(default=0, description="Total tokens consumed across all sessions")
    average_generation_time: float | None = Field(None, description="Average generation time in seconds")
    by_status: dict[str, int] = Field(default_factory=dict, description="Count by status")
    average_processing_time_seconds: float = Field(default=0.0, description="Average processing time")
    
    def get_completion_rate(self) -> float:
        """Get completion rate as percentage."""
        if self.total_sessions == 0:
            return 0.0
        return (self.completed_sessions / self.total_sessions) * 100.0
    
    def get_failure_rate(self) -> float:
        """Get failure rate as percentage."""
        if self.total_sessions == 0:
            return 0.0
        return (self.failed_sessions / self.total_sessions) * 100.0


class ActivityCreationServiceSchema(ServiceSchemaBase):
    """Service schema for creating activities from generation sessions."""
    
    session_id: uuid.UUID = Field(..., description="Generation session ID")
    title: str = Field(..., min_length=1, max_length=255, description="Activity title")
    description: str | None = Field(None, max_length=2000, description="Activity description")
    
    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        """Validate and normalize title."""
        title = v.strip()
        if not title:
            raise ValueError("Title cannot be empty")
        return title
    
    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        """Validate description if provided."""
        if v is not None:
            desc = v.strip()
            return desc if desc else None
        return v


# Export all schemas
__all__ = [
    "GenerationSessionServiceSchema",
    "GenerationSessionCreateServiceSchema", 
    "GenerationSessionUpdateServiceSchema",
    "GenerationSessionFilterServiceSchema",
    "GenerationSessionAnalyticsServiceSchema",
    "ActivityCreationServiceSchema",
]