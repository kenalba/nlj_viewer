"""
Approval workflow models for version-aware content review and approval process.
Supports multi-stage approval workflows with version control.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.content import ContentItem


class VersionStatus(str, Enum):
    """Version-specific status for content versions."""
    DRAFT = "draft"           # Being edited by creator
    PUBLISHED = "published"   # Live and available to users
    ARCHIVED = "archived"     # Older version, kept for history


class WorkflowState(str, Enum):
    """States in the approval workflow process."""
    DRAFT = "draft"                    # Creator is editing
    SUBMITTED_FOR_REVIEW = "submitted_for_review"  # Submitted to reviewers
    IN_REVIEW = "in_review"            # Being reviewed
    REVISION_REQUESTED = "revision_requested"      # Needs changes
    APPROVED_PENDING_PUBLISH = "approved_pending_publish"  # Approved, waiting to publish
    PUBLISHED = "published"            # Live version
    REJECTED = "rejected"              # Permanently rejected
    WITHDRAWN = "withdrawn"            # Creator withdrew submission


class ReviewDecision(str, Enum):
    """Decision options for reviewers."""
    APPROVE = "approve"
    REQUEST_REVISION = "request_revision"
    REJECT = "reject"


class ContentVersion(Base):
    """
    Version-aware content storage. Each version represents a snapshot
    of content at a specific point in time with its own lifecycle.
    """
    
    __tablename__ = "content_versions"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Link to base content item
    content_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Version information
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Incremental version number (1, 2, 3, ...)"
    )
    version_status: Mapped[VersionStatus] = mapped_column(
        String(20),
        default=VersionStatus.DRAFT,
        nullable=False,
        index=True
    )
    
    # Content snapshot - store the NLJ JSON for this specific version
    nlj_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="NLJ scenario data snapshot for this version"
    )
    
    # Version metadata
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Title at time of this version"
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="Description at time of this version"
    )
    
    # Change tracking
    change_summary: Mapped[str | None] = mapped_column(
        Text,
        comment="Summary of changes made in this version"
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When this version was published (if applicable)"
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When this version was archived"
    )
    
    # Relationships
    content: Mapped["ContentItem"] = relationship(
        back_populates="versions",
        lazy="selectin"
    )
    creator: Mapped["User"] = relationship(
        foreign_keys=[created_by],
        lazy="selectin"
    )
    
    # Link to approval workflow for this version
    approval_workflow: Mapped["ApprovalWorkflow | None"] = relationship(
        back_populates="content_version",
        uselist=False,
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return f"<ContentVersion(content_id={self.content_id}, v{self.version_number}, status={self.version_status})>"
    
    def is_editable(self) -> bool:
        """Check if this version can be edited."""
        return self.version_status == VersionStatus.DRAFT
    
    def is_current_published(self) -> bool:
        """Check if this is the currently published version."""
        return self.version_status == VersionStatus.PUBLISHED
    
    def can_be_published(self) -> bool:
        """Check if this version can be published."""
        return (
            self.version_status == VersionStatus.DRAFT and
            (not self.approval_workflow or 
             self.approval_workflow.current_state == WorkflowState.APPROVED_PENDING_PUBLISH)
        )


class ApprovalWorkflow(Base):
    """
    Tracks the approval workflow for a specific content version.
    Each version gets its own workflow instance.
    """
    
    __tablename__ = "approval_workflows"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Link to specific content version
    content_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_versions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One workflow per version
        index=True
    )
    
    # Workflow state
    current_state: Mapped[WorkflowState] = mapped_column(
        String(30),
        default=WorkflowState.DRAFT,
        nullable=False,
        index=True
    )
    
    # Workflow metadata
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When submitted for review"
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When final approval was granted"
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When version was published"
    )
    
    # Current reviewer assignment
    assigned_reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
        comment="Currently assigned reviewer"
    )
    
    # Workflow configuration
    requires_approval: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        comment="Whether this content type requires approval"
    )
    
    # Auto-publish after approval
    auto_publish: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="Automatically publish after approval"
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
    
    # Relationships
    content_version: Mapped["ContentVersion"] = relationship(
        back_populates="approval_workflow",
        lazy="selectin"
    )
    assigned_reviewer: Mapped["User | None"] = relationship(
        foreign_keys=[assigned_reviewer_id],
        lazy="selectin"
    )
    
    # Review history
    reviews: Mapped[list["WorkflowReview"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowReview.created_at.desc()",
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return f"<ApprovalWorkflow(version_id={self.content_version_id}, state={self.current_state})>"
    
    def can_submit_for_review(self) -> bool:
        """Check if workflow can be submitted for review."""
        return self.current_state in {WorkflowState.DRAFT, WorkflowState.REVISION_REQUESTED}
    
    def can_approve(self) -> bool:
        """Check if workflow can be approved."""
        return self.current_state == WorkflowState.IN_REVIEW
    
    def can_request_revision(self) -> bool:
        """Check if revisions can be requested."""
        return self.current_state == WorkflowState.IN_REVIEW
    
    def can_publish(self) -> bool:
        """Check if version can be published."""
        return self.current_state == WorkflowState.APPROVED_PENDING_PUBLISH
    
    def get_latest_review(self) -> "WorkflowReview | None":
        """Get the most recent review."""
        return self.reviews[0] if self.reviews else None


class WorkflowReview(Base):
    """
    Individual review entries in the approval workflow.
    Tracks reviewer decisions, comments, and timestamps.
    """
    
    __tablename__ = "workflow_reviews"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Link to workflow
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Review details
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    
    decision: Mapped[ReviewDecision] = mapped_column(
        String(20),
        nullable=False
    )
    
    comments: Mapped[str | None] = mapped_column(
        Text,
        comment="Reviewer feedback and comments"
    )
    
    # Specific feedback areas
    feedback_areas: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="Structured feedback by area (content, design, technical, etc.)"
    )
    
    # State changes
    previous_state: Mapped[WorkflowState] = mapped_column(
        String(30),
        nullable=False,
        comment="Workflow state before this review"
    )
    new_state: Mapped[WorkflowState] = mapped_column(
        String(30),
        nullable=False,
        comment="Workflow state after this review"
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    # Relationships
    workflow: Mapped["ApprovalWorkflow"] = relationship(
        back_populates="reviews",
        lazy="selectin"
    )
    reviewer: Mapped["User"] = relationship(
        foreign_keys=[reviewer_id],
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return f"<WorkflowReview(workflow_id={self.workflow_id}, decision={self.decision})>"
    
    def is_approval(self) -> bool:
        """Check if this review approved the content."""
        return self.decision == ReviewDecision.APPROVE
    
    def is_revision_request(self) -> bool:
        """Check if this review requested revisions."""
        return self.decision == ReviewDecision.REQUEST_REVISION
    
    def is_rejection(self) -> bool:
        """Check if this review rejected the content."""
        return self.decision == ReviewDecision.REJECT