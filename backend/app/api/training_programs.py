"""
Training Programs API endpoints.
Handles CRUD operations for training programs and their scheduled sessions.
"""

import logging
from datetime import datetime, timezone
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
from app.models.user import User, UserRole
from app.services.scheduling_service import SchedulingService, SchedulingError, get_scheduling_service
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


def check_program_permissions(user: User, action: str = "read") -> bool:
    """Check if user has permissions for training program operations."""
    if user.role in [UserRole.ADMIN, UserRole.APPROVER]:
        return True
    
    if action == "read" and user.role in [UserRole.REVIEWER, UserRole.CREATOR, UserRole.PLAYER]:
        return True
    
    if action in ["create", "update", "delete"] and user.role in [UserRole.CREATOR, UserRole.REVIEWER]:
        return True
    
    return False


# Training Programs Endpoints

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
        await db.commit()
        await db.refresh(program)
        
        logger.info(f"Created training program {program.id}")
        
        return TrainingProgramResponse.model_validate(program)
        
    except Exception as e:
        logger.error(f"Error creating training program: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create training program"
        )


@router.get("/{program_id}", response_model=TrainingProgramResponse)
async def get_training_program(
    program_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> TrainingProgramResponse:
    """Get training program details."""
    
    if not check_program_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view training programs"
        )
    
    # Get program with related data
    stmt = (
        select(TrainingProgram)
        .options(
            selectinload(TrainingProgram.sessions),
            selectinload(TrainingProgram.bookings)
        )
        .where(TrainingProgram.id == program_id)
    )
    
    result = await db.execute(stmt)
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training program not found"
        )
    
    # Check if user can see unpublished programs
    if not program.is_published and current_user.role == UserRole.PLAYER:
        if program.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training program not found"
            )
    
    # Calculate computed fields
    program_response = TrainingProgramResponse.model_validate(program)
    program_response.total_sessions = len(program.sessions or [])
    program_response.upcoming_sessions = len([
        s for s in (program.sessions or []) 
        if s.start_time > datetime.now(timezone.utc) and s.status == "scheduled"
    ])
    program_response.total_bookings = len(program.bookings or [])
    
    return program_response


@router.get("/", response_model=List[TrainingProgramResponse])
async def list_training_programs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    published_only: bool = True,
    skip: int = 0,
    limit: int = 100
) -> List[TrainingProgramResponse]:
    """List training programs with optional filters."""
    
    if not check_program_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view training programs"
        )
    
    # Build query
    stmt = select(TrainingProgram).options(
        selectinload(TrainingProgram.sessions),
        selectinload(TrainingProgram.bookings)
    )
    
    conditions = []
    
    # Published filter
    if published_only and current_user.role == UserRole.PLAYER:
        conditions.append(TrainingProgram.is_published == True)
    elif not published_only and current_user.role == UserRole.PLAYER:
        # Players can only see their own unpublished programs
        conditions.append(
            or_(
                TrainingProgram.is_published == True,
                TrainingProgram.created_by_id == current_user.id
            )
        )
    
    # Active programs only
    conditions.append(TrainingProgram.is_active == True)
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    stmt = stmt.offset(skip).limit(limit).order_by(TrainingProgram.created_at.desc())
    
    result = await db.execute(stmt)
    programs = result.scalars().all()
    
    # Build response with computed fields
    program_responses = []
    for program in programs:
        program_response = TrainingProgramResponse.model_validate(program)
        program_response.total_sessions = len(program.sessions or [])
        program_response.upcoming_sessions = len([
            s for s in (program.sessions or []) 
            if s.start_time > datetime.now(timezone.utc) and s.status == "scheduled"
        ])
        program_response.total_bookings = len(program.bookings or [])
        program_responses.append(program_response)
    
    return program_responses


@router.put("/{program_id}", response_model=TrainingProgramResponse)
async def update_training_program(
    program_id: UUID,
    program_data: TrainingProgramUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TrainingProgramResponse:
    """Update training program."""
    
    if not check_program_permissions(current_user, "update"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update training programs"
        )
    
    # Get existing program
    stmt = select(TrainingProgram).where(TrainingProgram.id == program_id)
    result = await db.execute(stmt)
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training program not found"
        )
    
    # Check ownership for non-admin users
    if (current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and 
        program.created_by_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update your own training programs"
        )
    
    try:
        # Update program fields
        update_data = program_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(program, field, value)
        
        await db.commit()
        await db.refresh(program)
        
        logger.info(f"Updated training program {program.id}")
        
        return TrainingProgramResponse.model_validate(program)
        
    except Exception as e:
        logger.error(f"Error updating training program: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update training program"
        )


@router.delete("/{program_id}")
async def delete_training_program(
    program_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Dict[str, str]:
    """Delete training program."""
    
    if not check_program_permissions(current_user, "delete"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete training programs"
        )
    
    # Get existing program
    stmt = select(TrainingProgram).where(TrainingProgram.id == program_id)
    result = await db.execute(stmt)
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training program not found"
        )
    
    # Check ownership for non-admin users
    if (current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and 
        program.created_by_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete your own training programs"
        )
    
    # Check for existing sessions/bookings
    stmt = select(TrainingBooking).where(
        and_(
            TrainingBooking.program_id == program_id,
            TrainingBooking.booking_status.in_(["confirmed", "pending"])
        )
    )
    result = await db.execute(stmt)
    active_bookings = result.scalars().all()
    
    if active_bookings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete program with active bookings. Cancel bookings first."
        )
    
    try:
        # Soft delete - mark as inactive instead of hard delete
        program.is_active = False
        await db.commit()
        
        logger.info(f"Deleted training program {program.id}")
        
        return {"message": "Training program deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting training program: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete training program"
        )


# Training Sessions Endpoints (for scheduled instances)

@router.post("/{program_id}/sessions", response_model=TrainingSessionResponse)
async def create_training_session(
    program_id: UUID,
    session_data: TrainingSessionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> TrainingSessionResponse:
    """Create a new training session for a program."""
    
    if not check_program_permissions(current_user, "create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create training sessions"
        )
    
    # Get the program
    stmt = select(TrainingProgram).where(TrainingProgram.id == program_id)
    result = await db.execute(stmt)
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training program not found"
        )
    
    # Check ownership for non-admin users
    if (current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and 
        program.created_by_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only create sessions for your own training programs"
        )
    
    try:
        # Create session using new model structure
        session = TrainingSession(
            program_id=program_id,
            start_time=session_data.start_time,
            end_time=session_data.end_time,
            timezone=session_data.timezone,
            location=session_data.location,
            location_details=session_data.location_details,
            capacity=session_data.capacity,
            instructor_id=session_data.instructor_id,
            session_notes=session_data.session_notes
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        logger.info(f"Created training session {session.id} for program {program_id}")
        
        # Calculate computed fields
        session_response = TrainingSessionResponse.model_validate(session)
        session_response.available_spots = session.capacity
        session_response.total_bookings = 0
        session_response.confirmed_bookings = 0
        session_response.waitlist_count = 0
        
        return session_response
        
    except Exception as e:
        logger.error(f"Error creating training session: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create training session"
        )


@router.get("/{program_id}/sessions", response_model=List[TrainingSessionResponse])
async def list_training_sessions(
    program_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    include_past: bool = False
) -> List[TrainingSessionResponse]:
    """List training sessions for a program."""
    
    if not check_program_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view training sessions"
        )
    
    # Build query
    stmt = (
        select(TrainingSession)
        .options(selectinload(TrainingSession.bookings))
        .where(TrainingSession.program_id == program_id)
        .order_by(TrainingSession.start_time)
    )
    
    # Filter out past sessions unless requested
    if not include_past:
        stmt = stmt.where(TrainingSession.start_time > datetime.now(timezone.utc))
    
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    
    # Build response with computed fields
    session_responses = []
    for session in sessions:
        session_response = TrainingSessionResponse.model_validate(session)
        
        # Calculate booking statistics
        confirmed_bookings = len([
            b for b in session.bookings 
            if b.booking_status in ["confirmed", "pending"]
        ])
        waitlist_bookings = len([
            b for b in session.bookings 
            if b.booking_status == "waitlist"
        ])
        
        available_spots = max(0, session.capacity - confirmed_bookings)
        
        session_response.available_spots = available_spots
        session_response.total_bookings = len(session.bookings)
        session_response.confirmed_bookings = confirmed_bookings
        session_response.waitlist_count = waitlist_bookings
        
        session_responses.append(session_response)
    
    return session_responses