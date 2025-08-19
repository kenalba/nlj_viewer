"""
Training repository for training programs, sessions, and booking management.
Handles training programs, sessions, bookings, and attendance tracking.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.models.training_program import (
    TrainingProgram, 
    TrainingSession, 
    TrainingBooking, 
    AttendanceRecord
)
from .base_repository import BaseRepository

if TYPE_CHECKING:
    pass


class TrainingProgramRepository(BaseRepository[TrainingProgram]):
    """Repository for TrainingProgram entities with program management."""
    
    @property
    def model(self) -> type[TrainingProgram]:
        return TrainingProgram
    
    async def get_by_id_with_relationships(self, program_id: UUID) -> TrainingProgram | None:
        """Get training program by ID with all relationships loaded."""
        result = await self.session.execute(
            select(TrainingProgram)
            .options(
                selectinload(TrainingProgram.content),
                selectinload(TrainingProgram.created_by_user),
                selectinload(TrainingProgram.sessions)
            )
            .where(TrainingProgram.id == program_id)
        )
        return result.scalar_one_or_none()
    
    async def get_active_programs(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[TrainingProgram]:
        """Get all active training programs."""
        query = select(TrainingProgram).where(TrainingProgram.is_active)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_programs_by_creator(
        self,
        creator_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[TrainingProgram]:
        """Get training programs created by a specific user."""
        query = select(TrainingProgram).where(TrainingProgram.created_by == creator_id)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_programs_by_content(
        self,
        content_id: UUID,
        active_only: bool = True
    ) -> list[TrainingProgram]:
        """Get training programs using specific content."""
        conditions = [TrainingProgram.content_id == content_id]
        if active_only:
            conditions.append(TrainingProgram.is_active)
        
        query = select(TrainingProgram).where(and_(*conditions))
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def search_programs(
        self,
        search_term: str,
        active_only: bool = True,
        limit: int | None = None
    ) -> list[TrainingProgram]:
        """Search training programs by title and description."""
        search_condition = or_(
            TrainingProgram.title.ilike(f"%{search_term}%"),
            TrainingProgram.description.ilike(f"%{search_term}%")
        )
        
        conditions = [search_condition]
        if active_only:
            conditions.append(TrainingProgram.is_active)
        
        query = select(TrainingProgram).where(and_(*conditions))
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_program_statistics(self) -> dict:
        """Get training program statistics."""
        # Total programs
        total_programs = await self.count_all()
        
        # Active vs inactive
        active_count = await self.session.execute(
            select(func.count(TrainingProgram.id))
            .where(TrainingProgram.is_active)
        )
        
        # Programs with sessions
        programs_with_sessions = await self.session.execute(
            select(func.count(func.distinct(TrainingSession.program_id)))
            .select_from(TrainingSession)
        )
        
        return {
            "total_programs": total_programs,
            "active_programs": active_count.scalar(),
            "inactive_programs": total_programs - active_count.scalar(),
            "programs_with_sessions": programs_with_sessions.scalar()
        }


class TrainingSessionRepository(BaseRepository[TrainingSession]):
    """Repository for TrainingSession entities with session management."""
    
    @property
    def model(self) -> type[TrainingSession]:
        return TrainingSession
    
    async def get_by_id_with_relationships(self, session_id: UUID) -> TrainingSession | None:
        """Get training session by ID with all relationships loaded."""
        result = await self.session.execute(
            select(TrainingSession)
            .options(
                selectinload(TrainingSession.program),
                selectinload(TrainingSession.bookings),
                selectinload(TrainingSession.attendance_records)
            )
            .where(TrainingSession.id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def get_sessions_by_program(
        self,
        program_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[TrainingSession]:
        """Get sessions for a specific training program."""
        query = (
            select(TrainingSession)
            .where(TrainingSession.program_id == program_id)
            .order_by(TrainingSession.scheduled_start_time)
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_upcoming_sessions(
        self,
        limit: int = 20
    ) -> list[TrainingSession]:
        """Get upcoming training sessions."""
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        
        query = (
            select(TrainingSession)
            .where(TrainingSession.scheduled_start_time > now)
            .order_by(TrainingSession.scheduled_start_time)
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_sessions_in_date_range(
        self,
        start_date,
        end_date,
        program_id: UUID | None = None
    ) -> list[TrainingSession]:
        """Get sessions within a date range."""
        conditions = [
            TrainingSession.scheduled_start_time >= start_date,
            TrainingSession.scheduled_start_time <= end_date
        ]
        
        if program_id is not None:
            conditions.append(TrainingSession.program_id == program_id)
        
        query = (
            select(TrainingSession)
            .where(and_(*conditions))
            .order_by(TrainingSession.scheduled_start_time)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_sessions_with_availability(
        self,
        min_spots: int = 1,
        limit: int | None = None
    ) -> list[TrainingSession]:
        """Get sessions with available spots."""
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        
        # Subquery to count current bookings
        booking_count_subquery = (
            select(
                TrainingBooking.session_id,
                func.count(TrainingBooking.id).label('booking_count')
            )
            .group_by(TrainingBooking.session_id)
        ).subquery()
        
        query = (
            select(TrainingSession)
            .outerjoin(booking_count_subquery, TrainingSession.id == booking_count_subquery.c.session_id)
            .where(
                and_(
                    TrainingSession.scheduled_start_time > now,
                    (TrainingSession.max_participants - func.coalesce(booking_count_subquery.c.booking_count, 0)) >= min_spots
                )
            )
            .order_by(TrainingSession.scheduled_start_time)
        )
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_session_statistics(self, program_id: UUID | None = None) -> dict:
        """Get training session statistics."""
        base_conditions = []
        if program_id is not None:
            base_conditions.append(TrainingSession.program_id == program_id)
        
        # Total sessions
        if base_conditions:
            total_sessions = await self.session.execute(
                select(func.count(TrainingSession.id)).where(and_(*base_conditions))
            )
            total = total_sessions.scalar()
        else:
            total = await self.count_all()
        
        # Sessions by status (past vs future)
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        upcoming_query = select(func.count(TrainingSession.id)).where(
            TrainingSession.scheduled_start_time > now
        )
        past_query = select(func.count(TrainingSession.id)).where(
            TrainingSession.scheduled_start_time <= now
        )
        
        if base_conditions:
            upcoming_query = upcoming_query.where(and_(*base_conditions))
            past_query = past_query.where(and_(*base_conditions))
        
        upcoming_count = await self.session.execute(upcoming_query)
        past_count = await self.session.execute(past_query)
        
        # Average participants
        avg_participants = await self.session.execute(
            select(func.avg(TrainingSession.max_participants))
            .where(and_(*base_conditions) if base_conditions else True)
        )
        
        return {
            "total_sessions": total,
            "upcoming_sessions": upcoming_count.scalar(),
            "past_sessions": past_count.scalar(),
            "average_max_participants": float(avg_participants.scalar() or 0)
        }


class TrainingBookingRepository(BaseRepository[TrainingBooking]):
    """Repository for TrainingBooking entities with booking management."""
    
    @property
    def model(self) -> type[TrainingBooking]:
        return TrainingBooking
    
    async def get_bookings_by_session(
        self,
        session_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[TrainingBooking]:
        """Get bookings for a specific training session."""
        query = (
            select(TrainingBooking)
            .where(TrainingBooking.session_id == session_id)
            .order_by(TrainingBooking.booking_time)
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_bookings_by_user(
        self,
        user_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[TrainingBooking]:
        """Get bookings for a specific user."""
        query = (
            select(TrainingBooking)
            .where(TrainingBooking.user_id == user_id)
            .order_by(desc(TrainingBooking.booking_time))
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_booking_by_user_and_session(
        self,
        user_id: UUID,
        session_id: UUID
    ) -> TrainingBooking | None:
        """Get a specific booking by user and session."""
        result = await self.session.execute(
            select(TrainingBooking)
            .where(
                and_(
                    TrainingBooking.user_id == user_id,
                    TrainingBooking.session_id == session_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def count_bookings_for_session(self, session_id: UUID) -> int:
        """Count total bookings for a session."""
        result = await self.session.execute(
            select(func.count(TrainingBooking.id))
            .where(TrainingBooking.session_id == session_id)
        )
        return result.scalar()
    
    async def get_recent_bookings(
        self,
        days: int = 7,
        limit: int = 50
    ) -> list[TrainingBooking]:
        """Get recent bookings."""
        from datetime import datetime, timedelta, timezone
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        query = (
            select(TrainingBooking)
            .where(TrainingBooking.booking_time >= cutoff_date)
            .order_by(desc(TrainingBooking.booking_time))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_booking_statistics(self) -> dict:
        """Get booking statistics."""
        total_bookings = await self.count_all()
        
        # Recent bookings (last 7 days)
        from datetime import datetime, timedelta, timezone
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        
        recent_bookings = await self.session.execute(
            select(func.count(TrainingBooking.id))
            .where(TrainingBooking.booking_time >= week_ago)
        )
        
        # Top sessions by booking count
        top_sessions = await self.session.execute(
            select(
                TrainingBooking.session_id,
                func.count(TrainingBooking.id).label('booking_count')
            )
            .group_by(TrainingBooking.session_id)
            .order_by(desc('booking_count'))
            .limit(5)
        )
        
        return {
            "total_bookings": total_bookings,
            "recent_bookings": recent_bookings.scalar(),
            "top_sessions": dict(top_sessions.all())
        }


class AttendanceRecordRepository(BaseRepository[AttendanceRecord]):
    """Repository for AttendanceRecord entities with attendance tracking."""
    
    @property
    def model(self) -> type[AttendanceRecord]:
        return AttendanceRecord
    
    async def get_attendance_by_session(
        self,
        session_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[AttendanceRecord]:
        """Get attendance records for a specific session."""
        query = (
            select(AttendanceRecord)
            .where(AttendanceRecord.session_id == session_id)
            .order_by(AttendanceRecord.check_in_time)
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_attendance_by_user(
        self,
        user_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[AttendanceRecord]:
        """Get attendance records for a specific user."""
        query = (
            select(AttendanceRecord)
            .where(AttendanceRecord.user_id == user_id)
            .order_by(desc(AttendanceRecord.check_in_time))
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_attendance_rate_by_session(self, session_id: UUID) -> float:
        """Calculate attendance rate for a session."""
        # Count total bookings
        total_bookings = await self.session.execute(
            select(func.count(TrainingBooking.id))
            .where(TrainingBooking.session_id == session_id)
        )
        
        # Count actual attendees
        attendees = await self.session.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.session_id == session_id)
        )
        
        total = total_bookings.scalar()
        attended = attendees.scalar()
        
        return (attended / total * 100) if total > 0 else 0
    
    async def get_attendance_statistics(self) -> dict:
        """Get attendance statistics."""
        total_attendance = await self.count_all()
        
        # Average session duration
        avg_duration = await self.session.execute(
            select(func.avg(
                func.extract('epoch', AttendanceRecord.check_out_time - AttendanceRecord.check_in_time)
            ))
            .where(AttendanceRecord.check_out_time.is_not(None))
        )
        
        # Recent attendance (last 7 days)
        from datetime import datetime, timedelta, timezone
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        
        recent_attendance = await self.session.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.check_in_time >= week_ago)
        )
        
        return {
            "total_attendance_records": total_attendance,
            "recent_attendance": recent_attendance.scalar(),
            "average_session_duration_seconds": float(avg_duration.scalar() or 0)
        }