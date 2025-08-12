"""
Approval workflow models for version-aware content review and approval process.
Supports multi-stage approval workflows with version control.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.user import User


class VersionStatus(str, Enum):
    """Version-specific status for content versions."""

    DRAFT = "draft"  # Being edited by creator
    PUBLISHED = "published"  # Live and available to users
    ARCHIVED = "archived"  # Older version, kept for history


class WorkflowState(str, Enum):
    """States in the approval workflow process."""

    DRAFT = "draft"  # Creator is editing
    SUBMITTED_FOR_REVIEW = "submitted_for_review"  # Submitted to reviewers
    IN_REVIEW = "in_review"  # Being reviewed
    REVISION_REQUESTED = "revision_requested"  # Needs changes
    APPROVED_PENDING_PUBLISH = "approved_pending_publish"  # Approved, waiting to publish
    PUBLISHED = "published"  # Live version
    REJECTED = "rejected"  # Permanently rejected
    WITHDRAWN = "withdrawn"  # Creator withdrew submission


class ReviewDecision(str, Enum):
    """Decision options for reviewers."""

    APPROVE = "approve"
    REQUEST_REVISION = "request_revision"
    REJECT = "reject"


class WorkflowTemplateType(str, Enum):
    """Types of content that can have different workflow templates."""

    TRAINING = "training"
    ASSESSMENT = "assessment"
    SURVEY = "survey"
    GAME = "game"
    DEFAULT = "default"


class StageType(str, Enum):
    """Types of review stages."""

    PEER_REVIEW = "peer_review"  # Peer/colleague review
    SUBJECT_MATTER_EXPERT = "sme"  # SME review
    MANAGER_APPROVAL = "manager"  # Manager approval
    LEGAL_REVIEW = "legal"  # Legal/compliance review
    FINAL_APPROVAL = "final"  # Final approval before publish
    CUSTOM = "custom"  # Custom stage type


class ContentVersion(Base):
    """
    Version-aware content storage. Each version represents a snapshot
    of content at a specific point in time with its own lifecycle.
    """

    __tablename__ = "content_versions"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Link to base content item
    content_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Version information
    version_number: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Incremental version number (1, 2, 3, ...)"
    )
    version_status: Mapped[VersionStatus] = mapped_column(
        String(20), default=VersionStatus.DRAFT, nullable=False, index=True
    )

    # Content snapshot - store the NLJ JSON for this specific version
    nlj_data: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, comment="NLJ scenario data snapshot for this version"
    )

    # Version metadata
    title: Mapped[str] = mapped_column(String(255), nullable=False, comment="Title at time of this version")
    description: Mapped[str | None] = mapped_column(Text, comment="Description at time of this version")

    # Change tracking
    change_summary: Mapped[str | None] = mapped_column(Text, comment="Summary of changes made in this version")
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When this version was published (if applicable)"
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When this version was archived"
    )

    # Relationships
    content: Mapped["ContentItem"] = relationship(back_populates="versions", lazy="select")
    creator: Mapped["User"] = relationship(foreign_keys=[created_by], lazy="select")

    # Link to approval workflow for this version
    approval_workflow: Mapped["ApprovalWorkflow | None"] = relationship(
        back_populates="content_version", uselist=False, lazy="select"
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
        return self.version_status == VersionStatus.DRAFT and (
            not self.approval_workflow or self.approval_workflow.current_state == WorkflowState.APPROVED_PENDING_PUBLISH
        )


class ApprovalWorkflow(Base):
    """
    Tracks the approval workflow for a specific content version.
    Each version gets its own workflow instance.
    """

    __tablename__ = "approval_workflows"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Link to specific content version
    content_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_versions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One workflow per version
        index=True,
    )

    # Workflow state
    current_state: Mapped[WorkflowState] = mapped_column(
        String(30), default=WorkflowState.DRAFT, nullable=False, index=True
    )

    # Workflow metadata
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="When submitted for review")
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When final approval was granted"
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="When version was published")

    # Current reviewer assignment (for single-stage workflows)
    assigned_reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
        comment="Currently assigned reviewer (single-stage workflow)",
    )

    # Multi-stage workflow support
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_templates.id"),
        index=True,
        comment="Workflow template (if using multi-stage workflow)",
    )
    current_stage_order: Mapped[int | None] = mapped_column(
        Integer, comment="Current stage in multi-stage workflow (1, 2, 3, ...)"
    )

    # Workflow configuration
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="Whether this content type requires approval"
    )

    # Auto-publish after approval
    auto_publish: Mapped[bool] = mapped_column(Boolean, default=False, comment="Automatically publish after approval")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    content_version: Mapped["ContentVersion"] = relationship(back_populates="approval_workflow", lazy="select")
    assigned_reviewer: Mapped["User | None"] = relationship(foreign_keys=[assigned_reviewer_id], lazy="select")
    template: Mapped["WorkflowTemplate | None"] = relationship(back_populates="workflows", lazy="select")

    # Multi-stage workflow instances
    stage_instances: Mapped[list["WorkflowStageInstance"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowStageInstance.template_stage_id",
        lazy="select",
    )

    # Review history
    reviews: Mapped[list["WorkflowReview"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowReview.created_at.desc()",
        lazy="select",
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

    def is_multi_stage(self) -> bool:
        """Check if this workflow uses multi-stage approval."""
        return self.template_id is not None

    def get_current_stage(self) -> "WorkflowStageInstance | None":
        """Get the current active stage in multi-stage workflow."""
        if not self.is_multi_stage() or not self.current_stage_order:
            return None

        # Find stage instance matching current stage order
        for stage in self.stage_instances:
            if stage.template_stage.stage_order == self.current_stage_order:
                return stage
        return None

    def has_pending_stages(self) -> bool:
        """Check if there are pending stages after the current one."""
        if not self.is_multi_stage():
            return False

        current_order = self.current_stage_order or 0
        return any(stage.template_stage.stage_order > current_order for stage in self.stage_instances)


class WorkflowReview(Base):
    """
    Individual review entries in the approval workflow.
    Tracks reviewer decisions, comments, and timestamps.
    """

    __tablename__ = "workflow_reviews"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Link to workflow
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Link to specific stage (for multi-stage workflows)
    stage_instance_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workflow_stage_instances.id", ondelete="CASCADE"),
        index=True,
        comment="Specific stage this review belongs to (multi-stage workflows)",
    )

    # Review details
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    decision: Mapped[ReviewDecision] = mapped_column(String(20), nullable=False)

    comments: Mapped[str | None] = mapped_column(Text, comment="Reviewer feedback and comments")

    # Specific feedback areas
    feedback_areas: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, comment="Structured feedback by area (content, design, technical, etc.)"
    )

    # State changes
    previous_state: Mapped[WorkflowState] = mapped_column(
        String(30), nullable=False, comment="Workflow state before this review"
    )
    new_state: Mapped[WorkflowState] = mapped_column(
        String(30), nullable=False, comment="Workflow state after this review"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    workflow: Mapped["ApprovalWorkflow"] = relationship(back_populates="reviews", lazy="select")
    reviewer: Mapped["User"] = relationship(foreign_keys=[reviewer_id], lazy="select")
    stage_instance: Mapped["WorkflowStageInstance | None"] = relationship(back_populates="reviews", lazy="select")

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


class WorkflowTemplate(Base):
    """
    Template defining multi-stage workflows for different content types.
    Templates specify the sequence of review stages and their requirements.
    """

    __tablename__ = "workflow_templates"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Template identification
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Human-readable template name")
    content_type: Mapped[WorkflowTemplateType] = mapped_column(
        String(20), nullable=False, index=True, comment="Type of content this template applies to"
    )

    # Template configuration
    description: Mapped[str | None] = mapped_column(Text, comment="Description of this workflow template")
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Whether this is the default template for the content type"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="Whether this template is currently active")

    # Auto-publish after all stages complete
    auto_publish_on_completion: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Automatically publish content after all stages approve"
    )

    # Creation tracking
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    creator: Mapped["User"] = relationship(foreign_keys=[created_by], lazy="select")
    stages: Mapped[list["WorkflowTemplateStage"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="WorkflowTemplateStage.stage_order",
        lazy="select",
    )
    workflows: Mapped[list["ApprovalWorkflow"]] = relationship(back_populates="template", lazy="select")

    def __repr__(self) -> str:
        return f"<WorkflowTemplate(name={self.name}, type={self.content_type})>"


class WorkflowTemplateStage(Base):
    """
    Individual stage definition within a workflow template.
    Defines the type, requirements, and reviewer assignments for each stage.
    """

    __tablename__ = "workflow_template_stages"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Link to template
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Stage configuration
    stage_order: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Order of this stage in the workflow (1, 2, 3, ...)"
    )
    stage_type: Mapped[StageType] = mapped_column(String(30), nullable=False, comment="Type of review stage")

    # Stage metadata
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Human-readable stage name")
    description: Mapped[str | None] = mapped_column(Text, comment="Description of this review stage")

    # Stage requirements
    required_approvals: Mapped[int] = mapped_column(
        Integer, default=1, comment="Number of approvals needed to complete this stage"
    )
    allow_parallel_review: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Whether multiple reviewers can review simultaneously"
    )

    # Auto-assignment rules
    auto_assign_to_role: Mapped[str | None] = mapped_column(
        String(50), comment="Automatically assign to users with this role"
    )
    reviewer_selection_criteria: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, comment="JSON criteria for automatic reviewer selection"
    )

    # Stage timing
    estimated_duration_hours: Mapped[int | None] = mapped_column(
        Integer, comment="Estimated time to complete this stage (hours)"
    )

    # Relationships
    template: Mapped["WorkflowTemplate"] = relationship(back_populates="stages", lazy="select")
    stage_instances: Mapped[list["WorkflowStageInstance"]] = relationship(
        back_populates="template_stage", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<WorkflowTemplateStage(template_id={self.template_id}, order={self.stage_order}, type={self.stage_type})>"
        )


class WorkflowStageInstance(Base):
    """
    Active instance of a workflow stage for a specific content version.
    Tracks the actual progress and reviewer assignments for each stage.
    """

    __tablename__ = "workflow_stage_instances"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Links
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_template_stages.id"), nullable=False, index=True
    )

    # Stage status
    current_state: Mapped[WorkflowState] = mapped_column(
        String(30),
        default=WorkflowState.DRAFT,
        nullable=False,
        index=True,
        comment="Current state of this stage instance",
    )

    # Progress tracking
    approvals_received: Mapped[int] = mapped_column(
        Integer, default=0, comment="Number of approvals received for this stage"
    )
    approvals_required: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Number of approvals needed (copied from template)"
    )

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="When this stage started")
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When this stage was completed"
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="Expected completion date")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    workflow: Mapped["ApprovalWorkflow"] = relationship(back_populates="stage_instances", lazy="select")
    template_stage: Mapped["WorkflowTemplateStage"] = relationship(back_populates="stage_instances", lazy="select")
    reviewer_assignments: Mapped[list["StageReviewerAssignment"]] = relationship(
        back_populates="stage_instance", cascade="all, delete-orphan", lazy="select"
    )
    reviews: Mapped[list["WorkflowReview"]] = relationship(
        foreign_keys="WorkflowReview.stage_instance_id", back_populates="stage_instance", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<WorkflowStageInstance(workflow_id={self.workflow_id}, state={self.current_state})>"

    def is_complete(self) -> bool:
        """Check if this stage has received all required approvals."""
        return self.approvals_received >= self.approvals_required

    def can_complete(self) -> bool:
        """Check if this stage can be marked as complete."""
        return self.current_state == WorkflowState.IN_REVIEW and self.is_complete()


class StageReviewerAssignment(Base):
    """
    Assignment of specific reviewers to workflow stage instances.
    Supports both individual assignments and role-based assignments.
    """

    __tablename__ = "stage_reviewer_assignments"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Links
    stage_instance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_stage_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, comment="Specific user assigned to review"
    )

    # Assignment metadata
    assigned_role: Mapped[str | None] = mapped_column(
        String(50), comment="Role-based assignment (if reviewer_id is null)"
    )
    assignment_type: Mapped[str] = mapped_column(
        String(20), default="direct", comment="Type of assignment: direct, role_based, delegated"
    )

    # Assignment status
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="Whether this assignment is currently active"
    )
    has_reviewed: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Whether this reviewer has completed their review"
    )

    # Delegation support
    delegated_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="Original reviewer who delegated this assignment"
    )
    delegation_reason: Mapped[str | None] = mapped_column(Text, comment="Reason for delegation")

    # Assignment tracking
    assigned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True, comment="User who made this assignment"
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    stage_instance: Mapped["WorkflowStageInstance"] = relationship(back_populates="reviewer_assignments", lazy="select")
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewer_id], lazy="select")
    delegated_from: Mapped["User | None"] = relationship(foreign_keys=[delegated_from_id], lazy="select")
    assigner: Mapped["User"] = relationship(foreign_keys=[assigned_by], lazy="select")

    def __repr__(self) -> str:
        return f"<StageReviewerAssignment(stage_id={self.stage_instance_id}, reviewer_id={self.reviewer_id})>"
