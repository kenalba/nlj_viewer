"""
Node Service Schemas - Business Logic Layer.

Provides service-level schemas for first-class node entity management with business
validation rules, performance analytics, and conversion utilities.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.api.nodes import (  # Import from actual API module
    NodeCreateRequest, NodeResponse
)
from .common import (
    ServiceSchemaBase,
    ValidationMixin,
    ConversionMixin,
    TimestampMixin,
    IdentityMixin,
    PaginationServiceSchema,
    SortingServiceSchema,
    SearchServiceSchema,
)


class NodeServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
    ConversionMixin[NodeResponse],
):
    """
    Core service schema for first-class node entity management.
    
    Provides business-level validation and analytics for individual learning components
    extracted from NLJ scenarios with performance tracking.
    """
    
    # Core node data
    node_type: str = Field(..., min_length=1, max_length=50, description="NLJ node type (true_false, multiple_choice, etc.)")
    content: dict[str, Any] = Field(..., description="Complete node data including text, options, media, etc.")
    
    # Content identification and deduplication
    content_hash: str | None = Field(None, max_length=64, description="SHA-256 hash for content deduplication detection")
    concept_fingerprint: str | None = Field(None, max_length=64, description="Semantic fingerprint for similarity detection")
    
    # Metadata
    title: str | None = Field(None, max_length=255, description="Node title or question text")
    description: str | None = Field(None, description="Node description")
    difficulty_level: int | None = Field(None, ge=1, le=10, description="Difficulty level 1-10")
    
    # Performance metrics (updated via xAPI event processing)
    avg_completion_time: int | None = Field(None, ge=0, description="Average completion time in milliseconds")
    success_rate: Decimal | None = Field(None, ge=0, le=1, description="Success rate as decimal 0.0000 to 1.0000")
    difficulty_score: Decimal | None = Field(None, ge=0, le=5, description="Calculated difficulty score 0.00 to 5.00")
    engagement_score: Decimal | None = Field(None, ge=0, le=5, description="Engagement score based on interaction patterns")
    
    # Versioning and language support
    current_version_id: uuid.UUID | None = Field(None, description="Current version ID for version control")
    base_language: str = Field(default="en-US", max_length=10, description="Base language code")
    
    @field_validator("node_type")
    @classmethod
    def validate_node_type(cls, v: str) -> str:
        """Validate node type format."""
        node_type = v.strip()
        if not node_type:
            raise ValueError("Node type cannot be empty")
        if len(node_type) > 50:
            raise ValueError("Node type must be less than 50 characters")
        return node_type
    
    @field_validator("content")
    @classmethod
    def validate_content_structure(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate node content structure."""
        if not isinstance(v, dict):
            raise ValueError("Node content must be a dictionary")
        if not v:
            raise ValueError("Node content cannot be empty")
        return v
    
    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        """Validate title if provided."""
        if v is not None:
            title = v.strip()
            if len(title) > 255:
                raise ValueError("Title must be less than 255 characters")
            return title if title else None
        return v
    
    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        """Validate description if provided."""
        if v is not None:
            desc = v.strip()
            return desc if desc else None
        return v
    
    @field_validator("content_hash", "concept_fingerprint")
    @classmethod
    def validate_hash_fields(cls, v: str | None) -> str | None:
        """Validate hash fields if provided."""
        if v is not None:
            hash_val = v.strip()
            if len(hash_val) != 64:
                raise ValueError("Hash must be exactly 64 characters")
            return hash_val
        return v
    
    @field_validator("base_language")
    @classmethod
    def validate_base_language(cls, v: str) -> str:
        """Validate base language format."""
        lang = v.strip()
        if not lang:
            raise ValueError("Base language cannot be empty")
        if len(lang) > 10:
            raise ValueError("Base language must be less than 10 characters")
        # Basic validation for language code format (e.g., en-US, fr, es-MX)
        if not lang.replace("-", "").isalpha():
            raise ValueError("Base language must be a valid language code")
        return lang
    
    def is_high_performing(self, success_threshold: Decimal = Decimal("0.8")) -> bool:
        """Check if node is considered high-performing (mirrors Node.is_high_performing)."""
        return self.success_rate and self.success_rate >= success_threshold
    
    def needs_optimization(self, success_threshold: Decimal = Decimal("0.6")) -> bool:
        """Check if node needs content optimization (mirrors Node.needs_optimization)."""
        return self.success_rate and self.success_rate < success_threshold
    
    def update_performance_metrics(
        self,
        avg_completion_time: int = None,
        success_rate: float = None,
        difficulty_score: float = None,
        engagement_score: float = None
    ) -> None:
        """Update performance metrics from analytics data (mirrors Node.update_performance_metrics)."""
        if avg_completion_time is not None:
            self.avg_completion_time = avg_completion_time
        if success_rate is not None:
            self.success_rate = Decimal(str(success_rate))
        if difficulty_score is not None:
            self.difficulty_score = Decimal(str(difficulty_score))
        if engagement_score is not None:
            self.engagement_score = Decimal(str(engagement_score))
        self.update_timestamps()
    
    def get_performance_summary(self) -> dict[str, Any]:
        """Get performance metrics summary for analytics (mirrors Node.get_performance_summary)."""
        return {
            'node_id': str(self.id),
            'node_type': self.node_type,
            'title': self.title,
            'avg_completion_time': self.avg_completion_time,
            'success_rate': float(self.success_rate) if self.success_rate else None,
            'difficulty_score': float(self.difficulty_score) if self.difficulty_score else None,
            'engagement_score': float(self.engagement_score) if self.engagement_score else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def generate_content_hash(self) -> str:
        """Generate SHA-256 hash for content deduplication."""
        import hashlib
        import json
        
        # Create normalized JSON string for hashing
        content_str = json.dumps(self.content, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(content_str.encode()).hexdigest()
    
    def extract_title_from_content(self) -> str | None:
        """Extract title from node content if not explicitly set."""
        if self.title:
            return self.title
            
        # Try common content fields for title
        content = self.content
        for field in ['text', 'question', 'title', 'label', 'prompt']:
            if field in content and content[field]:
                title = str(content[field]).strip()
                return title[:255] if title else None
        
        return None
    
    @classmethod  
    def from_api_schema(cls, api_schema: NodeCreateRequest, **extra_data) -> "NodeServiceSchema":
        """Convert from API schema to service schema."""
        # Extract data from API schema
        api_data = api_schema.model_dump(exclude_none=True)
        
        # Merge with extra data (e.g., creator info, system fields)
        merged_data = {**api_data, **extra_data}
        
        # Apply service-level defaults
        if "base_language" not in merged_data:
            merged_data["base_language"] = "en-US"
        
        return cls.model_validate(merged_data)
    
    def to_api_schema(self, api_schema_class=NodeResponse) -> NodeResponse:
        """Convert service schema to API response schema."""
        # Get all data for API response
        api_data = self.model_dump()
        
        # Convert UUID fields to strings
        api_data["id"] = str(self.id)
        api_data["created_by"] = str(self.created_by)
        if self.current_version_id:
            api_data["current_version_id"] = str(self.current_version_id)
        
        # Convert Decimal fields to floats
        if self.success_rate is not None:
            api_data["success_rate"] = float(self.success_rate)
        if self.difficulty_score is not None:
            api_data["difficulty_score"] = float(self.difficulty_score)
        if self.engagement_score is not None:
            api_data["engagement_score"] = float(self.engagement_score)
        
        return api_schema_class.model_validate(api_data)


class NodeCreateServiceSchema(NodeServiceSchema):
    """Service schema for node creation operations."""
    
    # Override to make ID optional for creation
    id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    
    # Required for creation via API
    node_type: str = Field(..., description="Type of node to create")
    content: dict[str, Any] = Field(..., description="Node content data")
    
    @model_validator(mode="before")
    @classmethod
    def validate_creation_rules(cls, data):
        """Apply creation-specific validation."""
        if isinstance(data, dict):
            # Set creation defaults
            if not data.get("id"):
                data["id"] = uuid.uuid4()
            
            # Set timestamps
            now = datetime.now(timezone.utc)
            if not data.get("created_at"):
                data["created_at"] = now
            data["updated_at"] = now
        
        return data


class NodeUpdateServiceSchema(ServiceSchemaBase):
    """Service schema for node update operations."""
    
    # All fields optional for updates
    node_type: str | None = Field(None, min_length=1, max_length=50)
    content: dict[str, Any] | None = None
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    difficulty_level: int | None = Field(None, ge=1, le=10)
    base_language: str | None = Field(None, max_length=10)
    
    @field_validator("node_type")
    @classmethod
    def validate_node_type_update(cls, v: str | None) -> str | None:
        """Validate node type for updates."""
        if v is not None:
            return NodeServiceSchema.validate_node_type(v)
        return v
    
    @field_validator("content")
    @classmethod
    def validate_content_update(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate content for updates."""
        if v is not None:
            return NodeServiceSchema.validate_content_structure(v)
        return v
    
    def apply_to_node(self, node: NodeServiceSchema) -> NodeServiceSchema:
        """Apply updates to existing node with validation."""
        update_data = self.model_dump(exclude_none=True)
        
        # Create updated node
        current_data = node.model_dump()
        merged_data = {**current_data, **update_data}
        
        updated_node = NodeServiceSchema.model_validate(merged_data)
        updated_node.update_timestamps()
        
        # Regenerate content hash if content was updated
        if "content" in update_data:
            updated_node.content_hash = updated_node.generate_content_hash()
        
        return updated_node


class NodeFilterServiceSchema(ServiceSchemaBase):
    """Service schema for node filtering and search operations."""
    
    # Pagination
    pagination: PaginationServiceSchema = Field(default_factory=PaginationServiceSchema)
    
    # Sorting (based on actual API usage)
    sorting: SortingServiceSchema = Field(default_factory=lambda: SortingServiceSchema(
        sort_by="updated_at", sort_order="desc"
    ))
    
    # Search
    search: SearchServiceSchema | None = None
    
    # Node-specific filters (based on actual NodeService parameters)
    node_type: str | None = None
    difficulty_level: int | None = Field(None, ge=1, le=10)
    min_success_rate: float | None = Field(None, ge=0.0, le=1.0)
    max_difficulty_score: float | None = Field(None, ge=0.0, le=5.0)
    base_language: str | None = None
    has_performance_data: bool | None = None
    
    @model_validator(mode="after")
    def validate_filter_combination(self):
        """Validate filter combinations make sense."""
        # Validate sorting field is allowed for nodes
        allowed_sort_fields = [
            "created_at", "updated_at", "node_type", "title", "difficulty_level",
            "avg_completion_time", "success_rate", "difficulty_score", "engagement_score"
        ]
        
        if not self.sorting.validate_sort_field(allowed_sort_fields):
            raise ValueError(f"Invalid sort field: {self.sorting.sort_by}")
        
        return self
    
    def build_filter_criteria(self) -> dict[str, Any]:
        """Build filter criteria for repository queries."""
        criteria = {
            "limit": self.pagination.size,
            "offset": self.pagination.get_offset(),
        }
        
        # Node type filter
        if self.node_type is not None:
            criteria["node_type"] = self.node_type
        
        # Performance filters
        if self.min_success_rate is not None:
            criteria["min_success_rate"] = self.min_success_rate
        if self.max_difficulty_score is not None:
            criteria["max_difficulty_score"] = self.max_difficulty_score
        
        # Metadata filters
        if self.difficulty_level is not None:
            criteria["difficulty_level"] = self.difficulty_level
        if self.base_language is not None:
            criteria["base_language"] = self.base_language
        
        # Search criteria
        if self.search:
            criteria["search_query"] = self.search.query
        
        return criteria


class NodeInteractionServiceSchema(ServiceSchemaBase):
    """Service schema for node interaction tracking operations."""
    
    node_id: uuid.UUID = Field(..., description="Node ID")
    user_id: uuid.UUID = Field(..., description="User ID")
    activity_id: uuid.UUID | None = Field(None, description="Activity ID if interaction was within an activity")
    
    # Session tracking
    session_id: str = Field(..., min_length=1, max_length=255, description="Activity session ID for grouping interactions")
    activity_session_id: str | None = Field(None, max_length=255, description="Overall activity session ID")
    
    # Response data
    response_data: dict[str, Any] = Field(..., description="User response data as JSON")
    is_correct: bool | None = Field(None, description="Whether response was correct")
    score: Decimal | None = Field(None, ge=0, description="Score awarded for response")
    
    # Timing data
    time_to_respond: int | None = Field(None, ge=0, description="Time taken to respond in milliseconds")
    attempts: int = Field(default=1, ge=1, description="Number of attempts for this interaction")
    
    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        """Validate session ID format."""
        session_id = v.strip()
        if not session_id:
            raise ValueError("Session ID cannot be empty")
        return session_id
    
    @field_validator("response_data")
    @classmethod
    def validate_response_data(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate response data structure."""
        if not isinstance(v, dict):
            raise ValueError("Response data must be a dictionary")
        return v
    
    def get_response_summary(self) -> dict[str, Any]:
        """Get summary of interaction for analytics (mirrors NodeInteraction.get_response_summary)."""
        return {
            'node_id': str(self.node_id),
            'user_id': str(self.user_id),
            'activity_id': str(self.activity_id) if self.activity_id else None,
            'is_correct': self.is_correct,
            'score': float(self.score) if self.score else None,
            'time_to_respond': self.time_to_respond,
            'attempts': self.attempts,
            'session_id': self.session_id,
        }


class NodeAnalyticsServiceSchema(ServiceSchemaBase):
    """Service schema for node analytics operations."""
    
    total_nodes: int = Field(default=0, description="Total number of nodes")
    by_type: dict[str, int] = Field(default_factory=dict, description="Count by node type")
    average_success_rate: float = Field(default=0.0, description="Average success rate across all nodes")
    min_success_rate: float = Field(default=0.0, description="Minimum success rate")
    max_success_rate: float = Field(default=0.0, description="Maximum success rate")
    average_difficulty: float = Field(default=0.0, description="Average difficulty score")
    total_interactions: int = Field(default=0, description="Total interactions across all nodes")
    
    def get_performance_insights(self) -> dict[str, Any]:
        """Get performance insights for content optimization."""
        return {
            "overall_performance": "high" if self.average_success_rate > 0.8 else "medium" if self.average_success_rate > 0.6 else "low",
            "needs_review": self.average_success_rate < 0.6,
            "engagement_level": "high" if self.total_interactions > 1000 else "medium" if self.total_interactions > 100 else "low",
            "diversity_score": len(self.by_type) / max(self.total_nodes, 1) if self.total_nodes > 0 else 0,
        }


class ActivityNodeServiceSchema(ServiceSchemaBase):
    """Service schema for activity-node relationship management."""
    
    activity_id: uuid.UUID = Field(..., description="Activity ID")
    node_id: uuid.UUID = Field(..., description="Node ID")
    position: int = Field(..., ge=0, description="Position of node in activity sequence")
    configuration_overrides: dict[str, Any] | None = Field(None, description="Activity-specific node customizations")
    
    @field_validator("configuration_overrides")
    @classmethod
    def validate_configuration_overrides(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate configuration overrides if provided."""
        if v is not None and not isinstance(v, dict):
            raise ValueError("Configuration overrides must be a dictionary")
        return v


# Export all schemas
__all__ = [
    "NodeServiceSchema",
    "NodeCreateServiceSchema", 
    "NodeUpdateServiceSchema",
    "NodeFilterServiceSchema",
    "NodeInteractionServiceSchema",
    "NodeAnalyticsServiceSchema",
    "ActivityNodeServiceSchema",
]