"""
Content generation API endpoints for Content Studio.
Manages AI content generation sessions and activity creation.
"""

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import get_db
from app.core.deps import get_current_user
from app.models.generation_session import GenerationStatus
from app.models.user import User, UserRole
from app.schemas.generation import (
    ActivityFromGenerationCreate,
    GenerationSessionCreate,
    GenerationSessionListResponse,
    GenerationSessionResponse,
    GenerationSessionSummary,
    GenerationStatisticsResponse,
)
from app.services.generation_service import GenerationService
from app.services.kafka_service import get_xapi_event_service

router = APIRouter(prefix="/generation", tags=["generation"])


# Additional schemas for Content Studio integration
class ContentStudioGenerateRequest(BaseModel):
    """Request schema for Content Studio integrated generation."""

    source_document_ids: List[uuid.UUID] = Field(..., description="Selected source document IDs")
    prompt_config: Dict[str, Any] = Field(..., description="Prompt configuration from Content Studio")
    generated_prompt: Optional[str] = Field(None, description="Pre-generated prompt text from frontend")
    activity_name: Optional[str] = Field(None, description="Name for generated activity")
    activity_description: Optional[str] = Field(None, description="Description for generated activity")


class GenerationProgressResponse(BaseModel):
    """Response for generation progress tracking."""

    session_id: uuid.UUID = Field(..., description="Generation session ID")
    status: str = Field(..., description="Current generation status")
    progress_percentage: Optional[int] = Field(None, description="Progress percentage (0-100)")
    current_step: Optional[str] = Field(None, description="Current processing step")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    generated_content: Optional[Dict[str, Any]] = Field(None, description="Generated NLJ content if completed")


@router.post(
    "/sessions",
    response_model=GenerationSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create generation session",
    description="Create a new AI content generation session.",
)
async def create_generation_session(
    session_data: GenerationSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerationSessionResponse:
    """Create a new generation session."""

    # Permission check: Creators and above can generate content
    if current_user.role not in [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to generate content"
        )

    try:
        service = GenerationService(db)
        session = await service.create_generation_session(
            user_id=current_user.id,
            prompt_config=session_data.prompt_config,
            source_document_ids=session_data.source_document_ids,
        )

        return GenerationSessionResponse.from_orm(session)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create generation session: {str(e)}"
        )


@router.post(
    "/sessions/{session_id}/start",
    response_model=GenerationSessionResponse,
    summary="Start generation",
    description="Start the AI content generation process for a session.",
)
async def start_generation(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Start generation process."""

    service = GenerationService(db)

    # Get session to return current state
    session = await service.get_session_by_id(session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation session not found")

    if session.status != GenerationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session is not in pending state (current: {session.status})",
        )

    # Publish content generation requested event instead of background task
    try:
        xapi_service = await get_xapi_event_service()

        # Get source document IDs for the event
        source_doc_ids = (
            [str(source.source_document_id) for source in session.activity_sources] if session.activity_sources else []
        )

        await xapi_service.publish_content_generation_requested(
            session_id=str(session_id),
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_name=current_user.full_name or current_user.username,
            source_document_ids=source_doc_ids,
            prompt_config=session.prompt_config or {},
        )

        # Update session status - the event consumer will handle the actual generation
        session.status = GenerationStatus.PROCESSING
        await db.commit()

        return GenerationSessionResponse.from_orm(session)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to start generation: {str(e)}"
        )


@router.get(
    "/sessions",
    response_model=GenerationSessionListResponse,
    summary="List generation sessions",
    description="Get paginated list of user's generation sessions.",
)
async def list_generation_sessions(
    status_filter: Optional[str] = Query(None, description="Filter by session status"),
    limit: int = Query(50, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
                    status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status filter: {status_filter}"
                )

        service = GenerationService(db)
        sessions, total_count = await service.get_user_sessions(
            user_id=current_user.id, status=status_enum, limit=limit, offset=offset
        )

        # Convert to summary format
        session_summaries = [GenerationSessionSummary.from_orm(session) for session in sessions]

        return GenerationSessionListResponse(items=session_summaries, total=total_count, limit=limit, offset=offset)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list generation sessions: {str(e)}"
        )


@router.get(
    "/sessions/{session_id}",
    response_model=GenerationSessionResponse,
    summary="Get generation session",
    description="Get detailed information about a generation session.",
)
async def get_generation_session(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Get generation session by ID."""

    service = GenerationService(db)
    session = await service.get_session_by_id(session_id, current_user.id)

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation session not found")

    return GenerationSessionResponse.from_orm(session)


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=GenerationSessionResponse,
    summary="Cancel generation session",
    description="Cancel a pending or processing generation session.",
)
async def cancel_generation_session(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Cancel generation session."""

    service = GenerationService(db)
    success = await service.cancel_session(session_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel session (not found or not cancellable)"
        )

    session = await service.get_session_by_id(session_id, current_user.id)
    return GenerationSessionResponse.from_orm(session)


@router.post(
    "/sessions/{session_id}/retry",
    response_model=GenerationSessionResponse,
    summary="Retry failed generation",
    description="Retry a failed generation session.",
)
async def retry_generation_session(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> GenerationSessionResponse:
    """Retry failed generation session."""

    service = GenerationService(db)

    session = await service.get_session_by_id(session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation session not found")

    if session.status not in [GenerationStatus.FAILED, GenerationStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session cannot be retried (current status: {session.status})",
        )

    # Publish content generation requested event for retry instead of background task
    try:
        xapi_service = await get_xapi_event_service()

        # Get source document IDs for the event
        source_doc_ids = (
            [str(source.source_document_id) for source in session.activity_sources] if session.activity_sources else []
        )

        await xapi_service.publish_content_generation_requested(
            session_id=str(session_id),
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_name=current_user.full_name or current_user.username,
            source_document_ids=source_doc_ids,
            prompt_config=session.prompt_config or {},
        )

        # Reset session to processing state
        session.status = GenerationStatus.PROCESSING
        session.error_message = None
        session.error_details = None
        await db.commit()

        return GenerationSessionResponse.from_orm(session)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retry generation: {str(e)}"
        )


@router.post(
    "/sessions/{session_id}/create-activity",
    response_model=dict,
    summary="Create activity from generation",
    description="Create an activity from a completed generation session.",
)
async def create_activity_from_generation(
    session_id: uuid.UUID,
    activity_data: ActivityFromGenerationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create activity from generation session."""

    service = GenerationService(db)
    activity = await service.create_activity_from_session(
        session_id=session_id, user_id=current_user.id, title=activity_data.title, description=activity_data.description
    )

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create activity from session (session not found or invalid)",
        )

    return {
        "activity_id": str(activity.id),
        "message": "Activity created successfully",
        "flow_editor_url": f"/app/flow/{activity.id}",
    }


@router.get(
    "/statistics",
    response_model=GenerationStatisticsResponse,
    summary="Get generation statistics",
    description="Get user's generation session statistics and usage metrics.",
)
async def get_generation_statistics(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> GenerationStatisticsResponse:
    """Get generation statistics."""

    service = GenerationService(db)
    stats = await service.get_session_statistics(current_user.id)

    return GenerationStatisticsResponse(**stats)


@router.post(
    "/content-studio/generate",
    response_model=GenerationProgressResponse,
    summary="Content Studio Generation",
    description="Simplified endpoint for Content Studio integrated generation workflow.",
)
async def content_studio_generate(
    request: ContentStudioGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerationProgressResponse:
    """
    Simplified generation endpoint for Content Studio.
    Creates session, starts generation, and returns tracking info.
    """

    # Permission check
    if current_user.role not in [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to generate content"
        )

    try:
        service = GenerationService(db)

        # Create and start generation session in one step
        session = await service.create_generation_session(
            user_id=current_user.id,
            prompt_config=request.prompt_config,
            source_document_ids=request.source_document_ids,
            generated_prompt_text=request.generated_prompt,
        )

        # Publish content generation requested event instead of background task
        xapi_service = await get_xapi_event_service()

        # Get source document IDs for the event
        source_doc_ids = [str(doc_id) for doc_id in request.source_document_ids]

        await xapi_service.publish_content_generation_requested(
            session_id=str(session.id),
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_name=current_user.full_name or current_user.username,
            source_document_ids=source_doc_ids,
            prompt_config=request.prompt_config,
        )

        # Update session status
        session.status = GenerationStatus.PROCESSING
        await db.commit()

        # Handle both enum and string status values
        status_str = session.status.value if hasattr(session.status, "value") else session.status

        return GenerationProgressResponse(
            session_id=session.id,
            status=status_str,
            progress_percentage=10,
            current_step="Starting generation...",
            error_message=None,
            generated_content=None,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to start generation: {str(e)}"
        )


@router.get(
    "/content-studio/sessions/{session_id}/status",
    response_model=GenerationProgressResponse,
    summary="Content Studio Generation Status",
    description="Get generation status for Content Studio polling.",
)
async def content_studio_generation_status(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> GenerationProgressResponse:
    """Get generation status for Content Studio frontend polling."""

    service = GenerationService(db)
    session = await service.get_session_by_id(session_id, current_user.id)

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation session not found")

    # Map status to progress percentage
    progress_map = {
        GenerationStatus.PENDING: 0,
        GenerationStatus.PROCESSING: 50,
        GenerationStatus.COMPLETED: 100,
        GenerationStatus.FAILED: None,
        GenerationStatus.CANCELLED: None,
    }

    # Get generated content if completed
    generated_content = None
    if session.status == GenerationStatus.COMPLETED:
        print(f"🔍 Session {session_id} completed, checking for validated_nlj...")
        print(f"🔍 session.validated_nlj is: {session.validated_nlj}")
        print(f"🔍 session.generated_content is: {session.generated_content}")
        if session.validated_nlj:
            generated_content = session.validated_nlj
            print(f"✅ Using validated_nlj: {type(generated_content)}")
        elif (
            session.generated_content
            and isinstance(session.generated_content, dict)
            and "generated_json" in session.generated_content
        ):
            generated_content = session.generated_content["generated_json"]
            print(f"✅ Using generated_content['generated_json']: {type(generated_content)}")
        else:
            print("❌ No valid content found in session")

    # Handle both enum and string status values
    status_str = session.status.value if hasattr(session.status, "value") else session.status

    # Reduced logging - only log when status changes or on errors
    if session.error_message or session.status != GenerationStatus.PROCESSING:
        print("🔍 Generation Status Update:")
        print(f"  - session_id: {session.id}")
        print(f"  - status: {status_str}")
        print(f"  - progress_percentage: {progress_map.get(session.status)}")
        if session.error_message:
            print(f"  - error_message: {session.error_message}")
        if generated_content:
            print(f"  - generated_content type: {type(generated_content)}")
            print(
                f"  - generated_content keys: {list(generated_content.keys()) if isinstance(generated_content, dict) else 'Not a dict'}"
            )

    return GenerationProgressResponse(
        session_id=session.id,
        status=status_str,
        progress_percentage=progress_map.get(session.status),
        current_step=status_str.replace("_", " ").title(),
        error_message=session.error_message,
        generated_content=generated_content,
    )
