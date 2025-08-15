"""
FastStream event handlers for training system events.
Converts existing training event handlers to FastStream subscribers.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import UUID

from faststream import Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.brokers.kafka_broker import broker
from app.core.database_manager import db_manager
from app.models.training_program import (
    AttendanceRecord,
    TrainingBooking,
    TrainingProgram,
    TrainingSession,
)
from app.services.elasticsearch_service import get_elasticsearch_service, ElasticsearchService

logger = logging.getLogger(__name__)


class XAPIEvent(BaseModel):
    """Base xAPI event structure for validation"""
    id: str
    version: str = "1.0.3"
    timestamp: str
    actor: Dict[str, Any]
    verb: Dict[str, Any]
    object: Dict[str, Any]
    result: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)


async def get_db_session() -> AsyncSession:
    """Get database session for dependency injection"""
    await db_manager.ensure_initialized()
    return db_manager.get_session()


async def log_event_processing(
    db: AsyncSession, 
    event_id: str, 
    event_type: str, 
    status: str
) -> None:
    """Log event processing for monitoring"""
    logger.info(f"Event {event_id} ({event_type}): {status}")


# =========================================================================
# TRAINING PROGRAM HANDLERS
# =========================================================================

@broker.subscriber("nlj.training.programs", group_id="nlj-training-programs")
async def handle_program_events(
    event: XAPIEvent,
    db: AsyncSession = Depends(get_db_session),
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> None:
    """Handle training program lifecycle events"""
    
    try:
        verb_id = event.verb["id"]
        
        if verb_id == "http://adlnet.gov/expapi/verbs/authored":
            await _process_program_created(event, db)
        elif verb_id == "http://adlnet.gov/expapi/verbs/shared":
            await _process_program_published(event, db)
        else:
            logger.warning(f"Unhandled program verb: {verb_id}")
            return
        
        # Store xAPI statement for analytics
        await elasticsearch_service.store_xapi_statement(event.dict())
        
        await log_event_processing(db, event.id, "training.program", "success")
        
    except Exception as e:
        logger.error(f"Error processing program event {event.id}: {e}")
        await log_event_processing(db, event.id, "training.program", f"error: {e}")
        raise
    finally:
        if db:
            await db.close()


async def _process_program_created(event: XAPIEvent, db: AsyncSession) -> None:
    """Process program.created event - create database record"""
    
    # Extract program data from xAPI event
    program_id = event.object["id"].split("/")[-1]
    program_name = event.object["definition"]["name"]["en-US"]
    program_description = event.object["definition"]["description"]["en-US"]
    creator_id = event.actor["account"]["name"]
    
    # Get learning objectives and prerequisites from extensions
    extensions = event.context.get("extensions", {})
    learning_objectives = extensions.get("http://nlj.platform/extensions/learning_objectives", [])
    prerequisites = extensions.get("http://nlj.platform/extensions/prerequisites", [])
    
    # Create program record
    program = TrainingProgram(
        id=UUID(program_id),
        title=program_name,
        description=program_description,
        learning_objectives=learning_objectives,
        prerequisites=([UUID(p) for p in prerequisites] if prerequisites else None),
        created_by_id=UUID(creator_id),
        is_published=False,  # Programs start as unpublished
    )
    
    db.add(program)
    await db.commit()
    
    logger.info(f"Created program from event: {program_id}")


async def _process_program_published(event: XAPIEvent, db: AsyncSession) -> None:
    """Process program.published event - update program status"""
    
    program_id = UUID(event.object["id"].split("/")[-1])
    
    # Update program to published status
    program = await db.get(TrainingProgram, program_id)
    if program:
        program.is_published = True
        program.published_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(f"Published program: {program_id}")
    else:
        logger.error(f"Program not found for publishing: {program_id}")


# =========================================================================
# TRAINING SESSION HANDLERS
# =========================================================================

@broker.subscriber("nlj.training.sessions", group_id="nlj-training-sessions")
async def handle_session_events(
    event: XAPIEvent,
    db: AsyncSession = Depends(get_db_session),
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> None:
    """Handle training session lifecycle events"""
    
    try:
        verb_id = event.verb["id"]
        
        if verb_id == "http://activitystrea.ms/schema/1.0/schedule":
            await _process_session_scheduled(event, db)
        elif verb_id == "http://adlnet.gov/expapi/verbs/voided":
            await _process_session_cancelled(event, db)
        else:
            logger.warning(f"Unhandled session verb: {verb_id}")
            return
        
        # Store xAPI statement for analytics
        await elasticsearch_service.store_xapi_statement(event.dict())
        
        await log_event_processing(db, event.id, "training.session", "success")
        
    except Exception as e:
        logger.error(f"Error processing session event {event.id}: {e}")
        await log_event_processing(db, event.id, "training.session", f"error: {e}")
        raise
    finally:
        if db:
            await db.close()


async def _process_session_scheduled(event: XAPIEvent, db: AsyncSession) -> None:
    """Process session.scheduled event - create session record"""
    
    # Extract session data from xAPI event
    session_id = event.object["id"].split("/")[-1]
    session_name = event.object["definition"]["name"]["en-US"]
    
    extensions = event.context.get("extensions", {})
    program_id = UUID(extensions["http://nlj.platform/extensions/program_id"])
    start_time = datetime.fromisoformat(extensions["http://nlj.platform/extensions/start_time"])
    end_time = datetime.fromisoformat(extensions["http://nlj.platform/extensions/end_time"])
    location = extensions.get("http://nlj.platform/extensions/location", "")
    max_capacity = extensions.get("http://nlj.platform/extensions/max_capacity", 20)
    instructor_id = UUID(extensions["http://nlj.platform/extensions/instructor_id"])
    
    # Create session record
    session = TrainingSession(
        id=UUID(session_id),
        program_id=program_id,
        title=session_name,
        start_time=start_time,
        end_time=end_time,
        location=location,
        max_capacity=max_capacity,
        instructor_id=instructor_id,
        is_cancelled=False,
    )
    
    db.add(session)
    await db.commit()
    
    logger.info(f"Scheduled session from event: {session_id}")


async def _process_session_cancelled(event: XAPIEvent, db: AsyncSession) -> None:
    """Process session.cancelled event - update session status"""
    
    session_id = UUID(event.object["id"].split("/")[-1])
    
    # Update session to cancelled status
    session = await db.get(TrainingSession, session_id)
    if session:
        session.is_cancelled = True
        session.cancelled_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(f"Cancelled session: {session_id}")
    else:
        logger.error(f"Session not found for cancellation: {session_id}")


# =========================================================================
# TRAINING BOOKING HANDLERS
# =========================================================================

@broker.subscriber("nlj.training.bookings", group_id="nlj-training-bookings")
async def handle_booking_events(
    event: XAPIEvent,
    db: AsyncSession = Depends(get_db_session),
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> None:
    """Handle training booking lifecycle events"""
    
    try:
        verb_id = event.verb["id"]
        
        if verb_id == "http://adlnet.gov/expapi/verbs/registered":
            await _process_booking_requested(event, db)
        elif verb_id == "http://adlnet.gov/expapi/verbs/voided":
            await _process_booking_cancelled(event, db)
        elif verb_id == "http://nlj.platform/verbs/checked-in":
            await _process_attendance_checked_in(event, db)
        elif verb_id == "http://adlnet.gov/expapi/verbs/completed":
            await _process_attendance_completed(event, db)
        else:
            logger.warning(f"Unhandled booking verb: {verb_id}")
            return
        
        # Store xAPI statement for analytics
        await elasticsearch_service.store_xapi_statement(event.dict())
        
        await log_event_processing(db, event.id, "training.booking", "success")
        
    except Exception as e:
        logger.error(f"Error processing booking event {event.id}: {e}")
        await log_event_processing(db, event.id, "training.booking", f"error: {e}")
        raise
    finally:
        if db:
            await db.close()


async def _process_booking_requested(event: XAPIEvent, db: AsyncSession) -> None:
    """Process booking.requested event - create booking record"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    learner_id = UUID(event.actor["account"]["name"])
    
    # Create booking record
    booking = TrainingBooking(
        session_id=session_id,
        learner_id=learner_id,
        status="confirmed",  # Simplified - would have waitlist logic in real implementation
        registered_at=datetime.now(timezone.utc),
    )
    
    db.add(booking)
    await db.commit()
    
    logger.info(f"Created booking: session={session_id}, learner={learner_id}")


async def _process_booking_cancelled(event: XAPIEvent, db: AsyncSession) -> None:
    """Process booking.cancelled event - update booking status"""
    
    extensions = event.context.get("extensions", {})
    booking_id = UUID(extensions["http://nlj.platform/extensions/booking_id"])
    
    # Update booking to cancelled status
    booking = await db.get(TrainingBooking, booking_id)
    if booking:
        booking.status = "cancelled"
        booking.cancelled_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(f"Cancelled booking: {booking_id}")
    else:
        logger.error(f"Booking not found for cancellation: {booking_id}")


async def _process_attendance_checked_in(event: XAPIEvent, db: AsyncSession) -> None:
    """Process attendance.checked_in event - create attendance record"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    learner_id = UUID(event.actor["account"]["name"])
    
    # Create or update attendance record
    attendance = AttendanceRecord(
        session_id=session_id,
        learner_id=learner_id,
        checked_in_at=datetime.now(timezone.utc),
        status="checked_in"
    )
    
    db.add(attendance)
    await db.commit()
    
    logger.info(f"Checked in: session={session_id}, learner={learner_id}")


async def _process_attendance_completed(event: XAPIEvent, db: AsyncSession) -> None:
    """Process attendance.completed event - update attendance record"""
    
    extensions = event.context.get("extensions", {})
    session_id = UUID(extensions["http://nlj.platform/extensions/session_id"])
    learner_id = UUID(event.actor["account"]["name"])
    
    # Find and update attendance record
    from sqlalchemy import select
    
    result = await db.execute(
        select(AttendanceRecord).where(
            and_(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.learner_id == learner_id
            )
        )
    )
    attendance = result.scalar_one_or_none()
    
    if attendance:
        attendance.status = "completed"
        attendance.completed_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(f"Completed attendance: session={session_id}, learner={learner_id}")
    else:
        logger.error(f"Attendance record not found: session={session_id}, learner={learner_id}")


logger.info("Training event handlers registered with FastStream")