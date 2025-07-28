"""
Content database model for NLJ scenarios with lifecycle management.
Uses modern SQLAlchemy 2.0 syntax with Python 3.11+ typing.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.workflow import ContentVersion, ApprovalWorkflow


class ContentState(str, Enum):
    """Content lifecycle states."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class ContentType(str, Enum):
    """Types of content that can be created."""
    TRAINING = "training"
    SURVEY = "survey"
    ASSESSMENT = "assessment"
    GAME = "game"
    MIXED = "mixed"


class LearningStyle(str, Enum):
    """Learning style variants for content generation."""
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING_WRITING = "reading_writing"


class ContentItem(Base):
    """
    Content model for storing NLJ scenarios with modern SQLAlchemy 2.0 syntax.
    Supports full content lifecycle from creation to publication.
    """
    
    __tablename__ = "content_items"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Basic content information
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    description: Mapped[str | None] = mapped_column(Text)
    
    # Content data - store the NLJ JSON directly
    nlj_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="Complete NLJ scenario data as JSON"
    )
    
    # Content metadata
    content_type: Mapped[ContentType] = mapped_column(
        String(20),
        default=ContentType.TRAINING,
        nullable=False
    )
    learning_style: Mapped[LearningStyle | None] = mapped_column(
        String(20),
        comment="Primary learning style for this content variant"
    )
    
    # Content lifecycle
    state: Mapped[ContentState] = mapped_column(
        String(20),
        default=ContentState.DRAFT,
        nullable=False,
        index=True
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    
    # Content relationships
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    
    # Parent content for variants (e.g., different learning styles)
    parent_content_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_items.id"),
        index=True
    )
    
    # Template information
    is_template: Mapped[bool] = mapped_column(default=False)
    template_category: Mapped[str | None] = mapped_column(
        String(100),
        comment="Category for template organization"
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # Usage statistics
    view_count: Mapped[int] = mapped_column(default=0)
    completion_count: Mapped[int] = mapped_column(default=0)
    
    # Relationships with modern typing
    creator: Mapped["User"] = relationship(
        back_populates="created_content",
        lazy="selectin"
    )
    
    # Self-referential relationship for content variants
    parent_content: Mapped["ContentItem | None"] = relationship(
        remote_side=[id],
        lazy="selectin"
    )
    
    # Version-aware relationships
    versions: Mapped[list["ContentVersion"]] = relationship(
        back_populates="content",
        cascade="all, delete-orphan",
        order_by="ContentVersion.version_number.desc()",
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return f"<ContentItem(title={self.title}, state={self.state})>"
    
    def is_editable(self) -> bool:
        """Check if content can be edited."""
        return self.state in {ContentState.DRAFT, ContentState.REJECTED}
    
    def can_be_submitted(self) -> bool:
        """Check if content can be submitted for approval."""
        return self.state == ContentState.DRAFT
    
    def is_published(self) -> bool:
        """Check if content is published and available to players."""
        return self.state == ContentState.PUBLISHED
    
    def get_current_version(self) -> "ContentVersion | None":
        """Get the current working/published version."""
        if not self.versions:
            return None
        # Return the latest version (versions are ordered by version_number desc)
        return self.versions[0]
    
    def get_published_version(self) -> "ContentVersion | None":
        """Get the currently published version."""
        from app.models.workflow import VersionStatus
        for version in self.versions:
            if version.version_status == VersionStatus.PUBLISHED:
                return version
        return None
    
    def get_draft_version(self) -> "ContentVersion | None":
        """Get the current draft version."""
        from app.models.workflow import VersionStatus
        for version in self.versions:
            if version.version_status == VersionStatus.DRAFT:
                return version
        return None
    
    def create_new_version(self, creator_id: uuid.UUID, change_summary: str = None) -> "ContentVersion":
        """Create a new version of this content."""
        from app.models.workflow import ContentVersion, VersionStatus
        
        next_version_number = (max(v.version_number for v in self.versions) + 1) if self.versions else 1
        
        new_version = ContentVersion(
            content_id=self.id,
            version_number=next_version_number,
            version_status=VersionStatus.DRAFT,
            nlj_data=self.nlj_data.copy(),  # Copy current NLJ data
            title=self.title,
            description=self.description,
            change_summary=change_summary,
            created_by=creator_id
        )
        
        return new_version
    
    def get_workflow_stage(self) -> str | None:
        """Get current workflow stage if in approval process."""
        current_version = self.get_current_version()
        if current_version and current_version.approval_workflow:
            return current_version.approval_workflow.current_state
        return None
    
    def increment_view_count(self) -> None:
        """Increment view count for analytics."""
        self.view_count += 1
    
    def increment_completion_count(self) -> None:
        """Increment completion count for analytics."""
        self.completion_count += 1