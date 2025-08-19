"""
Common service schema utilities and base classes.

Provides shared functionality for service-level schemas including validation mixins,
conversion utilities, and base schema classes.
"""

import uuid
from datetime import datetime
from typing import Any, Generic, TypeVar, Type
from abc import abstractmethod

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pydantic.v1.utils import deep_update


# Type variables for generic schema classes
ModelType = TypeVar("ModelType", bound=BaseModel)
APISchemaType = TypeVar("APISchemaType", bound=BaseModel)


class ServiceSchemaBase(BaseModel):
    """
    Base class for all service-level schemas.
    
    Provides common configuration and utilities for service schemas
    that are separate from API request/response schemas.
    """
    
    model_config = ConfigDict(
        # Enable attribute access from ORM models
        from_attributes=True,
        # Strict validation for service layer
        strict=True,
        # Allow extra fields for extensibility
        extra='forbid',
        # Use enum values for serialization
        use_enum_values=True,
        # Validate default values
        validate_default=True,
        # Validate on assignment
        validate_assignment=True,
    )
    
    def model_dump_for_orm(self, **kwargs) -> dict[str, Any]:
        """
        Dump model data optimized for ORM operations.
        
        Excludes None values and formats data for database persistence.
        """
        return self.model_dump(
            exclude_none=True,
            exclude_unset=True,
            by_alias=False,
            **kwargs
        )


class ValidationMixin:
    """
    Mixin providing advanced validation utilities for service schemas.
    """
    
    @classmethod
    def validate_business_rules(cls, values: dict[str, Any]) -> dict[str, Any]:
        """
        Apply business-specific validation rules.
        
        Override this method in service schemas to implement domain-specific
        validation that goes beyond basic field validation.
        """
        return values
    
    def validate_state_transition(self, current_state: str, new_state: str) -> bool:
        """
        Validate if a state transition is allowed.
        
        Override in schemas that manage entity state transitions.
        """
        return True
    
    def validate_permissions(self, user_role: str, operation: str) -> bool:
        """
        Validate if user has permissions for the operation.
        
        Override in schemas that need permission validation.
        """
        return True


class ConversionMixin(Generic[APISchemaType]):
    """
    Mixin providing conversion utilities between API and service schemas.
    """
    
    @classmethod
    @abstractmethod
    def from_api_schema(cls, api_schema: APISchemaType, **extra_data) -> "ConversionMixin":
        """
        Convert from API schema to service schema.
        
        Args:
            api_schema: The API request/response schema
            **extra_data: Additional data not present in API schema
            
        Returns:
            Service schema instance with business-level validation applied
        """
        pass
    
    @abstractmethod
    def to_api_schema(self, api_schema_class: Type[APISchemaType]) -> APISchemaType:
        """
        Convert from service schema to API schema.
        
        Args:
            api_schema_class: The target API schema class
            
        Returns:
            API schema instance suitable for HTTP response
        """
        pass
    
    def merge_api_updates(self, api_updates: APISchemaType) -> "ConversionMixin":
        """
        Merge API update schema into current service schema.
        
        Applies business validation to the merged result.
        """
        current_data = self.model_dump()
        update_data = api_updates.model_dump(exclude_none=True)
        merged_data = deep_update(current_data, update_data)
        
        return self.__class__.model_validate(merged_data)


class TimestampMixin(BaseModel):
    """
    Mixin for schemas that include timestamp fields.
    """
    
    created_at: datetime | None = Field(None, description="Creation timestamp")
    updated_at: datetime | None = Field(None, description="Last update timestamp")
    
    def update_timestamps(self, *, creating: bool = False) -> None:
        """Update timestamp fields appropriately."""
        now = datetime.utcnow()
        if creating or self.created_at is None:
            self.created_at = now
        self.updated_at = now


class IdentityMixin(BaseModel):
    """
    Mixin for schemas that include standard identity fields.
    """
    
    id: uuid.UUID | None = Field(None, description="Entity UUID")
    created_by: uuid.UUID | None = Field(None, description="Creator user ID")
    
    def validate_creator_access(self, requesting_user_id: uuid.UUID) -> bool:
        """Validate if requesting user can access this entity."""
        return self.created_by == requesting_user_id


class PaginationServiceSchema(BaseModel):
    """
    Service schema for pagination parameters with business validation.
    """
    
    page: int = Field(default=1, ge=1, le=1000, description="Page number")
    size: int = Field(default=20, ge=1, le=100, description="Items per page") 
    
    def get_offset(self) -> int:
        """Calculate database offset from page and size."""
        return (self.page - 1) * self.size
    
    def validate_resource_limits(self, total_items: int, user_role: str) -> bool:
        """Validate pagination request against resource limits."""
        # Admin users can access more data
        if user_role == "ADMIN":
            return self.page * self.size <= 10000
        
        # Regular users have lower limits
        return self.page * self.size <= 2000


class SortingServiceSchema(BaseModel):
    """
    Service schema for sorting parameters with validation.
    """
    
    sort_by: str = Field(default="created_at", description="Sort field")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$", description="Sort direction")
    
    def validate_sort_field(self, allowed_fields: list[str]) -> bool:
        """Validate if sort field is allowed for the entity."""
        return self.sort_by in allowed_fields
    
    def get_order_clause(self) -> str:
        """Generate SQL ORDER BY clause."""
        direction = "ASC" if self.sort_order == "asc" else "DESC"
        return f"{self.sort_by} {direction}"


class SearchServiceSchema(BaseModel):
    """
    Service schema for search parameters with business validation.
    """
    
    query: str = Field(..., min_length=1, max_length=200, description="Search query")
    fields: list[str] = Field(default=["title", "description"], description="Fields to search")
    
    def validate_search_permissions(self, user_role: str) -> bool:
        """Validate if user can search the specified fields."""
        # Some fields might be restricted based on role
        restricted_fields = ["internal_notes", "audit_log"]
        
        if user_role != "ADMIN":
            return not any(field in restricted_fields for field in self.fields)
        
        return True
    
    def prepare_search_terms(self) -> list[str]:
        """Prepare search terms for database query."""
        # Split query into terms and clean them
        terms = self.query.lower().split()
        return [term.strip() for term in terms if len(term.strip()) >= 2]


class ErrorDetailSchema(BaseModel):
    """
    Schema for structured error information in service responses.
    """
    
    error_code: str = Field(..., description="Service error code")
    error_message: str = Field(..., description="Human-readable error message")
    field_errors: dict[str, list[str]] = Field(default_factory=dict, description="Field validation errors")
    context: dict[str, Any] = Field(default_factory=dict, description="Additional error context")
    
    @classmethod
    def from_validation_error(cls, error: ValidationError, context: dict[str, Any] | None = None) -> "ErrorDetailSchema":
        """Create error detail from Pydantic validation error."""
        field_errors = {}
        
        for error_detail in error.errors():
            field_path = ".".join(str(loc) for loc in error_detail["loc"])
            if field_path not in field_errors:
                field_errors[field_path] = []
            field_errors[field_path].append(error_detail["msg"])
        
        return cls(
            error_code="VALIDATION_ERROR",
            error_message="Input validation failed",
            field_errors=field_errors,
            context=context or {}
        )


class ServiceResultSchema(BaseModel, Generic[ModelType]):
    """
    Generic schema for service operation results.
    
    Provides structured response format for service operations including
    success/failure status, data, and error information.
    """
    
    success: bool = Field(..., description="Operation success status")
    data: ModelType | None = Field(None, description="Result data if successful") 
    error: ErrorDetailSchema | None = Field(None, description="Error details if failed")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional result metadata")
    
    @classmethod
    def success_result(cls, data: ModelType, metadata: dict[str, Any] | None = None) -> "ServiceResultSchema[ModelType]":
        """Create successful result."""
        return cls(
            success=True,
            data=data,
            metadata=metadata or {}
        )
    
    @classmethod  
    def error_result(cls, error: ErrorDetailSchema, metadata: dict[str, Any] | None = None) -> "ServiceResultSchema[ModelType]":
        """Create error result."""
        return cls(
            success=False,
            error=error,
            metadata=metadata or {}
        )
    
    @classmethod
    def validation_error_result(
        cls, 
        validation_error: ValidationError,
        context: dict[str, Any] | None = None
    ) -> "ServiceResultSchema[ModelType]":
        """Create error result from validation error."""
        error_detail = ErrorDetailSchema.from_validation_error(validation_error, context)
        return cls.error_result(error_detail)