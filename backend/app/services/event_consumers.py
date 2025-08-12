"""
Event consumers for training scheduling system.
Uses direct async event processing (no FastAPI BackgroundTasks dependency).
Implements business logic based on published xAPI events.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, func, select

# FastAPI BackgroundTasks removed - using direct event processing
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import db_manager
from app.models.generation_session import GenerationSession, GenerationStatus
from app.models.source_document import SourceDocument
from app.models.training_program import (
    AttendanceRecord,
    TrainingBooking,
    TrainingProgram,
    TrainingSession,
)
from app.services.claude_service import claude_service
from app.services.kafka_service import XAPIEventService, get_xapi_event_service

logger = logging.getLogger(__name__)


class EventConsumerService:
    """
    Main event consumer service using direct async processing.
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

    async def handle_program_created_event(self, event_data: Dict[str, Any]) -> None:
        """Handle program.created event via BackgroundTask."""

        await self._process_program_created(event_data)

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
                    prerequisites=([UUID(p) for p in prerequisites] if prerequisites else None),
                    created_by_id=UUID(creator_id),
                    is_published=False,  # Programs start as unpublished
                )

                db.add(program)
                await db.commit()

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "program.created", "success")

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
                    db,
                    event_data.get("id", "unknown"),
                    "program.created",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_program_published_event(self, event_data: Dict[str, Any]) -> None:
        """Handle program.published event via BackgroundTask."""

        await self._process_program_published(event_data)

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
                await self._log_event_processing(db, event_data["id"], "program.published", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process program.published event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "program.published",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    # =========================================================================
    # SESSION LIFECYCLE EVENT HANDLERS
    # =========================================================================

    async def handle_session_scheduled_event(self, event_data: Dict[str, Any]) -> None:
        """Handle session.scheduled event via BackgroundTask."""

        await self._process_session_scheduled(event_data)

    async def _process_session_scheduled(self, event_data: Dict[str, Any]) -> None:
        """Process session scheduled event - create session record."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract session data from xAPI event
                session_id = event_data["object"]["id"].split("/")[-1]
                event_data["object"]["definition"]["name"]["en-US"]
                event_data["actor"]["account"]["name"]

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
                    status="scheduled",
                )

                db.add(session)
                await db.commit()

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "session.scheduled", "success")

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
                    db,
                    event_data.get("id", "unknown"),
                    "session.scheduled",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    # =========================================================================
    # BOOKING & REGISTRATION EVENT HANDLERS
    # =========================================================================

    async def handle_booking_requested_event(self, event_data: Dict[str, Any]) -> None:
        """Handle booking.requested event via BackgroundTask."""

        await self._process_booking_requested(event_data)

    async def _process_booking_requested(self, event_data: Dict[str, Any]) -> None:
        """Process booking requested event - check capacity and confirm/waitlist."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract booking data
                session_id = event_data["object"]["id"].split("/")[-1]
                learner_id = event_data["actor"]["account"]["name"]
                event_data["actor"]["name"]
                event_data["actor"]["mbox"].replace("mailto:", "")

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
                        TrainingBooking.booking_status.in_(["confirmed", "pending"]),
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
                            TrainingBooking.booking_status == "waitlist",
                        )
                    )
                    waitlist_count_result = await db.execute(waitlist_count_stmt)
                    waitlist_position = (waitlist_count_result.scalar() or 0) + 1
                    logger.info(
                        f"Booking waitlisted for learner {learner_id} in session {session_id} at position {waitlist_position}"
                    )

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
                    special_requirements=(special_requirements if special_requirements else None),
                )

                db.add(booking)
                await db.commit()

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "booking.requested", "success")

                logger.info(f"Processed booking request: {booking_id} -> {booking_status}")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process booking.requested event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "booking.requested",
                    "failed",
                    str(e),
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
        location: Optional[str],
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
                        TrainingSession.end_time > start_time,
                    ),
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
                                "location": c.location,
                            }
                            for c in conflicts
                        ],
                    }

                    xapi_service = await self._get_xapi_service()
                    await xapi_service.publish_scheduling_conflict_detected(
                        conflict_id=conflict_id,
                        session_id=session_id,
                        conflicting_session_ids=conflicting_session_ids,
                        conflict_type=("time_overlap" if not location else "location_conflict"),
                        conflict_details=conflict_details,
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
        error_message: Optional[str] = None,
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

    async def handle_session_cancelled_event(self, event_data: Dict[str, Any]) -> None:
        """Handle session.cancelled event via BackgroundTask."""

        await self._process_session_cancelled(event_data)

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
                    await self._log_event_processing(db, event_data["id"], "session.cancelled", "success")
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
                    db,
                    event_data.get("id", "unknown"),
                    "session.cancelled",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_booking_cancelled_event(self, event_data: Dict[str, Any]) -> None:
        """Handle booking.cancelled event via BackgroundTask."""

        await self._process_booking_cancelled(event_data)

    async def _process_booking_cancelled(self, event_data: Dict[str, Any]) -> None:
        """Process booking cancelled event - update booking status and handle waitlist promotion."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract booking data
                event_data["object"]["id"].split("/")[-1]
                event_data["actor"]["account"]["name"]
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
                    await self._log_event_processing(db, event_data["id"], "booking.cancelled", "success")
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
                    db,
                    event_data.get("id", "unknown"),
                    "booking.cancelled",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    # =========================================================================
    # ATTENDANCE EVENT HANDLERS
    # =========================================================================

    async def handle_attendance_checked_in_event(self, event_data: Dict[str, Any]) -> None:
        """Handle attendance.checked_in event via BackgroundTask."""

        await self._process_attendance_checked_in(event_data)

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
                        AttendanceRecord.learner_id == UUID(learner_id),
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
                        status="checked_in",
                    )
                    db.add(attendance)
                else:
                    attendance.check_in_time = check_in_time
                    attendance.check_in_method = check_in_method
                    attendance.status = "checked_in"

                await db.commit()
                logger.info(f"Processed check-in for learner {learner_id} in session {session_id}")

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "attendance.checked_in", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process attendance.checked_in event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "attendance.checked_in",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_attendance_completed_event(self, event_data: Dict[str, Any]) -> None:
        """Handle attendance.completed event via BackgroundTask."""

        await self._process_attendance_completed(event_data)

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
                        AttendanceRecord.learner_id == UUID(learner_id),
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
                    logger.info(
                        f"Processed completion for learner {learner_id} in session {session_id}: {completion_percentage}%"
                    )

                    # Log successful processing
                    await self._log_event_processing(db, event_data["id"], "attendance.completed", "success")
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
                    db,
                    event_data.get("id", "unknown"),
                    "attendance.completed",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    # =========================================================================
    # CONTENT GENERATION EVENT HANDLERS
    # =========================================================================

    async def handle_content_generation_requested_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.requested event directly."""

        await self._process_content_generation_requested(event_data)

    async def _process_content_generation_requested(self, event_data: Dict[str, Any]) -> None:
        """Process content generation requested event - update session status."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract session data from xAPI event
                session_id = event_data["object"]["id"].split("/")[-1]

                # Update session status to PROCESSING
                stmt = select(GenerationSession).where(GenerationSession.id == UUID(session_id))
                result = await db.execute(stmt)
                session = result.scalar_one_or_none()

                if session:
                    session.status = GenerationStatus.PROCESSING
                    await db.commit()
                    logger.info(f"Updated generation session {session_id} to PROCESSING status")

                    # Trigger started event
                    await self._publish_content_generation_started_event(session_id, session.user_id)
                else:
                    logger.warning(f"Generation session not found: {session_id}")

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.requested", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.requested event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.requested",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_content_generation_started_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.started event directly."""

        await self._process_content_generation_started(event_data)

    async def _process_content_generation_started(self, event_data: Dict[str, Any]) -> None:
        """Process content generation started event - begin Claude API generation."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract session data
                session_id = event_data["object"]["id"].split("/")[-1]

                # Get session with source documents (using select to avoid joinedload issues)
                stmt = select(GenerationSession).where(GenerationSession.id == UUID(session_id))
                result = await db.execute(stmt)
                session = result.scalar_one_or_none()

                if not session:
                    logger.error(f"Generation session not found: {session_id}")
                    return

                # Get source documents through the relationship
                from app.models.generation_session import generation_session_sources

                stmt = (
                    select(SourceDocument)
                    .join(
                        generation_session_sources,
                        SourceDocument.id == generation_session_sources.c.source_document_id,
                    )
                    .where(generation_session_sources.c.generation_session_id == session.id)
                )
                result = await db.execute(stmt)
                source_docs = result.scalars().all()

                logger.info(f"Starting content generation for session {session_id} with {len(source_docs)} documents")

                # Begin actual content generation process
                await self._perform_content_generation(session, source_docs, db)

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.started", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.started event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.started",
                    "failed",
                    str(e),
                )

                # Mark session as failed
                session = await db.get(GenerationSession, UUID(event_data["object"]["id"].split("/")[-1]))
                if session:
                    session.fail_with_error(f"Generation start failed: {str(e)}")
                    await db.commit()
            finally:
                await db.close()

    async def handle_content_generation_progress_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.progress event directly."""

        await self._process_content_generation_progress(event_data)

    async def _process_content_generation_progress(self, event_data: Dict[str, Any]) -> None:
        """Process content generation progress event - update progress tracking."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract progress data
                session_id = event_data["object"]["id"].split("/")[-1]
                extensions = event_data.get("result", {}).get("extensions", {})
                progress_percentage = extensions.get("http://nlj.platform/extensions/progress_percentage", 0)
                current_step = extensions.get("http://nlj.platform/extensions/current_step", "Processing...")

                logger.info(
                    f"Content generation progress for session {session_id}: {progress_percentage}% - {current_step}"
                )

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.progress", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.progress event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.progress",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_content_generation_completed_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.completed event directly."""

        await self._process_content_generation_completed(event_data)

    async def _process_content_generation_completed(self, event_data: Dict[str, Any]) -> None:
        """Process content generation completed event - finalize session."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract completion data
                session_id = event_data["object"]["id"].split("/")[-1]

                logger.info(f"Content generation completed for session {session_id}")

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.completed", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.completed event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.completed",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_content_generation_failed_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.failed event directly."""

        await self._process_content_generation_failed(event_data)

    async def _process_content_generation_failed(self, event_data: Dict[str, Any]) -> None:
        """Process content generation failed event - handle failure cleanup."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract failure data
                session_id = event_data["object"]["id"].split("/")[-1]
                extensions = event_data.get("context", {}).get("extensions", {})
                error_message = extensions.get("http://nlj.platform/extensions/error_message", "Unknown error")

                logger.error(f"Content generation failed for session {session_id}: {error_message}")

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.failed", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.failed event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.failed",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    # =========================================================================
    # CONTENT GENERATION UTILITY METHODS
    # =========================================================================

    async def _perform_content_generation(
        self, session: GenerationSession, source_docs: List[SourceDocument], db
    ) -> None:
        """Perform the actual content generation using Claude API."""

        try:
            # Publish progress event
            await self._publish_content_generation_progress_event(
                str(session.id), session.user_id, 25, "Preparing documents..."
            )

            # Prepare Claude API call with source documents
            file_ids = []
            for doc in source_docs:
                if doc.claude_file_id:
                    file_ids.append(doc.claude_file_id)
                    logger.info(f"Added source document {doc.original_filename} (Claude ID: {doc.claude_file_id})")

            if not file_ids:
                raise ValueError("No Claude file IDs found in source documents")

            # Publish progress event
            await self._publish_content_generation_progress_event(
                str(session.id),
                session.user_id,
                50,
                "Generating content with Claude API...",
            )

            # Extract prompt from session config
            prompt_config = session.prompt_config or {}
            generated_prompt = prompt_config.get("generated_prompt_text", "")

            if not generated_prompt:
                raise ValueError("No generated prompt text found in session config")

            # Call Claude API for content generation
            import time

            start_time = time.time()

            generated_content, error_message, tokens_used = await claude_service.generate_content(
                prompt_text=generated_prompt,
                file_ids=file_ids,
                model="claude-sonnet-4-20250514",
                max_tokens=8192,
                temperature=0.1,
            )

            generation_time = time.time() - start_time

            if error_message or not generated_content:
                raise ValueError(f"Claude API generation failed: {error_message or 'No content generated'}")

            # Publish progress event
            await self._publish_content_generation_progress_event(
                str(session.id), session.user_id, 75, "Validating generated content..."
            )

            # Extract and validate NLJ content from Claude response
            validated_nlj = None
            if isinstance(generated_content, dict):
                if "raw_response" in generated_content:
                    # Try to parse JSON from raw response
                    try:
                        import json

                        response_text = generated_content["raw_response"]
                        # Look for JSON content in the response
                        if "{" in response_text and "}" in response_text:
                            start_idx = response_text.find("{")
                            end_idx = response_text.rfind("}") + 1
                            json_content = response_text[start_idx:end_idx]
                            validated_nlj = json.loads(json_content)
                    except (json.JSONDecodeError, ValueError) as e:
                        logger.warning(f"Could not parse JSON from response: {e}")
                        validated_nlj = {
                            "nodes": [],
                            "links": [],
                            "error": "Failed to parse JSON",
                            "raw": response_text,
                        }
                else:
                    validated_nlj = generated_content
            else:
                # If it's just a string, try to parse as JSON
                try:
                    import json

                    validated_nlj = (
                        json.loads(generated_content) if isinstance(generated_content, str) else generated_content
                    )
                except (json.JSONDecodeError, ValueError):
                    validated_nlj = {
                        "nodes": [],
                        "links": [],
                        "error": "Invalid JSON response",
                        "raw": str(generated_content),
                    }

            # Update session with completed status and real data
            session.status = GenerationStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
            session.generated_content = {
                "generated_json": validated_nlj,
                "raw_response": (
                    generated_content.get("raw_response", str(generated_content))
                    if isinstance(generated_content, dict)
                    else str(generated_content)
                ),
                "generation_metadata": {
                    "model": "claude-sonnet-4-20250514",
                    "tokens_used": tokens_used,
                    "generation_time_seconds": generation_time,
                    "file_ids": file_ids,
                },
            }
            session.validated_nlj = validated_nlj
            session.total_tokens_used = tokens_used
            session.generation_time_seconds = generation_time

            await db.commit()

            logger.info(
                f"Content generation completed for session {session.id}: {tokens_used} tokens, {generation_time:.2f}s"
            )

            # Publish completion event
            await self._publish_content_generation_completed_event(str(session.id), session.user_id)

        except Exception as e:
            logger.error(f"Content generation failed for session {session.id}: {e}")
            session.fail_with_error(str(e))
            await db.commit()

            # Publish failure event
            await self._publish_content_generation_failed_event(str(session.id), session.user_id, str(e))

    async def _publish_content_generation_started_event(self, session_id: str, user_id: UUID) -> None:
        """Publish content generation started event."""
        try:
            xapi_service = await self._get_xapi_service()

            # Get user details for the event
            from app.models.user import User

            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                user = await db.get(User, user_id)
                if user:
                    await xapi_service.publish_content_generation_started(
                        session_id=session_id,
                        user_id=str(user_id),
                        user_email=user.email,
                        user_name=user.full_name or user.username,
                    )
                    logger.info(f"Published content.generation.started event for session {session_id}")
                else:
                    logger.warning(f"User not found for started event: {user_id}")
            finally:
                await db.close()
        except Exception as e:
            logger.error(f"Failed to publish started event: {e}")

    async def _publish_content_generation_progress_event(
        self, session_id: str, user_id: UUID, progress: int, step: str
    ) -> None:
        """Publish content generation progress event."""
        try:
            xapi_service = await self._get_xapi_service()

            # Get user details for the event
            from app.models.user import User

            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                user = await db.get(User, user_id)
                if user:
                    await xapi_service.publish_content_generation_progress(
                        session_id=session_id,
                        user_id=str(user_id),
                        user_email=user.email,
                        user_name=user.full_name or user.username,
                        progress_percentage=progress,
                        current_step=step,
                    )
                    logger.info(
                        f"Published content.generation.progress event for session {session_id}: {progress}% - {step}"
                    )
                else:
                    logger.warning(f"User not found for progress event: {user_id}")
            finally:
                await db.close()
        except Exception as e:
            logger.error(f"Failed to publish progress event: {e}")

    async def _publish_content_generation_completed_event(self, session_id: str, user_id: UUID) -> None:
        """Publish content generation completed event."""
        try:
            xapi_service = await self._get_xapi_service()

            # Get user details for the event
            from app.models.user import User

            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                user = await db.get(User, user_id)
                if user:
                    await xapi_service.publish_content_generation_completed(
                        session_id=session_id,
                        user_id=str(user_id),
                        user_email=user.email,
                        user_name=user.full_name or user.username,
                    )
                    logger.info(f"Published content.generation.completed event for session {session_id}")
                else:
                    logger.warning(f"User not found for completed event: {user_id}")
            finally:
                await db.close()
        except Exception as e:
            logger.error(f"Failed to publish completed event: {e}")

    async def _publish_content_generation_failed_event(self, session_id: str, user_id: UUID, error: str) -> None:
        """Publish content generation failed event."""
        try:
            xapi_service = await self._get_xapi_service()

            # Get user details for the event
            from app.models.user import User

            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                user = await db.get(User, user_id)
                if user:
                    await xapi_service.publish_content_generation_failed(
                        session_id=session_id,
                        user_id=str(user_id),
                        user_email=user.email,
                        user_name=user.full_name or user.username,
                        error_message=error,
                        error_type="generation_error",
                    )
                    logger.info(f"Published content.generation.failed event for session {session_id}: {error}")
                else:
                    logger.warning(f"User not found for failed event: {user_id}")
            finally:
                await db.close()
        except Exception as e:
            logger.error(f"Failed to publish failed event: {e}")

    # =========================================================================
    # CONTENT LIFECYCLE EVENT HANDLERS (MODIFIED/IMPORTED/REVIEWED)
    # =========================================================================

    async def handle_content_generation_modified_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.modified event via BackgroundTask."""

        await self._process_content_generation_modified(event_data)

    async def _process_content_generation_modified(self, event_data: Dict[str, Any]) -> None:
        """Process content generation modified event - track content modifications."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract modification data
                session_id = event_data["object"]["id"].split("/")[-1]
                extensions = event_data.get("context", {}).get("extensions", {})
                modification_type = extensions.get("http://nlj.platform/extensions/modification_type", "unknown")
                modified_by = event_data["actor"]["account"]["name"]

                logger.info(
                    f"Content modification tracked for session {session_id}: {modification_type} by user {modified_by}"
                )

                # Update session with modification tracking
                stmt = select(GenerationSession).where(GenerationSession.id == UUID(session_id))
                result = await db.execute(stmt)
                session = result.scalar_one_or_none()

                if session:
                    # Track modification in session metadata
                    if not session.metadata_:
                        session.metadata_ = {}

                    modifications = session.metadata_.get("modifications", [])
                    modifications.append(
                        {
                            "type": modification_type,
                            "modified_by": modified_by,
                            "modified_at": datetime.now(timezone.utc).isoformat(),
                            "event_id": event_data["id"],
                        }
                    )
                    session.metadata_["modifications"] = modifications
                    session.metadata_["last_modified"] = datetime.now(timezone.utc).isoformat()
                    session.metadata_["modification_count"] = len(modifications)

                    await db.commit()
                    logger.info(f"Updated modification tracking for session {session_id}")
                else:
                    logger.warning(f"Generation session not found for modification: {session_id}")

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.modified", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.modified event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.modified",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_content_generation_imported_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.imported event via BackgroundTask."""

        await self._process_content_generation_imported(event_data)

    async def _process_content_generation_imported(self, event_data: Dict[str, Any]) -> None:
        """Process content generation imported event - track content imports."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract import data
                session_id = event_data["object"]["id"].split("/")[-1]
                extensions = event_data.get("context", {}).get("extensions", {})
                import_source = extensions.get("http://nlj.platform/extensions/import_source", "unknown")
                import_type = extensions.get("http://nlj.platform/extensions/import_type", "unknown")
                imported_by = event_data["actor"]["account"]["name"]

                logger.info(
                    f"Content import tracked for session {session_id}: {import_type} from {import_source} by user {imported_by}"
                )

                # Update session with import tracking
                stmt = select(GenerationSession).where(GenerationSession.id == UUID(session_id))
                result = await db.execute(stmt)
                session = result.scalar_one_or_none()

                if session:
                    # Track import in session metadata
                    if not session.metadata_:
                        session.metadata_ = {}

                    imports = session.metadata_.get("imports", [])
                    imports.append(
                        {
                            "source": import_source,
                            "type": import_type,
                            "imported_by": imported_by,
                            "imported_at": datetime.now(timezone.utc).isoformat(),
                            "event_id": event_data["id"],
                        }
                    )
                    session.metadata_["imports"] = imports
                    session.metadata_["last_imported"] = datetime.now(timezone.utc).isoformat()
                    session.metadata_["import_count"] = len(imports)

                    await db.commit()
                    logger.info(f"Updated import tracking for session {session_id}")
                else:
                    logger.warning(f"Generation session not found for import: {session_id}")

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.imported", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.imported event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.imported",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()

    async def handle_content_generation_reviewed_event(self, event_data: Dict[str, Any]) -> None:
        """Handle content.generation.reviewed event via BackgroundTask."""

        await self._process_content_generation_reviewed(event_data)

    async def _process_content_generation_reviewed(self, event_data: Dict[str, Any]) -> None:
        """Process content generation reviewed event - track content reviews."""

        try:
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                # Extract review data
                session_id = event_data["object"]["id"].split("/")[-1]
                result_extensions = event_data.get("result", {}).get("extensions", {})
                context_extensions = event_data.get("context", {}).get("extensions", {})

                review_status = result_extensions.get("http://nlj.platform/extensions/review_status", "pending")
                reviewer_comments = context_extensions.get("http://nlj.platform/extensions/reviewer_comments", "")
                reviewed_by = event_data["actor"]["account"]["name"]

                logger.info(
                    f"Content review tracked for session {session_id}: {review_status} by reviewer {reviewed_by}"
                )

                # Update session with review tracking
                stmt = select(GenerationSession).where(GenerationSession.id == UUID(session_id))
                result = await db.execute(stmt)
                session = result.scalar_one_or_none()

                if session:
                    # Track review in session metadata
                    if not session.metadata_:
                        session.metadata_ = {}

                    reviews = session.metadata_.get("reviews", [])
                    reviews.append(
                        {
                            "status": review_status,
                            "comments": reviewer_comments,
                            "reviewed_by": reviewed_by,
                            "reviewed_at": datetime.now(timezone.utc).isoformat(),
                            "event_id": event_data["id"],
                        }
                    )
                    session.metadata_["reviews"] = reviews
                    session.metadata_["last_reviewed"] = datetime.now(timezone.utc).isoformat()
                    session.metadata_["current_review_status"] = review_status
                    session.metadata_["review_count"] = len(reviews)

                    # Update workflow status if this affects content state
                    if hasattr(session, "workflow_state"):
                        if review_status == "approved":
                            # Could transition to approved state
                            pass
                        elif review_status == "rejected":
                            # Could transition to rejected state or back to draft
                            pass

                    await db.commit()
                    logger.info(f"Updated review tracking for session {session_id} with status: {review_status}")
                else:
                    logger.warning(f"Generation session not found for review: {session_id}")

                # Log successful processing
                await self._log_event_processing(db, event_data["id"], "content.generation.reviewed", "success")
            finally:
                await db.close()

        except Exception as e:
            logger.error(f"Failed to process content.generation.reviewed event: {e}")
            await db_manager.ensure_initialized()
            db = db_manager.get_session()
            try:
                await self._log_event_processing(
                    db,
                    event_data.get("id", "unknown"),
                    "content.generation.reviewed",
                    "failed",
                    str(e),
                )
            finally:
                await db.close()


# Global event consumer instance
event_consumer = EventConsumerService()


# Helper functions for easy use in APIs
async def consume_program_created_event(event_data: Dict[str, Any]) -> None:
    """Consume program created event."""
    await event_consumer.handle_program_created_event(event_data)


async def consume_program_published_event(event_data: Dict[str, Any]) -> None:
    """Consume program published event."""
    await event_consumer.handle_program_published_event(event_data)


async def consume_session_scheduled_event(event_data: Dict[str, Any]) -> None:
    """Consume session scheduled event."""
    await event_consumer.handle_session_scheduled_event(event_data)


async def consume_booking_requested_event(event_data: Dict[str, Any]) -> None:
    """Consume booking requested event."""
    await event_consumer.handle_booking_requested_event(event_data)


# Cancellation event consumers
async def consume_session_cancelled_event(event_data: Dict[str, Any]) -> None:
    """Consume session cancelled event."""
    await event_consumer.handle_session_cancelled_event(event_data)


async def consume_booking_cancelled_event(event_data: Dict[str, Any]) -> None:
    """Consume booking cancelled event."""
    await event_consumer.handle_booking_cancelled_event(event_data)


# Attendance event consumers
async def consume_attendance_checked_in_event(event_data: Dict[str, Any]) -> None:
    """Consume attendance checked-in event."""
    await event_consumer.handle_attendance_checked_in_event(event_data)


async def consume_attendance_completed_event(event_data: Dict[str, Any]) -> None:
    """Consume attendance completed event."""
    await event_consumer.handle_attendance_completed_event(event_data)


# =============================================================================
# CONTENT GENERATION EVENT HANDLERS
# =============================================================================


async def consume_content_generation_requested_event(
    event_data: Dict[str, Any],
) -> None:
    """Consume content generation requested event."""
    await event_consumer.handle_content_generation_requested_event(event_data)


async def consume_content_generation_started_event(event_data: Dict[str, Any]) -> None:
    """Consume content generation started event."""
    await event_consumer.handle_content_generation_started_event(event_data)


async def consume_content_generation_progress_event(event_data: Dict[str, Any]) -> None:
    """Consume content generation progress event."""
    await event_consumer.handle_content_generation_progress_event(event_data)


async def consume_content_generation_completed_event(
    event_data: Dict[str, Any],
) -> None:
    """Consume content generation completed event."""
    await event_consumer.handle_content_generation_completed_event(event_data)


async def consume_content_generation_failed_event(event_data: Dict[str, Any]) -> None:
    """Consume content generation failed event."""
    await event_consumer.handle_content_generation_failed_event(event_data)


async def consume_content_generation_modified_event(event_data: Dict[str, Any]) -> None:
    """Consume content generation modified event."""
    await event_consumer.handle_content_generation_modified_event(event_data)


async def consume_content_generation_imported_event(event_data: Dict[str, Any]) -> None:
    """Consume content generation imported event."""
    await event_consumer.handle_content_generation_imported_event(event_data)


async def consume_content_generation_reviewed_event(event_data: Dict[str, Any]) -> None:
    """Consume content generation reviewed event."""
    await event_consumer.handle_content_generation_reviewed_event(event_data)


class ContentGenerationConsumer:
    """
    Consumer service that processes content generation events from Kafka.
    Handles the pipeline: Kafka Topics → Event Processing → Database Updates
    """

    def __init__(self, kafka_service):
        from app.services.kafka_service import KafkaService

        self.kafka: KafkaService = kafka_service
        self.is_running = False
        self.consumer_task = None

        # Topics to consume from
        self.topics = [
            "nlj.content.generation",  # Content generation events
        ]

        # Event type to handler mapping
        self.event_handlers = {
            "content.generation.requested": consume_content_generation_requested_event,
            "content.generation.started": consume_content_generation_started_event,
            "content.generation.progress": consume_content_generation_progress_event,
            "content.generation.completed": consume_content_generation_completed_event,
            "content.generation.failed": consume_content_generation_failed_event,
            "content.generation.modified": consume_content_generation_modified_event,
            "content.generation.imported": consume_content_generation_imported_event,
            "content.generation.reviewed": consume_content_generation_reviewed_event,
        }

    async def start_consuming(self) -> None:
        """Start the Kafka consumer and begin processing events"""
        logger.debug(f"start_consuming called, is_running={self.is_running}")
        if self.is_running:
            logger.warning("Content generation consumer is already running")
            return

        try:
            logger.info("Starting content generation event consumer...")
            logger.debug("About to call kafka.start_consumer")

            # Start Kafka consumer
            await self.kafka.start_consumer(topics=self.topics, group_id="nlj-content-generation-consumer")
            logger.debug("kafka.start_consumer completed")

            self.is_running = True

            # Start consuming events
            logger.debug("About to create consumer task...")
            self.consumer_task = asyncio.create_task(self._consume_events())
            logger.debug(f"Consumer task created: {self.consumer_task}")

            logger.info("Content generation event consumer started successfully")

        except Exception as e:
            logger.error(f"Failed to start content generation consumer: {e}")
            self.is_running = False
            raise

    async def stop_consuming(self) -> None:
        """Stop the Kafka consumer"""
        if not self.is_running:
            return

        logger.info("Stopping content generation event consumer...")

        self.is_running = False

        # Cancel consumer task
        if self.consumer_task:
            self.consumer_task.cancel()
            try:
                await self.consumer_task
            except asyncio.CancelledError:
                pass

        # Stop Kafka consumer
        try:
            await self.kafka.stop()
        except Exception as e:
            logger.warning(f"Error stopping Kafka consumer: {e}")

        logger.info("Content generation event consumer stopped")

    async def _consume_events(self) -> None:
        """Main event consumption loop"""
        try:
            logger.debug("Content generation consumer loop started, waiting for events...")
            logger.debug(f"Kafka service: {self.kafka}, Consumer: {self.kafka.consumer if self.kafka else None}")

            if not self.kafka:
                logger.error("No kafka service available!")
                return

            if not self.kafka.consumer:
                logger.error("Kafka consumer not initialized!")
                return

            async for event in self.kafka.consume_events():
                if not self.is_running:
                    logger.debug("Consumer stopped, breaking out of event loop")
                    break

                logger.debug(f"Received event from Kafka: {type(event)}")
                await self._process_event(event)

        except asyncio.CancelledError:
            logger.debug("Content generation consumer task cancelled")
        except Exception as e:
            logger.error(f"Error in content generation consumer loop: {e}")
            import traceback

            logger.error(f"Traceback: {traceback.format_exc()}")
            if self.is_running:
                # Attempt to restart consumer after error
                logger.info("Attempting to restart content generation consumer...")
                await asyncio.sleep(5)
                if self.is_running:
                    self.consumer_task = asyncio.create_task(self._consume_events())

    async def _process_event(self, event: Dict[str, Any]) -> None:
        """Process a single event"""
        try:
            # Debug: Log the raw event structure
            logger.debug("Raw event structure:")
            logger.debug(f"  Event keys: {list(event.keys()) if isinstance(event, dict) else 'Not a dict'}")

            # Extract event type from topic and verb
            topic = event.get("topic", "")
            event_data = event.get("value", {})  # Fix: Use 'value' not 'event'

            logger.debug(f"  Extracted topic: {topic}")
            logger.debug(
                f"  Event data keys: {list(event_data.keys()) if isinstance(event_data, dict) else 'Not a dict'}"
            )

            # Determine event type based on verb and status
            event_type = self._extract_event_type(topic, event_data)

            if not event_type:
                logger.debug(f"Unknown event type for topic {topic}: {event_data.get('verb', {}).get('id')}")
                return

            # Get handler for event type
            handler = self.event_handlers.get(event_type)
            if not handler:
                logger.error(f"No handler found for event type: {event_type}")
                return

            logger.debug(f"Processing {event_type} event with handler: {handler}")

            # Call event handler directly (no background tasks needed)
            logger.debug(f"About to call event handler: {handler}")
            await handler(event_data)
            logger.debug("Event handler completed successfully")

        except Exception as e:
            logger.error(f"Error processing event: {e}")
            import traceback

            logger.error(f"Traceback: {traceback.format_exc()}")

    def _extract_event_type(self, topic: str, event: Dict[str, Any]) -> Optional[str]:
        """Extract event type from topic and verb for validation."""

        # Map topic + verb + status to event type
        topic_verb_status_mapping = {
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "requested",
            ): "content.generation.requested",
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "started",
            ): "content.generation.started",
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "in_progress",
            ): "content.generation.progress",
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "completed",
            ): "content.generation.completed",
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "failed",
            ): "content.generation.failed",
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "modified",
            ): "content.generation.modified",
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "imported",
            ): "content.generation.imported",
            (
                "nlj.content.generation",
                "http://adlnet.gov/expapi/verbs/authored",
                "reviewed",
            ): "content.generation.reviewed",
        }

        verb_id = event.get("verb", {}).get("id")
        # Check both result.extensions and context.extensions for generation_status
        result_status = (
            event.get("result", {}).get("extensions", {}).get("http://nlj.platform/extensions/generation_status")
        )
        context_status = (
            event.get("context", {}).get("extensions", {}).get("http://nlj.platform/extensions/generation_status")
        )
        status = result_status or context_status

        logger.debug(f"Event processing: topic={topic}, verb={verb_id}, status={status}")

        if verb_id and status:
            event_type = topic_verb_status_mapping.get((topic, verb_id, status))
            logger.debug(f"Mapped to event type: {event_type}")
            return event_type
        else:
            logger.debug(f"Missing verb_id ({verb_id}) or status ({status}) - event keys: {list(event.keys())}")

        return None


# Global consumer instance
content_generation_consumer: Optional[ContentGenerationConsumer] = None


async def get_content_generation_consumer() -> ContentGenerationConsumer:
    """Get or create the content generation consumer instance"""
    global content_generation_consumer

    if content_generation_consumer is None:
        from app.services.kafka_service import get_kafka_service

        kafka_service = await get_kafka_service()
        content_generation_consumer = ContentGenerationConsumer(kafka_service)

    return content_generation_consumer


async def start_content_generation_consumer() -> None:
    """Start the content generation consumer service"""
    try:
        logger.debug("start_content_generation_consumer() called")
        consumer = await get_content_generation_consumer()
        logger.debug(f"Got consumer instance: {consumer}")
        logger.debug(f"Consumer kafka service: {consumer.kafka}")
        await consumer.start_consuming()
        logger.debug("start_consuming() completed")
    except Exception as e:
        logger.error(f"Exception in start_content_generation_consumer: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        raise


async def stop_content_generation_consumer() -> None:
    """Stop the content generation consumer service"""
    if content_generation_consumer:
        await content_generation_consumer.stop_consuming()
