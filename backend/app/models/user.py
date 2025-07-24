"""
User database model with role-based access control.
Uses modern SQLAlchemy 2.0 syntax with Python 3.11+ typing.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.workflow import ApprovalStep


class UserRole(str, Enum):
    """User roles for access control."""
    CREATOR = "creator"
    REVIEWER = "reviewer"
    APPROVER = "approver"
    ADMIN = "admin"


class User(Base):
    """
    User model with modern SQLAlchemy 2.0 mapped_column syntax.
    Supports role-based access control for content management.
    """
    
    __tablename__ = "users"
    
    # Primary key with UUID
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # User credentials
    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    
    # User profile
    full_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole),
        default=UserRole.CREATOR,
        nullable=False
    )
    
    # User status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps with automatic handling
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
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # Relationships using modern typing
    created_content: Mapped[list["ContentItem"]] = relationship(
        back_populates="creator",
        lazy="selectin"
    )
    approval_steps: Mapped[list["ApprovalStep"]] = relationship(
        back_populates="approver",
        lazy="selectin"
    )
    
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