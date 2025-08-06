"""
Internal scheduling service for training sessions.
Replaces Cal.com integration with our own scheduling system.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.training_program import TrainingProgram, TrainingSession, TrainingBooking
from app.models.user import User

logger = logging.getLogger(__name__)


class SchedulingError(Exception):
    """Custom exception for scheduling errors."""
    def __init__(self, message: str, error_code: Optional[str] = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class SchedulingService:
    """Internal scheduling service for training sessions."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_session_slug(self, title: str, session_id: UUID) -> str:
        """Create a unique slug for the training session."""
        base_slug = f"training-{str(session_id)[:8]}-{title.lower().replace(' ', '-')}"
        # Remove special characters and limit length
        clean_slug = ''.join(c for c in base_slug if c.isalnum() or c == '-')[:50]
        return clean_slug
    
    async def validate_session_capacity(self, session: TrainingSession, instance_id: Optional[UUID] = None) -> bool:
        """Validate that session capacity is not exceeded."""
        if instance_id:
            # Check specific instance capacity
            stmt = select(func.count(TrainingBooking.id)).where(
                and_(
                    TrainingBooking.instance_id == instance_id,
                    TrainingBooking.booking_status.in_(["confirmed", "pending"])
                )
            )
        else:
            # Check overall session capacity across all instances
            stmt = select(func.count(TrainingBooking.id)).where(
                and_(
                    TrainingBooking.session_id == session.id,
                    TrainingBooking.booking_status.in_(["confirmed", "pending"])
                )
            )
        
        result = await self.db.execute(stmt)
        current_bookings = result.scalar() or 0
        
        return current_bookings < session.capacity
    
    async def find_scheduling_conflicts(
        self, 
        start_time: datetime, 
        end_time: datetime,
        location: Optional[str] = None,
        exclude_instance_id: Optional[UUID] = None
    ) -> List[TrainingSession]:
        """Find scheduling conflicts for the given time slot."""
        conditions = [
            TrainingSession.status == "scheduled",
            or_(
                # New session starts during existing session
                and_(
                    TrainingSession.start_time <= start_time,
                    TrainingSession.end_time > start_time
                ),
                # New session ends during existing session
                and_(
                    TrainingSession.start_time < end_time,
                    TrainingSession.end_time >= end_time
                ),
                # New session completely contains existing session
                and_(
                    TrainingSession.start_time >= start_time,
                    TrainingSession.end_time <= end_time
                )
            )
        ]
        
        # Check location conflicts if specified
        if location:
            conditions.append(
                or_(
                    TrainingSession.actual_location == location,
                    and_(
                        TrainingSession.actual_location.is_(None),
                        TrainingSession.session.has(TrainingSession.location == location)
                    )
                )
            )
        
        # Exclude current instance if updating
        if exclude_instance_id:
            conditions.append(TrainingSession.id != exclude_instance_id)
        
        stmt = (
            select(TrainingSession)
            .options(selectinload(TrainingSession.session))
            .where(and_(*conditions))
        )
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def create_training_instance(
        self,
        session: TrainingSession,
        start_time: datetime,
        end_time: datetime,
        timezone_str: str = "UTC",
        actual_location: Optional[str] = None,
        instance_notes: Optional[str] = None,
        max_attendees: Optional[int] = None
    ) -> TrainingSession:
        """Create a new training instance."""
        
        # Validate timing
        if start_time >= end_time:
            raise SchedulingError("Start time must be before end time")
        
        if start_time <= datetime.now(timezone.utc):
            raise SchedulingError("Cannot schedule sessions in the past")
        
        # Check for conflicts
        conflicts = await self.find_scheduling_conflicts(
            start_time, end_time, actual_location or session.location
        )
        
        if conflicts:
            conflict_titles = [c.session.title for c in conflicts]
            raise SchedulingError(
                f"Scheduling conflict with existing sessions: {', '.join(conflict_titles)}",
                error_code="SCHEDULING_CONFLICT"
            )
        
        # Create instance
        instance = TrainingSession(
            session_id=session.id,
            start_time=start_time,
            end_time=end_time,
            timezone=timezone_str,
            actual_location=actual_location,
            instance_notes=instance_notes,
            max_attendees=max_attendees,
            status="scheduled"
        )
        
        self.db.add(instance)
        await self.db.flush()
        
        logger.info(f"Created training instance {instance.id} for session {session.id}")
        return instance
    
    async def update_training_instance(
        self,
        instance: TrainingSession,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        actual_location: Optional[str] = None,
        instance_notes: Optional[str] = None,
        max_attendees: Optional[int] = None
    ) -> TrainingSession:
        """Update an existing training instance."""
        
        # Update fields if provided
        if start_time:
            instance.start_time = start_time
        if end_time:
            instance.end_time = end_time
        if actual_location is not None:
            instance.actual_location = actual_location
        if instance_notes is not None:
            instance.instance_notes = instance_notes
        if max_attendees is not None:
            instance.max_attendees = max_attendees
        
        # Validate timing if changed
        if start_time or end_time:
            if instance.start_time >= instance.end_time:
                raise SchedulingError("Start time must be before end time")
            
            if instance.start_time <= datetime.now(timezone.utc):
                raise SchedulingError("Cannot schedule sessions in the past")
            
            # Check for conflicts (excluding this instance)
            conflicts = await self.find_scheduling_conflicts(
                instance.start_time, 
                instance.end_time, 
                instance.actual_location,
                exclude_instance_id=instance.id
            )
            
            if conflicts:
                conflict_titles = [c.session.title for c in conflicts]
                raise SchedulingError(
                    f"Scheduling conflict with existing sessions: {', '.join(conflict_titles)}",
                    error_code="SCHEDULING_CONFLICT"
                )
        
        logger.info(f"Updated training instance {instance.id}")
        return instance
    
    async def cancel_training_instance(
        self,
        instance: TrainingSession,
        cancellation_reason: Optional[str] = None
    ) -> TrainingSession:
        """Cancel a training instance and handle bookings."""
        
        instance.status = "cancelled"
        instance.cancelled_at = datetime.now(timezone.utc)
        instance.cancellation_reason = cancellation_reason
        
        # Cancel all bookings for this instance
        stmt = select(TrainingBooking).where(
            and_(
                TrainingBooking.instance_id == instance.id,
                TrainingBooking.booking_status.in_(["confirmed", "pending"])
            )
        )
        result = await self.db.execute(stmt)
        bookings = result.scalars().all()
        
        for booking in bookings:
            booking.booking_status = "cancelled"
            booking.cancelled_at = datetime.now(timezone.utc)
            booking.cancellation_reason = "instance_cancelled"
        
        logger.info(f"Cancelled training instance {instance.id} with {len(bookings)} bookings")
        return instance
    
    async def create_booking(
        self,
        session: TrainingSession,
        instance: TrainingSession,
        learner: User,
        registration_method: str = "online",
        registration_notes: Optional[str] = None,
        special_requirements: Optional[Dict] = None
    ) -> TrainingBooking:
        """Create a booking for a training instance."""
        
        # Check if learner already has a booking for this session
        existing_stmt = select(TrainingBooking).where(
            and_(
                TrainingBooking.session_id == session.id,
                TrainingBooking.learner_id == learner.id,
                TrainingBooking.booking_status.in_(["confirmed", "pending", "waitlist"])
            )
        )
        result = await self.db.execute(existing_stmt)
        existing_booking = result.scalar_one_or_none()
        
        if existing_booking:
            raise SchedulingError(
                "Learner already has a booking for this session",
                error_code="DUPLICATE_BOOKING"
            )
        
        # Check capacity
        max_capacity = instance.max_attendees or session.capacity
        stmt = select(func.count(TrainingBooking.id)).where(
            and_(
                TrainingBooking.instance_id == instance.id,
                TrainingBooking.booking_status.in_(["confirmed", "pending"])
            )
        )
        result = await self.db.execute(stmt)
        current_bookings = result.scalar() or 0
        
        # Determine booking status
        if current_bookings >= max_capacity:
            if session.allow_waitlist:
                booking_status = "waitlist"
                is_waitlisted = True
                # Get waitlist position
                waitlist_stmt = select(func.count(TrainingBooking.id)).where(
                    and_(
                        TrainingBooking.instance_id == instance.id,
                        TrainingBooking.booking_status == "waitlist"
                    )
                )
                waitlist_result = await self.db.execute(waitlist_stmt)
                waitlist_position = (waitlist_result.scalar() or 0) + 1
            else:
                raise SchedulingError(
                    "Training session is full and waitlist is not allowed",
                    error_code="SESSION_FULL"
                )
        else:
            booking_status = "pending" if session.requires_approval else "confirmed"
            is_waitlisted = False
            waitlist_position = None
        
        # Create booking
        booking = TrainingBooking(
            session_id=session.id,
            instance_id=instance.id,
            learner_id=learner.id,
            registration_method=registration_method,
            booking_status=booking_status,
            is_waitlisted=is_waitlisted,
            waitlist_position=waitlist_position,
            registration_notes=registration_notes,
            special_requirements=special_requirements
        )
        
        self.db.add(booking)
        await self.db.flush()
        
        logger.info(f"Created booking {booking.id} for learner {learner.id} in session {session.id}")
        return booking
    
    async def get_availability_summary(
        self,
        session: TrainingSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get availability summary for a training session."""
        
        # Query instances
        conditions = [TrainingSession.session_id == session.id]
        
        if start_date:
            conditions.append(TrainingSession.start_time >= start_date)
        if end_date:
            conditions.append(TrainingSession.end_time <= end_date)
        
        stmt = (
            select(TrainingSession)
            .options(selectinload(TrainingSession.bookings))
            .where(and_(*conditions))
            .order_by(TrainingSession.start_time)
        )
        
        result = await self.db.execute(stmt)
        instances = result.scalars().all()
        
        # Calculate availability
        availability = []
        for instance in instances:
            confirmed_bookings = len([
                b for b in instance.bookings 
                if b.booking_status in ["confirmed", "pending"]
            ])
            waitlist_bookings = len([
                b for b in instance.bookings 
                if b.booking_status == "waitlist"
            ])
            
            max_capacity = instance.max_attendees or session.capacity
            available_spots = max(0, max_capacity - confirmed_bookings)
            
            availability.append({
                "instance_id": str(instance.id),
                "start_time": instance.start_time.isoformat(),
                "end_time": instance.end_time.isoformat(),
                "status": instance.status,
                "location": instance.actual_location or session.location,
                "capacity": max_capacity,
                "confirmed_bookings": confirmed_bookings,
                "available_spots": available_spots,
                "waitlist_count": waitlist_bookings,
                "is_full": available_spots == 0
            })
        
        return {
            "session_id": str(session.id),
            "session_title": session.title,
            "total_instances": len(instances),
            "upcoming_instances": len([
                i for i in instances 
                if i.start_time > datetime.now(timezone.utc) and i.status == "scheduled"
            ]),
            "instances": availability
        }


# Dependency injection for FastAPI
def get_scheduling_service(db: AsyncSession) -> SchedulingService:
    """Dependency for getting scheduling service instance."""
    return SchedulingService(db)