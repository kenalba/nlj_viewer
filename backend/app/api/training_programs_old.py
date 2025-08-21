"""
Training Programs API endpoints.
Handles CRUD operations for training programs and their scheduled sessions using Clean Architecture.
"""

import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict

from app.core.deps import get_current_user, get_manage_program_use_case, get_manage_sessions_use_case
from app.core.user_context import extract_user_context
from app.models.user import User, UserRole
from app.services.use_cases.training.manage_program_use_case import (
    ManageProgramUseCase, ManageProgramRequest, ManageProgramResponse, ProgramAction
)
from app.services.use_cases.training.manage_sessions_use_case import (
    ManageSessionsUseCase, ManageSessionsRequest, ManageSessionsResponse
)

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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


class EventResponse(BaseModel):
    """Schema for event-driven operation responses."""

    message: str = Field(..., description="Operation status message")
    event_id: str = Field(..., description="Event ID for tracking")
    resource_id: str = Field(..., description="ID of created/updated resource")
    status_endpoint: Optional[str] = Field(None, description="Endpoint to check operation status")


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
    current_user: Annotated[User, Depends(get_current_user)],
    manage_program_use_case: Annotated[ManageProgramUseCase, Depends(get_manage_program_use_case)]
) -> TrainingProgramResponse:
    """Create a new training program using Clean Architecture."""
    
    # Convert API schema to use case request
    create_request = ManageProgramRequest(
        action=ProgramAction.CREATE,
        title=program_data.title,
        description=program_data.description,
        duration_minutes=program_data.duration_minutes,
        learning_objectives=program_data.learning_objectives,
        prerequisites=program_data.prerequisites,
        created_by=current_user.id
    )
    
    # Extract user context
    user_context = extract_user_context(current_user)
    
    try:
        # Execute use case (handles permissions internally)
        result = await manage_program_use_case.execute(create_request, user_context)
        
        # Convert use case response to API response
        program = result.program
        return TrainingProgramResponse(
            id=program.id,
            title=program.title,
            description=program.description or "",
            duration_minutes=program.duration_minutes,
            learning_objectives=getattr(program, 'learning_objectives', []),
            prerequisites=getattr(program, 'prerequisites', []),
            content_items=getattr(program, 'content_items', []),
            instructor_requirements=getattr(program, 'instructor_requirements', {}),
            requires_approval=getattr(program, 'requires_approval', False),
            auto_approve=getattr(program, 'auto_approve', True),
            is_published=getattr(program, 'is_published', False),
            created_at=program.created_at or datetime.now(timezone.utc),
            updated_at=program.updated_at or datetime.now(timezone.utc),
            created_by=program.created_by
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")
        }
        # Event consumer will handle program creation asynchronously via Kafka

        # Generate event ID for tracking
        event_id = str(uuid4())

        logger.info(f"Published program.created event for program {program_id}")

        # If program should be published immediately, publish that event too
        if program_data.is_published:
            await xapi_service.publish_program_published(
                program_id=program_id,
                program_title=program_data.title,
                publisher_id=str(current_user.id),
                publisher_email=current_user.email,
                publisher_name=current_user.full_name or current_user.email,
            )
            logger.info(f"Published program.published event for program {program_id}")

            # Trigger publish event consumer
            {
                "id": str(uuid4()),
                "object": {
                    "id": f"http://nlj.platform/training-programs/{program_id}",
                    "definition": {"name": {"en-US": program_data.title}},
                },
                "actor": {"account": {"name": str(current_user.id)}},
                "context": {"extensions": {}},
            }
            # Event consumer will handle program publishing asynchronously via Kafka

        return EventResponse(
            message="Program creation initiated",
            event_id=event_id,
            resource_id=program_id,
            status_endpoint=f"/api/training-programs/{program_id}",
        )

    except Exception as e:
        logger.error(f"Error publishing program.created event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to initiate program creation"
        )


@router.get("/{program_id}", response_model=TrainingProgramResponse)
async def get_training_program(
    program_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TrainingProgramResponse:
    """Get training program details."""

    if not check_program_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to view training programs"
        )

    # Get program with related data
    stmt = (
        select(TrainingProgram)
        .options(selectinload(TrainingProgram.sessions), selectinload(TrainingProgram.bookings))
        .where(TrainingProgram.id == program_id)
    )

    result = await db.execute(stmt)
    program = result.scalar_one_or_none()

    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found")

    # Check if user can see unpublished programs
    if not program.is_published and current_user.role == UserRole.PLAYER:
        if program.created_by_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found")

    # Calculate computed fields
    program_response = TrainingProgramResponse.model_validate(program)
    program_response.total_sessions = len(program.sessions or [])
    program_response.upcoming_sessions = len(
        [s for s in (program.sessions or []) if s.start_time > datetime.now(timezone.utc) and s.status == "scheduled"]
    )
    program_response.total_bookings = len(program.bookings or [])

    return program_response


@router.get("/", response_model=List[TrainingProgramResponse])
async def list_training_programs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    published_only: bool = True,
    skip: int = 0,
    limit: int = 100,
) -> List[TrainingProgramResponse]:
    """List training programs with optional filters."""

    if not check_program_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to view training programs"
        )

    # Build query
    stmt = select(TrainingProgram).options(
        selectinload(TrainingProgram.sessions), selectinload(TrainingProgram.bookings)
    )

    conditions = []

    # Published filter
    if published_only and current_user.role == UserRole.PLAYER:
        conditions.append(TrainingProgram.is_published)
    elif not published_only and current_user.role == UserRole.PLAYER:
        # Players can only see their own unpublished programs
        conditions.append(or_(TrainingProgram.is_published, TrainingProgram.created_by_id == current_user.id))

    # Active programs only
    conditions.append(TrainingProgram.is_active)

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
        program_response.upcoming_sessions = len(
            [
                s
                for s in (program.sessions or [])
                if s.start_time > datetime.now(timezone.utc) and s.status == "scheduled"
            ]
        )
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
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to update training programs"
        )

    # Get existing program
    stmt = select(TrainingProgram).where(TrainingProgram.id == program_id)
    result = await db.execute(stmt)
    program = result.scalar_one_or_none()

    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found")

    # Check ownership for non-admin users
    if current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and program.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own training programs")

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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update training program"
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
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to delete training programs"
        )

    # Get existing program
    stmt = select(TrainingProgram).where(TrainingProgram.id == program_id)
    result = await db.execute(stmt)
    program = result.scalar_one_or_none()

    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found")

    # Check ownership for non-admin users
    if current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and program.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only delete your own training programs")

    # Check for existing sessions/bookings
    stmt = select(TrainingBooking).where(
        and_(TrainingBooking.program_id == program_id, TrainingBooking.booking_status.in_(["confirmed", "pending"]))
    )
    result = await db.execute(stmt)
    active_bookings = result.scalars().all()

    if active_bookings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete program with active bookings. Cancel bookings first.",
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete training program"
        )


# Training Sessions Endpoints (for scheduled instances)


@router.post("/{program_id}/sessions", response_model=EventResponse)
async def create_training_session(
    program_id: UUID,
    session_data: TrainingSessionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    xapi_service: Annotated[XAPIEventService, Depends(get_xapi_event_service)],
) -> EventResponse:
    """Create a new training session for a program via event-driven architecture."""

    if not check_program_permissions(current_user, "create"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to create training sessions"
        )

    # Get the program
    stmt = select(TrainingProgram).where(TrainingProgram.id == program_id)
    result = await db.execute(stmt)
    program = result.scalar_one_or_none()

    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found")

    # Check ownership for non-admin users
    if current_user.role not in [UserRole.ADMIN, UserRole.APPROVER] and program.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Can only create sessions for your own training programs"
        )

    try:
        # Generate session ID
        from uuid import uuid4

        session_id = str(uuid4())

        # Publish session.scheduled event
        await xapi_service.publish_session_scheduled(
            session_id=session_id,
            program_id=str(program_id),
            session_title=program.title,
            start_time=session_data.start_time,
            end_time=session_data.end_time,
            location=session_data.location,
            capacity=session_data.capacity,
            scheduler_id=str(current_user.id),
            scheduler_email=current_user.email,
            scheduler_name=current_user.full_name or current_user.email,
            instructor_id=str(session_data.instructor_id) if session_data.instructor_id else None,
        )

        # Trigger session event consumer
        {
            "id": str(uuid4()),
            "object": {
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": program.title}},
            },
            "actor": {"account": {"name": str(current_user.id)}},
            "context": {
                "extensions": {
                    "http://nlj.platform/extensions/program_id": str(program_id),
                    "http://nlj.platform/extensions/start_time": session_data.start_time.isoformat(),
                    "http://nlj.platform/extensions/end_time": session_data.end_time.isoformat(),
                    "http://nlj.platform/extensions/location": session_data.location or "",
                    "http://nlj.platform/extensions/capacity": session_data.capacity,
                    "http://nlj.platform/extensions/instructor_id": (
                        str(session_data.instructor_id) if session_data.instructor_id else None
                    ),
                }
            },
        }
        # Event consumer will handle session scheduling asynchronously via Kafka

        # Generate event ID for tracking
        event_id = str(uuid4())

        logger.info(f"Published session.scheduled event for session {session_id}")

        return EventResponse(
            message="Session scheduling initiated",
            event_id=event_id,
            resource_id=session_id,
            status_endpoint=f"/api/training-sessions/{session_id}",
        )

    except Exception as e:
        logger.error(f"Error publishing session.scheduled event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to initiate session scheduling"
        )


@router.get("/{program_id}/sessions", response_model=List[TrainingSessionResponse])
async def list_training_sessions(
    program_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    include_past: bool = False,
) -> List[TrainingSessionResponse]:
    """List training sessions for a program."""

    if not check_program_permissions(current_user, "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to view training sessions"
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
        confirmed_bookings = len([b for b in session.bookings if b.booking_status in ["confirmed", "pending"]])
        waitlist_bookings = len([b for b in session.bookings if b.booking_status == "waitlist"])

        available_spots = max(0, session.capacity - confirmed_bookings)

        session_response.available_spots = available_spots
        session_response.total_bookings = len(session.bookings)
        session_response.confirmed_bookings = confirmed_bookings
        session_response.waitlist_count = waitlist_bookings

        session_responses.append(session_response)

    return session_responses
