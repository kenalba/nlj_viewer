"""
Source document database model for Content Studio.
Manages persistent source library with Claude Files API integration.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, List

from sqlalchemy import ARRAY, BigInteger, DateTime, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.generation_session import GenerationSession
    from app.models.media import MediaItem
    from app.models.user import User


class FileType(str, Enum):
    """Supported file types for source documents."""

    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    TXT = "txt"
    ORIGINAL_PDF = "original_pdf"  # PDFs that were uploaded directly


class ConversionStatus(str, Enum):
    """Document conversion status."""

    PENDING = "pending"
    CONVERTING = "converting"
    CONVERTED = "converted"
    FAILED = "failed"
    NOT_REQUIRED = "not_required"  # For files that don't need conversion


class SourceDocument(Base):
    """
    Source document model for persistent source library.
    Supports document conversion, Claude Files API integration, and usage tracking.
    """

    __tablename__ = "source_documents"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # File information
    filename: Mapped[str] = mapped_column(String(255), nullable=False, comment="Current filename (may be converted)")
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False, comment="Original uploaded filename")
    file_type: Mapped[FileType] = mapped_column(
        SQLEnum(FileType), nullable=False, comment="Current file type (after conversion if applicable)"
    )
    original_file_type: Mapped[FileType] = mapped_column(
        SQLEnum(FileType), nullable=False, comment="Original file type before conversion"
    )

    # Conversion tracking
    conversion_status: Mapped[ConversionStatus] = mapped_column(
        SQLEnum(ConversionStatus), default=ConversionStatus.PENDING, nullable=False
    )
    conversion_error: Mapped[str | None] = mapped_column(Text)

    # Claude Files API integration
    claude_file_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, comment="Claude Files API file ID"
    )

    # File metadata
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, comment="File size in bytes")
    file_path: Mapped[str] = mapped_column(String(500), nullable=False, comment="Local file system path")

    # Content metadata
    extracted_title: Mapped[str | None] = mapped_column(String(500), comment="Title extracted from document metadata")
    extracted_author: Mapped[str | None] = mapped_column(String(255), comment="Author extracted from document metadata")
    page_count: Mapped[int | None] = mapped_column(comment="Number of pages (for PDFs)")

    # User-defined metadata
    description: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, comment="User-defined tags for organization")

    # AI-generated metadata
    summary: Mapped[str | None] = mapped_column(Text, comment="AI-generated summary of document content")
    keywords: Mapped[List[str] | None] = mapped_column(ARRAY(String), comment="AI-extracted keywords and key terms")
    learning_objectives: Mapped[List[str] | None] = mapped_column(
        ARRAY(String), comment="Potential learning objectives derived from content"
    )
    content_type_classification: Mapped[str | None] = mapped_column(
        String(100), comment="AI-classified content type (training, reference, process, etc.)"
    )
    difficulty_level: Mapped[str | None] = mapped_column(
        String(20), comment="Content difficulty level (beginner, intermediate, advanced)"
    )
    estimated_reading_time: Mapped[int | None] = mapped_column(comment="Estimated reading time in minutes")
    key_concepts: Mapped[List[str] | None] = mapped_column(
        ARRAY(String), comment="Main concepts that could become quiz questions"
    )
    target_audience: Mapped[str | None] = mapped_column(String(200), comment="Intended audience for this content")
    subject_matter_areas: Mapped[List[str] | None] = mapped_column(
        ARRAY(String), comment="Subject areas covered (sales, technical, compliance, etc.)"
    )
    actionable_items: Mapped[List[str] | None] = mapped_column(
        ARRAY(String), comment="Specific steps/processes that could become scenarios"
    )
    assessment_opportunities: Mapped[List[str] | None] = mapped_column(
        ARRAY(String), comment="What could be tested or evaluated from this content"
    )
    content_gaps: Mapped[List[str] | None] = mapped_column(
        ARRAY(String), comment="What additional information might be needed"
    )

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Claude Files API lifecycle
    uploaded_to_claude_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="Claude Files API expiration date"
    )

    # Ownership and timestamps
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="source_documents", lazy="select")

    generation_sessions: Mapped[List["GenerationSession"]] = relationship(
        secondary="generation_session_sources", back_populates="source_documents", lazy="select"
    )

    generated_media: Mapped[List["MediaItem"]] = relationship(
        back_populates="source_document", cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<SourceDocument(filename={self.filename}, type={self.file_type})>"

    def is_converted(self) -> bool:
        """Check if document has been successfully converted."""
        return self.conversion_status == ConversionStatus.CONVERTED

    def is_uploaded_to_claude(self) -> bool:
        """Check if document has been uploaded to Claude Files API."""
        return self.claude_file_id is not None

    def is_expired(self) -> bool:
        """Check if Claude Files API upload has expired."""
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def needs_reupload(self) -> bool:
        """Check if document needs to be re-uploaded to Claude."""
        return not self.is_uploaded_to_claude() or self.is_expired()

    def increment_usage(self) -> None:
        """Increment usage count and update last used timestamp."""
        self.usage_count += 1
        self.last_used_at = datetime.now(timezone.utc)

    def add_tag(self, tag: str) -> None:
        """Add a tag if it doesn't already exist."""
        if not self.tags:
            self.tags = []
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: str) -> None:
        """Remove a tag if it exists."""
        if self.tags and tag in self.tags:
            self.tags.remove(tag)

    def get_display_name(self) -> str:
        """Get the best display name for this document."""
        return self.extracted_title or self.original_filename
