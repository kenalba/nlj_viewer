"""
Training Registration API endpoints.
Handles learner registration for training sessions with event-driven updates and xAPI tracking.
"""

import logging
from datetime import datetime, timezone
from typing import Annotated, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.training_program import TrainingProgram, TrainingSession, TrainingBooking
from app.models.user import User, UserRole
# Cal.com service removed - using internal scheduling system
from app.services.scheduling_service import SchedulingService, SchedulingError
from app.services.kafka_service import get_xapi_event_service, XAPIEventService

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic schemas for registration API
class RegistrationRequest(BaseModel):
    """Schema for registration requests."""
    session_id: UUID = Field(..., description="Training session UUID")
    instance_id: Optional[UUID] = Field(None, description="Specific instance UUID (if available)")
    preferred_times: Optional[List[datetime]] = Field(None, description="Preferred time slots")
    special_requirements: Optional[str] = Field(None, max_length=500, description="Special requirements or notes")
    emergency_contact: Optional[str] = Field(None, max_length=255, description="Emergency contact information")


class RegistrationResponse(BaseModel):
    """Schema for registration responses."""
    id: UUID
    session_id: UUID
    instance_id: Optional[UUID]
    learner_id: UUID
    booking_status: str
    registration_method: str
    # Cal.com fields removed - using internal scheduling
    special_requirements: Optional[Dict]
    waitlist_position: Optional[int]
    confirmation_sent: bool
    registered_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AvailabilityResponse(BaseModel):
    """Schema for availability responses."""
    session_id: UUID
    session_title: str
    available_instances: List[Dict] = Field(default_factory=list)
    total_capacity: int
    remaining_spots: int
    waitlist_enabled: bool
    prerequisites_met: bool
    registration_status: str  # "available", "waitlist", "full", "not_eligible"


@router.get("/availability/{session_id}", response_model=AvailabilityResponse)
async def check_availability(
    session_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> AvailabilityResponse:
    """Check registration availability for a training session."""
    
    # Get session with instances and bookings
    stmt = (
        select(TrainingProgram)
        .options(
            selectinload(TrainingProgram.sessions),
            selectinload(TrainingProgram.bookings)
        )
        .where(and_(
            TrainingProgram.id == session_id,
            TrainingProgram.is_active == True,
            TrainingProgram.is_published == True
        ))
    )
    
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found or not available"
        )
    
    # Check if user is already registered
    existing_booking_stmt = select(TrainingBooking).where(
        and_(
            TrainingBooking.session_id == session_id,
            TrainingBooking.learner_id == current_user.id,
            TrainingBooking.booking_status.in_(["confirmed", "pending", "waitlisted"])
        )
    )
    existing_result = await db.execute(existing_booking_stmt)
    existing_booking = existing_result.scalar_one_or_none()
    
    if existing_booking:
        registration_status = f"already_registered_{existing_booking.booking_status}"
    else:
        # Check prerequisites (simplified - in real implementation, check against completed activities)
        prerequisites_met = True  # TODO: Implement actual prerequisite checking
        
        # Calculate availability
        upcoming_instances = [
            i for i in (session.instances or [])
            if i.start_time > datetime.now(timezone.utc) and i.status == "scheduled"
        ]
        
        available_instances = []
        total_remaining = 0
        
        for instance in upcoming_instances:
            # Count confirmed bookings for this instance
            confirmed_bookings = len([
                b for b in (session.bookings or [])
                if b.instance_id == instance.id and b.booking_status == "confirmed"
            ])
            
            max_capacity = instance.max_attendees or session.capacity
            remaining = max_capacity - confirmed_bookings
            total_remaining += max(0, remaining)
            
            available_instances.append({
                "id": str(instance.id),
                "start_time": instance.start_time.isoformat(),
                "end_time": instance.end_time.isoformat(),
                "location": instance.actual_location or session.location,
                "capacity": max_capacity,
                "confirmed_bookings": confirmed_bookings,
                "remaining_spots": max(0, remaining),
                "status": "available" if remaining > 0 else "full"
            })
        
        # Determine registration status
        if not prerequisites_met:
            registration_status = "not_eligible"
        elif total_remaining > 0:
            registration_status = "available"
        elif session.allow_waitlist:
            registration_status = "waitlist"
        else:
            registration_status = "full"
    
    return AvailabilityResponse(
        session_id=session.id,
        session_title=session.title,
        available_instances=available_instances,
        total_capacity=session.capacity,
        remaining_spots=total_remaining,
        waitlist_enabled=session.allow_waitlist,
        prerequisites_met=prerequisites_met,
        registration_status=registration_status
    )


@router.post("/register", response_model=RegistrationResponse)
async def register_for_session(
    registration: RegistrationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    xapi_service: Annotated[XAPIEventService, Depends(get_xapi_event_service)]
) -> RegistrationResponse:
    """Register learner for a training session."""
    
    # Get session details
    stmt = (
        select(TrainingSession)
        .options(selectinload(TrainingSession.instances))
        .where(and_(
            TrainingSession.id == registration.session_id,
            TrainingSession.is_active == True,
            TrainingSession.is_published == True
        ))
    )
    
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found or not available"
        )
    
    # Check for existing registration
    existing_booking_stmt = select(TrainingBooking).where(
        and_(
            TrainingBooking.session_id == registration.session_id,
            TrainingBooking.learner_id == current_user.id,
            TrainingBooking.booking_status.in_(["confirmed", "pending", "waitlisted"])
        )
    )
    existing_result = await db.execute(existing_booking_stmt)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already registered for this training session"
        )
    
    # Use internal scheduling service for booking
    scheduling_service = SchedulingService(db)
    
    try:
        # Find target instance
        target_instance = None
        if registration.instance_id:
            # Specific instance requested
            target_instance = next(
                (i for i in session.instances if i.id == registration.instance_id), None
            )
            if not target_instance:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Requested training instance not found"
                )
        else:
            # Find next available instance
            upcoming_instances = [
                i for i in (session.instances or [])
                if i.start_time > datetime.now(timezone.utc) and i.status == "scheduled"
            ]
            
            if not upcoming_instances:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No upcoming instances available for this session"
                )
            
            # Sort by start time and pick first
            upcoming_instances.sort(key=lambda x: x.start_time)
            target_instance = upcoming_instances[0]
        
        # Create booking using our scheduling service
        internal_booking = await scheduling_service.create_booking(
            session=session,
            instance=target_instance,
            learner=current_user,
            registration_method="online",
            registration_notes=registration.special_requirements,
            special_requirements={
                "requirements": registration.special_requirements,
                "emergency_contact": registration.emergency_contact
            } if registration.special_requirements or registration.emergency_contact else None
        )
        
        await db.commit()
        await db.refresh(internal_booking)
        
        # Publish xAPI registration event
        try:
            await xapi_service.publish_learner_registration(
                session_id=str(registration.session_id),
                session_title=session.title,
                learner_email=current_user.email,
                learner_name=current_user.full_name or current_user.username,
                cal_booking_id="",  # No external booking ID
                scheduled_time=target_instance.start_time,
                registration_method="online"
            )
        except Exception as e:
            logger.error(f"Failed to publish registration event: {e}")
        
        logger.info(f"User {current_user.id} registered for session {registration.session_id} with status {internal_booking.booking_status}")
        
        return RegistrationResponse.model_validate(internal_booking)
        
    except SchedulingError as e:
        logger.error(f"Scheduling error during registration: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {e.message}"
        )
    except Exception as e:
        logger.error(f"Error during registration: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to internal error"
        )


@router.get("/my-registrations", response_model=List[RegistrationResponse])
async def get_my_registrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[RegistrationResponse]:
    """Get current user's training registrations."""
    
    stmt = (
        select(TrainingBooking)
        .where(TrainingBooking.learner_id == current_user.id)
        .order_by(TrainingBooking.registered_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    if status_filter:
        stmt = stmt.where(TrainingBooking.booking_status == status_filter)
    
    result = await db.execute(stmt)
    bookings = result.scalars().all()
    
    return [RegistrationResponse.model_validate(booking) for booking in bookings]


@router.delete("/registrations/{booking_id}")
async def cancel_registration(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> Dict[str, str]:
    """Cancel a training registration."""
    
    # Get booking
    stmt = select(TrainingBooking).where(
        and_(
            TrainingBooking.id == booking_id,
            TrainingBooking.learner_id == current_user.id,
            TrainingBooking.booking_status.in_(["confirmed", "pending", "waitlisted"])
        )
    )
    
    result = await db.execute(stmt)
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found or cannot be cancelled"
        )
    
    try:
        # No Cal.com cancellation needed - using internal scheduling
        
        # Update booking status
        booking.booking_status = "cancelled"
        booking.cancelled_at = datetime.now(timezone.utc)
        booking.cancellation_reason = "learner"
        
        await db.commit()
        
        logger.info(f"User {current_user.id} cancelled registration {booking_id}")
        
        return {"message": "Registration cancelled successfully"}
        
    except Exception as e:
        logger.error(f"Error cancelling registration: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel registration"
        )