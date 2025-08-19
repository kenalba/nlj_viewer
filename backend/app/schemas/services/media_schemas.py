"""
Media Service Schemas - Business Logic Layer.

Provides service-level schemas for media management operations with business
validation rules, generation lifecycle management, and conversion utilities.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models.media import MediaType, MediaState, MediaStyle
from app.schemas.media import (
    MediaGenerationRequest, MediaCreate, MediaResponse
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


class MediaServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
    ConversionMixin[MediaResponse],
):
    """
    Core service schema for media management operations.
    
    Provides business-level validation and lifecycle management for media entities.
    """
    
    # Core media fields
    title: str = Field(..., min_length=1, max_length=255, description="Media title")
    description: str | None = Field(None, max_length=2000, description="Media description")
    
    # Media type and state
    media_type: MediaType = Field(..., description="Type of media content")
    media_state: MediaState = Field(default=MediaState.GENERATING, description="Processing state")
    
    # Content fields
    transcript: str | None = Field(None, description="Generated transcript for audio/video content")
    duration: int | None = Field(None, ge=0, description="Duration in seconds for audio/video content")
    
    # File storage
    file_path: str | None = Field(None, max_length=500, description="Storage path for the media file")
    file_size: int | None = Field(None, ge=0, description="File size in bytes")
    mime_type: str | None = Field(None, max_length=100, description="MIME type")
    
    # Generation metadata
    generation_prompt: str | None = Field(None, description="Original prompt used for content generation")
    selected_keywords: list[str] = Field(default_factory=list, description="Keywords selected for generation focus")
    selected_objectives: list[str] = Field(default_factory=list, description="Learning objectives used in generation")
    generation_config: dict[str, Any] | None = Field(None, description="Generation settings")
    
    # Media-specific configuration
    media_style: MediaStyle | None = Field(None, description="Style template used for generation")
    voice_config: dict[str, Any] | None = Field(None, description="Voice settings for audio generation")
    
    # Source tracking
    source_document_id: uuid.UUID = Field(..., description="Source document used to generate this media")
    
    # Generation tracking
    generation_start_time: datetime | None = Field(None, description="When generation process started")
    generation_end_time: datetime | None = Field(None, description="When generation process completed")
    generation_error: str | None = Field(None, description="Error message if generation failed")
    
    # Usage and analytics
    play_count: int = Field(default=0, ge=0, description="Number of times media has been played/viewed")
    last_played_at: datetime | None = Field(None, description="When media was last played/viewed")
    
    # Sharing and permissions
    is_public: bool = Field(default=False, description="Whether media can be publicly shared")
    
    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        """Validate and normalize title."""
        title = v.strip()
        if not title:
            raise ValueError("Title cannot be empty")
        if len(title) > 255:
            raise ValueError("Title must be less than 255 characters")
        return title
    
    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        """Validate description if provided."""
        if v is not None:
            desc = v.strip()
            if len(desc) > 2000:
                raise ValueError("Description must be less than 2000 characters")
            return desc if desc else None
        return v
    
    @field_validator("transcript")
    @classmethod
    def validate_transcript(cls, v: str | None) -> str | None:
        """Validate transcript if provided."""
        if v is not None:
            transcript = v.strip()
            return transcript if transcript else None
        return v
    
    @field_validator("generation_prompt")
    @classmethod
    def validate_generation_prompt(cls, v: str | None) -> str | None:
        """Validate generation prompt if provided."""
        if v is not None:
            prompt = v.strip()
            return prompt if prompt else None
        return v
    
    @field_validator("selected_keywords", "selected_objectives")
    @classmethod
    def validate_keyword_lists(cls, v: list[str]) -> list[str]:
        """Validate and clean keyword/objective lists."""
        return [item.strip() for item in v if item.strip()]
    
    def is_completed(self) -> bool:
        """Check if media generation is completed."""
        return self.media_state == MediaState.COMPLETED
    
    def is_failed(self) -> bool:
        """Check if media generation failed."""
        return self.media_state == MediaState.FAILED
    
    def is_generating(self) -> bool:
        """Check if media is currently being generated."""
        return self.media_state == MediaState.GENERATING
    
    def is_audio(self) -> bool:
        """Check if media is audio content."""
        return self.media_type in {MediaType.PODCAST, MediaType.AUDIO_SUMMARY}
    
    def is_video(self) -> bool:
        """Check if media is video content."""
        return self.media_type == MediaType.VIDEO
    
    def is_visual(self) -> bool:
        """Check if media is visual content."""
        return self.media_type in {MediaType.IMAGE, MediaType.INFOGRAPHIC}
    
    def can_be_shared(self) -> bool:
        """Check if media can be publicly shared (mirrors MediaItem.can_be_shared)."""
        return self.is_completed() and not self.is_failed()
    
    def can_transition_to(self, new_state: MediaState) -> bool:
        """Check if media can transition to new state."""
        # Define valid state transitions based on media processing workflow
        transitions = {
            MediaState.GENERATING: [MediaState.COMPLETED, MediaState.FAILED],
            MediaState.COMPLETED: [MediaState.ARCHIVED],
            MediaState.FAILED: [MediaState.GENERATING],  # Can retry failed generation
            MediaState.ARCHIVED: []  # Terminal state
        }
        
        return new_state in transitions.get(self.media_state, [])
    
    def get_generation_time(self) -> float | None:
        """Get generation time in seconds (mirrors MediaItem.get_generation_time)."""
        if self.generation_start_time and self.generation_end_time:
            delta = self.generation_end_time - self.generation_start_time
            return delta.total_seconds()
        return None
    
    def get_duration_formatted(self) -> str:
        """Get formatted duration string (MM:SS) (mirrors MediaItem.get_duration_formatted)."""
        if not self.duration:
            return "00:00"
        
        minutes = self.duration // 60
        seconds = self.duration % 60
        return f"{minutes:02d}:{seconds:02d}"
    
    def get_file_extension(self) -> str:
        """Get file extension based on media type (mirrors MediaItem.get_file_extension)."""
        if self.is_audio():
            return ".mp3"
        elif self.is_video():
            return ".mp4"
        elif self.media_type == MediaType.IMAGE:
            return ".png"
        elif self.media_type == MediaType.INFOGRAPHIC:
            return ".svg"
        return ".bin"
    
    def increment_play_count(self) -> None:
        """Increment play count and update last played timestamp (mirrors MediaItem.increment_play_count)."""
        self.play_count += 1
        self.last_played_at = datetime.now(timezone.utc)
        self.update_timestamps()
    
    def mark_generation_started(self) -> None:
        """Mark media generation as started (mirrors MediaItem.mark_generation_started)."""
        self.media_state = MediaState.GENERATING
        self.generation_start_time = datetime.now(timezone.utc)
        self.generation_error = None
        self.update_timestamps()
    
    def mark_generation_completed(self, file_path: str, file_size: int, mime_type: str, duration: int = None) -> None:
        """Mark media generation as completed (mirrors MediaItem.mark_generation_completed)."""
        self.media_state = MediaState.COMPLETED
        self.generation_end_time = datetime.now(timezone.utc)
        self.file_path = file_path
        self.file_size = file_size
        self.mime_type = mime_type
        if duration:
            self.duration = duration
        self.generation_error = None
        self.update_timestamps()
    
    def mark_generation_failed(self, error_message: str) -> None:
        """Mark media generation as failed (mirrors MediaItem.mark_generation_failed)."""
        self.media_state = MediaState.FAILED
        self.generation_end_time = datetime.now(timezone.utc)
        self.generation_error = error_message
        self.update_timestamps()
    
    @classmethod
    def from_api_schema(cls, api_schema: MediaGenerationRequest | MediaCreate, **extra_data) -> "MediaServiceSchema":
        """Convert from API schema to service schema."""
        # Extract data from API schema
        api_data = api_schema.model_dump(exclude_none=True)
        
        # Merge with extra data (e.g., creator info, system fields)
        merged_data = {**api_data, **extra_data}
        
        # Apply service-level defaults
        if "media_state" not in merged_data:
            merged_data["media_state"] = MediaState.GENERATING
        if "play_count" not in merged_data:
            merged_data["play_count"] = 0
        if "is_public" not in merged_data:
            merged_data["is_public"] = False
        if "selected_keywords" not in merged_data:
            merged_data["selected_keywords"] = []
        if "selected_objectives" not in merged_data:
            merged_data["selected_objectives"] = []
        
        return cls.model_validate(merged_data)
    
    def to_api_schema(self, api_schema_class=MediaResponse) -> MediaResponse:
        """Convert service schema to API response schema."""
        # Get all data except internal service fields
        api_data = self.model_dump()
        
        # Add computed properties that API expects
        api_data["display_name"] = self.title
        api_data["duration_formatted"] = self.get_duration_formatted()
        api_data["generation_time"] = self.get_generation_time()
        
        return api_schema_class.model_validate(api_data)


class MediaCreateServiceSchema(MediaServiceSchema):
    """Service schema for media creation operations."""
    
    # Override to make ID optional for creation
    id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    
    # Required for creation via API
    media_type: MediaType = Field(..., description="Type of media to create")
    source_document_id: uuid.UUID = Field(..., description="Source document ID")
    
    @model_validator(mode="before")
    @classmethod
    def validate_creation_rules(cls, data):
        """Apply creation-specific validation."""
        if isinstance(data, dict):
            # Set creation defaults
            if not data.get("id"):
                data["id"] = uuid.uuid4()
            
            # Set timestamps
            now = datetime.now(timezone.utc)
            if not data.get("created_at"):
                data["created_at"] = now
            data["updated_at"] = now
            
            # Ensure proper initial state
            if not data.get("media_state"):
                data["media_state"] = MediaState.GENERATING
            
            # Mark generation as started
            if not data.get("generation_start_time"):
                data["generation_start_time"] = now
        
        return data


class MediaUpdateServiceSchema(ServiceSchemaBase):
    """Service schema for media update operations."""
    
    # All fields optional for updates
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    is_public: bool | None = None
    transcript: str | None = None
    
    @field_validator("title")
    @classmethod
    def validate_title_update(cls, v: str | None) -> str | None:
        """Validate title format for updates."""
        if v is not None:
            return MediaServiceSchema.validate_title(v)
        return v
    
    @field_validator("description")
    @classmethod
    def validate_description_update(cls, v: str | None) -> str | None:
        """Validate description format for updates."""
        if v is not None:
            return MediaServiceSchema.validate_description(v)
        return v
    
    def apply_to_media(self, media: MediaServiceSchema) -> MediaServiceSchema:
        """Apply updates to existing media with validation."""
        update_data = self.model_dump(exclude_none=True)
        
        # Create updated media
        current_data = media.model_dump()
        merged_data = {**current_data, **update_data}
        
        updated_media = MediaServiceSchema.model_validate(merged_data)
        updated_media.update_timestamps()
        
        return updated_media


class MediaGenerationServiceSchema(ServiceSchemaBase):
    """Service schema for media generation operations."""
    
    source_document_id: uuid.UUID = Field(..., description="Source document to generate from")
    media_type: MediaType = Field(default=MediaType.PODCAST, description="Type of media to generate")
    media_style: MediaStyle | None = Field(MediaStyle.NPR_INTERVIEW, description="Style template for generation")
    selected_keywords: list[str] = Field(default_factory=list, description="Keywords to focus on")
    selected_objectives: list[str] = Field(default_factory=list, description="Learning objectives to include")
    generation_config: dict[str, Any] | None = Field(None, description="Additional generation parameters")
    voice_config: dict[str, Any] | None = Field(None, description="Voice settings for audio generation")
    
    @field_validator("selected_keywords", "selected_objectives")
    @classmethod
    def validate_keyword_lists(cls, v: list[str]) -> list[str]:
        """Validate and clean keyword/objective lists."""
        return [item.strip() for item in v if item.strip()]


class MediaFilterServiceSchema(ServiceSchemaBase):
    """Service schema for media filtering and search operations."""
    
    # Pagination
    pagination: PaginationServiceSchema = Field(default_factory=PaginationServiceSchema)
    
    # Sorting (based on actual API usage)
    sorting: SortingServiceSchema = Field(default_factory=lambda: SortingServiceSchema(
        sort_by="created_at", sort_order="desc"
    ))
    
    # Search
    search: SearchServiceSchema | None = None
    
    # Media-specific filters (based on actual MediaService.get_user_media parameters)
    media_type: MediaType | None = None
    media_state: MediaState | None = None
    source_document_id: uuid.UUID | None = None
    
    @model_validator(mode="after")
    def validate_filter_combination(self):
        """Validate filter combinations make sense."""
        # Validate sorting field is allowed for media
        allowed_sort_fields = [
            "created_at", "updated_at", "title", "play_count", "last_played_at",
            "generation_start_time", "generation_end_time", "media_type", "media_state"
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
        
        # Media type filter
        if self.media_type is not None:
            criteria["media_type"] = self.media_type
            
        # State filter
        if self.media_state is not None:
            criteria["media_state"] = self.media_state
        
        # Source document filter
        if self.source_document_id is not None:
            criteria["source_document_id"] = self.source_document_id
        
        # Search criteria
        if self.search:
            criteria["search_query"] = self.search.query
        
        return criteria


class MediaAnalyticsServiceSchema(ServiceSchemaBase):
    """Service schema for media analytics operations."""
    
    total_media: int = Field(default=0, description="Total number of media items")
    by_type: dict[str, int] = Field(default_factory=dict, description="Count by media type")
    by_state: dict[str, int] = Field(default_factory=dict, description="Count by processing state")
    by_voice_type: dict[str, int] = Field(default_factory=dict, description="Count by voice type")
    total_storage_bytes: int = Field(default=0, description="Total storage used in bytes")
    average_file_size: float = Field(default=0.0, description="Average file size")
    largest_file_size: int = Field(default=0, description="Largest file size")
    
    def get_total_storage_mb(self) -> float:
        """Get total storage in megabytes."""
        return self.total_storage_bytes / (1024 * 1024)
    
    def get_average_file_size_mb(self) -> float:
        """Get average file size in megabytes."""
        return self.average_file_size / (1024 * 1024)


class MediaPlayEventServiceSchema(ServiceSchemaBase):
    """Service schema for media play event tracking."""
    
    media_id: uuid.UUID = Field(..., description="Media item ID")
    play_duration: int | None = Field(None, ge=0, description="How long the media was played (seconds)")
    completed: bool = Field(default=False, description="Whether playback was completed")
    
    def calculate_completion_percentage(self, total_duration: int | None) -> float | None:
        """Calculate completion percentage if total duration is known."""
        if self.play_duration is None or total_duration is None or total_duration == 0:
            return None
        return min(100.0, (self.play_duration / total_duration) * 100.0)


# Export all schemas
__all__ = [
    "MediaServiceSchema",
    "MediaCreateServiceSchema", 
    "MediaUpdateServiceSchema",
    "MediaGenerationServiceSchema",
    "MediaFilterServiceSchema",
    "MediaAnalyticsServiceSchema",
    "MediaPlayEventServiceSchema",
]