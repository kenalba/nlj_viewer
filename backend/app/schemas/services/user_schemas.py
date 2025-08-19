"""
User Service Schemas - Business Logic Layer.

Provides service-level schemas for user management operations with business
validation rules, authentication logic, and conversion utilities.
"""

import uuid
import re
from datetime import datetime, timezone
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models.user import UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse
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


class UserServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
    ConversionMixin[UserResponse],
):
    """
    Core service schema for user management operations.
    
    Provides business-level validation and role management for user entities.
    """
    
    # Core user fields
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: str = Field(..., description="User email address")
    full_name: str | None = Field(None, max_length=255, description="Full display name")
    role: UserRole = Field(default=UserRole.PLAYER, description="User role for permissions")
    
    # Authentication fields (not exposed in API responses)
    hashed_password: str | None = Field(None, description="Password hash")
    
    # User status
    is_active: bool = Field(default=True, description="Whether user is active")
    is_verified: bool = Field(default=False, description="Whether user is verified")
    last_login: datetime | None = Field(None, description="Last login timestamp")
    
    @field_validator("username")
    @classmethod
    def validate_username_format(cls, v: str) -> str:
        """Validate username format and normalize."""
        username = v.strip().lower()
        if len(username) < 3:
            raise ValueError("Username must be at least 3 characters long")
        if len(username) > 50:
            raise ValueError("Username must be less than 50 characters")
        if not re.match(r"^[a-zA-Z0-9_-]+$", username):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return username
    
    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        """Validate and normalize email address."""
        email = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
            raise ValueError("Invalid email format")
        if len(email) > 254:
            raise ValueError("Email must be less than 254 characters")
        return email
    
    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        """Validate full name if provided."""
        if v is not None:
            name = v.strip()
            if len(name) > 255:
                raise ValueError("Full name must be less than 255 characters")
            return name if name else None
        return v
    
    def validate_permissions(self, user_role: UserRole, operation: str) -> bool:
        """Validate user operation permissions based on actual usage patterns."""
        permission_matrix = {
            "create": [UserRole.ADMIN],  # Only admins can create users
            "read": [UserRole.ADMIN],    # Only admins can read other users
            "update": [UserRole.ADMIN],  # Only admins can update users
            "delete": [UserRole.ADMIN],  # Only admins can delete users
            "activate": [UserRole.ADMIN],
            "deactivate": [UserRole.ADMIN],
            "change_role": [UserRole.ADMIN],
            "list_users": [UserRole.ADMIN],  # Based on API analysis
            # Users can update their own profile - handled separately
        }
        
        allowed_roles = permission_matrix.get(operation, [])
        return user_role in allowed_roles
    
    def can_user_access_profile(self, requesting_user_role: UserRole, requesting_user_id: uuid.UUID) -> bool:
        """Check if user can access this profile."""
        # Admin can access any profile
        if requesting_user_role == UserRole.ADMIN:
            return True
        
        # Users can only access their own profile
        return self.created_by == requesting_user_id
    
    def has_role(self, role: UserRole) -> bool:
        """Check if user has specific role (mirrors User.has_role)."""
        return self.role == role
    
    def can_create_content(self) -> bool:
        """Check if user can create content (mirrors User.can_create_content)."""
        return self.role in {UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN}
    
    def can_review_content(self) -> bool:
        """Check if user can review content (mirrors User.can_review_content)."""
        return self.role in {UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN}
    
    def can_approve_content(self) -> bool:
        """Check if user can approve content (mirrors User.can_approve_content)."""
        return self.role in {UserRole.APPROVER, UserRole.ADMIN}
    
    def can_manage_users(self) -> bool:
        """Check if user can manage other users (mirrors User.can_manage_users)."""
        return self.role == UserRole.ADMIN
    
    def update_last_login(self) -> None:
        """Update last login timestamp for authentication."""
        self.last_login = datetime.now(timezone.utc)
        self.update_timestamps()
    
    @classmethod
    def from_api_schema(cls, api_schema: UserCreate | UserUpdate, **extra_data) -> "UserServiceSchema":
        """Convert from API schema to service schema."""
        # Extract data from API schema
        api_data = api_schema.model_dump(exclude_none=True)
        
        # Remove password if present - it should be hashed separately
        if "password" in api_data:
            del api_data["password"]
        
        # Merge with extra data (e.g., hashed_password, system fields)
        merged_data = {**api_data, **extra_data}
        
        # Apply service-level defaults
        if "role" not in merged_data:
            merged_data["role"] = UserRole.CREATOR  # Default role from API analysis
        if "is_active" not in merged_data:
            merged_data["is_active"] = True
        if "is_verified" not in merged_data:
            merged_data["is_verified"] = False
        
        return cls.model_validate(merged_data)
    
    def to_api_schema(self, api_schema_class=UserResponse) -> UserResponse:
        """Convert service schema to API response schema."""
        # Get all data except internal service fields
        api_data = self.model_dump(exclude={
            "hashed_password",  # Never expose password hash
            "created_by"        # Internal field
        })
        
        return api_schema_class.model_validate(api_data)


class UserCreateServiceSchema(UserServiceSchema):
    """Service schema for user creation operations."""
    
    # Override to make ID optional for creation
    id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    
    # Password is required for creation
    plain_password: str | None = Field(None, description="Plain text password for hashing")
    
    @field_validator("plain_password")
    @classmethod
    def validate_password_strength(cls, v: str | None) -> str | None:
        """Validate password strength (mirrors UserOrmService validation)."""
        if v is None:
            return v
            
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if len(v) > 128:
            raise ValueError("Password must be less than 128 characters")
        
        # At least one lowercase letter
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        
        # At least one uppercase letter
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        
        # At least one digit
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        
        return v
    
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


class UserUpdateServiceSchema(ServiceSchemaBase):
    """Service schema for user update operations."""
    
    # All fields optional for updates
    username: str | None = Field(None, min_length=3, max_length=50)
    email: str | None = None
    full_name: str | None = Field(None, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None
    is_verified: bool | None = None
    
    @field_validator("username")
    @classmethod
    def validate_username_update(cls, v: str | None) -> str | None:
        """Validate username format for updates."""
        if v is not None:
            return UserServiceSchema.validate_username_format(v)
        return v
    
    @field_validator("email")
    @classmethod
    def validate_email_update(cls, v: str | None) -> str | None:
        """Validate email format for updates."""
        if v is not None:
            return UserServiceSchema.validate_email_format(v)
        return v
    
    def apply_to_user(self, user: UserServiceSchema) -> UserServiceSchema:
        """Apply updates to existing user with validation."""
        update_data = self.model_dump(exclude_none=True)
        
        # Create updated user
        current_data = user.model_dump()
        merged_data = {**current_data, **update_data}
        
        updated_user = UserServiceSchema.model_validate(merged_data)
        updated_user.update_timestamps()
        
        return updated_user


class UserAuthenticationSchema(ServiceSchemaBase):
    """Service schema for user authentication operations."""
    
    identifier: str = Field(..., description="Username or email")
    password: str = Field(..., description="Plain text password")
    
    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        """Validate login identifier."""
        if not v or not v.strip():
            raise ValueError("Username or email is required")
        return v.strip().lower()
    
    @field_validator("password")
    @classmethod
    def validate_password_provided(cls, v: str) -> str:
        """Validate password is provided."""
        if not v:
            raise ValueError("Password is required")
        return v


class PasswordChangeServiceSchema(ServiceSchemaBase):
    """Service schema for password change operations."""
    
    current_password: str = Field(..., description="Current password for verification")
    new_password: str = Field(..., description="New password")
    
    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        """Validate new password strength."""
        return UserCreateServiceSchema.validate_password_strength(v)


class UserFilterServiceSchema(ServiceSchemaBase):
    """Service schema for user filtering and search operations."""
    
    # Pagination
    pagination: PaginationServiceSchema = Field(default_factory=PaginationServiceSchema)
    
    # Sorting (based on actual API usage)
    sorting: SortingServiceSchema = Field(default_factory=lambda: SortingServiceSchema(
        sort_by="created_at", sort_order="desc"
    ))
    
    # Search
    search: SearchServiceSchema | None = None
    
    # User-specific filters (based on actual UserService.get_users parameters)
    role_filter: UserRole | None = None
    active_only: bool = Field(default=False, description="Show only active users")
    
    @model_validator(mode="after")
    def validate_filter_combination(self):
        """Validate filter combinations make sense."""
        # Validate sorting field is allowed for users
        allowed_sort_fields = [
            "created_at", "updated_at", "username", "email", "full_name", "last_login"
        ]
        
        if not self.sorting.validate_sort_field(allowed_sort_fields):
            raise ValueError(f"Invalid sort field: {self.sorting.sort_by}")
        
        return self
    
    def build_filter_criteria(self) -> dict[str, Any]:
        """Build filter criteria for repository queries."""
        criteria = {
            "skip": self.pagination.get_offset(),
            "limit": self.pagination.size,
        }
        
        # Role filter
        if self.role_filter is not None:
            criteria["role_filter"] = self.role_filter
            
        # Active filter
        criteria["active_only"] = self.active_only
        
        # Search criteria
        if self.search:
            criteria["search"] = self.search.query
        
        return criteria


# Export all schemas
__all__ = [
    "UserServiceSchema",
    "UserCreateServiceSchema", 
    "UserUpdateServiceSchema",
    "UserAuthenticationSchema",
    "PasswordChangeServiceSchema",
    "UserFilterServiceSchema",
]