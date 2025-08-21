"""
Training Sessions API endpoints - Clean Architecture.
Handles CRUD operations for individual training sessions using Clean Architecture patterns.
"""

import logging
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, get_manage_sessions_use_case, get_track_engagement_use_case
from app.core.user_context import extract_user_context
from app.models.user import User
from app.services.use_cases.training.manage_sessions_use_case import (
    ManageSessionsUseCase, ManageSessionsRequest, SessionAction
)
from app.services.use_cases.training.track_engagement_use_case import (
    TrackEngagementUseCase
)

logger = logging.getLogger(__name__)

router = APIRouter()


# API Schemas (request/response models for API boundary)
class TrainingSessionCreate(BaseModel):
    """Schema for creating training sessions."""
    program_id: UUID = Field(..., description="Training program UUID")
    scheduled_start: datetime = Field(..., description="Session start time")
    scheduled_end: datetime = Field(..., description="Session end time")
    instructor_id: UUID | None = Field(None, description="Assigned instructor UUID")
    location: str | None = Field(None, description="Session location")
    max_participants: int = Field(default=20, ge=1, le=200, description="Session capacity")
    notes: str | None = Field(None, description="Session-specific notes")


class TrainingSessionUpdate(BaseModel):
    """Schema for updating training sessions."""
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    instructor_id: UUID | None = None
    location: str | None = None
    max_participants: int | None = Field(None, ge=1, le=200)
    notes: str | None = None
    status: str | None = None


class TrainingSessionResponse(BaseModel):
    """Schema for training session responses."""
    id: UUID
    program_id: UUID
    scheduled_start: datetime
    scheduled_end: datetime
    instructor_id: UUID | None
    location: str | None
    max_participants: int
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    available_spots: int = 0
    total_bookings: int = 0


class AttendanceRecordRequest(BaseModel):
    """Schema for recording attendance."""
    user_id: UUID = Field(..., description="Learner ID for attendance")
    attended: bool = Field(..., description="Attendance status")
    notes: str | None = Field(None, description="Attendance notes")


# API Endpoints

@router.post("/", response_model=TrainingSessionResponse)
async def create_training_session(
    session_data: TrainingSessionCreate,
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case)
) -> TrainingSessionResponse:
    """Create a new training session using Clean Architecture."""
    
    # Convert API schema to use case request
    create_request = ManageSessionsRequest(
        action=SessionAction.CREATE,
        program_id=session_data.program_id,
        instructor_id=session_data.instructor_id,
        scheduled_start=session_data.scheduled_start,
        scheduled_end=session_data.scheduled_end,
        max_participants=session_data.max_participants,
        location=session_data.location,
        notes=session_data.notes
    )
    
    # Extract user context
    user_context = extract_user_context(current_user)
    
    try:
        # Execute use case (handles permissions internally)
        result = await manage_sessions_use_case.execute(create_request, user_context)
        
        if not result.session:
            raise RuntimeError("Session creation failed - no session returned")
            
        session = result.session
        
        return TrainingSessionResponse(
            id=session.id or uuid4(),
            program_id=session.program_id,
            scheduled_start=session.scheduled_start,
            scheduled_end=session.scheduled_end,
            instructor_id=session.instructor_id,
            location=session.location,
            max_participants=session.max_participants or 20,
            notes=session.session_notes,
            status=session.status,
            created_at=session.created_at or datetime.now(),
            updated_at=session.updated_at or datetime.now(),
            available_spots=getattr(session, 'available_spots', 0),
            total_bookings=getattr(session, 'total_bookings', 0)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/{session_id}", response_model=TrainingSessionResponse)
async def get_training_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case)
) -> TrainingSessionResponse:
    """Get a specific training session by ID."""
    
    # TODO: Add GET/READ action to ManageSessionsUseCase
    # For now, return placeholder
    try:
        # Placeholder until GET action is implemented
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, 
            detail="Session retrieval not yet implemented - needs GET action in ManageSessionsUseCase"
        )
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/", response_model=list[TrainingSessionResponse])
async def list_training_sessions(
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case),
    program_id: UUID | None = Query(None, description="Filter by program ID"),
    skip: int = Query(0, ge=0, description="Number of sessions to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of sessions to return")
) -> list[TrainingSessionResponse]:
    """List training sessions with optional filters."""
    
    try:
        # TODO: Enhance ManageSessionsUseCase to support listing sessions
        # For now, return empty list as placeholder
        return []
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.put("/{session_id}", response_model=TrainingSessionResponse)
async def update_training_session(
    session_id: UUID,
    session_data: TrainingSessionUpdate,
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case)
) -> TrainingSessionResponse:
    """Update a training session."""
    
    # TODO: Add UPDATE action to ManageSessionsUseCase
    try:
        # Placeholder until UPDATE action is implemented
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, 
            detail="Session updates not yet implemented - needs UPDATE action in ManageSessionsUseCase"
        )
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.delete("/{session_id}")
async def delete_training_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case)
) -> dict[str, str]:
    """Delete/cancel a training session."""
    
    # TODO: Add DELETE/CANCEL action to ManageSessionsUseCase
    try:
        # Placeholder until CANCEL action is implemented
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, 
            detail="Session cancellation not yet implemented - needs CANCEL action in ManageSessionsUseCase"
        )
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


# Attendance management endpoints using ManageSessionsUseCase

@router.post("/{session_id}/attendance", response_model=dict[str, str])
async def record_attendance(
    session_id: UUID,
    attendance_data: AttendanceRecordRequest,
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case)
) -> dict[str, str]:
    """Record attendance for a training session."""
    
    # Convert API schema to use case request
    attendance_request = ManageSessionsRequest(
        action=SessionAction.RECORD_ATTENDANCE,
        session_id=session_id,
        user_id=attendance_data.user_id,
        attended=attendance_data.attended
    )
    
    user_context = extract_user_context(current_user)
    
    try:
        result = await manage_sessions_use_case.execute(attendance_request, user_context)
        
        status_msg = "checked in" if attendance_data.attended else "marked absent"
        return {
            "message": f"Attendance {status_msg} successfully for session {session_id}",
            "participants_affected": str(result.participants_affected)
        }
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/{session_id}/attendance", response_model=list[dict[str, str]])
async def get_session_attendance(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    track_engagement_use_case: TrackEngagementUseCase = Depends(get_track_engagement_use_case)
) -> list[dict[str, str]]:
    """Get attendance records for a training session."""
    
    try:
        # TODO: Enhance TrackEngagementUseCase to support listing attendance
        # For now, return empty list as placeholder
        return []
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")