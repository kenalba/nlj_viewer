"""
Training Registration API endpoints.
Handles learner registration for training sessions via event-driven architecture.
"""

import logging
from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.training_program import TrainingProgram, TrainingSession, TrainingBooking
from app.models.user import User
from app.services.kafka_service import get_xapi_event_service, XAPIEventService
from app.services.event_consumers import consume_booking_requested_event

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic schemas
class BookingRequest(BaseModel):
    """Schema for booking registration requests."""
    session_id: UUID = Field(..., description="Training session UUID")
    registration_method: str = Field(default="online", description="Registration method")
    special_requirements: Optional[Dict[str, Any]] = Field(
        None, description="Special accommodations or requirements"
    )
    registration_notes: Optional[str] = Field(
        None, max_length=500, description="Optional notes from learner"
    )


class BookingResponse(BaseModel):
    """Schema for event-driven booking responses."""
    message: str = Field(..., description="Registration status message")
    event_id: str = Field(..., description="Event ID for tracking")
    booking_id: str = Field(..., description="Booking ID")
    session_id: str = Field(..., description="Session ID")
    status_endpoint: str = Field(..., description="Endpoint to check booking status")


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


@router.post("/register", response_model=BookingResponse)
async def register_for_training(
    booking_data: BookingRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    xapi_service: Annotated[XAPIEventService, Depends(get_xapi_event_service)]
) -> BookingResponse:
    """
    Register a learner for a training session via event-driven architecture.
    Publishes booking.requested event which will be processed asynchronously.
    """
    
    try:
        # Verify session exists and is available for registration
        stmt = select(TrainingSession).where(
            TrainingSession.id == booking_data.session_id
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training session not found"
            )
        
        if session.status != "scheduled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot register for session with status: {session.status}"
            )
        
        # Get session program for event context
        program_stmt = select(TrainingProgram).where(
            TrainingProgram.id == session.program_id
        )
        program_result = await db.execute(program_stmt)
        program = program_result.scalar_one_or_none()
        
        if not program:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Session program not found"
            )
        
        # Generate booking ID
        booking_id = str(uuid4())
        
        # Publish booking.requested event
        await xapi_service.publish_booking_requested(
            booking_id=booking_id,
            session_id=str(booking_data.session_id),
            session_title=program.title,
            learner_id=str(current_user.id),
            learner_email=current_user.email,
            learner_name=current_user.full_name or current_user.email,
            registration_method=booking_data.registration_method,
            special_requirements=booking_data.special_requirements
        )
        
        # Trigger booking event consumer
        booking_event_data = {
            "id": str(uuid4()),
            "object": {
                "id": f"http://nlj.platform/training-sessions/{booking_data.session_id}",
                "definition": {"name": {"en-US": program.title}}
            },
            "actor": {
                "name": current_user.full_name or current_user.email,
                "mbox": f"mailto:{current_user.email}",
                "account": {"name": str(current_user.id)}
            },
            "context": {
                "extensions": {
                    "http://nlj.platform/extensions/booking_id": booking_id,
                    "http://nlj.platform/extensions/registration_method": booking_data.registration_method,
                    "http://nlj.platform/extensions/special_requirements": booking_data.special_requirements or {}
                }
            }
        }
        await consume_booking_requested_event(booking_event_data, background_tasks)
        
        # Generate event ID for tracking
        event_id = str(uuid4())
        
        logger.info(
            f"Published booking.requested event for learner {current_user.id} "
            f"in session {booking_data.session_id}"
        )
        
        return BookingResponse(
            message="Registration request submitted",
            event_id=event_id,
            booking_id=booking_id,
            session_id=str(booking_data.session_id),
            status_endpoint=f"/api/bookings/{booking_id}/status"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error processing training registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process registration request"
        )


@router.get("/{booking_id}/status")
async def get_booking_status(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> Dict[str, Any]:
    """Get the current status of a booking registration."""
    
    # This would query the database to get current booking status
    # For now, returning a placeholder response
    return {
        "booking_id": str(booking_id),
        "status": "processing",
        "message": "Registration is being processed"
    }


