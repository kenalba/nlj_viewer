"""
Training Registration API endpoints - Clean Architecture.
Handles learner registration for training sessions using Clean Architecture patterns.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, get_track_engagement_use_case
from app.core.user_context import extract_user_context
from app.models.user import User
from app.services.use_cases.training.track_engagement_use_case import (
    TrackEngagementUseCase, TrackEngagementRequest, EngagementAction
)

logger = logging.getLogger(__name__)

router = APIRouter()


# API Schemas (request/response models for API boundary)
class BookingRequest(BaseModel):
    """Schema for booking registration requests."""
    session_id: UUID = Field(..., description="Training session UUID")
    registration_method: str = Field(default="online", description="Registration method")
    special_requirements: dict[str, str] | None = Field(None, description="Special accommodations")
    registration_notes: str | None = Field(None, max_length=500, description="Optional notes")


class BookingResponse(BaseModel):
    """Schema for booking registration responses."""
    message: str = Field(..., description="Registration status message")
    booking_id: str = Field(..., description="Booking ID for tracking")
    session_id: str = Field(..., description="Session ID")
    status: str = Field(..., description="Registration status")


class RegistrationStatusResponse(BaseModel):
    """Schema for registration status responses."""
    booking_id: str
    session_id: str
    learner_id: str
    status: str
    registration_method: str
    waitlist_position: int | None = None
    confirmation_sent: bool = False
    registered_at: str | None = None


# API Endpoints

@router.post("/register", response_model=BookingResponse)
async def register_for_training(
    booking_data: BookingRequest,
    current_user: User = Depends(get_current_user),
    track_engagement_use_case: TrackEngagementUseCase = Depends(get_track_engagement_use_case)
) -> BookingResponse:
    """Register a learner for a training session using Clean Architecture."""
    
    # TODO: Add REGISTER_FOR_SESSION action to EngagementAction enum
    # For now, return placeholder
    try:
        # Placeholder until REGISTER action is implemented
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, 
            detail="Training registration not yet implemented - needs REGISTER action in TrackEngagementUseCase"
        )
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/{booking_id}/status", response_model=RegistrationStatusResponse)
async def get_booking_status(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    track_engagement_use_case: TrackEngagementUseCase = Depends(get_track_engagement_use_case)
) -> RegistrationStatusResponse:
    """Get the current status of a booking registration."""
    
    # TODO: Add GET_REGISTRATION_STATUS action to EngagementAction enum
    try:
        # Placeholder until status checking is implemented
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, 
            detail="Registration status checking not yet implemented - needs GET_STATUS action in TrackEngagementUseCase"
        )
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.delete("/{booking_id}", response_model=dict[str, str])
async def cancel_registration(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    track_engagement_use_case: TrackEngagementUseCase = Depends(get_track_engagement_use_case)
) -> dict[str, str]:
    """Cancel a training registration."""
    
    # TODO: Add CANCEL_REGISTRATION action to EngagementAction enum
    try:
        # Placeholder until cancellation is implemented
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, 
            detail="Registration cancellation not yet implemented - needs CANCEL action in TrackEngagementUseCase"
        )
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/my-registrations", response_model=list[RegistrationStatusResponse])
async def get_my_registrations(
    current_user: User = Depends(get_current_user),
    track_engagement_use_case: TrackEngagementUseCase = Depends(get_track_engagement_use_case),
    upcoming_only: bool = True
) -> list[RegistrationStatusResponse]:
    """Get current user's training registrations."""
    
    # Convert to engagement tracking request
    registrations_request = TrackEngagementRequest(
        action=EngagementAction.GET_UPCOMING_SESSIONS,
        user_id=current_user.id,
        limit=50
    )
    
    user_context = extract_user_context(current_user)
    
    try:
        # TODO: Enhance TrackEngagementUseCase to return registration details
        # For now, return empty list as placeholder
        return []
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")