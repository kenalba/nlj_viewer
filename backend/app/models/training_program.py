"""
Training Program models for the restructured training system.
Training Programs are templates that define what to train.
Training Sessions are scheduled instances of programs that define when/where to train.
"""

from uuid import uuid4

from sqlalchemy import ARRAY, JSON, BigInteger, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TrainingProgram(Base):
    """
    Training program template that defines WHAT to train.
    Contains curriculum-level information that applies to all sessions of this program.
    """

    __tablename__ = "training_programs"

    # Primary identifiers
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Program curriculum configuration
    duration_minutes = Column(Integer, nullable=False, default=120, comment="Standard program duration")
    learning_objectives = Column(ARRAY(String), nullable=True, comment="Learning objectives for this program")

    # Prerequisites and content links
    prerequisites = Column(ARRAY(UUID(as_uuid=True)), nullable=True, comment="Required content completion UUIDs")
    content_items = Column(ARRAY(UUID(as_uuid=True)), nullable=True, comment="Related NLJ content item UUIDs")

    # Instructor requirements (not specific instructors, but qualifications needed)
    instructor_requirements = Column(JSON, nullable=True, comment="Required instructor qualifications")

    # Approval and workflow settings
    requires_approval = Column(Boolean, default=False, comment="Requires manager approval for enrollment")
    auto_approve = Column(Boolean, default=True, comment="Automatically approve eligible learners")

    # Status tracking
    is_active = Column(Boolean, default=True, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False, comment="Published to learners")

    # Metadata
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_programs")
    sessions = relationship("TrainingSession", back_populates="program", cascade="all, delete-orphan")
    bookings = relationship("TrainingBooking", back_populates="program", cascade="all, delete-orphan")


class TrainingSession(Base):
    """
    Specific scheduled instances of a training program that define WHEN/WHERE to train.
    Each session represents a scheduled occurrence with specific date/time/location/instructor.
    """

    __tablename__ = "training_sessions"

    # Primary identifiers
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    program_id = Column(UUID(as_uuid=True), ForeignKey("training_programs.id"), nullable=False)

    # Scheduling details
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String(50), nullable=False, default="UTC")

    # Session-specific configuration
    location = Column(String(255), nullable=True, comment="Session location/venue")
    location_details = Column(JSON, nullable=True, comment="Additional location metadata (address, room, etc.)")
    location_override = Column(String(255), nullable=True, comment="Override location if different from main location")
    capacity = Column(Integer, nullable=False, default=20, comment="Maximum attendees for this session")

    # Instructor assignment
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Session-specific details
    session_notes = Column(Text, nullable=True, comment="Notes specific to this session")
    max_attendees = Column(Integer, nullable=True, comment="Override capacity for this specific session")

    # Legacy Cal.com fields (kept for backwards compatibility)
    cal_booking_id = Column(BigInteger, nullable=True, unique=True, comment="Legacy Cal.com booking ID")
    cal_booking_uid = Column(String(255), nullable=True, unique=True, comment="Legacy Cal.com booking UID")

    # Status tracking
    status = Column(
        String(30), nullable=False, default="scheduled", index=True
    )  # scheduled, confirmed, cancelled, completed
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    # Attendance tracking
    attendance_taken = Column(Boolean, default=False, nullable=False)
    attendance_taken_at = Column(DateTime(timezone=True), nullable=True)
    attendance_taken_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    program = relationship("TrainingProgram", back_populates="sessions")
    instructor = relationship("User", foreign_keys=[instructor_id], back_populates="instructor_sessions")
    bookings = relationship("TrainingBooking", back_populates="session", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    attendance_taken_by = relationship("User", foreign_keys=[attendance_taken_by_id])


class TrainingBooking(Base):
    """
    Individual learner bookings for training sessions.
    Links learners to specific scheduled sessions (not just programs).
    """

    __tablename__ = "training_bookings"

    # Primary identifiers
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    program_id = Column(UUID(as_uuid=True), ForeignKey("training_programs.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("training_sessions.id"), nullable=False)
    learner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Legacy Cal.com fields (kept for backwards compatibility)
    cal_booking_id = Column(BigInteger, nullable=True, comment="Legacy Cal.com booking ID")
    cal_attendee_id = Column(BigInteger, nullable=True, comment="Legacy Cal.com attendee ID")

    # Booking details
    registration_method = Column(String(30), nullable=False, default="online")  # online, admin, import
    booking_status = Column(
        String(30), nullable=False, default="confirmed", index=True
    )  # confirmed, cancelled, no_show, waitlist

    # Waitlist management
    is_waitlisted = Column(Boolean, default=False, nullable=False)
    waitlist_position = Column(Integer, nullable=True, comment="Position on waitlist")
    waitlist_notified = Column(Boolean, default=False, comment="Notified when slot becomes available")

    # Registration metadata
    registration_notes = Column(Text, nullable=True, comment="Notes from learner during registration")
    special_requirements = Column(JSON, nullable=True, comment="Special accommodations or requirements")

    # Confirmation and reminders
    confirmation_sent = Column(Boolean, default=False, nullable=False)
    confirmation_sent_at = Column(DateTime(timezone=True), nullable=True)
    reminder_count = Column(Integer, default=0, nullable=False)
    last_reminder_sent = Column(DateTime(timezone=True), nullable=True)

    # Cancellation
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    cancellation_reason = Column(String(100), nullable=True)  # learner, admin, system, no_show

    # Metadata
    registered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    program = relationship("TrainingProgram", back_populates="bookings")
    session = relationship("TrainingSession", back_populates="bookings")
    learner = relationship("User", foreign_keys=[learner_id], back_populates="training_bookings")
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])
    attendance_record = relationship("AttendanceRecord", back_populates="booking", uselist=False)


class AttendanceRecord(Base):
    """
    Attendance tracking for training sessions.
    Records actual attendance, participation, and completion.
    """

    __tablename__ = "attendance_records"

    # Primary identifiers
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("training_sessions.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("training_bookings.id"), nullable=False)
    learner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Attendance details
    attended = Column(Boolean, nullable=False, default=False)
    check_in_time = Column(DateTime(timezone=True), nullable=True)
    check_out_time = Column(DateTime(timezone=True), nullable=True)
    attendance_method = Column(String(20), nullable=False, default="in_person")  # in_person, virtual, hybrid

    # Participation tracking
    participation_score = Column(Float, nullable=True, comment="Participation score 0.0-1.0")
    engagement_notes = Column(Text, nullable=True, comment="Notes about learner engagement")

    # Completion and assessment
    completed = Column(Boolean, default=False, nullable=False)
    completion_time = Column(DateTime(timezone=True), nullable=True)
    assessment_score = Column(Float, nullable=True, comment="Assessment score if applicable")
    certificate_issued = Column(Boolean, default=False, nullable=False)
    certificate_issued_at = Column(DateTime(timezone=True), nullable=True)

    # Instructor feedback
    instructor_notes = Column(Text, nullable=True, comment="Instructor notes about this learner")
    follow_up_required = Column(Boolean, default=False, comment="Requires follow-up training or coaching")
    follow_up_notes = Column(Text, nullable=True)

    # Metadata
    recorded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    session = relationship("TrainingSession", back_populates="attendance_records")
    booking = relationship("TrainingBooking", back_populates="attendance_record")
    learner = relationship("User", foreign_keys=[learner_id], back_populates="attendance_records")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])


class XAPIEventLog(Base):
    """
    Log of xAPI events published to Kafka for training programs and sessions.
    Provides audit trail and prevents duplicate event publishing.
    """

    __tablename__ = "xapi_event_log"

    # Primary identifiers
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    event_id = Column(String(255), nullable=False, unique=True, comment="Unique event identifier")

    # Event metadata
    event_type = Column(String(50), nullable=False, index=True)  # scheduled, registered, attended, completed
    kafka_topic = Column(String(100), nullable=False, index=True)

    # Associated entities
    program_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    session_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    booking_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    learner_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # xAPI data
    actor_email = Column(String(255), nullable=True, index=True)
    verb_id = Column(String(255), nullable=False)
    object_id = Column(String(255), nullable=False)

    # Event payload and status
    event_payload = Column(JSON, nullable=False, comment="Full xAPI event payload")
    publish_status = Column(String(20), nullable=False, default="published")  # published, failed, retrying
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Correlation tracking
    correlation_id = Column(String(255), nullable=True, index=True, comment="For tracking related events")

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    last_retry_at = Column(DateTime(timezone=True), nullable=True)
