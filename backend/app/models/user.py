"""
User database model with role-based access control.
Uses modern SQLAlchemy 2.0 syntax with Python 3.11+ typing.
"""

import uuid
from datetime import datetime
from enum import Enum as PythonEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.generation_session import GenerationSession
    from app.models.media import MediaItem
    from app.models.source_document import SourceDocument
    from app.models.training_program import AttendanceRecord, TrainingBooking, TrainingProgram, TrainingSession

    # TODO: Uncomment when ApprovalStep model is implemented
    # from app.models.workflow import ApprovalStep


class UserRole(str, PythonEnum):
    """User roles for access control."""

    PLAYER = "PLAYER"
    LEARNER = "LEARNER"
    CREATOR = "CREATOR"
    REVIEWER = "REVIEWER"
    APPROVER = "APPROVER"
    ADMIN = "ADMIN"


class User(Base):
    """
    User model with modern SQLAlchemy 2.0 mapped_column syntax.
    Supports role-based access control for content management.
    """

    __tablename__ = "users"

    # Primary key with UUID
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # User credentials
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # User profile
    full_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), default=UserRole.PLAYER, nullable=False)

    # User status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps with automatic handling
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships using modern typing
    created_content: Mapped[list["ContentItem"]] = relationship(back_populates="creator", lazy="select")
    source_documents: Mapped[list["SourceDocument"]] = relationship(back_populates="owner", lazy="select")
    generation_sessions: Mapped[list["GenerationSession"]] = relationship(back_populates="creator", lazy="select")
    created_media: Mapped[list["MediaItem"]] = relationship(back_populates="creator", lazy="select")

    # Training relationships (updated for new structure)
    created_programs: Mapped[list["TrainingProgram"]] = relationship(
        foreign_keys="TrainingProgram.created_by_id", back_populates="created_by", lazy="select"
    )
    instructor_sessions: Mapped[list["TrainingSession"]] = relationship(
        foreign_keys="TrainingSession.instructor_id", back_populates="instructor", lazy="select"
    )
    training_bookings: Mapped[list["TrainingBooking"]] = relationship(
        foreign_keys="TrainingBooking.learner_id", back_populates="learner", lazy="select"
    )
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        foreign_keys="AttendanceRecord.learner_id", back_populates="learner", lazy="select"
    )

    # TODO: Uncomment when ApprovalStep model is implemented
    # approval_steps: Mapped[list["ApprovalStep"]] = relationship(
    #     back_populates="approver",
    #     lazy="select"
    # )

    def __repr__(self) -> str:
        return f"<User(username={self.username}, role={self.role})>"

    def has_role(self, role: UserRole) -> bool:
        """Check if user has specific role."""
        return self.role == role

    def can_create_content(self) -> bool:
        """Check if user can create content."""
        return self.role in {UserRole.CREATOR, UserRole.ADMIN}

    def can_review_content(self) -> bool:
        """Check if user can review content."""
        return self.role in {UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN}

    def can_approve_content(self) -> bool:
        """Check if user can approve content."""
        return self.role in {UserRole.APPROVER, UserRole.ADMIN}

    def can_manage_users(self) -> bool:
        """Check if user can manage other users."""
        return self.role == UserRole.ADMIN
