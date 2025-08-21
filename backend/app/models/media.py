"""
Media database model for generated audio, video, and visual content.
Uses modern SQLAlchemy 2.0 syntax with Python 3.11+ typing.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import ARRAY, JSON, Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.shared_token import SharedToken
    from app.models.source_document import SourceDocument
    from app.models.user import User


class MediaType(str, Enum):
    """Types of media content that can be generated."""

    PODCAST = "podcast"
    VIDEO = "video"
    IMAGE = "image"
    INFOGRAPHIC = "infographic"
    AUDIO_SUMMARY = "audio_summary"


class MediaState(str, Enum):
    """Media generation and lifecycle states."""

    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class VoiceType(str, Enum):
    """Available voice types for audio generation."""

    MALE_PROFESSIONAL = "male_professional"
    FEMALE_PROFESSIONAL = "female_professional"
    MALE_CONVERSATIONAL = "male_conversational"
    FEMALE_CONVERSATIONAL = "female_conversational"


class MediaStyle(str, Enum):
    """Style templates for media generation."""

    NPR_INTERVIEW = "npr_interview"
    EDUCATIONAL_SUMMARY = "educational_summary"
    CONVERSATIONAL_DEEP_DIVE = "conversational_deep_dive"
    TECHNICAL_BREAKDOWN = "technical_breakdown"


class MediaItem(Base):
    """
    Media model for storing generated audio, video, and visual content.
    Supports the full media generation pipeline from script to final asset.
    """

    __tablename__ = "media_items"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Basic media information
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)

    # Media type and state
    media_type: Mapped[MediaType] = mapped_column(SQLEnum(MediaType), nullable=False, index=True)
    media_state: Mapped[MediaState] = mapped_column(
        SQLEnum(MediaState), default=MediaState.GENERATING, nullable=False, index=True
    )

    # Content fields
    transcript: Mapped[str | None] = mapped_column(Text, comment="Generated transcript for audio/video content")
    duration: Mapped[int | None] = mapped_column(Integer, comment="Duration in seconds for audio/video content")

    # File storage
    file_path: Mapped[str | None] = mapped_column(String(500), comment="Local/cloud storage path for the media file")
    file_size: Mapped[int | None] = mapped_column(Integer, comment="File size in bytes")
    mime_type: Mapped[str | None] = mapped_column(String(100), comment="MIME type (audio/mpeg, video/mp4, etc.)")

    # Generation metadata
    generation_prompt: Mapped[str | None] = mapped_column(Text, comment="Original prompt used for content generation")
    selected_keywords: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, comment="Keywords selected for generation focus"
    )
    selected_objectives: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, comment="Learning objectives used in generation"
    )
    generation_config: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, comment="Generation settings (voice, style, length, etc.)"
    )

    # Media-specific configuration
    media_style: Mapped[MediaStyle | None] = mapped_column(SQLEnum(MediaStyle), comment="Style template used for generation")
    voice_config: Mapped[dict[str, Any] | None] = mapped_column(JSON, comment="Voice settings for audio generation")

    # Source tracking
    source_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_documents.id"),
        nullable=False,
        index=True,
        comment="Source document used to generate this media",
    )

    # Generation tracking
    generation_start_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When generation process started"
    )
    generation_end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When generation process completed"
    )
    generation_error: Mapped[str | None] = mapped_column(Text, comment="Error message if generation failed")

    # Usage and analytics
    play_count: Mapped[int] = mapped_column(Integer, default=0, comment="Number of times media has been played/viewed")
    last_played_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When media was last played/viewed"
    )

    # Sharing and permissions
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, comment="Whether media can be publicly shared")

    # Ownership and timestamps
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    creator: Mapped["User"] = relationship(back_populates="created_media", lazy="select")

    source_document: Mapped["SourceDocument"] = relationship(back_populates="generated_media", lazy="select")

    # Public sharing tokens
    shared_tokens: Mapped[list["SharedToken"]] = relationship(
        back_populates="media", cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<MediaItem(title={self.title}, type={self.media_type}, state={self.media_state})>"

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

    def get_generation_time(self) -> float | None:
        """Get generation time in seconds."""
        if self.generation_start_time and self.generation_end_time:
            delta = self.generation_end_time - self.generation_start_time
            return delta.total_seconds()
        return None

    def get_duration_formatted(self) -> str:
        """Get formatted duration string (MM:SS)."""
        if not self.duration:
            return "00:00"

        minutes = self.duration // 60
        seconds = self.duration % 60
        return f"{minutes:02d}:{seconds:02d}"

    def increment_play_count(self) -> None:
        """Increment play count and update last played timestamp."""
        self.play_count += 1
        self.last_played_at = datetime.utcnow()

    def mark_generation_started(self) -> None:
        """Mark media generation as started."""
        self.media_state = MediaState.GENERATING
        self.generation_start_time = datetime.utcnow()
        self.generation_error = None

    def mark_generation_completed(self, file_path: str, file_size: int, mime_type: str, duration: int = None) -> None:
        """Mark media generation as completed."""
        self.media_state = MediaState.COMPLETED
        self.generation_end_time = datetime.utcnow()
        self.file_path = file_path
        self.file_size = file_size
        self.mime_type = mime_type
        if duration:
            self.duration = duration
        self.generation_error = None

    def mark_generation_failed(self, error_message: str) -> None:
        """Mark media generation as failed."""
        self.media_state = MediaState.FAILED
        self.generation_end_time = datetime.utcnow()
        self.generation_error = error_message

    def can_be_shared(self) -> bool:
        """Check if media can be publicly shared."""
        return self.is_completed() and not self.is_failed()

    def get_active_share_token(self) -> "SharedToken | None":
        """Get the currently active share token, if any."""
        for token in self.shared_tokens:
            if token.is_valid:
                return token
        return None

    def has_active_share(self) -> bool:
        """Check if media has an active public share."""
        return self.get_active_share_token() is not None

    def get_file_extension(self) -> str:
        """Get file extension based on media type."""
        if self.is_audio():
            return ".mp3"
        elif self.is_video():
            return ".mp4"
        elif self.media_type == MediaType.IMAGE:
            return ".png"
        elif self.media_type == MediaType.INFOGRAPHIC:
            return ".svg"
        return ".bin"

    def get_display_name(self) -> str:
        """Get display name for UI."""
        return self.title

    def get_source_attribution(self) -> str:
        """Get source attribution text."""
        if self.source_document:
            return f"Generated from: {self.source_document.get_display_name()}"
        return "Source: Unknown"
