"""
Training ORM Service - Clean Architecture Implementation.

Provides transaction-managed operations for training-related entities using repository pattern.
Handles training programs, sessions, bookings, and attendance tracking.
"""

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.training_program import TrainingProgram, TrainingSession, TrainingBooking, AttendanceRecord
from app.services.orm_repositories.training_repository import (
    TrainingProgramRepository,
    TrainingSessionRepository,
    TrainingBookingRepository,
    AttendanceRecordRepository,
)


class TrainingOrmService:
    """
    Training ORM Service managing training-related entities with Clean Architecture.

    This service aggregates multiple training-related repositories to provide
    comprehensive training management operations.

    Responsibilities:
    - Training program lifecycle management
    - Session scheduling and management
    - Booking and registration handling
    - Attendance tracking and reporting
    - Training analytics and reporting

    Uses TrainingProgramRepository, TrainingSessionRepository,
    TrainingBookingRepository, and AttendanceRecordRepository.
    """

    def __init__(
        self,
        session: AsyncSession,
        program_repository: TrainingProgramRepository,
        session_repository: TrainingSessionRepository,
        booking_repository: TrainingBookingRepository,
        attendance_repository: AttendanceRecordRepository,
    ):
        """Initialize Training ORM Service with session and repositories."""
        self.session = session
        self.program_repo = program_repository
        self.session_repo = session_repository
        self.booking_repo = booking_repository
        self.attendance_repo = attendance_repository

    # Transaction Management

    async def commit_transaction(self):
        """Commit the current transaction."""
        try:
            await self.session.commit()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to commit transaction: {e}") from e

    async def rollback_transaction(self):
        """Rollback the current transaction."""
        try:
            await self.session.rollback()
        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to rollback transaction: {e}") from e

    # Training Program Operations

    async def create_training_program(
        self,
        title: str,
        description: str,
        content_id: uuid.UUID,
        created_by: uuid.UUID,
        is_active: bool = True,
        max_participants: int | None = None,
        duration_minutes: int | None = None,
        prerequisites: str | None = None,
    ) -> TrainingProgram:
        """Create new training program."""
        program_data = {
            "title": title.strip(),
            "description": description.strip(),
            "content_id": content_id,
            "created_by": created_by,
            "is_active": is_active,
            "max_participants": max_participants,
            "duration_minutes": duration_minutes,
            "prerequisites": prerequisites,
        }

        try:
            program = await self.program_repo.create(**program_data)
            await self.session.commit()
            return program
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError("Invalid content or user ID provided") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create training program: {e}") from e

    async def get_active_programs(self) -> list[TrainingProgram]:
        """Get all active training programs."""
        try:
            return await self.program_repo.get_active_programs()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get active programs: {e}") from e

    # Training Session Operations

    async def create_training_session(
        self,
        program_id: uuid.UUID,
        instructor_id: uuid.UUID,
        scheduled_start: datetime,
        scheduled_end: datetime,
        max_participants: int | None = None,
        location: str | None = None,
        notes: str | None = None,
    ) -> TrainingSession:
        """Create new training session."""
        session_data = {
            "program_id": program_id,
            "instructor_id": instructor_id,
            "scheduled_start": scheduled_start,
            "scheduled_end": scheduled_end,
            "max_participants": max_participants,
            "location": location,
            "notes": notes,
        }

        try:
            training_session = await self.session_repo.create(**session_data)
            await self.session.commit()
            return training_session
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError("Invalid program or instructor ID provided") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create training session: {e}") from e

    async def get_upcoming_sessions(self, limit: int = 50) -> list[TrainingSession]:
        """Get upcoming training sessions."""
        try:
            return await self.session_repo.get_upcoming_sessions(limit=limit)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get upcoming sessions: {e}") from e

    # Booking Operations

    async def create_booking(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        booking_notes: str | None = None,
    ) -> TrainingBooking:
        """Create new training booking."""
        booking_data = {
            "session_id": session_id,
            "user_id": user_id,
            "booking_notes": booking_notes,
        }

        try:
            booking = await self.booking_repo.create(**booking_data)
            await self.session.commit()
            return booking
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError("Invalid session or user ID provided, or booking already exists") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create booking: {e}") from e

    async def get_user_bookings(self, user_id: uuid.UUID, limit: int = 50) -> list[TrainingBooking]:
        """Get bookings for a specific user."""
        try:
            return await self.booking_repo.get_user_bookings(user_id=user_id, limit=limit)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user bookings: {e}") from e

    # Attendance Operations

    async def record_attendance(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        attended: bool,
        attendance_notes: str | None = None,
    ) -> AttendanceRecord:
        """Record attendance for a training session."""
        attendance_data = {
            "session_id": session_id,
            "user_id": user_id,
            "attended": attended,
            "attendance_notes": attendance_notes,
        }

        try:
            attendance = await self.attendance_repo.create(**attendance_data)
            await self.session.commit()
            return attendance
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError("Invalid session or user ID provided") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to record attendance: {e}") from e

    async def get_session_attendance(self, session_id: uuid.UUID) -> list[AttendanceRecord]:
        """Get attendance records for a training session."""
        try:
            return await self.attendance_repo.get_session_attendance(session_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get session attendance: {e}") from e

    async def get_by_id(self, program_id: uuid.UUID) -> TrainingProgram | None:
        """Get training program by ID."""
        try:
            return await self.program_repo.get_by_id(program_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get training program: {e}") from e
    
    async def update_by_id(self, program_id: uuid.UUID, **data) -> TrainingProgram | None:
        """Update training program by ID."""
        try:
            return await self.program_repo.update_by_id(program_id, **data)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update training program: {e}") from e
