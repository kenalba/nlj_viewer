"""
User Registrations API endpoints.
Handles user-specific registration queries and management.
"""

import logging
from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.training_program import TrainingProgram, TrainingSession, TrainingBooking
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class RegistrationResponse(BaseModel):
    """Schema for user registration responses."""
    id: str
    program_id: str
    session_id: str
    learner_id: str
    booking_status: str
    registration_method: str
    special_requirements: Optional[Dict[str, Any]]
    waitlist_position: Optional[int]
    confirmation_sent: bool
    registered_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[RegistrationResponse])
async def get_my_registrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[RegistrationResponse]:
    """Get the current user's training registrations."""
    
    # Build query to get user's bookings
    stmt = select(TrainingBooking).options(
        selectinload(TrainingBooking.session),
        selectinload(TrainingBooking.program)
    ).where(TrainingBooking.learner_id == current_user.id)
    
    # Apply status filter if provided
    if status_filter:
        stmt = stmt.where(TrainingBooking.booking_status == status_filter)
    
    stmt = stmt.offset(skip).limit(limit).order_by(TrainingBooking.registered_at.desc())
    
    result = await db.execute(stmt)
    bookings = result.scalars().all()
    
    # Convert to response format
    registrations = []
    for booking in bookings:
        registration = RegistrationResponse(
            id=str(booking.id),
            program_id=str(booking.program_id),
            session_id=str(booking.session_id),
            learner_id=str(booking.learner_id),
            booking_status=booking.booking_status,
            registration_method=booking.registration_method,
            special_requirements=booking.special_requirements,
            waitlist_position=booking.waitlist_position,
            confirmation_sent=booking.confirmation_sent,
            registered_at=booking.registered_at.isoformat(),
            updated_at=booking.updated_at.isoformat()
        )
        registrations.append(registration)
    
    return registrations


@router.delete("/{booking_id}")
async def cancel_registration(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> Dict[str, str]:
    """Cancel a user's training registration."""
    
    # Get the booking
    stmt = select(TrainingBooking).where(
        TrainingBooking.id == booking_id,
        TrainingBooking.learner_id == current_user.id
    )
    result = await db.execute(stmt)
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )
    
    if booking.booking_status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration is already cancelled"
        )
    
    # Cancel the booking
    booking.booking_status = "cancelled"
    booking.cancelled_by_id = current_user.id
    booking.cancellation_reason = "learner"
    
    await db.commit()
    
    logger.info(f"User {current_user.id} cancelled registration {booking_id}")
    
    return {"message": "Registration cancelled successfully"}