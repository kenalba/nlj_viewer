"""
Permission Service Schemas - Business Logic Layer.

Provides service-level schemas for permission management operations with business
validation rules, role-based access control, and conversion utilities.
Designed to be extensible for future integration with external identity providers like Keycloak.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models.user import UserRole
from .common import (
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
)


class PermissionServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
):
    """
    Core service schema for permission management operations.
    
    Provides business-level validation for role changes and permission management.
    Extensible design allows for future integration with external identity providers.
    """
    
    # Core permission fields
    user_id: uuid.UUID = Field(..., description="Target user ID for permission operation")
    role: UserRole = Field(..., description="User role for permissions")
    previous_role: UserRole | None = Field(None, description="Previous role before change")
    changed_by: uuid.UUID = Field(..., description="ID of user who made the change")
    
    # Extensibility fields for future identity provider integration
    external_provider: str | None = Field(None, description="External identity provider (e.g., keycloak)")
    external_user_id: str | None = Field(None, description="External provider user ID")
    provider_metadata: dict[str, Any] | None = Field(None, description="Provider-specific metadata")
    
    # Audit fields
    change_reason: str | None = Field(None, description="Reason for permission change")
    effective_until: datetime | None = Field(None, description="When permission expires (for temporary access)")
    
    @field_validator("role", "previous_role")
    @classmethod
    def validate_role(cls, v: UserRole | None) -> UserRole | None:
        """Validate role is a valid UserRole enum value."""
        if v is not None and v not in UserRole:
            raise ValueError(f"Invalid role: {v}")
        return v
    
    @model_validator(mode="after")
    def validate_role_change(self) -> "PermissionServiceSchema":
        """Validate role change logic."""
        # Prevent invalid role transitions (can be customized)
        if self.role == self.previous_role:
            raise ValueError("New role must be different from previous role")
        return self
    
    def can_change_to_role(self, target_role: UserRole, changer_role: UserRole) -> bool:
        """
        Business logic to determine if role change is allowed.
        Extensible for future role hierarchy customization.
        """
        # Only admins can change roles
        if changer_role != UserRole.ADMIN:
            return False
            
        # Prevent admins from demoting themselves
        if self.user_id == self.changed_by and target_role != UserRole.ADMIN:
            return False
            
        return True
    
    def to_permission_response(self) -> dict[str, Any]:
        """Convert to permission response format for APIs."""
        return {
            "user_id": str(self.user_id),
            "role": self.role.value,
            "previous_role": self.previous_role.value if self.previous_role else None,
            "changed_by": str(self.changed_by),
            "changed_at": self.created_at.isoformat() if self.created_at else None,
            "change_reason": self.change_reason,
            "effective_until": self.effective_until.isoformat() if self.effective_until else None,
            "external_provider": self.external_provider,
        }
    
    @classmethod
    def from_user_role_change(
        cls,
        user_id: uuid.UUID,
        new_role: UserRole,
        previous_role: UserRole,
        changed_by: uuid.UUID,
        change_reason: str | None = None
    ) -> "PermissionServiceSchema":
        """Create permission schema from role change data."""
        return cls(
            user_id=user_id,
            role=new_role,
            previous_role=previous_role,
            changed_by=changed_by,
            change_reason=change_reason,
            created_at=datetime.now(timezone.utc)
        )


class UserPermissionSummaryServiceSchema(ServiceSchemaBase):
    """
    Service schema for user permission summaries.
    
    Provides a comprehensive view of user permissions based on role.
    Extensible for future granular permission systems.
    """
    
    user_id: uuid.UUID = Field(..., description="User ID")
    role: UserRole = Field(..., description="Current user role")
    permissions: dict[str, bool] = Field(..., description="Permission matrix")
    
    # Extensibility for future permission systems
    granular_permissions: list[str] | None = Field(None, description="List of specific permissions")
    permission_groups: list[str] | None = Field(None, description="Permission groups user belongs to")
    external_permissions: dict[str, Any] | None = Field(None, description="External provider permissions")
    
    @classmethod
    def from_user_role(cls, user_id: uuid.UUID, role: UserRole) -> "UserPermissionSummaryServiceSchema":
        """Create permission summary from user role."""
        # Define role-based permission matrix (extensible)
        role_permissions = {
            UserRole.PLAYER: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": False,
                "can_review_content": False,
                "can_approve_content": False,
                "can_manage_users": False,
                "can_view_analytics": False,
                "can_manage_system": False,
            },
            UserRole.LEARNER: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_access_training": True,
                "can_edit_content": False,
                "can_review_content": False,
                "can_approve_content": False,
                "can_manage_users": False,
                "can_view_analytics": False,
                "can_manage_system": False,
            },
            UserRole.CREATOR: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_create_content": True,
                "can_access_training": True,
                "can_edit_content": True,
                "can_review_content": False,
                "can_approve_content": False,
                "can_manage_users": False,
                "can_view_analytics": True,
                "can_manage_system": False,
            },
            UserRole.REVIEWER: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_create_content": True,
                "can_review_content": True,
                "can_access_training": True,
                "can_approve_content": False,
                "can_manage_users": False,
                "can_view_analytics": True,
                "can_manage_system": False,
            },
            UserRole.APPROVER: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_create_content": True,
                "can_review_content": True,
                "can_approve_content": True,
                "can_access_training": True,
                "can_manage_users": False,
                "can_view_analytics": True,
                "can_manage_system": False,
            },
            UserRole.ADMIN: {
                "can_view_content": True,
                "can_play_scenarios": True,
                "can_edit_content": True,
                "can_create_content": True,
                "can_review_content": True,
                "can_approve_content": True,
                "can_access_training": True,
                "can_manage_users": True,
                "can_view_analytics": True,
                "can_manage_system": True,
            },
        }
        
        permissions = role_permissions.get(role, {})
        
        return cls(
            user_id=user_id,
            role=role,
            permissions=permissions
        )
    
    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission."""
        return self.permissions.get(permission, False)
    
    def get_allowed_content_states(self) -> list[str]:
        """Get content states user can access (matches frontend logic)."""
        if self.role == UserRole.ADMIN:
            return ['published', 'approved', 'rejected', 'in_review', 'submitted', 'draft']
        elif self.role == UserRole.APPROVER:
            return ['published', 'approved', 'rejected', 'in_review', 'submitted']
        elif self.role == UserRole.REVIEWER:
            return ['published', 'rejected', 'in_review', 'submitted']
        elif self.role == UserRole.CREATOR:
            return ['published', 'approved', 'rejected', 'in_review', 'submitted', 'draft']
        else:
            return ['published']


class UserPreferenceServiceSchema(ServiceSchemaBase, ValidationMixin, TimestampMixin, IdentityMixin):
    """
    Service schema for user preferences management.
    
    Handles user customization settings, privacy preferences, and UI configuration.
    Designed to be extensible for future preference types.
    """
    
    user_id: uuid.UUID = Field(..., description="User ID")
    
    # UI Preferences
    theme: str = Field(default="light", description="UI theme preference")
    language: str = Field(default="en", description="Language preference")
    timezone: str = Field(default="UTC", description="Timezone preference")
    
    # Privacy Preferences
    profile_visibility: str = Field(default="public", description="Profile visibility setting")
    email_notifications: bool = Field(default=True, description="Email notifications enabled")
    marketing_emails: bool = Field(default=False, description="Marketing email consent")
    
    # Feature Preferences
    enable_analytics_tracking: bool = Field(default=True, description="Analytics tracking consent")
    auto_save: bool = Field(default=True, description="Auto-save preference")
    
    # Extensibility for future preferences
    custom_preferences: dict[str, Any] | None = Field(None, description="Custom user preferences")
    external_preferences: dict[str, Any] | None = Field(None, description="External system preferences")
    
    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str) -> str:
        """Validate theme is allowed value."""
        allowed_themes = ["light", "dark", "auto"]
        if v not in allowed_themes:
            raise ValueError(f"Theme must be one of: {allowed_themes}")
        return v
    
    @field_validator("profile_visibility")
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        """Validate profile visibility setting."""
        allowed_visibility = ["public", "private", "organization"]
        if v not in allowed_visibility:
            raise ValueError(f"Profile visibility must be one of: {allowed_visibility}")
        return v
    
    def to_preferences_response(self) -> dict[str, Any]:
        """Convert to preferences response format for APIs."""
        return {
            "user_id": str(self.user_id),
            "theme": self.theme,
            "language": self.language,
            "timezone": self.timezone,
            "profile_visibility": self.profile_visibility,
            "email_notifications": self.email_notifications,
            "marketing_emails": self.marketing_emails,
            "enable_analytics_tracking": self.enable_analytics_tracking,
            "auto_save": self.auto_save,
            "custom_preferences": self.custom_preferences or {},
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def create_default_preferences(cls, user_id: uuid.UUID) -> "UserPreferenceServiceSchema":
        """Create default preferences for new user."""
        return cls(
            user_id=user_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )