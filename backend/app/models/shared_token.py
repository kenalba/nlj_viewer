"""
Shared Token model for public activity sharing.
Manages secure tokens that allow unauthenticated access to published activities.
"""

import uuid
import secrets
import string
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.user import User


def generate_share_token() -> str:
    """Generate a cryptographically secure URL-safe sharing token."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(12))


class SharedToken(Base):
    """
    Shared token for public activity access.
    
    Allows unauthenticated users to access specific published activities
    via a secure, shareable link with optional QR code generation.
    """
    __tablename__ = "shared_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(16), unique=True, nullable=False, default=generate_share_token)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # NULL = permanent
    is_active = Column(Boolean, default=True, nullable=False)
    access_count = Column(Integer, default=0, nullable=False)
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Optional: Store additional metadata
    description = Column(Text, nullable=True)  # User-provided description for the share
    
    # Relationships
    content: Mapped["ContentItem"] = relationship("ContentItem", back_populates="shared_tokens")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self) -> str:
        return f"<SharedToken(token='{self.token}', content_id='{self.content_id}', active={self.is_active})>"
    
    @property
    def is_expired(self) -> bool:
        """Check if the token has expired."""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at
    
    @property
    def is_valid(self) -> bool:
        """Check if the token is valid (active and not expired)."""
        return self.is_active and not self.is_expired
    
    def increment_access_count(self) -> None:
        """Increment the access count and update last accessed timestamp."""
        self.access_count += 1
        self.last_accessed_at = datetime.now(timezone.utc)
    
    def revoke(self) -> None:
        """Revoke the token by setting it as inactive."""
        self.is_active = False