"""
Learning objectives model for normalized concept organization and tracking.
Supports domain-specific learning objectives with cognitive levels and prerequisites.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Index, DECIMAL
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.user import User
    from app.models.node import Node


class LearningObjective(Base):
    """
    Normalized learning objectives for knowledge organization and tracking.
    Supports Bloom's taxonomy cognitive levels and domain classification.
    """

    __tablename__ = "learning_objectives"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )

    # Objective content
    objective_text: Mapped[str] = mapped_column(
        Text, 
        nullable=False,
        comment="Learning objective description"
    )

    # Classification
    domain: Mapped[Optional[str]] = mapped_column(
        String(100), 
        index=True,
        comment="Domain classification (automotive, sales, programming, etc.)"
    )
    
    cognitive_level: Mapped[Optional[str]] = mapped_column(
        String(20), 
        index=True,
        comment="Bloom's taxonomy level (remember, understand, apply, analyze, evaluate, create)"
    )
    
    difficulty_level: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Difficulty level 1-10"
    )

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(
        Integer, 
        default=0, 
        nullable=False,
        comment="Number of times this objective has been used"
    )

    # Lineage tracking
    created_from_activity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_items.id"),
        comment="Activity that originally defined this objective"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    created_from_activity: Mapped[Optional["ContentItem"]] = relationship(lazy="select")
    
    # Node relationships
    node_relationships: Mapped[list["NodeLearningObjective"]] = relationship(
        back_populates="objective",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    # Prerequisite relationships
    prerequisites: Mapped[list["ObjectivePrerequisite"]] = relationship(
        foreign_keys="ObjectivePrerequisite.objective_id",
        back_populates="objective",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    dependent_objectives: Mapped[list["ObjectivePrerequisite"]] = relationship(
        foreign_keys="ObjectivePrerequisite.prerequisite_objective_id",
        back_populates="prerequisite_objective",
        lazy="select"
    )

    # Indexes
    __table_args__ = (
        Index('idx_learning_objectives_text', 'objective_text'),
        Index('idx_learning_objectives_domain', 'domain'),
        Index('idx_learning_objectives_cognitive', 'cognitive_level'),
        Index('idx_learning_objectives_usage', 'usage_count'),
    )

    def __repr__(self) -> str:
        return f"<LearningObjective(id={self.id}, domain={self.domain}, text={self.objective_text[:50]}...)>"

    def increment_usage(self) -> None:
        """Increment usage count when objective is applied to content."""
        self.usage_count += 1

    def get_related_nodes(self) -> list["Node"]:
        """Get all nodes associated with this learning objective."""
        return [rel.node for rel in self.node_relationships]

    def get_prerequisite_objectives(self) -> list["LearningObjective"]:
        """Get all prerequisite learning objectives."""
        return [rel.prerequisite_objective for rel in self.prerequisites]

    def get_dependent_objectives(self) -> list["LearningObjective"]:
        """Get all objectives that depend on this one."""
        return [rel.objective for rel in self.dependent_objectives]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            'id': str(self.id),
            'objective_text': self.objective_text,
            'domain': self.domain,
            'cognitive_level': self.cognitive_level,
            'difficulty_level': self.difficulty_level,
            'usage_count': self.usage_count,
            'created_at': self.created_at.isoformat()
        }


class Keyword(Base):
    """
    Normalized keywords for content tagging and organization.
    Supports domain and category classification for improved searchability.
    """

    __tablename__ = "keywords"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )

    # Keyword content
    keyword_text: Mapped[str] = mapped_column(
        String(255), 
        nullable=False,
        comment="Keyword text"
    )

    # Classification
    domain: Mapped[Optional[str]] = mapped_column(
        String(100), 
        index=True,
        comment="Domain classification"
    )
    
    category: Mapped[Optional[str]] = mapped_column(
        String(50), 
        index=True,
        comment="Category (technical, process, safety, etc.)"
    )

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(
        Integer, 
        default=0, 
        nullable=False,
        comment="Number of times this keyword has been used"
    )

    # Lineage tracking
    created_from_activity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_items.id"),
        comment="Activity that originally defined this keyword"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    created_from_activity: Mapped[Optional["ContentItem"]] = relationship(lazy="select")
    
    # Node relationships
    node_relationships: Mapped[list["NodeKeyword"]] = relationship(
        back_populates="keyword",
        cascade="all, delete-orphan",
        lazy="select"
    )

    # Indexes
    __table_args__ = (
        Index('idx_keywords_text', 'keyword_text'),
        Index('idx_keywords_domain', 'domain'),
        Index('idx_keywords_category', 'category'),
        Index('idx_keywords_usage', 'usage_count'),
        # Unique constraint on keyword text to prevent duplicates
        Index('idx_keywords_unique_text', 'keyword_text', unique=True),
    )

    def __repr__(self) -> str:
        return f"<Keyword(id={self.id}, text={self.keyword_text}, domain={self.domain})>"

    def increment_usage(self) -> None:
        """Increment usage count when keyword is applied to content."""
        self.usage_count += 1

    def get_related_nodes(self) -> list["Node"]:
        """Get all nodes associated with this keyword."""
        return [rel.node for rel in self.node_relationships]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            'id': str(self.id),
            'keyword_text': self.keyword_text,
            'domain': self.domain,
            'category': self.category,
            'usage_count': self.usage_count,
            'created_at': self.created_at.isoformat()
        }


class NodeLearningObjective(Base):
    """
    Many-to-many relationship between nodes and learning objectives
    with relevance scoring and auto-tagging tracking.
    """

    __tablename__ = "node_learning_objectives"

    # Composite primary key
    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("nodes.id", ondelete="CASCADE"), 
        primary_key=True
    )
    
    objective_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("learning_objectives.id", ondelete="CASCADE"), 
        primary_key=True
    )

    # Relevance scoring
    relevance_score: Mapped[Decimal] = mapped_column(
        DECIMAL(3, 2), 
        default=Decimal('1.0'), 
        nullable=False,
        index=True,
        comment="Relevance score 0.00-1.00"
    )

    # Auto-tagging tracking
    auto_tagged: Mapped[bool] = mapped_column(
        default=False, 
        nullable=False,
        comment="Whether this relationship was created by auto-tagging"
    )
    
    tagged_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"),
        comment="User who created this relationship (if manual)"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    node: Mapped["Node"] = relationship(back_populates="objective_relationships", lazy="select")
    objective: Mapped["LearningObjective"] = relationship(back_populates="node_relationships", lazy="select")
    tagger: Mapped[Optional["User"]] = relationship(lazy="select")

    # Indexes
    __table_args__ = (
        Index('idx_node_objectives_node', 'node_id'),
        Index('idx_node_objectives_objective', 'objective_id'),
        Index('idx_node_objectives_relevance', 'relevance_score'),
    )

    def __repr__(self) -> str:
        return f"<NodeLearningObjective(node_id={self.node_id}, objective_id={self.objective_id}, relevance={self.relevance_score})>"


class NodeKeyword(Base):
    """
    Many-to-many relationship between nodes and keywords
    with relevance scoring and auto-tagging tracking.
    """

    __tablename__ = "node_keywords"

    # Composite primary key
    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("nodes.id", ondelete="CASCADE"), 
        primary_key=True
    )
    
    keyword_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("keywords.id", ondelete="CASCADE"), 
        primary_key=True
    )

    # Relevance scoring
    relevance_score: Mapped[Decimal] = mapped_column(
        DECIMAL(3, 2), 
        default=Decimal('1.0'), 
        nullable=False,
        index=True,
        comment="Relevance score 0.00-1.00"
    )

    # Auto-tagging tracking
    auto_tagged: Mapped[bool] = mapped_column(
        default=False, 
        nullable=False,
        comment="Whether this relationship was created by auto-tagging"
    )
    
    tagged_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"),
        comment="User who created this relationship (if manual)"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    node: Mapped["Node"] = relationship(back_populates="keyword_relationships", lazy="select")
    keyword: Mapped["Keyword"] = relationship(back_populates="node_relationships", lazy="select")
    tagger: Mapped[Optional["User"]] = relationship(lazy="select")

    # Indexes
    __table_args__ = (
        Index('idx_node_keywords_node', 'node_id'),
        Index('idx_node_keywords_keyword', 'keyword_id'),
        Index('idx_node_keywords_relevance', 'relevance_score'),
    )

    def __repr__(self) -> str:
        return f"<NodeKeyword(node_id={self.node_id}, keyword_id={self.keyword_id}, relevance={self.relevance_score})>"


class ObjectivePrerequisite(Base):
    """
    Prerequisite relationships between learning objectives
    for knowledge graph construction and adaptive learning paths.
    """

    __tablename__ = "objective_prerequisites"

    # Primary keys
    objective_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("learning_objectives.id"), 
        primary_key=True
    )
    
    prerequisite_objective_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("learning_objectives.id"), 
        primary_key=True
    )

    # Relationship strength
    relationship_strength: Mapped[Decimal] = mapped_column(
        DECIMAL(3, 2), 
        default=Decimal('1.0'), 
        nullable=False,
        comment="How essential this prerequisite is (0.00-1.00)"
    )
    
    relationship_type: Mapped[str] = mapped_column(
        String(50), 
        default="required", 
        nullable=False,
        comment="Type: required, recommended, helpful"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    objective: Mapped["LearningObjective"] = relationship(
        foreign_keys=[objective_id],
        back_populates="prerequisites", 
        lazy="select"
    )
    
    prerequisite_objective: Mapped["LearningObjective"] = relationship(
        foreign_keys=[prerequisite_objective_id],
        back_populates="dependent_objectives", 
        lazy="select"
    )

    # Indexes
    __table_args__ = (
        Index('idx_objective_prerequisites_obj', 'objective_id'),
        Index('idx_objective_prerequisites_prereq', 'prerequisite_objective_id'),
    )

    def __repr__(self) -> str:
        return f"<ObjectivePrerequisite(obj={self.objective_id}, prereq={self.prerequisite_objective_id}, type={self.relationship_type})>"