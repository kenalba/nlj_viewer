"""
Content generation API endpoints for Content Studio.
Manages AI content generation sessions and activity creation.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.generation_session import GenerationSession, GenerationStatus
from app.services.generation_service import GenerationService
from app.schemas.generation import (
    GenerationSessionCreate,
    GenerationSessionResponse,
    GenerationSessionSummary,
    GenerationSessionListResponse,
    ActivityFromGenerationCreate,
    GenerationStatisticsResponse
)

router = APIRouter(prefix="/generation", tags=["generation"])


@router.post(
    "/sessions",
    response_model=GenerationSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create generation session",
    description="Create a new AI content generation session."
)
async def create_generation_session(
    session_data: GenerationSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Create a new generation session."""
    
    # Permission check: Creators and above can generate content
    if current_user.role not in [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to generate content"
        )
    
    try:
        service = GenerationService(db)
        session = await service.create_generation_session(
            user_id=current_user.id,
            prompt_config=session_data.prompt_config,
            source_document_ids=session_data.source_document_ids
        )
        
        return GenerationSessionResponse.from_orm(session)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create generation session: {str(e)}"
        )


@router.post(
    "/sessions/{session_id}/start",
    response_model=GenerationSessionResponse,
    summary="Start generation",
    description="Start the AI content generation process for a session."
)
async def start_generation(
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Start generation process."""
    
    service = GenerationService(db)
    
    # Get session to return current state
    session = await service.get_session_by_id(session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation session not found"
        )
    
    if session.status != GenerationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session is not in pending state (current: {session.status})"
        )
    
    # Start generation in background
    background_tasks.add_task(service.start_generation, session_id, current_user.id)
    
    # Return session with updated status
    session.status = GenerationStatus.PROCESSING
    await db.commit()
    
    return GenerationSessionResponse.from_orm(session)


@router.get(
    "/sessions",
    response_model=GenerationSessionListResponse,
    summary="List generation sessions",
    description="Get paginated list of user's generation sessions."
)
async def list_generation_sessions(
    status_filter: Optional[str] = Query(None, description="Filter by session status"),
    limit: int = Query(50, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GenerationSessionListResponse:
    """List user's generation sessions."""
    
    try:
        # Parse status filter
        status_enum = None
        if status_filter:
            try:
                status_enum = GenerationStatus(status_filter)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status filter: {status_filter}"
                )
        
        service = GenerationService(db)
        sessions, total_count = await service.get_user_sessions(
            user_id=current_user.id,
            status=status_enum,
            limit=limit,
            offset=offset
        )
        
        # Convert to summary format
        session_summaries = [
            GenerationSessionSummary.from_orm(session) for session in sessions
        ]
        
        return GenerationSessionListResponse(
            items=session_summaries,
            total=total_count,
            limit=limit,
            offset=offset
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list generation sessions: {str(e)}"
        )


@router.get(
    "/sessions/{session_id}",
    response_model=GenerationSessionResponse,
    summary="Get generation session",
    description="Get detailed information about a generation session."
)
async def get_generation_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Get generation session by ID."""
    
    service = GenerationService(db)
    session = await service.get_session_by_id(session_id, current_user.id)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation session not found"
        )
    
    return GenerationSessionResponse.from_orm(session)


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=GenerationSessionResponse,
    summary="Cancel generation session",
    description="Cancel a pending or processing generation session."
)
async def cancel_generation_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Cancel generation session."""
    
    service = GenerationService(db)
    success = await service.cancel_session(session_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel session (not found or not cancellable)"
        )
    
    session = await service.get_session_by_id(session_id, current_user.id)
    return GenerationSessionResponse.from_orm(session)


@router.post(
    "/sessions/{session_id}/retry",
    response_model=GenerationSessionResponse,
    summary="Retry failed generation",
    description="Retry a failed generation session."
)
async def retry_generation_session(
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Retry failed generation session."""
    
    service = GenerationService(db)
    
    # Start retry in background
    background_tasks.add_task(service.retry_failed_session, session_id, current_user.id)
    
    session = await service.get_session_by_id(session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation session not found"
        )
    
    return GenerationSessionResponse.from_orm(session)


@router.post(
    "/sessions/{session_id}/create-activity",
    response_model=dict,
    summary="Create activity from generation",
    description="Create an activity from a completed generation session."
)
async def create_activity_from_generation(
    session_id: uuid.UUID,
    activity_data: ActivityFromGenerationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Create activity from generation session."""
    
    service = GenerationService(db)
    activity = await service.create_activity_from_session(
        session_id=session_id,
        user_id=current_user.id,
        title=activity_data.title,
        description=activity_data.description
    )
    
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create activity from session (session not found or invalid)"
        )
    
    return {
        "activity_id": str(activity.id),
        "message": "Activity created successfully",
        "flow_editor_url": f"/app/flow/{activity.id}"
    }


@router.get(
    "/statistics",
    response_model=GenerationStatisticsResponse,
    summary="Get generation statistics",
    description="Get user's generation session statistics and usage metrics."
)
async def get_generation_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GenerationStatisticsResponse:
    """Get generation statistics."""
    
    service = GenerationService(db)
    stats = await service.get_session_statistics(current_user.id)
    
    return GenerationStatisticsResponse(**stats)