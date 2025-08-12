"""
Event consumers for training scheduling system.
Uses FastAPI BackgroundTasks for async event processing.
Implements business logic based on published xAPI events.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select, func

from app.core.database_manager import db_manager
from app.models.training_program import (
    TrainingProgram, TrainingSession, TrainingBooking, 
    AttendanceRecord, XAPIEventLog
)
from app.models.user import User
from app.services.kafka_service import get_xapi_event_service, XAPIEventService

logger = logging.getLogger(__name__)


class EventConsumerService:
    """
    Main event consumer service using FastAPI BackgroundTasks.
    Processes xAPI events and updates database state accordingly.
    """

    def __init__(self):
        self.xapi_service: Optional[XAPIEventService] = None

    async def _get_xapi_service(self) -> XAPIEventService:
        """Get xAPI service instance."""
        if not self.xapi_service:
            self.xapi_service = await get_xapi_event_service()
        return self.xapi_service

    # =========================================================================
    # PROGRAM LIFECYCLE EVENT HANDLERS
    # =========================================================================

    async def handle_program_created_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle program.created event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_program_created,
            event_data
        )

    async def _process_program_created(self, event_data: Dict[str, Any]) -> None:
        """Process program created event - create database record."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract program data from xAPI event
                program_id = event_data["object"]["id"].split("/")[-1]
                program_name = event_data["object"]["definition"]["name"]["en-US"]
                program_description = event_data["object"]["definition"]["description"]["en-US"]
                creator_id = event_data["actor"]["account"]["name"]
                
                # Get learning objectives and prerequisites from extensions
                extensions = event_data["context"]["extensions"]
                learning_objectives = extensions.get("http://nlj.platform/extensions/learning_objectives", [])
                prerequisites = extensions.get("http://nlj.platform/extensions/prerequisites", [])

                # Create program record
                program = TrainingProgram(
                    id=UUID(program_id),
                    title=program_name,
                    description=program_description,
                    learning_objectives=learning_objectives,
                    prerequisites=[UUID(p) for p in prerequisites] if prerequisites else None,
                    created_by_id=UUID(creator_id),
                    is_published=False  # Programs start as unpublished
                )

                db.add(program)
                await db.commit()

                # Log successful processing
                await self._log_event_processing(
                    db, event_data["id"], "program.created", "success"
                )

                logger.info(f"Created program from event: {program_id}")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process program.created event: {e}")
            # Log failed processing
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "program.created", "failed", str(e)
                )
            finally:
                await db.close()

    async def handle_program_published_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle program.published event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_program_published,
            event_data
        )

    async def _process_program_published(self, event_data: Dict[str, Any]) -> None:
        """Process program published event - update database record."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                program_id = event_data["object"]["id"].split("/")[-1]
                
                # Update program to published status
                stmt = select(TrainingProgram).where(TrainingProgram.id == UUID(program_id))
                result = await db.execute(stmt)
                program = result.scalar_one_or_none()
                
                if program:
                    program.is_published = True
                    await db.commit()
                    
                    logger.info(f"Published program from event: {program_id}")
                else:
                    logger.warning(f"Program not found for publish event: {program_id}")

                # Log processing
                await self._log_event_processing(
                    db, event_data["id"], "program.published", "success"
                )
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process program.published event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "program.published", "failed", str(e)
                )
            finally:
                await db.close()

    # =========================================================================
    # SESSION LIFECYCLE EVENT HANDLERS
    # =========================================================================

    async def handle_session_scheduled_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle session.scheduled event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_session_scheduled,
            event_data
        )

    async def _process_session_scheduled(self, event_data: Dict[str, Any]) -> None:
        """Process session scheduled event - create session record."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract session data from xAPI event
                session_id = event_data["object"]["id"].split("/")[-1]
                session_title = event_data["object"]["definition"]["name"]["en-US"]
                scheduler_id = event_data["actor"]["account"]["name"]
                
                extensions = event_data["context"]["extensions"]
                program_id = extensions["http://nlj.platform/extensions/program_id"]
                start_time_str = extensions["http://nlj.platform/extensions/start_time"]
                end_time_str = extensions["http://nlj.platform/extensions/end_time"]
                location = extensions.get("http://nlj.platform/extensions/location", "")
                capacity = extensions["http://nlj.platform/extensions/capacity"]
                instructor_id = extensions.get("http://nlj.platform/extensions/instructor_id")

                # Parse datetime strings
                start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
                end_time = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))

                # Create session record
                session = TrainingSession(
                    id=UUID(session_id),
                    program_id=UUID(program_id),
                    start_time=start_time,
                    end_time=end_time,
                    location=location or None,
                    capacity=capacity,
                    instructor_id=UUID(instructor_id) if instructor_id else None,
                    status="scheduled"
                )

                db.add(session)
                await db.commit()

                # Log successful processing
                await self._log_event_processing(
                    db, event_data["id"], "session.scheduled", "success"
                )

                logger.info(f"Created session from event: {session_id}")

                # Check for scheduling conflicts (publish conflict event if needed)
                await self._check_scheduling_conflicts(session_id, start_time, end_time, location)
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process session.scheduled event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "session.scheduled", "failed", str(e)
                )
            finally:
                await db.close()

    # =========================================================================
    # BOOKING & REGISTRATION EVENT HANDLERS
    # =========================================================================

    async def handle_booking_requested_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle booking.requested event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_booking_requested,
            event_data
        )

    async def _process_booking_requested(self, event_data: Dict[str, Any]) -> None:
        """Process booking requested event - check capacity and confirm/waitlist."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract booking data
                session_id = event_data["object"]["id"].split("/")[-1]
                learner_id = event_data["actor"]["account"]["name"]
                learner_name = event_data["actor"]["name"]
                learner_email = event_data["actor"]["mbox"].replace("mailto:", "")
                
                extensions = event_data["context"]["extensions"]
                booking_id = extensions["http://nlj.platform/extensions/booking_id"]
                registration_method = extensions["http://nlj.platform/extensions/registration_method"]
                special_requirements = extensions.get("http://nlj.platform/extensions/special_requirements", {})

                # Get session and check capacity
                stmt = select(TrainingSession).where(TrainingSession.id == UUID(session_id))
                result = await db.execute(stmt)
                session = result.scalar_one_or_none()

                if not session:
                    logger.error(f"Session not found for booking: {session_id}")
                    return

                # Check current bookings
                booking_count_stmt = select(func.count(TrainingBooking.id)).where(
                    and_(
                        TrainingBooking.session_id == UUID(session_id),
                        TrainingBooking.booking_status.in_(["confirmed", "pending"])
                    )
                )
                count_result = await db.execute(booking_count_stmt)
                current_bookings = count_result.scalar() or 0

                # Determine booking status
                if current_bookings < session.capacity:
                    booking_status = "confirmed"
                    is_waitlisted = False
                    waitlist_position = None
                    logger.info(f"Booking confirmed for learner {learner_id} in session {session_id}")
                else:
                    booking_status = "waitlist"
                    is_waitlisted = True
                    
                    # Get waitlist position
                    waitlist_count_stmt = select(func.count(TrainingBooking.id)).where(
                        and_(
                            TrainingBooking.session_id == UUID(session_id),
                            TrainingBooking.booking_status == "waitlist"
                        )
                    )
                    waitlist_count_result = await db.execute(waitlist_count_stmt)
                    waitlist_position = (waitlist_count_result.scalar() or 0) + 1
                    logger.info(f"Booking waitlisted for learner {learner_id} in session {session_id} at position {waitlist_position}")

                # Create booking record
                booking = TrainingBooking(
                    id=UUID(booking_id),
                    program_id=session.program_id,
                    session_id=UUID(session_id),
                    learner_id=UUID(learner_id),
                    registration_method=registration_method,
                    booking_status=booking_status,
                    is_waitlisted=is_waitlisted,
                    waitlist_position=waitlist_position,
                    special_requirements=special_requirements if special_requirements else None
                )

                db.add(booking)
                await db.commit()

                # Log successful processing
                await self._log_event_processing(
                    db, event_data["id"], "booking.requested", "success"
                )

                logger.info(f"Processed booking request: {booking_id} -> {booking_status}")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process booking.requested event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "booking.requested", "failed", str(e)
                )
            finally:
                await db.close()

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    async def _check_scheduling_conflicts(
        self, 
        session_id: str, 
        start_time: datetime, 
        end_time: datetime, 
        location: Optional[str]
    ) -> None:
        """Check for scheduling conflicts and publish conflict events if found."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Check for time/location conflicts
                conflict_conditions = [
                    TrainingSession.status == "scheduled",
                    TrainingSession.id != UUID(session_id),
                    # Time overlap conditions
                    and_(
                        TrainingSession.start_time < end_time,
                        TrainingSession.end_time > start_time
                    )
                ]

                if location:
                    conflict_conditions.append(TrainingSession.location == location)

                stmt = select(TrainingSession).where(and_(*conflict_conditions))
                result = await db.execute(stmt)
                conflicts = result.scalars().all()

                if conflicts:
                    # Publish conflict detection event
                    logger.warning(f"Scheduling conflicts detected for session {session_id}")
                    
                    from uuid import uuid4
                    conflict_id = str(uuid4())
                    conflicting_session_ids = [str(c.id) for c in conflicts]
                    
                    conflict_details = {
                        "new_session_time": f"{start_time.isoformat()} - {end_time.isoformat()}",
                        "new_session_location": location,
                        "conflicting_sessions": [
                            {
                                "session_id": str(c.id),
                                "time": f"{c.start_time.isoformat()} - {c.end_time.isoformat()}",
                                "location": c.location
                            } for c in conflicts
                        ]
                    }
                    
                    xapi_service = await self._get_xapi_service()
                    await xapi_service.publish_scheduling_conflict_detected(
                        conflict_id=conflict_id,
                        session_id=session_id,
                        conflicting_session_ids=conflicting_session_ids,
                        conflict_type="time_overlap" if not location else "location_conflict",
                        conflict_details=conflict_details
                    )
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to check scheduling conflicts: {e}")

    async def _log_event_processing(
        self,
        db: AsyncSession,
        event_id: str,
        event_type: str,
        status: str,
        error_message: Optional[str] = None
    ) -> None:
        """Log event processing status to XAPIEventLog."""
        
        try:
            # Simple logging without database constraints for now
            logger.info(f"Event {event_id} of type {event_type}: {status}")
            if error_message:
                logger.error(f"Event processing error: {error_message}")
            
        except Exception as e:
            logger.error(f"Failed to log event processing: {e}")

    # =========================================================================
    # CANCELLATION EVENT HANDLERS
    # =========================================================================

    async def handle_session_cancelled_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle session.cancelled event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_session_cancelled,
            event_data
        )

    async def _process_session_cancelled(self, event_data: Dict[str, Any]) -> None:
        """Process session cancelled event - update session status and notify learners."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract cancellation data
                session_id = event_data["object"]["id"].split("/")[-1]
                extensions = event_data["context"]["extensions"]
                cancellation_reason = extensions.get("http://nlj.platform/extensions/cancellation_reason", "")
                cancelled_at_str = extensions.get("http://nlj.platform/extensions/cancelled_at", "")
                
                # Parse cancellation datetime
                cancelled_at = datetime.fromisoformat(cancelled_at_str.replace("Z", "+00:00"))
                
                # Update session status
                stmt = select(TrainingSession).where(TrainingSession.id == UUID(session_id))
                result = await db.execute(stmt)
                session = result.scalar_one_or_none()
                
                if session:
                    session.status = "cancelled"
                    session.cancelled_at = cancelled_at
                    session.cancellation_reason = cancellation_reason
                    await db.commit()
                    
                    logger.info(f"Cancelled session from event: {session_id}")
                    
                    # Log successful processing
                    await self._log_event_processing(
                        db, event_data["id"], "session.cancelled", "success"
                    )
                else:
                    logger.warning(f"Session not found for cancellation event: {session_id}")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process session.cancelled event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "session.cancelled", "failed", str(e)
                )
            finally:
                await db.close()

    async def handle_booking_cancelled_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle booking.cancelled event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_booking_cancelled,
            event_data
        )

    async def _process_booking_cancelled(self, event_data: Dict[str, Any]) -> None:
        """Process booking cancelled event - update booking status and handle waitlist promotion."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract booking data
                session_id = event_data["object"]["id"].split("/")[-1]
                learner_id = event_data["actor"]["account"]["name"]
                extensions = event_data["context"]["extensions"]
                booking_id = extensions["http://nlj.platform/extensions/booking_id"]
                cancellation_reason = extensions.get("http://nlj.platform/extensions/cancellation_reason", "")
                
                # Update booking status
                stmt = select(TrainingBooking).where(TrainingBooking.id == UUID(booking_id))
                result = await db.execute(stmt)
                booking = result.scalar_one_or_none()
                
                if booking:
                    booking.booking_status = "cancelled"
                    booking.cancellation_reason = cancellation_reason
                    booking.cancelled_at = datetime.now(timezone.utc)
                    await db.commit()
                    
                    logger.info(f"Cancelled booking from event: {booking_id}")
                    
                    # TODO: Handle waitlist promotion logic here
                    # If this was a confirmed booking, promote first waitlisted person
                    
                    # Log successful processing
                    await self._log_event_processing(
                        db, event_data["id"], "booking.cancelled", "success"
                    )
                else:
                    logger.warning(f"Booking not found for cancellation event: {booking_id}")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process booking.cancelled event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "booking.cancelled", "failed", str(e)
                )
            finally:
                await db.close()

    # =========================================================================
    # ATTENDANCE EVENT HANDLERS
    # =========================================================================

    async def handle_attendance_checked_in_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle attendance.checked_in event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_attendance_checked_in,
            event_data
        )

    async def _process_attendance_checked_in(self, event_data: Dict[str, Any]) -> None:
        """Process attendance check-in event - create attendance record."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract attendance data
                session_id = event_data["object"]["id"].split("/")[-1]
                learner_id = event_data["actor"]["account"]["name"]
                extensions = event_data["context"]["extensions"]
                check_in_time_str = extensions["http://nlj.platform/extensions/check_in_time"]
                check_in_method = extensions.get("http://nlj.platform/extensions/check_in_method", "manual")
                
                # Parse check-in time
                check_in_time = datetime.fromisoformat(check_in_time_str.replace("Z", "+00:00"))
                
                # Create or update attendance record
                stmt = select(AttendanceRecord).where(
                    and_(
                        AttendanceRecord.session_id == UUID(session_id),
                        AttendanceRecord.learner_id == UUID(learner_id)
                    )
                )
                result = await db.execute(stmt)
                attendance = result.scalar_one_or_none()
                
                if not attendance:
                    attendance = AttendanceRecord(
                        session_id=UUID(session_id),
                        learner_id=UUID(learner_id),
                        check_in_time=check_in_time,
                        check_in_method=check_in_method,
                        status="checked_in"
                    )
                    db.add(attendance)
                else:
                    attendance.check_in_time = check_in_time
                    attendance.check_in_method = check_in_method
                    attendance.status = "checked_in"
                
                await db.commit()
                logger.info(f"Processed check-in for learner {learner_id} in session {session_id}")
                
                # Log successful processing
                await self._log_event_processing(
                    db, event_data["id"], "attendance.checked_in", "success"
                )
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process attendance.checked_in event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "attendance.checked_in", "failed", str(e)
                )
            finally:
                await db.close()

    async def handle_attendance_completed_event(
        self,
        event_data: Dict[str, Any],
        background_tasks: BackgroundTasks
    ) -> None:
        """Handle attendance.completed event via BackgroundTask."""
        
        background_tasks.add_task(
            self._process_attendance_completed,
            event_data
        )

    async def _process_attendance_completed(self, event_data: Dict[str, Any]) -> None:
        """Process attendance completion event - update attendance record with completion data."""
        
        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract attendance data
                session_id = event_data["object"]["id"].split("/")[-1]
                learner_id = event_data["actor"]["account"]["name"]
                result_data = event_data.get("result", {})
                extensions = event_data["context"]["extensions"]
                
                completion_percentage = extensions.get("http://nlj.platform/extensions/completion_percentage", 0.0)
                duration_minutes = extensions.get("http://nlj.platform/extensions/duration_minutes", 0)
                completion = result_data.get("completion", False)
                score = result_data.get("score", {}).get("scaled") if result_data.get("score") else None
                
                # Update attendance record
                stmt = select(AttendanceRecord).where(
                    and_(
                        AttendanceRecord.session_id == UUID(session_id),
                        AttendanceRecord.learner_id == UUID(learner_id)
                    )
                )
                result = await db.execute(stmt)
                attendance = result.scalar_one_or_none()
                
                if attendance:
                    attendance.completion_percentage = completion_percentage
                    attendance.duration_minutes = duration_minutes
                    attendance.completed = completion
                    attendance.score = score
                    attendance.status = "completed" if completion else "partial"
                    attendance.completion_time = datetime.now(timezone.utc)
                    
                    await db.commit()
                    logger.info(f"Processed completion for learner {learner_id} in session {session_id}: {completion_percentage}%")
                    
                    # Log successful processing
                    await self._log_event_processing(
                        db, event_data["id"], "attendance.completed", "success"
                    )
                else:
                    logger.warning(f"Attendance record not found for completion event: {session_id}:{learner_id}")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process attendance.completed event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db, event_data.get("id", "unknown"), "attendance.completed", "failed", str(e)
                )
            finally:
                await db.close()


# Global event consumer instance
event_consumer = EventConsumerService()


# Helper functions for easy use in APIs
async def consume_program_created_event(
    event_data: Dict[str, Any], 
    background_tasks: BackgroundTasks
) -> None:
    """Consume program created event."""
    await event_consumer.handle_program_created_event(event_data, background_tasks)


async def consume_program_published_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Consume program published event."""
    await event_consumer.handle_program_published_event(event_data, background_tasks)


async def consume_session_scheduled_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Consume session scheduled event."""
    await event_consumer.handle_session_scheduled_event(event_data, background_tasks)


async def consume_booking_requested_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Consume booking requested event."""
    await event_consumer.handle_booking_requested_event(event_data, background_tasks)


# Cancellation event consumers
async def consume_session_cancelled_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Consume session cancelled event."""
    await event_consumer.handle_session_cancelled_event(event_data, background_tasks)


async def consume_booking_cancelled_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Consume booking cancelled event."""
    await event_consumer.handle_booking_cancelled_event(event_data, background_tasks)


# Attendance event consumers
async def consume_attendance_checked_in_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Consume attendance checked-in event."""
    await event_consumer.handle_attendance_checked_in_event(event_data, background_tasks)


async def consume_attendance_completed_event(
    event_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> None:
    """Consume attendance completed event."""
    await event_consumer.handle_attendance_completed_event(event_data, background_tasks)