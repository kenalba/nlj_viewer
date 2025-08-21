"""
Training Programs API endpoints - Clean Architecture.
Handles CRUD operations for training programs and their scheduled sessions using Clean Architecture patterns.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, get_manage_program_use_case, get_manage_sessions_use_case
from app.core.user_context import extract_user_context
from app.models.user import User
from app.services.use_cases.training.manage_program_use_case import (
    ManageProgramUseCase, ManageProgramRequest, ProgramAction
)
from app.services.use_cases.training.manage_sessions_use_case import (
    ManageSessionsUseCase, ManageSessionsRequest, SessionAction
)

logger = logging.getLogger(__name__)

router = APIRouter()


# API Schemas (request/response models for API boundary)
class TrainingProgramCreate(BaseModel):
    """Schema for creating training programs."""
    title: str = Field(..., min_length=3, max_length=255, description="Program title")
    description: str | None = Field(None, description="Program description")
    duration_minutes: int = Field(default=120, ge=15, le=480, description="Standard program duration in minutes")
    prerequisites: list[UUID] | None = Field(None, description="Required content completion UUIDs")
    content_items: list[UUID] | None = Field(None, description="Related NLJ content UUIDs")
    learning_objectives: list[str] | None = Field(None, description="Learning objectives")
    instructor_requirements: dict[str, str] | None = Field(None, description="Required instructor qualifications")
    requires_approval: bool = Field(default=False, description="Requires manager approval")
    auto_approve: bool = Field(default=True, description="Auto-approve eligible learners")
    is_published: bool = Field(default=False, description="Published to learners")


class TrainingProgramUpdate(BaseModel):
    """Schema for updating training programs."""
    title: str | None = Field(None, min_length=3, max_length=255)
    description: str | None = None
    duration_minutes: int | None = Field(None, ge=15, le=480)
    prerequisites: list[UUID] | None = None
    content_items: list[UUID] | None = None
    learning_objectives: list[str] | None = None
    instructor_requirements: dict[str, str] | None = None
    requires_approval: bool | None = None
    auto_approve: bool | None = None
    is_published: bool | None = None


class TrainingProgramResponse(BaseModel):
    """Schema for training program responses."""
    id: UUID
    title: str
    description: str
    duration_minutes: int
    prerequisites: list[UUID]
    content_items: list[UUID]
    learning_objectives: list[str]
    instructor_requirements: dict[str, str]
    requires_approval: bool
    auto_approve: bool
    is_published: bool
    created_at: datetime
    updated_at: datetime
    created_by: UUID


class TrainingSessionCreate(BaseModel):
    """Schema for creating training sessions."""
    scheduled_start: datetime
    scheduled_end: datetime
    location: str | None = None
    max_participants: int = Field(default=20, ge=1, le=100)
    instructor_id: UUID | None = None
    notes: str | None = None


class TrainingSessionResponse(BaseModel):
    """Schema for training session responses."""
    id: UUID
    program_id: UUID
    scheduled_start: datetime
    scheduled_end: datetime
    location: str | None
    max_participants: int
    instructor_id: UUID | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# API Endpoints

@router.post("/", response_model=TrainingProgramResponse)
async def create_training_program(
    program_data: TrainingProgramCreate,
    current_user: User = Depends(get_current_user),
    manage_program_use_case: ManageProgramUseCase = Depends(get_manage_program_use_case)
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


@router.get("/{program_id}", response_model=TrainingProgramResponse)
async def get_training_program(
    program_id: UUID,
    current_user: User = Depends(get_current_user),
    manage_program_use_case: ManageProgramUseCase = Depends(get_manage_program_use_case)
) -> TrainingProgramResponse:
    """Get a specific training program by ID."""
    
    # For GET operations, we'll use UPDATE action with just the program_id
    get_request = ManageProgramRequest(
        action=ProgramAction.UPDATE,  # Using UPDATE action for read operations
        program_id=program_id
    )
    
    user_context = extract_user_context(current_user)
    
    try:
        result = await manage_program_use_case.execute(get_request, user_context)
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
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/", response_model=list[TrainingProgramResponse])
async def list_training_programs(
    current_user: User = Depends(get_current_user),
    manage_program_use_case: ManageProgramUseCase = Depends(get_manage_program_use_case),
    skip: int = Query(0, ge=0, description="Number of programs to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of programs to return")
) -> list[TrainingProgramResponse]:
    """List training programs with pagination."""
    
    try:
        # TODO: Enhance ManageProgramUseCase to support listing programs
        # For now, return empty list as placeholder
        return []
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.put("/{program_id}", response_model=TrainingProgramResponse)
async def update_training_program(
    program_id: UUID,
    program_data: TrainingProgramUpdate,
    current_user: User = Depends(get_current_user),
    manage_program_use_case: ManageProgramUseCase = Depends(get_manage_program_use_case)
) -> TrainingProgramResponse:
    """Update a training program."""
    
    update_request = ManageProgramRequest(
        action=ProgramAction.UPDATE,
        program_id=program_id,
        title=program_data.title,
        description=program_data.description,
        duration_minutes=program_data.duration_minutes,
        learning_objectives=program_data.learning_objectives,
        prerequisites=program_data.prerequisites
    )
    
    user_context = extract_user_context(current_user)
    
    try:
        result = await manage_program_use_case.execute(update_request, user_context)
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
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.delete("/{program_id}")
async def delete_training_program(
    program_id: UUID,
    current_user: User = Depends(get_current_user),
    manage_program_use_case: ManageProgramUseCase = Depends(get_manage_program_use_case)
) -> dict[str, str]:
    """Delete a training program."""
    
    delete_request = ManageProgramRequest(
        action=ProgramAction.ARCHIVE,  # Use ARCHIVE instead of delete
        program_id=program_id
    )
    
    user_context = extract_user_context(current_user)
    
    try:
        await manage_program_use_case.execute(delete_request, user_context)
        return {"message": "Training program deleted successfully"}
        
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


# Session endpoints using ManageSessionsUseCase

@router.post("/{program_id}/sessions", response_model=TrainingSessionResponse)
async def create_training_session(
    program_id: UUID,
    session_data: TrainingSessionCreate,
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case)
) -> TrainingSessionResponse:
    """Create a new training session for a program."""
    
    # Create session request
    session_request = ManageSessionsRequest(
        action=SessionAction.CREATE,
        program_id=program_id,
        scheduled_start=session_data.scheduled_start,
        scheduled_end=session_data.scheduled_end,
        instructor_id=session_data.instructor_id
    )
    
    user_context = extract_user_context(current_user)
    
    try:
        result = await manage_sessions_use_case.execute(session_request, user_context)
        
        if not result.session:
            raise RuntimeError("Session creation failed - no session returned")
            
        session = result.session
        
        return TrainingSessionResponse(
            id=session.id or uuid4(),
            program_id=session.program_id,
            scheduled_start=session.scheduled_start,
            scheduled_end=session.scheduled_end,
            location=getattr(session, 'location', None),
            max_participants=getattr(session, 'max_participants', 20),
            instructor_id=session.instructor_id,
            notes=getattr(session, 'notes', None),
            created_at=session.created_at or datetime.now(timezone.utc),
            updated_at=session.updated_at or datetime.now(timezone.utc)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/{program_id}/sessions", response_model=list[TrainingSessionResponse])
async def list_training_sessions(
    program_id: UUID,
    current_user: User = Depends(get_current_user),
    manage_sessions_use_case: ManageSessionsUseCase = Depends(get_manage_sessions_use_case)
) -> list[TrainingSessionResponse]:
    """List training sessions for a specific program."""
    
    try:
        # TODO: Enhance ManageSessionsUseCase to support listing sessions
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