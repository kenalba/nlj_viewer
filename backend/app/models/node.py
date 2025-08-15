"""
Node database model for first-class node entities extracted from NLJ scenarios.
Implements node-level analytics, performance tracking, and content intelligence.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, Index, DECIMAL
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import ContentItem
    from app.models.user import User


class Node(Base):
    """
    First-class node entity representing individual learning components
    extracted from NLJ scenarios with performance tracking and analytics.
    """

    __tablename__ = "nodes"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )

    # Node type from NLJ schema
    node_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False, 
        index=True,
        comment="NLJ node type (true_false, multiple_choice, etc.)"
    )

    # Node content as JSONB for flexible schema
    content: Mapped[dict[str, Any]] = mapped_column(
        JSON, 
        nullable=False, 
        comment="Complete node data including text, options, media, etc."
    )

    # Content identification and deduplication
    content_hash: Mapped[Optional[str]] = mapped_column(
        String(64), 
        index=True,
        comment="SHA-256 hash for content deduplication detection"
    )
    
    concept_fingerprint: Mapped[Optional[str]] = mapped_column(
        String(64), 
        index=True,
        comment="Semantic fingerprint for similarity detection"
    )

    # Metadata
    title: Mapped[Optional[str]] = mapped_column(String(255), comment="Node title or question text")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="Node description")
    difficulty_level: Mapped[Optional[int]] = mapped_column(
        Integer, 
        comment="Difficulty level 1-10"
    )

    # Performance metrics (updated via xAPI event processing)
    avg_completion_time: Mapped[Optional[int]] = mapped_column(
        Integer, 
        comment="Average completion time in milliseconds"
    )
    
    success_rate: Mapped[Optional[Decimal]] = mapped_column(
        DECIMAL(5, 4), 
        index=True,
        comment="Success rate as decimal 0.0000 to 1.0000"
    )
    
    difficulty_score: Mapped[Optional[Decimal]] = mapped_column(
        DECIMAL(3, 2), 
        index=True,
        comment="Calculated difficulty score 0.00 to 5.00"
    )
    
    engagement_score: Mapped[Optional[Decimal]] = mapped_column(
        DECIMAL(3, 2), 
        comment="Engagement score based on interaction patterns"
    )

    # Versioning and language support (future-ready)
    current_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        comment="Current version ID for version control"
    )
    
    base_language: Mapped[str] = mapped_column(
        String(10), 
        default="en-US", 
        nullable=False,
        comment="Base language code"
    )

    # Audit fields
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=False, 
        index=True
    )
    
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
    creator: Mapped["User"] = relationship(lazy="select")
    
    # Activity relationships (through activity_nodes table)
    activity_relationships: Mapped[list["ActivityNode"]] = relationship(
        back_populates="node", 
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    # Node interactions for analytics
    interactions: Mapped[list["NodeInteraction"]] = relationship(
        back_populates="node",
        cascade="all, delete-orphan",
        lazy="select"
    )

    # Learning objectives and keywords relationships
    objective_relationships: Mapped[list["NodeLearningObjective"]] = relationship(
        back_populates="node",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    keyword_relationships: Mapped[list["NodeKeyword"]] = relationship(
        back_populates="node",
        cascade="all, delete-orphan",
        lazy="select"
    )

    # Indexes for performance
    __table_args__ = (
        Index('idx_nodes_type_performance', 'node_type', 'success_rate'),
        Index('idx_nodes_hash_lookup', 'content_hash', 'node_type'),
        Index('idx_nodes_fingerprint', 'concept_fingerprint'),
    )

    def __repr__(self) -> str:
        return f"<Node(id={self.id}, type={self.node_type}, title={self.title})>"

    def get_activities(self) -> list["ContentItem"]:
        """Get all activities that use this node."""
        return [rel.activity for rel in self.activity_relationships]

    def get_usage_count(self) -> int:
        """Get total number of activities using this node."""
        return len(self.activity_relationships)

    def get_total_interactions(self) -> int:
        """Get total number of user interactions with this node."""
        return len(self.interactions)

    def update_performance_metrics(
        self, 
        avg_completion_time: Optional[int] = None,
        success_rate: Optional[float] = None, 
        difficulty_score: Optional[float] = None,
        engagement_score: Optional[float] = None
    ) -> None:
        """Update performance metrics from analytics data."""
        if avg_completion_time is not None:
            self.avg_completion_time = avg_completion_time
        if success_rate is not None:
            self.success_rate = Decimal(str(success_rate))
        if difficulty_score is not None:
            self.difficulty_score = Decimal(str(difficulty_score))
        if engagement_score is not None:
            self.engagement_score = Decimal(str(engagement_score))

    def get_performance_summary(self) -> dict[str, Any]:
        """Get performance metrics summary for analytics."""
        return {
            'node_id': str(self.id),
            'node_type': self.node_type,
            'title': self.title,
            'avg_completion_time': self.avg_completion_time,
            'success_rate': float(self.success_rate) if self.success_rate else None,
            'difficulty_score': float(self.difficulty_score) if self.difficulty_score else None,
            'engagement_score': float(self.engagement_score) if self.engagement_score else None,
            'usage_count': self.get_usage_count(),
            'total_interactions': self.get_total_interactions()
        }

    def is_high_performing(self, success_threshold: float = 0.8) -> bool:
        """Check if node is considered high-performing."""
        return self.success_rate and self.success_rate >= Decimal(str(success_threshold))

    def needs_optimization(self, success_threshold: float = 0.6) -> bool:
        """Check if node needs content optimization."""
        return self.success_rate and self.success_rate < Decimal(str(success_threshold))


class ActivityNode(Base):
    """
    Many-to-many relationship table connecting activities to nodes
    with position and configuration override support.
    """

    __tablename__ = "activity_nodes"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )

    # Foreign keys
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("content_items.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    
    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("nodes.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )

    # Position in activity sequence
    position: Mapped[int] = mapped_column(
        Integer, 
        nullable=False,
        comment="Position of node in activity sequence"
    )

    # Activity-specific customizations
    configuration_overrides: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        comment="Activity-specific node customizations"
    )

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    activity: Mapped["ContentItem"] = relationship(lazy="select")
    node: Mapped["Node"] = relationship(back_populates="activity_relationships", lazy="select")

    # Constraints
    __table_args__ = (
        Index('idx_activity_nodes_activity', 'activity_id'),
        Index('idx_activity_nodes_node', 'node_id'),
        # Unique constraint on activity_id + position to prevent duplicate positions
        Index('idx_activity_position_unique', 'activity_id', 'position', unique=True),
    )

    def __repr__(self) -> str:
        return f"<ActivityNode(activity_id={self.activity_id}, node_id={self.node_id}, position={self.position})>"


class NodeInteraction(Base):
    """
    High-volume interaction tracking table for node-level analytics.
    Stores individual user interactions with nodes for performance analysis.
    """

    __tablename__ = "node_interactions"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )

    # Foreign keys
    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("nodes.id"), 
        nullable=False, 
        index=True
    )
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=False, 
        index=True
    )
    
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("content_items.id"), 
        nullable=False
    )

    # Session tracking
    session_id: Mapped[str] = mapped_column(
        String(255), 
        nullable=False, 
        index=True,
        comment="Activity session ID for grouping interactions"
    )

    # Response data
    response_data: Mapped[dict[str, Any]] = mapped_column(
        JSON, 
        nullable=False,
        comment="User response data as JSON"
    )
    
    is_correct: Mapped[Optional[bool]] = mapped_column(comment="Whether response was correct")
    score: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(5, 2), comment="Score awarded for response")

    # Timing data
    time_to_respond: Mapped[Optional[int]] = mapped_column(
        Integer,
        comment="Time taken to respond in milliseconds"
    )
    
    attempts: Mapped[int] = mapped_column(
        Integer, 
        default=1, 
        nullable=False,
        comment="Number of attempts for this interaction"
    )

    # Context
    activity_session_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        comment="Overall activity session ID"
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False,
        index=True
    )

    # Relationships
    node: Mapped["Node"] = relationship(back_populates="interactions", lazy="select")
    user: Mapped["User"] = relationship(lazy="select")
    activity: Mapped["ContentItem"] = relationship(lazy="select")

    # Indexes for analytics queries
    __table_args__ = (
        Index('idx_node_interactions_node_date', 'node_id', 'created_at'),
        Index('idx_node_interactions_user', 'user_id'),
        Index('idx_node_interactions_session', 'session_id'),
        Index('idx_node_interactions_activity', 'activity_id'),
    )

    def __repr__(self) -> str:
        return f"<NodeInteraction(node_id={self.node_id}, user_id={self.user_id}, session_id={self.session_id})>"

    def get_response_summary(self) -> dict[str, Any]:
        """Get summary of interaction for analytics."""
        return {
            'interaction_id': str(self.id),
            'node_id': str(self.node_id),
            'user_id': str(self.user_id),
            'is_correct': self.is_correct,
            'score': float(self.score) if self.score else None,
            'time_to_respond': self.time_to_respond,
            'attempts': self.attempts,
            'created_at': self.created_at.isoformat()
        }