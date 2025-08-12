"""
JSON Schema definitions for xAPI training events.
Provides validation for all training lifecycle events published to Kafka.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, validator


class XAPIVerb(str, Enum):
    """Standard xAPI verbs used in training events."""

    AUTHORED = "http://adlnet.gov/expapi/verbs/authored"
    SHARED = "http://adlnet.gov/expapi/verbs/shared"
    MODIFIED = "http://adlnet.gov/expapi/verbs/modified"
    SUSPENDED = "http://adlnet.gov/expapi/verbs/suspended"
    SCHEDULED = "http://activitystrea.ms/schema/1.0/schedule"
    VOIDED = "http://adlnet.gov/expapi/verbs/voided"
    ASKED = "http://adlnet.gov/expapi/verbs/asked"
    REGISTERED = "http://adlnet.gov/expapi/verbs/registered"
    LAUNCHED = "http://adlnet.gov/expapi/verbs/launched"
    COMPLETED = "http://adlnet.gov/expapi/verbs/completed"
    EARNED = "http://adlnet.gov/expapi/verbs/earned"
    ATTENDED = "http://adlnet.gov/expapi/verbs/attended"
    PROGRESSED = "http://adlnet.gov/expapi/verbs/progressed"
    FAILED = "http://adlnet.gov/expapi/verbs/failed"
    IMPORTED = "http://adlnet.gov/expapi/verbs/imported"
    # Custom verbs (REVIEWED may be custom if not in ADL spec)
    REVIEWED = "http://adlnet.gov/expapi/verbs/reviewed"
    WAITLISTED = "http://nlj.platform/verbs/waitlisted"
    CHECKED_IN = "http://nlj.platform/verbs/checked-in"
    RESCHEDULED = "http://nlj.platform/verbs/rescheduled"


class XAPIActivityType(str, Enum):
    """Standard xAPI activity types."""

    COURSE = "http://adlnet.gov/expapi/activities/course"
    MEETING = "http://adlnet.gov/expapi/activities/meeting"
    BADGE = "http://adlnet.gov/expapi/activities/badge"
    # Content generation activity type
    CONTENT_GENERATION = "http://nlj.platform/activities/content-generation"


class XAPIActor(BaseModel):
    """xAPI Actor (Agent) schema."""

    objectType: str = Field(default="Agent", pattern="^Agent$")
    name: str = Field(..., min_length=1, max_length=100)
    mbox: str = Field(..., pattern=r"^mailto:[^@]+@[^@]+\.[^@]+$")
    account: Optional[Dict[str, str]] = None

    @validator("account")
    def validate_account(cls, v):
        if v is not None:
            required_keys = {"name", "homePage"}
            if not all(key in v for key in required_keys):
                raise ValueError(f"Account must contain {required_keys}")
        return v


class XAPIVerbSchema(BaseModel):
    """xAPI Verb schema."""

    id: str = Field(..., pattern=r"^https?://")
    display: Dict[str, str] = Field(...)

    @validator("display")
    def validate_display(cls, v):
        if "en-US" not in v:
            raise ValueError("Display must contain 'en-US' language")
        return v


class XAPIActivityDefinition(BaseModel):
    """xAPI Activity Definition schema."""

    name: Dict[str, str] = Field(...)
    description: Optional[Dict[str, str]] = None
    type: XAPIActivityType = Field(...)

    @validator("name")
    def validate_name(cls, v):
        if "en-US" not in v:
            raise ValueError("Name must contain 'en-US' language")
        return v


class XAPIActivity(BaseModel):
    """xAPI Activity Object schema."""

    objectType: str = Field(default="Activity", pattern="^Activity$")
    id: str = Field(..., pattern=r"^http://nlj\.platform/")
    definition: XAPIActivityDefinition = Field(...)


class XAPIContext(BaseModel):
    """xAPI Context schema."""

    platform: str = Field(default="NLJ Platform")
    extensions: Optional[Dict[str, Any]] = None

    @validator("extensions")
    def validate_extensions(cls, v):
        if v is not None:
            # All extension keys must be URIs
            for key in v.keys():
                if not key.startswith("http://nlj.platform/extensions/"):
                    raise ValueError(f"Extension key must be NLJ platform URI: {key}")
        return v


class XAPIResult(BaseModel):
    """xAPI Result schema."""

    completion: Optional[bool] = None
    success: Optional[bool] = None
    score: Optional[Dict[str, float]] = None
    duration: Optional[str] = None  # ISO 8601 duration
    extensions: Optional[Dict[str, Any]] = None


class BaseXAPIEvent(BaseModel):
    """Base xAPI Event schema."""

    id: str = Field(..., pattern=r"^[a-f0-9\-]{36}$")  # UUID format
    version: str = Field(default="1.0.3", pattern="^1\.0\.3$")
    actor: XAPIActor = Field(...)
    verb: XAPIVerbSchema = Field(...)
    object: XAPIActivity = Field(...)
    context: XAPIContext = Field(...)
    timestamp: datetime = Field(...)
    result: Optional[XAPIResult] = None


# =============================================================================
# PROGRAM LIFECYCLE EVENT SCHEMAS
# =============================================================================


class ProgramCreatedEvent(BaseXAPIEvent):
    """Schema for program.created events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.AUTHORED:
            raise ValueError("Program created events must use 'authored' verb")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/training-programs/"):
            raise ValueError("Object ID must be training program URI")
        if v.definition.type != XAPIActivityType.COURSE:
            raise ValueError("Activity type must be course")
        return v

    @validator("context")
    def validate_context(cls, v):
        if v.extensions:
            pass
            # Extensions are optional but if present must be valid
        return v


class ProgramPublishedEvent(BaseXAPIEvent):
    """Schema for program.published events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.SHARED:
            raise ValueError("Program published events must use 'shared' verb")
        return v


# =============================================================================
# SESSION LIFECYCLE EVENT SCHEMAS
# =============================================================================


class SessionScheduledEvent(BaseXAPIEvent):
    """Schema for session.scheduled events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.SCHEDULED:
            raise ValueError("Session scheduled events must use 'schedule' verb")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/training-sessions/"):
            raise ValueError("Object ID must be training session URI")
        if v.definition.type != XAPIActivityType.MEETING:
            raise ValueError("Activity type must be meeting")
        return v

    @validator("context")
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Session scheduled events require extensions")

        required_extensions = [
            "http://nlj.platform/extensions/program_id",
            "http://nlj.platform/extensions/start_time",
            "http://nlj.platform/extensions/end_time",
            "http://nlj.platform/extensions/capacity",
        ]

        for ext in required_extensions:
            if ext not in v.extensions:
                raise ValueError(f"Missing required extension: {ext}")

        # Validate datetime formats
        try:
            datetime.fromisoformat(v.extensions["http://nlj.platform/extensions/start_time"].replace("Z", "+00:00"))
            datetime.fromisoformat(v.extensions["http://nlj.platform/extensions/end_time"].replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("start_time and end_time must be valid ISO datetime strings")

        # Validate capacity is positive integer
        capacity = v.extensions["http://nlj.platform/extensions/capacity"]
        if not isinstance(capacity, int) or capacity <= 0:
            raise ValueError("Capacity must be positive integer")

        return v


# =============================================================================
# BOOKING & REGISTRATION EVENT SCHEMAS
# =============================================================================


class BookingRequestedEvent(BaseXAPIEvent):
    """Schema for booking.requested events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.ASKED:
            raise ValueError("Booking requested events must use 'asked' verb")
        return v

    @validator("context")
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Booking requested events require extensions")

        required_extensions = [
            "http://nlj.platform/extensions/booking_id",
            "http://nlj.platform/extensions/registration_method",
        ]

        for ext in required_extensions:
            if ext not in v.extensions:
                raise ValueError(f"Missing required extension: {ext}")

        return v


class BookingConfirmedEvent(BaseXAPIEvent):
    """Schema for booking.confirmed events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.REGISTERED:
            raise ValueError("Booking confirmed events must use 'registered' verb")
        return v


class BookingWaitlistedEvent(BaseXAPIEvent):
    """Schema for booking.waitlisted events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.WAITLISTED:
            raise ValueError("Booking waitlisted events must use 'waitlisted' verb")
        return v

    @validator("context")
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Booking waitlisted events require extensions")

        # Must have waitlist position
        if "http://nlj.platform/extensions/waitlist_position" not in v.extensions:
            raise ValueError("Missing required extension: waitlist_position")

        position = v.extensions["http://nlj.platform/extensions/waitlist_position"]
        if not isinstance(position, int) or position <= 0:
            raise ValueError("Waitlist position must be positive integer")

        return v


# =============================================================================
# CONTENT GENERATION EVENT SCHEMAS
# =============================================================================


class ContentGenerationRequestedEvent(BaseXAPIEvent):
    """Schema for content.generation.requested events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.AUTHORED:
            raise ValueError("Content generation requested events must use 'authored' verb")
        return v

    @validator("result")
    def validate_result(cls, v):
        if v is None:
            raise ValueError("Content generation requested events must have a result")
        if not hasattr(v, "extensions") or v.extensions is None:
            raise ValueError("Result must have extensions")
        if "http://nlj.platform/extensions/generation_status" not in v.extensions:
            raise ValueError("Result must include generation_status extension")
        if v.extensions["http://nlj.platform/extensions/generation_status"] != "requested":
            raise ValueError("Generation status must be 'requested' for requested events")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v

    @validator("context")
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Content generation requested events require extensions")

        required_extensions = [
            "http://nlj.platform/extensions/source_document_ids",
            "http://nlj.platform/extensions/prompt_config",
        ]

        for ext in required_extensions:
            if ext not in v.extensions:
                raise ValueError(f"Missing required extension: {ext}")

        # Validate source document IDs is a list
        doc_ids = v.extensions["http://nlj.platform/extensions/source_document_ids"]
        if not isinstance(doc_ids, list) or len(doc_ids) == 0:
            raise ValueError("source_document_ids must be a non-empty list")

        return v


class ContentGenerationStartedEvent(BaseXAPIEvent):
    """Schema for content.generation.started events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.AUTHORED:
            raise ValueError("Content generation started events must use 'authored' verb")
        return v

    @validator("result")
    def validate_result(cls, v):
        if v is None:
            raise ValueError("Content generation started events must have a result")
        if not hasattr(v, "extensions") or v.extensions is None:
            raise ValueError("Result must have extensions")
        if "http://nlj.platform/extensions/generation_status" not in v.extensions:
            raise ValueError("Result must include generation_status extension")
        if v.extensions["http://nlj.platform/extensions/generation_status"] != "started":
            raise ValueError("Generation status must be 'started' for started events")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v


class ContentGenerationProgressEvent(BaseXAPIEvent):
    """Schema for content.generation.progress events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.AUTHORED:
            raise ValueError("Content generation progress events must use 'authored' verb")
        return v

    @validator("result")
    def validate_result(cls, v):
        if v is None:
            raise ValueError("Content generation progress events must have a result")
        if not hasattr(v, "extensions") or v.extensions is None:
            raise ValueError("Result must have extensions")
        if "http://nlj.platform/extensions/generation_status" not in v.extensions:
            raise ValueError("Result must include generation_status extension")
        if v.extensions["http://nlj.platform/extensions/generation_status"] != "progressing":
            raise ValueError("Generation status must be 'progressing' for progress events")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v

    @validator("context")
    def validate_context(cls, v):
        if v.extensions:
            # Validate progress percentage if present
            if "http://nlj.platform/extensions/progress_percentage" in v.extensions:
                progress = v.extensions["http://nlj.platform/extensions/progress_percentage"]
                if not isinstance(progress, (int, float)) or progress < 0 or progress > 100:
                    raise ValueError("progress_percentage must be a number between 0 and 100")

        return v


class ContentGenerationCompletedEvent(BaseXAPIEvent):
    """Schema for content.generation.completed events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.AUTHORED:
            raise ValueError("Content generation completed events must use 'authored' verb")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v

    @validator("result")
    def validate_result(cls, v):
        if v is None:
            raise ValueError("Content generation completed events must have a result")
        if v.completion is not True:
            raise ValueError("Completed events must have completion=True")
        if not hasattr(v, "extensions") or v.extensions is None:
            raise ValueError("Result must have extensions")
        if "http://nlj.platform/extensions/generation_status" not in v.extensions:
            raise ValueError("Result must include generation_status extension")
        if v.extensions["http://nlj.platform/extensions/generation_status"] != "completed":
            raise ValueError("Generation status must be 'completed' for completed events")
        return v


class ContentGenerationFailedEvent(BaseXAPIEvent):
    """Schema for content.generation.failed events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.AUTHORED:
            raise ValueError("Content generation failed events must use 'authored' verb")
        return v

    @validator("result")
    def validate_result(cls, v):
        if v is None:
            raise ValueError("Content generation failed events must have a result")
        if not hasattr(v, "extensions") or v.extensions is None:
            raise ValueError("Result must have extensions")
        if "http://nlj.platform/extensions/generation_status" not in v.extensions:
            raise ValueError("Result must include generation_status extension")
        if v.extensions["http://nlj.platform/extensions/generation_status"] != "failed":
            raise ValueError("Generation status must be 'failed' for failed events")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v

    @validator("context")
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Content generation failed events require extensions")

        # Must have error message
        if "http://nlj.platform/extensions/error_message" not in v.extensions:
            raise ValueError("Missing required extension: error_message")

        error_msg = v.extensions["http://nlj.platform/extensions/error_message"]
        if not isinstance(error_msg, str) or len(error_msg.strip()) == 0:
            raise ValueError("error_message must be a non-empty string")

        return v


class ContentGenerationModifiedEvent(BaseXAPIEvent):
    """Schema for content.generation.modified events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.MODIFIED:
            raise ValueError("Content generation modified events must use 'modified' verb")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v

    @validator("context")
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Content generation modified events require extensions")

        # Should include modification details
        if "http://nlj.platform/extensions/modification_type" not in v.extensions:
            raise ValueError("Missing required extension: modification_type")

        mod_type = v.extensions["http://nlj.platform/extensions/modification_type"]
        valid_types = ["manual_edit", "flow_editor_change", "regeneration", "parameter_update"]
        if mod_type not in valid_types:
            raise ValueError(f"modification_type must be one of {valid_types}")

        return v


class ContentGenerationImportedEvent(BaseXAPIEvent):
    """Schema for content.generation.imported events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.IMPORTED:
            raise ValueError("Content generation imported events must use 'imported' verb")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v

    @validator("context")
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Content generation imported events require extensions")

        required_extensions = [
            "http://nlj.platform/extensions/import_source",
            "http://nlj.platform/extensions/import_type",
        ]

        for ext in required_extensions:
            if ext not in v.extensions:
                raise ValueError(f"Missing required extension: {ext}")

        # Validate import type
        import_type = v.extensions["http://nlj.platform/extensions/import_type"]
        valid_types = ["trivie_excel", "nlj_json", "external_source", "template"]
        if import_type not in valid_types:
            raise ValueError(f"import_type must be one of {valid_types}")

        return v


class ContentGenerationReviewedEvent(BaseXAPIEvent):
    """Schema for content.generation.reviewed events."""

    @validator("verb")
    def validate_verb(cls, v):
        if v.id != XAPIVerb.REVIEWED:
            raise ValueError("Content generation reviewed events must use 'reviewed' verb")
        return v

    @validator("object")
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/content-generation-sessions/"):
            raise ValueError("Object ID must be content generation session URI")
        if v.definition.type != XAPIActivityType.CONTENT_GENERATION:
            raise ValueError("Activity type must be content-generation")
        return v

    @validator("result")
    def validate_result(cls, v):
        if v is None:
            raise ValueError("Content generation reviewed events must have a result")
        if not hasattr(v, "extensions") or v.extensions is None:
            raise ValueError("Result must have extensions")

        # Should include review outcome
        if "http://nlj.platform/extensions/review_status" not in v.extensions:
            raise ValueError("Result must include review_status extension")

        review_status = v.extensions["http://nlj.platform/extensions/review_status"]
        valid_statuses = ["approved", "rejected", "needs_revision", "pending"]
        if review_status not in valid_statuses:
            raise ValueError(f"review_status must be one of {valid_statuses}")

        return v

    @validator("context")
    def validate_context(cls, v):
        if v.extensions:
            # Optional reviewer comments
            if "http://nlj.platform/extensions/reviewer_comments" in v.extensions:
                comments = v.extensions["http://nlj.platform/extensions/reviewer_comments"]
                if not isinstance(comments, str):
                    raise ValueError("reviewer_comments must be a string")

        return v


# =============================================================================
# EVENT VALIDATION FUNCTIONS
# =============================================================================

EVENT_SCHEMAS = {
    "program.created": ProgramCreatedEvent,
    "program.published": ProgramPublishedEvent,
    "session.scheduled": SessionScheduledEvent,
    "booking.requested": BookingRequestedEvent,
    "booking.confirmed": BookingConfirmedEvent,
    "booking.waitlisted": BookingWaitlistedEvent,
    # Content generation events
    "content.generation.requested": ContentGenerationRequestedEvent,
    "content.generation.started": ContentGenerationStartedEvent,
    "content.generation.progress": ContentGenerationProgressEvent,
    "content.generation.completed": ContentGenerationCompletedEvent,
    "content.generation.failed": ContentGenerationFailedEvent,
    "content.generation.modified": ContentGenerationModifiedEvent,
    "content.generation.imported": ContentGenerationImportedEvent,
    "content.generation.reviewed": ContentGenerationReviewedEvent,
}


def validate_xapi_event(event_type: str, event_data: Dict[str, Any]) -> BaseXAPIEvent:
    """
    Validate an xAPI event against its schema.

    Args:
        event_type: Type of event (e.g., 'program.created')
        event_data: Event payload to validate

    Returns:
        Validated event object

    Raises:
        ValueError: If event is invalid
        KeyError: If event type is not supported
    """
    if event_type not in EVENT_SCHEMAS:
        raise KeyError(f"Unsupported event type: {event_type}")

    schema_class = EVENT_SCHEMAS[event_type]

    try:
        return schema_class(**event_data)
    except Exception as e:
        raise ValueError(f"Event validation failed for {event_type}: {e}")


def is_valid_xapi_event(event_type: str, event_data: Dict[str, Any]) -> bool:
    """
    Check if an xAPI event is valid without raising exceptions.

    Args:
        event_type: Type of event
        event_data: Event payload

    Returns:
        True if valid, False otherwise
    """
    try:
        validate_xapi_event(event_type, event_data)
        return True
    except (ValueError, KeyError):
        return False


def get_event_validation_errors(event_type: str, event_data: Dict[str, Any]) -> Optional[str]:
    """
    Get validation errors for an xAPI event.

    Args:
        event_type: Type of event
        event_data: Event payload

    Returns:
        Error message if invalid, None if valid
    """
    try:
        validate_xapi_event(event_type, event_data)
        return None
    except (ValueError, KeyError) as e:
        return str(e)
