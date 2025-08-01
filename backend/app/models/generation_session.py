"""
Generation session database model for Content Studio.
Tracks AI content generation sessions with full lineage and chain of custody.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Any

from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.source_document import SourceDocument
    from app.models.content import ContentItem


class GenerationStatus(str, Enum):
    """Generation session status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Association table for many-to-many relationship between generation sessions and source documents
generation_session_sources = Table(
    "generation_session_sources",
    Base.metadata,
    Column("generation_session_id", UUID(as_uuid=True), ForeignKey("generation_sessions.id"), primary_key=True),
    Column("source_document_id", UUID(as_uuid=True), ForeignKey("source_documents.id"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now())
)


class GenerationSession(Base):
    """
    Generation session model for tracking AI content generation.
    Maintains full chain of custody from source documents to generated activities.
    """
    
    __tablename__ = "generation_sessions"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Generation configuration
    prompt_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="LLM prompt configuration used for generation"
    )
    
    # Claude API integration
    claude_conversation_id: Mapped[str | None] = mapped_column(
        String(255),
        comment="Claude conversation ID for continuity"
    )
    claude_message_id: Mapped[str | None] = mapped_column(
        String(255),
        comment="Claude message ID for the generation request"
    )
    
    # Generation results
    generated_content: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="Raw response from Claude API"
    )
    validated_nlj: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="Validated NLJ scenario data"
    )
    validation_errors: Mapped[List[str] | None] = mapped_column(
        JSON,
        comment="Validation errors if NLJ schema validation failed"
    )
    
    # Generation metadata
    total_tokens_used: Mapped[int | None] = mapped_column(
        comment="Total tokens consumed in generation"
    )
    generation_time_seconds: Mapped[float | None] = mapped_column(
        comment="Time taken for generation in seconds"
    )
    
    # Status tracking
    status: Mapped[GenerationStatus] = mapped_column(
        String(20),
        default=GenerationStatus.PENDING,
        nullable=False,
        index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    
    # Ownership and timestamps
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    creator: Mapped["User"] = relationship(
        back_populates="generation_sessions",
        lazy="selectin"
    )
    
    source_documents: Mapped[List["SourceDocument"]] = relationship(
        secondary=generation_session_sources,
        back_populates="generation_sessions",
        lazy="selectin"
    )
    
    created_activities: Mapped[List["ContentItem"]] = relationship(
        back_populates="generation_session",
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return f"<GenerationSession(id={str(self.id)[:8]}, status={self.status})>"
    
    def is_pending(self) -> bool:
        """Check if generation is pending."""
        return self.status == GenerationStatus.PENDING
    
    def is_processing(self) -> bool:
        """Check if generation is in progress."""
        return self.status == GenerationStatus.PROCESSING
    
    def is_completed(self) -> bool:
        """Check if generation completed successfully."""
        return self.status == GenerationStatus.COMPLETED
    
    def is_failed(self) -> bool:
        """Check if generation failed."""
        return self.status == GenerationStatus.FAILED
    
    def has_valid_nlj(self) -> bool:
        """Check if session produced valid NLJ content."""
        return self.validated_nlj is not None and not self.validation_errors
    
    def start_processing(self) -> None:
        """Mark session as processing."""
        self.status = GenerationStatus.PROCESSING
        self.started_at = datetime.utcnow()
    
    def complete_successfully(self, generated_content: dict, validated_nlj: dict, 
                            tokens_used: int = None, generation_time: float = None) -> None:
        """Mark session as completed successfully."""
        self.status = GenerationStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        self.generated_content = generated_content
        self.validated_nlj = validated_nlj
        self.validation_errors = None
        if tokens_used:
            self.total_tokens_used = tokens_used
        if generation_time:
            self.generation_time_seconds = generation_time
    
    def fail_with_error(self, error_message: str, validation_errors: List[str] = None) -> None:
        """Mark session as failed with error details."""
        self.status = GenerationStatus.FAILED
        self.completed_at = datetime.utcnow()
        self.error_message = error_message
        if validation_errors:
            self.validation_errors = validation_errors
    
    def cancel(self) -> None:
        """Cancel the generation session."""
        self.status = GenerationStatus.CANCELLED
        self.completed_at = datetime.utcnow()
    
    def get_source_document_ids(self) -> List[uuid.UUID]:
        """Get list of source document IDs used in this session."""
        return [doc.id for doc in self.source_documents]
    
    def get_generation_summary(self) -> dict:
        """Get a summary of the generation session."""
        return {
            "id": str(self.id),
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "source_count": len(self.source_documents),
            "has_valid_content": self.has_valid_nlj(),
            "generation_time": self.generation_time_seconds,
            "tokens_used": self.total_tokens_used,
            "activities_created": len(self.created_activities)
        }