"""
Training Service Schemas - Business Logic Layer.

Provides service-level schemas for training management operations with business
validation rules, training workflow logic, and conversion utilities.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, List

from pydantic import Field, field_validator, model_validator

from app.models.user import UserRole
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


class TrainingProgramServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
    ConversionMixin[Any],  # Will be replaced with actual API schema when available
):
    """
    Core service schema for training program management operations.
    
    Provides business-level validation and lifecycle management for training programs.
    """
    
    # Core program fields
    title: str = Field(..., min_length=3, max_length=255, description="Training program title")
    description: str | None = Field(None, max_length=2000, description="Program description")
    
    # Program configuration
    duration_minutes: int = Field(default=120, ge=15, le=480, description="Standard program duration")
    learning_objectives: List[str] | None = Field(None, description="Learning objectives")
    
    # Content and prerequisites
    content_id: uuid.UUID | None = Field(None, description="Primary content UUID")
    prerequisites: List[uuid.UUID] | None = Field(None, description="Required content completion UUIDs")
    content_items: List[uuid.UUID] | None = Field(None, description="Related content item UUIDs")
    
    # Program settings
    requires_approval: bool = Field(default=False, description="Requires manager approval for enrollment")
    auto_approve: bool = Field(default=True, description="Automatically approve eligible learners")
    max_participants: int | None = Field(None, ge=1, le=1000, description="Maximum participants")
    
    # Status
    is_active: bool = Field(default=True, description="Program is active")
    is_published: bool = Field(default=False, description="Published to learners")
    
    # Creator reference
    created_by: uuid.UUID = Field(..., description="Program creator ID")
    
    @field_validator("title")
    @classmethod
    def validate_title_format(cls, v: str) -> str:
        """Validate and normalize program title."""
        title = v.strip()
        if len(title) < 3:
            raise ValueError("Program title must be at least 3 characters long")
        if len(title) > 255:
            raise ValueError("Program title must be less than 255 characters")
        return title
    
    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        """Validate program description if provided."""
        if v is not None:
            desc = v.strip()
            if len(desc) > 2000:
                raise ValueError("Program description must be less than 2000 characters")
            return desc if desc else None
        return v
    
    @field_validator("learning_objectives")
    @classmethod
    def validate_learning_objectives(cls, v: List[str] | None) -> List[str] | None:
        """Validate learning objectives format."""
        if v is not None:
            if len(v) > 10:
                raise ValueError("Maximum 10 learning objectives allowed")
            validated = []
            for obj in v:
                if not isinstance(obj, str):
                    raise ValueError("Learning objectives must be strings")
                obj = obj.strip()
                if len(obj) > 200:
                    raise ValueError("Each learning objective must be less than 200 characters")
                if obj:
                    validated.append(obj)
            return validated if validated else None
        return v
    
    @model_validator(mode="after")
    def validate_program_consistency(self):
        """Validate program configuration consistency."""
        if self.auto_approve and self.requires_approval:
            # This is valid - auto-approve can still require initial approval setup
            pass
            
        if self.max_participants is not None and self.max_participants < 1:
            raise ValueError("Maximum participants must be at least 1")
            
        return self
    
    def validate_permissions(self, user_role: UserRole, operation: str) -> bool:
        """Validate user operation permissions for training programs."""
        permission_matrix = {
            "create": [UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            "read": [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            "update": [UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            "delete": [UserRole.ADMIN],
            "publish": [UserRole.APPROVER, UserRole.ADMIN],
            "assign_learners": [UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            "archive": [UserRole.ADMIN],
        }
        
        allowed_roles = permission_matrix.get(operation, [])
        return user_role in allowed_roles
    
    def can_user_modify_program(self, requesting_user_role: UserRole, requesting_user_id: uuid.UUID) -> bool:
        """Check if user can modify this program."""
        # Admin can modify any program
        if requesting_user_role == UserRole.ADMIN:
            return True
            
        # Creator can modify their own program if they have reviewer+ role
        if self.created_by == requesting_user_id and requesting_user_role in [UserRole.REVIEWER, UserRole.APPROVER]:
            return True
            
        # Approvers can modify any program
        if requesting_user_role == UserRole.APPROVER:
            return True
            
        return False
    
    @classmethod
    def from_api_schema(cls, api_schema: Any, **extra_data) -> "TrainingProgramServiceSchema":
        """Convert from API schema to service schema."""
        # Extract data from API schema (will be implemented when API schemas exist)
        if hasattr(api_schema, 'model_dump'):
            api_data = api_schema.model_dump(exclude_none=True)
        else:
            # Fallback for dict input
            api_data = api_schema if isinstance(api_schema, dict) else {}
        
        # Merge with extra data (e.g., created_by, system fields)
        merged_data = {**api_data, **extra_data}
        
        # Apply service-level defaults
        if "is_active" not in merged_data:
            merged_data["is_active"] = True
        if "is_published" not in merged_data:
            merged_data["is_published"] = False
        if "requires_approval" not in merged_data:
            merged_data["requires_approval"] = False
        if "auto_approve" not in merged_data:
            merged_data["auto_approve"] = True
        
        return cls.model_validate(merged_data)
    
    def to_api_schema(self, api_schema_class=None) -> Any:
        """Convert service schema to API response schema."""
        # Get all data except internal service fields
        api_data = self.model_dump(exclude={
            "created_by"  # May be internal field depending on API design
        })
        
        if api_schema_class:
            return api_schema_class.model_validate(api_data)
        return api_data


class TrainingSessionServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
):
    """
    Core service schema for training session management operations.
    
    Handles session scheduling, capacity, and logistics.
    """
    
    # Core session fields
    program_id: uuid.UUID = Field(..., description="Training program ID")
    instructor_id: uuid.UUID | None = Field(None, description="Assigned instructor ID")
    
    # Scheduling
    scheduled_start: datetime = Field(..., description="Session start time")
    scheduled_end: datetime = Field(..., description="Session end time")
    timezone: str = Field(default="UTC", description="Session timezone")
    
    # Session configuration
    location: str | None = Field(None, max_length=255, description="Session location")
    capacity: int = Field(default=20, ge=1, le=200, description="Maximum attendees")
    max_participants: int | None = Field(None, ge=1, le=200, description="Override capacity")
    
    # Session details
    session_notes: str | None = Field(None, max_length=2000, description="Session-specific notes")
    
    # Status
    status: str = Field(default="scheduled", description="Session status")
    
    @field_validator("scheduled_start", "scheduled_end")
    @classmethod
    def validate_session_times(cls, v: datetime) -> datetime:
        """Validate session times are in the future."""
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v
    
    @model_validator(mode="after")
    def validate_session_consistency(self):
        """Validate session configuration consistency."""
        if self.scheduled_end <= self.scheduled_start:
            raise ValueError("Session end time must be after start time")
            
        session_duration = (self.scheduled_end - self.scheduled_start).total_seconds() / 60
        if session_duration < 15:
            raise ValueError("Session must be at least 15 minutes long")
        if session_duration > 480:  # 8 hours
            raise ValueError("Session cannot be longer than 8 hours")
            
        if self.max_participants is not None and self.max_participants > self.capacity:
            # Allow override to be higher than default capacity
            pass
            
        return self


class TrainingBookingServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
):
    """
    Core service schema for training booking management operations.
    
    Handles learner registration and booking status.
    """
    
    # Core booking fields
    program_id: uuid.UUID = Field(..., description="Training program ID")
    session_id: uuid.UUID = Field(..., description="Training session ID")
    learner_id: uuid.UUID = Field(..., description="Learner ID")
    
    # Booking details
    registration_method: str = Field(default="online", description="How booking was made")
    booking_status: str = Field(default="confirmed", description="Booking status")
    
    # Waitlist management
    is_waitlisted: bool = Field(default=False, description="On waitlist")
    waitlist_position: int | None = Field(None, ge=1, description="Position on waitlist")
    
    # Special requirements
    registration_notes: str | None = Field(None, max_length=1000, description="Learner notes")
    special_requirements: dict[str, Any] | None = Field(None, description="Special accommodations")
    
    # Communication tracking
    confirmation_sent: bool = Field(default=False, description="Confirmation email sent")
    reminder_count: int = Field(default=0, ge=0, description="Number of reminders sent")
    
    @field_validator("booking_status")
    @classmethod
    def validate_booking_status(cls, v: str) -> str:
        """Validate booking status values."""
        valid_statuses = {"confirmed", "cancelled", "no_show", "waitlist"}
        if v not in valid_statuses:
            raise ValueError(f"Invalid booking status. Must be one of: {valid_statuses}")
        return v
    
    @field_validator("registration_method")
    @classmethod
    def validate_registration_method(cls, v: str) -> str:
        """Validate registration method values."""
        valid_methods = {"online", "admin", "import", "phone", "walk_in"}
        if v not in valid_methods:
            raise ValueError(f"Invalid registration method. Must be one of: {valid_methods}")
        return v


class AttendanceRecordServiceSchema(
    ServiceSchemaBase,
    ValidationMixin,
    TimestampMixin,
    IdentityMixin,
):
    """
    Core service schema for attendance tracking operations.
    
    Handles attendance recording and completion tracking.
    """
    
    # Core attendance fields
    session_id: uuid.UUID = Field(..., description="Training session ID")
    booking_id: uuid.UUID = Field(..., description="Training booking ID")
    learner_id: uuid.UUID = Field(..., description="Learner ID")
    
    # Attendance details
    attended: bool = Field(default=False, description="Learner attended")
    check_in_time: datetime | None = Field(None, description="Check-in time")
    check_out_time: datetime | None = Field(None, description="Check-out time")
    attendance_method: str = Field(default="in_person", description="Attendance method")
    
    # Participation tracking
    participation_score: float | None = Field(None, ge=0.0, le=1.0, description="Participation score")
    engagement_notes: str | None = Field(None, max_length=1000, description="Engagement notes")
    
    # Completion tracking
    completed: bool = Field(default=False, description="Session completed")
    completion_time: datetime | None = Field(None, description="Completion time")
    assessment_score: float | None = Field(None, ge=0.0, le=1.0, description="Assessment score")
    
    # Certificate tracking
    certificate_issued: bool = Field(default=False, description="Certificate issued")
    certificate_issued_at: datetime | None = Field(None, description="Certificate issue time")
    
    # Instructor feedback
    instructor_notes: str | None = Field(None, max_length=1000, description="Instructor notes")
    follow_up_required: bool = Field(default=False, description="Requires follow-up")
    
    # Record metadata
    recorded_by_id: uuid.UUID = Field(..., description="Who recorded attendance")
    
    @field_validator("attendance_method")
    @classmethod
    def validate_attendance_method(cls, v: str) -> str:
        """Validate attendance method values."""
        valid_methods = {"in_person", "virtual", "hybrid"}
        if v not in valid_methods:
            raise ValueError(f"Invalid attendance method. Must be one of: {valid_methods}")
        return v
    
    @model_validator(mode="after")
    def validate_attendance_consistency(self):
        """Validate attendance record consistency."""
        if self.check_out_time and self.check_in_time:
            if self.check_out_time <= self.check_in_time:
                raise ValueError("Check-out time must be after check-in time")
                
        if self.completion_time and not self.attended:
            raise ValueError("Cannot have completion time without attendance")
            
        if self.certificate_issued and not self.completed:
            raise ValueError("Cannot issue certificate without completion")
            
        return self


# Filter and pagination schemas
class TrainingFilterServiceSchema(ServiceSchemaBase):
    """Service schema for training program filtering and search operations."""
    
    # Pagination
    pagination: PaginationServiceSchema = Field(default_factory=PaginationServiceSchema)
    
    # Sorting
    sorting: SortingServiceSchema = Field(default_factory=lambda: SortingServiceSchema(
        sort_by="created_at", sort_order="desc"
    ))
    
    # Search
    search: SearchServiceSchema | None = None
    
    # Training-specific filters
    status_filter: str | None = Field(None, description="Filter by program status")
    active_only: bool = Field(default=True, description="Show only active programs")
    published_only: bool = Field(default=False, description="Show only published programs")
    creator_filter: uuid.UUID | None = Field(None, description="Filter by creator")
    
    @model_validator(mode="after")
    def validate_filter_combination(self):
        """Validate filter combinations make sense."""
        # Validate sorting field is allowed for training programs
        allowed_sort_fields = [
            "created_at", "updated_at", "title", "duration_minutes", "max_participants"
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
        
        # Status filters
        criteria["active_only"] = self.active_only
        criteria["published_only"] = self.published_only
        
        # Creator filter
        if self.creator_filter is not None:
            criteria["creator_filter"] = self.creator_filter
            
        # Search criteria
        if self.search:
            criteria["search"] = self.search.query
        
        return criteria


# Export all schemas
__all__ = [
    "TrainingProgramServiceSchema",
    "TrainingSessionServiceSchema", 
    "TrainingBookingServiceSchema",
    "AttendanceRecordServiceSchema",
    "TrainingFilterServiceSchema",
]