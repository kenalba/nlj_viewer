"""
Content Service Schemas - Business Logic Layer.

Provides service-level schemas for content management operations with business
validation rules, state transition logic, and conversion utilities.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models.content import ContentState, ContentType, LearningStyle
from app.models.user import UserRole  
from app.schemas.content import ContentCreate, ContentUpdate, ContentResponse
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


class ContentServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
    ConversionMixin[ContentResponse],
):
    """
    Core service schema for content management operations.
    
    Provides business-level validation and state management for content entities.
    """
    
    # Core content fields
    title: str = Field(..., min_length=1, max_length=255, description="Content title")
    description: str | None = Field(None, max_length=2000, description="Content description")
    nlj_data: dict[str, Any] = Field(..., description="Complete NLJ scenario data")
    content_type: ContentType = Field(default=ContentType.TRAINING, description="Content type")
    learning_style: LearningStyle | None = Field(None, description="Primary learning style")
    
    # State and lifecycle  
    state: ContentState = Field(default=ContentState.DRAFT, description="Content state")
    version: int = Field(default=1, ge=1, description="Content version number")
    
    # Template management
    is_template: bool = Field(default=False, description="Whether content is a template")
    template_category: str | None = Field(None, max_length=100, description="Template category")
    parent_content_id: uuid.UUID | None = Field(None, description="Parent content for variants")
    
    # Generation tracking (AI-generated content)
    generation_session_id: uuid.UUID | None = Field(None, description="Generation session that created this content")
    
    # Import tracking  
    import_source: str | None = Field(None, max_length=50, description="Import source type")
    import_filename: str | None = Field(None, max_length=255, description="Original import filename")
    
    # Analytics
    view_count: int = Field(default=0, ge=0, description="Number of views")
    completion_count: int = Field(default=0, ge=0, description="Number of completions")
    published_at: datetime | None = Field(None, description="Publication timestamp")
    
    @field_validator("nlj_data")
    @classmethod
    def validate_nlj_structure(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate NLJ data has required structure."""
        if not isinstance(v, dict):
            raise ValueError("NLJ data must be a dictionary")
        
        # Check for essential NLJ fields
        required_fields = ["title", "nodes", "edges"]
        missing_fields = [field for field in required_fields if field not in v]
        if missing_fields:
            raise ValueError(f"NLJ data missing required fields: {missing_fields}")
        
        # Validate nodes structure
        nodes = v.get("nodes", [])
        if not isinstance(nodes, list) or len(nodes) == 0:
            raise ValueError("NLJ data must contain at least one node")
        
        # Validate each node has required fields
        for i, node in enumerate(nodes):
            if not isinstance(node, dict):
                raise ValueError(f"Node {i} must be a dictionary")
            if "id" not in node or "type" not in node:
                raise ValueError(f"Node {i} missing required fields: id, type")
        
        return v
    
    @field_validator("template_category")
    @classmethod
    def validate_template_category(cls, v: str | None, info) -> str | None:
        """Validate template category is only set for templates."""
        if v is not None:
            is_template = info.data.get("is_template", False)
            if not is_template:
                raise ValueError("Template category can only be set for templates")
            
            # Normalize category name
            return v.strip().lower().replace(" ", "_")
        
        return v
    
    @model_validator(mode="after")
    def validate_business_rules(self):
        """Apply content-specific business validation rules."""
        # Template validation
        if self.is_template:
            if not self.template_category:
                raise ValueError("Templates must have a category")
            if self.state not in [ContentState.DRAFT, ContentState.PUBLISHED]:
                raise ValueError("Templates can only be in DRAFT or PUBLISHED state")
        
        # Parent content validation
        if self.parent_content_id:
            if self.parent_content_id == self.id:
                raise ValueError("Content cannot be its own parent")
        
        # State consistency validation
        if self.state == ContentState.PUBLISHED:
            if not self.title.strip():
                raise ValueError("Published content must have a title")
            if not self.nlj_data or len(self.nlj_data.get("nodes", [])) == 0:
                raise ValueError("Published content must have NLJ data with nodes")
        
        return self
    
    def validate_state_transition(self, current_state: ContentState, new_state: ContentState) -> bool:
        """Validate content state transitions based on actual model states."""
        # Define valid state transitions matching the actual ContentState enum
        valid_transitions = {
            ContentState.DRAFT: [ContentState.SUBMITTED, ContentState.PUBLISHED, ContentState.ARCHIVED],
            ContentState.SUBMITTED: [ContentState.DRAFT, ContentState.IN_REVIEW, ContentState.REJECTED], 
            ContentState.IN_REVIEW: [ContentState.APPROVED, ContentState.REJECTED, ContentState.DRAFT],
            ContentState.APPROVED: [ContentState.PUBLISHED, ContentState.DRAFT],
            ContentState.PUBLISHED: [ContentState.ARCHIVED, ContentState.DRAFT], 
            ContentState.REJECTED: [ContentState.DRAFT, ContentState.SUBMITTED],
            ContentState.ARCHIVED: [ContentState.DRAFT],
        }
        
        allowed_states = valid_transitions.get(current_state, [])
        return new_state in allowed_states
    
    def validate_permissions(self, user_role: UserRole, operation: str) -> bool:
        """Validate content operation permissions based on actual UserRole enum."""
        permission_matrix = {
            "create": [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            "read": [UserRole.PLAYER, UserRole.LEARNER, UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            "update": [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            "delete": [UserRole.CREATOR, UserRole.ADMIN],
            "submit": [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN], 
            "approve": [UserRole.APPROVER, UserRole.ADMIN],
            "publish": [UserRole.APPROVER, UserRole.ADMIN],
            "archive": [UserRole.ADMIN],
        }
        
        allowed_roles = permission_matrix.get(operation, [])
        return user_role in allowed_roles
    
    def can_user_access_content(self, user_role: UserRole, user_id: uuid.UUID) -> bool:
        """Check if user can access this content based on role and ownership."""
        # Admin and Approver can see all content
        if user_role in [UserRole.ADMIN, UserRole.APPROVER]:
            return True
            
        # Creators and Reviewers can see their own content + specific states
        if user_role in [UserRole.CREATOR, UserRole.REVIEWER]:
            if self.created_by == user_id:
                return True
            # Can see published content and content in review states
            return self.state in [ContentState.PUBLISHED, ContentState.SUBMITTED, ContentState.IN_REVIEW]
            
        # Players and Learners can only see published content  
        if user_role in [UserRole.PLAYER, UserRole.LEARNER]:
            return self.state == ContentState.PUBLISHED
            
        return False
    
    @classmethod
    def from_api_schema(cls, api_schema: ContentCreate | ContentUpdate, **extra_data) -> "ContentServiceSchema":
        """Convert from API schema to service schema."""
        # Extract data from API schema
        api_data = api_schema.model_dump(exclude_none=True)
        
        # Merge with extra data (e.g., user context, system fields)
        merged_data = {**api_data, **extra_data}
        
        # Apply service-level defaults
        if "state" not in merged_data:
            merged_data["state"] = ContentState.DRAFT
        if "version" not in merged_data:
            merged_data["version"] = 1
        
        return cls.model_validate(merged_data)
    
    def to_api_schema(self, api_schema_class=ContentResponse) -> ContentResponse:
        """Convert service schema to API response schema."""
        # Get all data except internal service fields
        api_data = self.model_dump(exclude={"created_by"})  # Adjust based on API schema
        
        return api_schema_class.model_validate(api_data)
    
    def increment_view_count(self) -> None:
        """Business logic for incrementing view count."""
        self.view_count += 1
        self.update_timestamps()
    
    def increment_completion_count(self) -> None:
        """Business logic for incrementing completion count."""
        self.completion_count += 1
        self.update_timestamps()
    
    def can_be_published(self) -> bool:
        """Check if content can be published."""
        return self.state in [ContentState.DRAFT, ContentState.APPROVED]
    
    def can_be_edited(self) -> bool:
        """Check if content can be edited."""
        return self.state in [ContentState.DRAFT, ContentState.REJECTED]
    
    def is_published(self) -> bool:
        """Check if content is published."""
        return self.state == ContentState.PUBLISHED
    
    def can_transition_to(self, new_state: ContentState) -> bool:
        """Check if content can transition to new state."""
        # Define valid state transitions
        transitions = {
            ContentState.DRAFT: [ContentState.SUBMITTED, ContentState.PUBLISHED],
            ContentState.SUBMITTED: [ContentState.IN_REVIEW, ContentState.DRAFT],
            ContentState.IN_REVIEW: [ContentState.APPROVED, ContentState.REJECTED],
            ContentState.APPROVED: [ContentState.PUBLISHED, ContentState.IN_REVIEW],
            ContentState.PUBLISHED: [ContentState.ARCHIVED],
            ContentState.REJECTED: [ContentState.DRAFT],
            ContentState.ARCHIVED: []  # Cannot transition from archived
        }
        
        return new_state in transitions.get(self.state, [])
    
    def publish_content(self) -> None:
        """Business logic for publishing content."""
        if not self.validate_state_transition(self.state, ContentState.PUBLISHED):
            raise ValueError(f"Cannot publish content in {self.state} state")
        
        self.state = ContentState.PUBLISHED
        self.published_at = datetime.now(timezone.utc)
        self.update_timestamps()
        
    def is_editable(self) -> bool:
        """Check if content can be edited (mirrors ContentItem.is_editable)."""
        return self.state in {ContentState.DRAFT, ContentState.REJECTED}
    
    def can_be_submitted(self) -> bool:
        """Check if content can be submitted for approval."""
        return self.state == ContentState.DRAFT
    
    def is_published(self) -> bool:
        """Check if content is published and available."""
        return self.state == ContentState.PUBLISHED
        
    def is_ai_generated(self) -> bool:
        """Check if this content was generated by AI."""
        return self.generation_session_id is not None
        
    def can_be_shared(self) -> bool:
        """Check if content can be publicly shared."""
        # Mirror ContentItem logic - allow sharing of any content for feedback/testing
        return True
        
    def create_new_version(self, creator_id: uuid.UUID, change_summary: str | None = None) -> "ContentServiceSchema":
        """Create a new version of this content with incremented version number."""
        new_content = self.model_copy()
        new_content.id = uuid.uuid4()
        new_content.version = self.version + 1
        new_content.state = ContentState.DRAFT
        new_content.created_by = creator_id
        new_content.published_at = None
        new_content.view_count = 0
        new_content.completion_count = 0
        new_content.update_timestamps(creating=True)
        return new_content
    
    @classmethod
    def from_orm_model(cls, orm_model) -> "ContentServiceSchema":
        """
        Convert ORM model to service schema.
        
        Args:
            orm_model: ContentItem ORM model instance
            
        Returns:
            ContentServiceSchema instance
        """
        return cls.model_validate(orm_model, from_attributes=True)


class ContentCreateServiceSchema(ContentServiceSchema):
    """Service schema for content creation operations."""
    
    # Override to make ID optional for creation
    id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    
    @model_validator(mode="before")
    @classmethod
    def validate_creation_rules(cls, data):
        """Apply creation-specific validation."""
        if isinstance(data, dict):
            # Set creation defaults
            if "id" not in data or not data["id"]:
                data["id"] = uuid.uuid4()
            
            # Set timestamp defaults
            now = datetime.now(timezone.utc)
            if "created_at" not in data:
                data["created_at"] = now
            if "updated_at" not in data:
                data["updated_at"] = now
                
            # Set state default
            if "state" not in data:
                data["state"] = ContentState.DRAFT
                
            # Set version default  
            if "version" not in data:
                data["version"] = 1
        
        return data


class ContentUpdateServiceSchema(ServiceSchemaBase):
    """Service schema for content update operations."""
    
    # All fields optional for updates
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    nlj_data: dict[str, Any] | None = None
    content_type: ContentType | None = None
    learning_style: LearningStyle | None = None
    is_template: bool | None = None
    template_category: str | None = Field(None, max_length=100)
    
    @field_validator("nlj_data")
    @classmethod
    def validate_nlj_update(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate NLJ data updates."""
        if v is not None:
            # Apply same validation as ContentServiceSchema
            return ContentServiceSchema.validate_nlj_structure(v)
        return v
    
    def apply_to_content(self, content: ContentServiceSchema) -> ContentServiceSchema:
        """Apply updates to existing content with validation."""
        update_data = self.model_dump(exclude_none=True)
        
        # Create updated content
        current_data = content.model_dump()
        merged_data = {**current_data, **update_data}
        
        updated_content = ContentServiceSchema.model_validate(merged_data)
        updated_content.update_timestamps()
        
        return updated_content


class ContentStateTransitionSchema(ServiceSchemaBase):
    """Service schema for content state transitions."""
    
    current_state: ContentState = Field(..., description="Current content state")
    new_state: ContentState = Field(..., description="Target content state")
    comment: str | None = Field(None, max_length=500, description="Transition comment")
    user_role: str = Field(..., description="Role of user requesting transition")
    
    @model_validator(mode="after")
    def validate_state_transition(self):
        """Validate the state transition is allowed."""
        # Use ContentServiceSchema validation logic
        temp_content = ContentServiceSchema(
            title="temp",
            nlj_data={"title": "temp", "nodes": [], "edges": []},
            state=self.current_state,
        )
        
        if not temp_content.validate_state_transition(self.current_state, self.new_state):
            raise ValueError(f"Invalid state transition from {self.current_state} to {self.new_state}")
        
        # Check user permissions for the transition
        operation_map = {
            ContentState.PUBLISHED: "publish",
            ContentState.ARCHIVED: "archive",
        }
        
        required_operation = operation_map.get(self.new_state, "update")
        if not temp_content.validate_permissions(self.user_role, required_operation):
            raise ValueError(f"User with role {self.user_role} cannot perform {required_operation} operation")
        
        return self


class ContentFilterServiceSchema(ServiceSchemaBase):
    """Service schema for content filtering and search operations."""
    
    # Pagination
    pagination: PaginationServiceSchema = Field(default_factory=PaginationServiceSchema)
    
    # Sorting
    sorting: SortingServiceSchema = Field(default_factory=SortingServiceSchema)
    
    # Search
    search: SearchServiceSchema | None = None
    
    # Content-specific filters
    state: ContentState | None = None
    content_type: ContentType | None = None
    learning_style: LearningStyle | None = None
    is_template: bool | None = None
    template_category: str | None = None
    created_by: uuid.UUID | None = None
    
    # Date range filters
    created_after: datetime | None = None
    created_before: datetime | None = None
    updated_after: datetime | None = None
    updated_before: datetime | None = None
    
    @model_validator(mode="after")
    def validate_filter_combination(self):
        """Validate filter combinations make sense."""
        # Validate sorting field is allowed for content
        allowed_sort_fields = [
            "created_at", "updated_at", "title", "view_count", 
            "completion_count", "published_at", "state"
        ]
        
        if not self.sorting.validate_sort_field(allowed_sort_fields):
            raise ValueError(f"Invalid sort field: {self.sorting.sort_by}")
        
        # Validate date ranges
        if self.created_after and self.created_before:
            if self.created_after >= self.created_before:
                raise ValueError("created_after must be before created_before")
        
        if self.updated_after and self.updated_before:
            if self.updated_after >= self.updated_before:
                raise ValueError("updated_after must be before updated_before")
        
        return self
    
    def build_filter_criteria(self) -> dict[str, Any]:
        """Build filter criteria for repository queries."""
        criteria = {}
        
        # Direct field filters
        if self.state is not None:
            criteria["state"] = self.state
        if self.content_type is not None:
            criteria["content_type"] = self.content_type
        if self.learning_style is not None:
            criteria["learning_style"] = self.learning_style
        if self.is_template is not None:
            criteria["is_template"] = self.is_template
        if self.template_category is not None:
            criteria["template_category"] = self.template_category
        if self.created_by is not None:
            criteria["created_by"] = self.created_by
        
        # Date range filters
        if self.created_after is not None:
            criteria["created_after"] = self.created_after
        if self.created_before is not None:
            criteria["created_before"] = self.created_before
        if self.updated_after is not None:
            criteria["updated_after"] = self.updated_after
        if self.updated_before is not None:
            criteria["updated_before"] = self.updated_before
        
        # Search criteria
        if self.search:
            criteria["search_query"] = self.search.query
            criteria["search_fields"] = self.search.fields
        
        return criteria


# Export all schemas
__all__ = [
    "ContentServiceSchema",
    "ContentCreateServiceSchema", 
    "ContentUpdateServiceSchema",
    "ContentStateTransitionSchema",
    "ContentFilterServiceSchema",
]