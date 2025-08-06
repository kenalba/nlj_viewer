"""
JSON Schema definitions for xAPI training events.
Provides validation for all training lifecycle events published to Kafka.
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum


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
    # Custom verbs
    WAITLISTED = "http://nlj.platform/verbs/waitlisted"
    CHECKED_IN = "http://nlj.platform/verbs/checked-in"
    RESCHEDULED = "http://nlj.platform/verbs/rescheduled"


class XAPIActivityType(str, Enum):
    """Standard xAPI activity types."""
    COURSE = "http://adlnet.gov/expapi/activities/course"
    MEETING = "http://adlnet.gov/expapi/activities/meeting"
    BADGE = "http://adlnet.gov/expapi/activities/badge"


class XAPIActor(BaseModel):
    """xAPI Actor (Agent) schema."""
    objectType: str = Field(default="Agent", pattern="^Agent$")
    name: str = Field(..., min_length=1, max_length=100)
    mbox: str = Field(..., pattern=r"^mailto:[^@]+@[^@]+\.[^@]+$")
    account: Optional[Dict[str, str]] = None

    @validator('account')
    def validate_account(cls, v):
        if v is not None:
            required_keys = {'name', 'homePage'}
            if not all(key in v for key in required_keys):
                raise ValueError(f"Account must contain {required_keys}")
        return v


class XAPIVerbSchema(BaseModel):
    """xAPI Verb schema."""
    id: str = Field(..., pattern=r"^https?://")
    display: Dict[str, str] = Field(...)

    @validator('display')
    def validate_display(cls, v):
        if 'en-US' not in v:
            raise ValueError("Display must contain 'en-US' language")
        return v


class XAPIActivityDefinition(BaseModel):
    """xAPI Activity Definition schema."""
    name: Dict[str, str] = Field(...)
    description: Optional[Dict[str, str]] = None
    type: XAPIActivityType = Field(...)

    @validator('name')
    def validate_name(cls, v):
        if 'en-US' not in v:
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

    @validator('extensions')
    def validate_extensions(cls, v):
        if v is not None:
            # All extension keys must be URIs
            for key in v.keys():
                if not key.startswith('http://nlj.platform/extensions/'):
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
    
    @validator('verb')
    def validate_verb(cls, v):
        if v.id != XAPIVerb.AUTHORED:
            raise ValueError("Program created events must use 'authored' verb")
        return v
    
    @validator('object')
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/training-programs/"):
            raise ValueError("Object ID must be training program URI")
        if v.definition.type != XAPIActivityType.COURSE:
            raise ValueError("Activity type must be course")
        return v
    
    @validator('context')
    def validate_context(cls, v):
        if v.extensions:
            required_extensions = [
                'http://nlj.platform/extensions/learning_objectives',
                'http://nlj.platform/extensions/prerequisites'
            ]
            # Extensions are optional but if present must be valid
        return v


class ProgramPublishedEvent(BaseXAPIEvent):
    """Schema for program.published events."""
    
    @validator('verb')
    def validate_verb(cls, v):
        if v.id != XAPIVerb.SHARED:
            raise ValueError("Program published events must use 'shared' verb")
        return v


# =============================================================================
# SESSION LIFECYCLE EVENT SCHEMAS
# =============================================================================

class SessionScheduledEvent(BaseXAPIEvent):
    """Schema for session.scheduled events."""
    
    @validator('verb')
    def validate_verb(cls, v):
        if v.id != XAPIVerb.SCHEDULED:
            raise ValueError("Session scheduled events must use 'schedule' verb")
        return v
    
    @validator('object')
    def validate_object(cls, v):
        if not v.id.startswith("http://nlj.platform/training-sessions/"):
            raise ValueError("Object ID must be training session URI")
        if v.definition.type != XAPIActivityType.MEETING:
            raise ValueError("Activity type must be meeting")
        return v
    
    @validator('context')
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Session scheduled events require extensions")
        
        required_extensions = [
            'http://nlj.platform/extensions/program_id',
            'http://nlj.platform/extensions/start_time',
            'http://nlj.platform/extensions/end_time',
            'http://nlj.platform/extensions/capacity'
        ]
        
        for ext in required_extensions:
            if ext not in v.extensions:
                raise ValueError(f"Missing required extension: {ext}")
        
        # Validate datetime formats
        try:
            datetime.fromisoformat(v.extensions['http://nlj.platform/extensions/start_time'].replace('Z', '+00:00'))
            datetime.fromisoformat(v.extensions['http://nlj.platform/extensions/end_time'].replace('Z', '+00:00'))
        except ValueError:
            raise ValueError("start_time and end_time must be valid ISO datetime strings")
        
        # Validate capacity is positive integer
        capacity = v.extensions['http://nlj.platform/extensions/capacity']
        if not isinstance(capacity, int) or capacity <= 0:
            raise ValueError("Capacity must be positive integer")
        
        return v


# =============================================================================
# BOOKING & REGISTRATION EVENT SCHEMAS
# =============================================================================

class BookingRequestedEvent(BaseXAPIEvent):
    """Schema for booking.requested events."""
    
    @validator('verb')
    def validate_verb(cls, v):
        if v.id != XAPIVerb.ASKED:
            raise ValueError("Booking requested events must use 'asked' verb")
        return v
    
    @validator('context')
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Booking requested events require extensions")
        
        required_extensions = [
            'http://nlj.platform/extensions/booking_id',
            'http://nlj.platform/extensions/registration_method'
        ]
        
        for ext in required_extensions:
            if ext not in v.extensions:
                raise ValueError(f"Missing required extension: {ext}")
        
        return v


class BookingConfirmedEvent(BaseXAPIEvent):
    """Schema for booking.confirmed events."""
    
    @validator('verb')
    def validate_verb(cls, v):
        if v.id != XAPIVerb.REGISTERED:
            raise ValueError("Booking confirmed events must use 'registered' verb")
        return v


class BookingWaitlistedEvent(BaseXAPIEvent):
    """Schema for booking.waitlisted events."""
    
    @validator('verb')
    def validate_verb(cls, v):
        if v.id != XAPIVerb.WAITLISTED:
            raise ValueError("Booking waitlisted events must use 'waitlisted' verb")
        return v
    
    @validator('context')
    def validate_context(cls, v):
        if not v.extensions:
            raise ValueError("Booking waitlisted events require extensions")
        
        # Must have waitlist position
        if 'http://nlj.platform/extensions/waitlist_position' not in v.extensions:
            raise ValueError("Missing required extension: waitlist_position")
        
        position = v.extensions['http://nlj.platform/extensions/waitlist_position']
        if not isinstance(position, int) or position <= 0:
            raise ValueError("Waitlist position must be positive integer")
        
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