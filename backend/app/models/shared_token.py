"""
Shared Token model for public content and media sharing.
Manages secure tokens that allow unauthenticated access to published activities and media.
"""

import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.media import MediaItem
    from app.models.user import User


def generate_share_token() -> str:
    """Generate a cryptographically secure URL-safe sharing token."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


class SharedToken(Base):
    """
    Shared token for public content and media access.

    Allows unauthenticated users to access specific published activities or media
    via a secure, shareable link with optional QR code generation.
    """

    __tablename__ = "shared_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Polymorphic sharing - can share either content or media
    content_id = Column(UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE"), nullable=True)
    media_id = Column(UUID(as_uuid=True), ForeignKey("media_items.id", ondelete="CASCADE"), nullable=True)

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
    content: Mapped[Optional["ContentItem"]] = relationship("ContentItem", back_populates="shared_tokens")
    media: Mapped[Optional["MediaItem"]] = relationship("MediaItem", back_populates="shared_tokens")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        shared_type = "media" if self.media_id else "content"
        shared_id = self.media_id or self.content_id
        return f"<SharedToken(token='{self.token}', {shared_type}_id='{shared_id}', active={self.is_active})>"

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

    @property
    def shared_type(self) -> str:
        """Get the type of shared resource."""
        return "media" if self.media_id else "content"

    @property
    def shared_resource(self) -> Optional["ContentItem | MediaItem"]:
        """Get the shared resource (content or media)."""
        return self.media if self.media_id else self.content

    def increment_access_count(self) -> None:
        """Increment the access count and update last accessed timestamp."""
        self.access_count += 1
        self.last_accessed_at = datetime.now(timezone.utc)

    def revoke(self) -> None:
        """Revoke the token by setting it as inactive."""
        self.is_active = False

    def is_media_share(self) -> bool:
        """Check if this token shares media content."""
        return self.media_id is not None

    def is_content_share(self) -> bool:
        """Check if this token shares activity content."""
        return self.content_id is not None
