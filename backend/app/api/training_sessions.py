"""
Training Programs API endpoints.
Handles CRUD operations for training programs and their scheduled sessions.
"""

import logging
from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.training_program import TrainingProgram, TrainingSession, TrainingBooking
# Note: TrainingInstance is not in the current models - using TrainingSession for instances
from app.models.user import User, UserRole
# Cal.com service removed - using internal scheduling system
from app.services.scheduling_service import SchedulingError
from app.services.kafka_service import get_xapi_event_service, XAPIEventService

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic schemas for API requests/responses
class TrainingProgramCreate(BaseModel):
    """Schema for creating training programs."""
    title: str = Field(..., min_length=3, max_length=255, description="Program title")
    description: Optional[str] = Field(None, description="Program description")
    duration_minutes: int = Field(default=120, ge=15, le=480, description="Standard program duration in minutes")
    prerequisites: Optional[List[UUID]] = Field(None, description="Required content completion UUIDs")
    content_items: Optional[List[UUID]] = Field(None, description="Related NLJ content UUIDs")
    learning_objectives: Optional[List[str]] = Field(None, description="Learning objectives")
    instructor_requirements: Optional[Dict[str, Any]] = Field(None, description="Required instructor qualifications")
    requires_approval: bool = Field(default=False, description="Requires manager approval")
    auto_approve: bool = Field(default=True, description="Auto-approve eligible learners")
    is_published: bool = Field(default=False, description="Published to learners")


class TrainingProgramUpdate(BaseModel):
    """Schema for updating training programs."""
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=480)
    prerequisites: Optional[List[UUID]] = None
    content_items: Optional[List[UUID]] = None
    learning_objectives: Optional[List[str]] = None
    instructor_requirements: Optional[Dict[str, Any]] = None
    requires_approval: Optional[bool] = None
    auto_approve: Optional[bool] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None


class TrainingProgramResponse(BaseModel):
    """Schema for training program responses."""
    id: UUID
    title: str
    description: Optional[str]
    duration_minutes: int
    prerequisites: Optional[List[UUID]]
    content_items: Optional[List[UUID]]
    learning_objectives: Optional[List[str]]
    instructor_requirements: Optional[Dict[str, Any]]
    requires_approval: bool
    auto_approve: bool
    is_active: bool
    is_published: bool
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    total_sessions: int = 0
    upcoming_sessions: int = 0
    total_bookings: int = 0

    class Config:
        from_attributes = True


class TrainingSessionCreate(BaseModel):
    """Schema for creating training sessions (scheduled instances)."""
    program_id: UUID = Field(..., description="Training program UUID")
    start_time: datetime = Field(..., description="Session start time")
    end_time: datetime = Field(..., description="Session end time")
    timezone: str = Field(default="UTC", description="Timezone")
    location: Optional[str] = Field(None, description="Session location")
    location_details: Optional[Dict[str, Any]] = Field(None, description="Location metadata")
    capacity: int = Field(default=20, ge=1, le=1000, description="Session capacity")
    instructor_id: Optional[UUID] = Field(None, description="Assigned instructor UUID")
    session_notes: Optional[str] = Field(None, description="Session-specific notes")


class TrainingSessionUpdate(BaseModel):
    """Schema for updating training sessions."""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timezone: Optional[str] = None
    location: Optional[str] = None
    location_details: Optional[Dict[str, Any]] = None
    capacity: Optional[int] = Field(None, ge=1, le=1000)
    instructor_id: Optional[UUID] = None
    session_notes: Optional[str] = None
    status: Optional[str] = None
    cancellation_reason: Optional[str] = None


class TrainingSessionResponse(BaseModel):
    """Schema for training session responses."""
    id: UUID
    program_id: UUID
    start_time: datetime
    end_time: datetime
    timezone: str
    location: Optional[str]
    location_details: Optional[Dict[str, Any]]
    capacity: int
    instructor_id: Optional[UUID]
    session_notes: Optional[str]
    status: str
    cancelled_at: Optional[datetime]
    cancellation_reason: Optional[str]
    attendance_taken: bool
    attendance_taken_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    available_spots: int = 0
    total_bookings: int = 0
    confirmed_bookings: int = 0
    waitlist_count: int = 0

    class Config:
        from_attributes = True


# Training instances are not implemented in current models
# Sessions serve as the main scheduling entity


def check_program_permissions(user: User, action: str = "read") -> bool:
    """Check if user has permissions for training program operations."""
    if user.role in [UserRole.ADMIN, UserRole.APPROVER]:
        return True
    
    if action == "read" and user.role in [UserRole.REVIEWER, UserRole.CREATOR, UserRole.PLAYER]:
        return True
    
    if action in ["create", "update", "delete"] and user.role in [UserRole.CREATOR, UserRole.REVIEWER]:
        return True
    
    return False


def check_session_permissions(user: User, action: str = "read") -> bool:
    """Check if user has permissions for training session operations."""
    if user.role in [UserRole.ADMIN, UserRole.APPROVER]:
        return True
    
    if action == "read" and user.role in [UserRole.REVIEWER, UserRole.CREATOR, UserRole.PLAYER]:
        return True
    
    if action in ["create", "update", "delete"] and user.role in [UserRole.CREATOR, UserRole.REVIEWER]:
        return True
    
    return False


@router.post("/", response_model=TrainingProgramResponse)
async def create_training_program(
    program_data: TrainingProgramCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    xapi_service: Annotated[XAPIEventService, Depends(get_xapi_event_service)]
) -> TrainingProgramResponse:
    """Create a new training program template."""
    
    if not check_program_permissions(current_user, "create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create training programs"
        )
    
    try:
        # Create training program in database
        program = TrainingProgram(
            title=program_data.title,
            description=program_data.description,
            duration_minutes=program_data.duration_minutes,
            prerequisites=program_data.prerequisites,
            content_items=program_data.content_items,
            learning_objectives=program_data.learning_objectives,
            instructor_requirements=program_data.instructor_requirements,
            requires_approval=program_data.requires_approval,
            auto_approve=program_data.auto_approve,
            is_published=program_data.is_published,
            created_by_id=current_user.id
        )
        
        db.add(program)
        await db.flush()  # Get the ID without committing
        
        await db.commit()
        await db.refresh(program)
        
        # Publish xAPI event
        try:
            await xapi_service.publish_training_program_created(
                program_id=str(program.id),
                program_title=program.title,
                creator_email=current_user.email,
                creator_name=current_user.full_name or current_user.username,
                duration_minutes=program.duration_minutes,
                prerequisites=[str(p) for p in (program.prerequisites or [])]
            )
        except Exception as e:
            logger.error(f"Failed to publish training program created event: {e}")
            # Don't fail the request if event publishing fails
        
        logger.info(f"Created training program {program.id}")
        
        return TrainingProgramResponse.model_validate(program)
        
    except SchedulingError as e:
        logger.error(f"Error creating training program: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Program creation error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error creating training program: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create training program"
        )


@router.get("/{session_id}", response_model=TrainingSessionResponse)
async def get_training_session(
    session_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> TrainingSessionResponse:
    """Get training session details."""
    
    if not check_session_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view training sessions"
        )
    
    # Get session with related data
    stmt = (
        select(TrainingSession)
        .options(
            selectinload(TrainingSession.bookings)
        )
        .where(TrainingSession.id == session_id)
    )
    
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found"
        )
    
    # Check if user can see unpublished sessions
    if not session.is_published and current_user.role == UserRole.PLAYER:
        if session.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training session not found"
            )
    
    # Calculate computed fields
    session_response = TrainingSessionResponse.model_validate(session)
    confirmed_bookings = len([
        b for b in (session.bookings or []) 
        if b.booking_status in ["confirmed", "pending"]
    ])
    waitlist_bookings = len([
        b for b in (session.bookings or []) 
        if b.booking_status == "waitlist"
    ])
    session_response.available_spots = max(0, session.capacity - confirmed_bookings)
    session_response.total_bookings = len(session.bookings or [])
    session_response.confirmed_bookings = confirmed_bookings
    session_response.waitlist_count = waitlist_bookings
    
    return session_response


@router.get("/", response_model=List[TrainingSessionResponse])
async def list_training_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    published_only: bool = True,
    instructor_id: Optional[UUID] = None,
    location: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[TrainingSessionResponse]:
    """List training sessions with optional filters."""
    
    if not check_session_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view training sessions"
        )
    
    # Build query
    stmt = select(TrainingSession).options(
        selectinload(TrainingSession.bookings)
    )
    
    conditions = []
    
    # Published filter
    if published_only and current_user.role == UserRole.PLAYER:
        conditions.append(TrainingSession.is_published == True)
    elif not published_only and current_user.role == UserRole.PLAYER:
        # Players can only see their own unpublished sessions
        conditions.append(
            or_(
                TrainingSession.is_published == True,
                TrainingSession.created_by_id == current_user.id
            )
        )
    
    # Active sessions only
    conditions.append(TrainingSession.is_active == True)
    
    # Optional filters
    if instructor_id:
        conditions.append(TrainingSession.instructor_id == instructor_id)
    
    if location:
        conditions.append(TrainingSession.location.ilike(f"%{location}%"))
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    stmt = stmt.offset(skip).limit(limit).order_by(TrainingSession.created_at.desc())
    
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    
    # Build response with computed fields
    session_responses = []
    for session in sessions:
        session_response = TrainingSessionResponse.model_validate(session)
        confirmed_bookings = len([
            b for b in (session.bookings or []) 
            if b.booking_status in ["confirmed", "pending"]
        ])
        waitlist_bookings = len([
            b for b in (session.bookings or []) 
            if b.booking_status == "waitlist"
        ])
        session_response.available_spots = max(0, session.capacity - confirmed_bookings)
        session_response.total_bookings = len(session.bookings or [])
        session_response.confirmed_bookings = confirmed_bookings
        session_response.waitlist_count = waitlist_bookings
        session_responses.append(session_response)
    
    return session_responses


@router.put("/{session_id}", response_model=TrainingSessionResponse)
async def update_training_session(
    session_id: UUID,
    session_data: TrainingSessionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TrainingSessionResponse:
    """Update training session with internal scheduling system."""
    
    if not check_session_permissions(current_user, "update"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update training sessions"
        )
    
    # Get existing session
    stmt = select(TrainingSession).where(TrainingSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found"
        )
    
    # Check ownership for non-admin users
    if (current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and 
        session.created_by_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update your own training sessions"
        )
    
    try:
        # Update session fields
        update_data = session_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(session, field, value)
        
        # No Cal.com sync needed - using internal scheduling
        await db.commit()
        await db.refresh(session)
        
        logger.info(f"Updated training session {session.id}")
        
        return TrainingSessionResponse.model_validate(session)
        
    except SchedulingError as e:
        logger.error(f"Scheduling error updating training session: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scheduling error: {e.message}"
        )
    except Exception as e:
        logger.error(f"Error updating training session: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update training session"
        )


@router.delete("/{session_id}")
async def delete_training_session(
    session_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Dict[str, str]:
    """Delete training session using internal scheduling system."""
    
    if not check_session_permissions(current_user, "delete"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete training sessions"
        )
    
    # Get existing session
    stmt = select(TrainingSession).where(TrainingSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found"
        )
    
    # Check ownership for non-admin users
    if (current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and 
        session.created_by_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete your own training sessions"
        )
    
    # Check for existing bookings
    stmt = select(TrainingBooking).where(
        and_(
            TrainingBooking.session_id == session_id,
            TrainingBooking.booking_status.in_(["confirmed", "pending"])
        )
    )
    result = await db.execute(stmt)
    active_bookings = result.scalars().all()
    
    if active_bookings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete session with active bookings. Cancel bookings first."
        )
    
    try:
        # No Cal.com cleanup needed - using internal scheduling
        
        # Soft delete - mark as inactive instead of hard delete
        session.is_active = False
        await db.commit()
        
        logger.info(f"Deleted training session {session.id}")
        
        return {"message": "Training session deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting training session: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete training session"
        )


# Training Instance Endpoints have been removed
# The current model design uses TrainingSession as the main scheduling entity