"""
Activity source lineage model for Content Studio.
Tracks the relationship between activities and their source documents for full chain of custody.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import ARRAY, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.generation_session import GenerationSession
    from app.models.source_document import SourceDocument


class ActivitySource(Base):
    """
    Activity source lineage model for tracking the relationship between
    generated activities and their source documents.
    """

    __tablename__ = "activity_sources"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Relationships
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    generation_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generation_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Citation and usage details
    citation_references: Mapped[List[str] | None] = mapped_column(
        ARRAY(String), comment="Specific page/section references used from the source document"
    )
    influence_weight: Mapped[float | None] = mapped_column(
        comment="How heavily this source influenced the generated content (0.0-1.0)"
    )
    notes: Mapped[str | None] = mapped_column(Text, comment="Additional notes about how this source was used")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    activity: Mapped["ContentItem"] = relationship(back_populates="source_lineage", lazy="select")
    source_document: Mapped["SourceDocument"] = relationship(lazy="select")
    generation_session: Mapped["GenerationSession"] = relationship(lazy="select")

    def __repr__(self) -> str:
        return (
            f"<ActivitySource(activity_id={str(self.activity_id)[:8]}, source_id={str(self.source_document_id)[:8]})>"
        )

    def add_citation_reference(self, reference: str) -> None:
        """Add a citation reference."""
        if not self.citation_references:
            self.citation_references = []
        if reference not in self.citation_references:
            self.citation_references.append(reference)

    def get_citation_summary(self) -> str:
        """Get a summary of citations for display."""
        if not self.citation_references:
            return "General reference"
        if len(self.citation_references) == 1:
            return f"Reference: {self.citation_references[0]}"
        return (
            f"References: {', '.join(self.citation_references[:3])}{'...' if len(self.citation_references) > 3 else ''}"
        )
