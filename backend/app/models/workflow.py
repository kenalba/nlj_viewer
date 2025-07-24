"""
Approval workflow models for content review and approval process.
Uses modern SQLAlchemy 2.0 syntax with Python 3.11+ typing.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.content import ContentItem


class ApprovalStage(str, Enum):
    """Stages in the approval workflow."""
    SGM = "sgm"
    LEGAL = "legal"
    COMPLIANCE = "compliance"


class ApprovalDecision(str, Enum):
    """Possible decisions in approval process."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_CHANGES = "requires_changes"


class ApprovalWorkflow(Base):
    """
    Workflow tracking for content approval process.
    Manages multi-stage approval with SGM -> Legal -> Compliance flow.
    """
    
    __tablename__ = "approval_workflows"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Content being approved
    content_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One workflow per content item
        index=True
    )
    
    # Workflow state
    current_stage: Mapped[ApprovalStage] = mapped_column(
        String(20),
        default=ApprovalStage.SGM,
        nullable=False
    )
    is_completed: Mapped[bool] = mapped_column(default=False)
    is_approved: Mapped[bool] = mapped_column(default=False)
    
    # Timestamps
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    content: Mapped["ContentItem"] = relationship(
        back_populates="approval_workflow",
        lazy="selectin"
    )
    
    approval_steps: Mapped[list["ApprovalStep"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return f"<ApprovalWorkflow(content_id={self.content_id}, stage={self.current_stage})>"
    
    def get_next_stage(self) -> ApprovalStage | None:
        """Get the next stage in the approval process."""
        stage_order = [ApprovalStage.SGM, ApprovalStage.LEGAL, ApprovalStage.COMPLIANCE]
        try:
            current_index = stage_order.index(self.current_stage)
            if current_index < len(stage_order) - 1:
                return stage_order[current_index + 1]
        except ValueError:
            pass
        return None
    
    def advance_to_next_stage(self) -> bool:
        """Advance workflow to next stage. Returns True if successful."""
        next_stage = self.get_next_stage()
        if next_stage:
            self.current_stage = next_stage
            return True
        return False
    
    def complete_workflow(self, approved: bool = True) -> None:
        """Complete the workflow with final decision."""
        self.is_completed = True
        self.is_approved = approved
        self.completed_at = datetime.utcnow()


class ApprovalStep(Base):
    """
    Individual approval step within a workflow.
    Tracks decisions made by specific approvers at each stage.
    """
    
    __tablename__ = "approval_steps"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Workflow relationship
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Approval details
    stage: Mapped[ApprovalStage] = mapped_column(
        String(20),
        nullable=False
    )
    decision: Mapped[ApprovalDecision] = mapped_column(
        String(20),
        default=ApprovalDecision.PENDING,
        nullable=False
    )
    
    # Approver information
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True
    )
    
    # Feedback and comments
    comments: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(
        Text,
        comment="Internal notes not visible to content creator"
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    workflow: Mapped["ApprovalWorkflow"] = relationship(
        back_populates="approval_steps",
        lazy="selectin"
    )
    
    approver: Mapped["User | None"] = relationship(
        back_populates="approval_steps",
        lazy="selectin"
    )
    
    def __repr__(self) -> str:
        return f"<ApprovalStep(stage={self.stage}, decision={self.decision})>"
    
    def approve(self, approver_id: uuid.UUID, comments: str | None = None) -> None:
        """Approve this step."""
        self.decision = ApprovalDecision.APPROVED
        self.approver_id = approver_id
        self.comments = comments
        self.decided_at = datetime.utcnow()
    
    def reject(self, approver_id: uuid.UUID, comments: str) -> None:
        """Reject this step with required comments."""
        self.decision = ApprovalDecision.REJECTED
        self.approver_id = approver_id
        self.comments = comments
        self.decided_at = datetime.utcnow()
    
    def request_changes(self, approver_id: uuid.UUID, comments: str) -> None:
        """Request changes to content."""
        self.decision = ApprovalDecision.REQUIRES_CHANGES
        self.approver_id = approver_id
        self.comments = comments
        self.decided_at = datetime.utcnow()
    
    def is_pending(self) -> bool:
        """Check if this step is still pending."""
        return self.decision == ApprovalDecision.PENDING
    
    def is_decided(self) -> bool:
        """Check if this step has been decided."""
        return self.decision != ApprovalDecision.PENDING