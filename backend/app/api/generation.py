"""
Content generation API endpoints for Content Studio.
Manages AI content generation sessions and activity creation.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.core.deps import (
    get_current_user, 
    get_generate_content_use_case,
    get_list_generation_sessions_use_case,
    get_get_generation_session_use_case,
    get_cancel_generation_use_case,
    get_generation_status_use_case,
    get_create_activity_from_generation_use_case,
    get_start_generation_use_case,
    get_retry_generation_use_case,
    get_generation_statistics_use_case
)
from app.core.user_context import extract_user_context
from app.models.generation_session import GenerationStatus
from app.models.user import User
from app.schemas.generation import (
    ActivityFromGenerationCreate,
    GenerationSessionCreate,
    GenerationSessionListResponse,
    GenerationSessionResponse,
    GenerationSessionSummary,
    GenerationStatisticsResponse,
)
from app.services.use_cases.content.generate_content_use_case import (
    GenerateContentUseCase, GenerateContentRequest
)
from app.services.use_cases.content.list_generation_sessions_use_case import (
    ListGenerationSessionsUseCase, ListGenerationSessionsRequest
)
from app.services.use_cases.content.get_generation_session_use_case import (
    GetGenerationSessionUseCase, GetGenerationSessionRequest
)
from app.services.use_cases.content.cancel_generation_use_case import (
    CancelGenerationUseCase, CancelGenerationRequest
)
from app.services.use_cases.content.generation_status_use_case import (
    GenerationStatusUseCase, GenerationStatusRequest
)
from app.services.use_cases.content.create_activity_from_generation_use_case import (
    CreateActivityFromGenerationUseCase, CreateActivityFromGenerationRequest
)
from app.services.use_cases.content.start_generation_use_case import (
    StartGenerationUseCase, StartGenerationRequest
)
from app.services.use_cases.content.retry_generation_use_case import (
    RetryGenerationUseCase, RetryGenerationRequest
)
from app.services.use_cases.content.get_generation_statistics_use_case import (
    GetGenerationStatisticsUseCase, GetGenerationStatisticsRequest
)

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
    description="Create a new AI content generation session using Clean Architecture.",
)
async def create_generation_session(
    session_data: GenerationSessionCreate,
    current_user: User = Depends(get_current_user),
    generate_content_use_case: GenerateContentUseCase = Depends(get_generate_content_use_case),
) -> GenerationSessionResponse:
    """Create a new generation session using Clean Architecture with event-driven workflows."""

    # Convert API schema to use case request
    generate_request = GenerateContentRequest(
        source_document_ids=session_data.source_document_ids,
        prompt_config=session_data.prompt_config,
        generation_type="scenario",  # Default type
        activity_name=getattr(session_data, 'activity_name', None),
        activity_description=getattr(session_data, 'activity_description', None),
        auto_create_content=False  # Just create session, don't auto-create content
    )

    try:
        # Execute generation use case (creates session but doesn't start generation)
        result = await generate_content_use_case.execute(
            generate_request,
            extract_user_context(current_user)
        )

        # Convert use case response to API response
        session = result.generation_session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),  # Ensure not None
            user_id=session.user_id or uuid.uuid4(),  # Ensure not None
            status=session.status.value if hasattr(session.status, 'value') else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, 'started_at', None),
            completed_at=getattr(session, 'completed_at', None),
            total_tokens_used=getattr(session, 'total_tokens_used', None),
            generation_time_seconds=getattr(session, 'generation_time_seconds', None),
            source_documents=[],  # Will be populated from source_document_ids if needed
            has_valid_nlj=False,  # Will be updated based on generated content
            validation_errors=None,
            prompt_config=getattr(session, 'prompt_config', session.config if hasattr(session, 'config') else {}),
            claude_conversation_id=getattr(session, 'claude_conversation_id', None),
            claude_message_id=getattr(session, 'claude_message_id', None),
            generated_content=session.generated_content,
            validated_nlj=None,  # Will be populated after validation
            error_message=session.error_message,
            created_activities_count=0  # New session
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to create generation session"
        )


@router.post(
    "/sessions/{session_id}/start",
    response_model=GenerationSessionResponse,
    summary="Start generation",
    description="Start the AI content generation process for a session using Clean Architecture.",
)
async def start_generation(
    session_id: uuid.UUID, 
    current_user: User = Depends(get_current_user),
    start_generation_use_case: StartGenerationUseCase = Depends(get_start_generation_use_case)
) -> GenerationSessionResponse:
    """Start generation process using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        start_request = StartGenerationRequest(
            session_id=session_id,
            force_restart=False  # Only allow starting PENDING sessions
        )

        # Execute use case
        result = await start_generation_use_case.execute(
            start_request,
            extract_user_context(current_user)
        )

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, 'value') else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, 'started_at', None),
            completed_at=getattr(session, 'completed_at', None),
            total_tokens_used=getattr(session, 'total_tokens_used', None),
            generation_time_seconds=getattr(session, 'generation_time_seconds', None),
            source_documents=[],  # Could be populated from session data
            has_valid_nlj=False,  # Will be updated when generation completes
            validation_errors=None,
            prompt_config=getattr(session, 'prompt_config', {}),
            claude_conversation_id=getattr(session, 'claude_conversation_id', None),
            claude_message_id=getattr(session, 'claude_message_id', None),
            generated_content=session.generated_content,
            validated_nlj=None,
            error_message=session.error_message,
            created_activities_count=0  # New processing session
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to start generation process"
        )


@router.get(
    "/sessions",
    response_model=GenerationSessionListResponse,
    summary="List generation sessions",
    description="Get paginated list of user's generation sessions using Clean Architecture.",
)
async def list_generation_sessions(
    status_filter: Optional[str] = Query(None, description="Filter by session status"),
    limit: int = Query(50, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_current_user),
    list_sessions_use_case: ListGenerationSessionsUseCase = Depends(get_list_generation_sessions_use_case),
) -> GenerationSessionListResponse:
    """List user's generation sessions using Clean Architecture with event-driven workflows."""

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

        # Create use case request
        list_request = ListGenerationSessionsRequest(
            user_id=None,  # None means current user
            status_filter=status_enum,
            limit=limit,
            offset=offset
        )

        # Execute use case
        result = await list_sessions_use_case.execute(
            list_request,
            extract_user_context(current_user)
        )

        # Convert use case response to API response
        session_summaries = []
        for session_schema in result.sessions:
            summary = GenerationSessionSummary(
                id=session_schema.id or uuid.uuid4(),
                status=session_schema.status.value if hasattr(session_schema.status, 'value') else str(session_schema.status),
                created_at=session_schema.created_at or datetime.now(),
                started_at=getattr(session_schema, 'started_at', None),
                completed_at=getattr(session_schema, 'completed_at', None),
                total_tokens_used=getattr(session_schema, 'total_tokens_used', None),
                generation_time_seconds=getattr(session_schema, 'generation_time_seconds', None),
                source_documents=[],  # Could be populated if needed
                has_valid_nlj=bool(session_schema.generated_content),
                validation_errors=None
            )
            session_summaries.append(summary)

        return GenerationSessionListResponse(
            items=session_summaries, 
            total=result.total_count, 
            limit=result.limit, 
            offset=result.offset
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to list generation sessions"
        )


@router.get(
    "/sessions/{session_id}",
    response_model=GenerationSessionResponse,
    summary="Get generation session",
    description="Get detailed information about a generation session using Clean Architecture.",
)
async def get_generation_session(
    session_id: uuid.UUID, 
    current_user: User = Depends(get_current_user),
    get_session_use_case: GetGenerationSessionUseCase = Depends(get_get_generation_session_use_case)
) -> GenerationSessionResponse:
    """Get generation session by ID using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        get_request = GetGenerationSessionRequest(
            session_id=session_id,
            include_activity_data=True
        )

        # Execute use case
        result = await get_session_use_case.execute(
            get_request,
            extract_user_context(current_user)
        )

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, 'value') else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, 'started_at', None),
            completed_at=getattr(session, 'completed_at', None),
            total_tokens_used=getattr(session, 'total_tokens_used', None),
            generation_time_seconds=getattr(session, 'generation_time_seconds', None),
            source_documents=[],  # Could be populated from session data
            has_valid_nlj=result.can_create_activity,
            validation_errors=None,
            prompt_config=getattr(session, 'prompt_config', {}),
            claude_conversation_id=getattr(session, 'claude_conversation_id', None),
            claude_message_id=getattr(session, 'claude_message_id', None),
            generated_content=session.generated_content,
            validated_nlj=None,  # Could be enhanced
            error_message=session.error_message,
            created_activities_count=result.activity_count
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to retrieve generation session"
        )


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=GenerationSessionResponse,
    summary="Cancel generation session",
    description="Cancel a pending or processing generation session using Clean Architecture.",
)
async def cancel_generation_session(
    session_id: uuid.UUID, 
    current_user: User = Depends(get_current_user),
    cancel_use_case: CancelGenerationUseCase = Depends(get_cancel_generation_use_case)
) -> GenerationSessionResponse:
    """Cancel generation session using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        cancel_request = CancelGenerationRequest(
            session_id=session_id,
            cancellation_reason="User requested cancellation"
        )

        # Execute use case
        result = await cancel_use_case.execute(
            cancel_request,
            extract_user_context(current_user)
        )

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, 'value') else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, 'started_at', None),
            completed_at=getattr(session, 'completed_at', None),
            total_tokens_used=getattr(session, 'total_tokens_used', None),
            generation_time_seconds=getattr(session, 'generation_time_seconds', None),
            source_documents=[],
            has_valid_nlj=False,  # Cancelled session
            validation_errors=None,
            prompt_config=getattr(session, 'prompt_config', {}),
            claude_conversation_id=getattr(session, 'claude_conversation_id', None),
            claude_message_id=getattr(session, 'claude_message_id', None),
            generated_content=session.generated_content,
            validated_nlj=None,
            error_message=session.error_message,
            created_activities_count=0  # Cancelled session
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to cancel generation session"
        )


@router.post(
    "/sessions/{session_id}/retry",
    response_model=GenerationSessionResponse,
    summary="Retry failed generation",
    description="Retry a failed generation session using Clean Architecture.",
)
async def retry_generation_session(
    session_id: uuid.UUID, 
    current_user: User = Depends(get_current_user),
    retry_generation_use_case: RetryGenerationUseCase = Depends(get_retry_generation_use_case)
) -> GenerationSessionResponse:
    """Retry failed generation session using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        retry_request = RetryGenerationRequest(
            session_id=session_id,
            reset_configuration=False,  # Keep original configuration
            preserve_error_history=True  # Keep error history for debugging
        )

        # Execute use case
        result = await retry_generation_use_case.execute(
            retry_request,
            extract_user_context(current_user)
        )

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, 'value') else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, 'started_at', None),
            completed_at=getattr(session, 'completed_at', None),
            total_tokens_used=getattr(session, 'total_tokens_used', None),
            generation_time_seconds=getattr(session, 'generation_time_seconds', None),
            source_documents=[],  # Could be populated from session data
            has_valid_nlj=False,  # Will be updated when generation completes
            validation_errors=None,
            prompt_config=getattr(session, 'prompt_config', {}),
            claude_conversation_id=getattr(session, 'claude_conversation_id', None),
            claude_message_id=getattr(session, 'claude_message_id', None),
            generated_content=session.generated_content,
            validated_nlj=None,
            error_message=session.error_message,  # May include retry history
            created_activities_count=0  # Retrying session
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to retry generation process"
        )


@router.post(
    "/sessions/{session_id}/create-activity",
    response_model=Dict[str, Any],
    summary="Create activity from generation",
    description="Create an activity from a completed generation session using Clean Architecture.",
)
async def create_activity_from_generation(
    session_id: uuid.UUID,
    activity_data: ActivityFromGenerationCreate,
    current_user: User = Depends(get_current_user),
    create_activity_use_case: CreateActivityFromGenerationUseCase = Depends(get_create_activity_from_generation_use_case)
) -> Dict[str, Any]:
    """Create activity from generation session using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        create_request = CreateActivityFromGenerationRequest(
            session_id=session_id,
            activity_title=activity_data.title,
            activity_description=activity_data.description,
            override_content_type=None,  # Use default
            add_generation_metadata=True  # Include generation metadata
        )

        # Execute use case
        result = await create_activity_use_case.execute(
            create_request,
            extract_user_context(current_user)
        )

        # Return API response
        response_dict: Dict[str, Any] = {
            "activity_id": str(result.activity.id),
            "message": "Activity created successfully",
            "flow_editor_url": f"/app/flow/{result.activity.id}",
            "generation_quality": result.generation_data_quality,
            "validation_warnings": result.validation_warnings
        }
        return response_dict

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to create activity from generation session"
        )


@router.get(
    "/statistics",
    response_model=GenerationStatisticsResponse,
    summary="Get generation statistics",
    description="Get user's generation session statistics and usage metrics using Clean Architecture.",
)
async def get_generation_statistics(
    current_user: User = Depends(get_current_user),
    statistics_use_case: GetGenerationStatisticsUseCase = Depends(get_generation_statistics_use_case)
) -> GenerationStatisticsResponse:
    """Get generation statistics using Clean Architecture with comprehensive analytics."""

    try:
        # Create use case request
        stats_request = GetGenerationStatisticsRequest(
            user_id=None,  # Current user
            include_global_stats=False,  # User stats only
            time_period_days=None  # All time
        )

        # Execute use case
        result = await statistics_use_case.execute(
            stats_request,
            extract_user_context(current_user)
        )

        # Convert use case response to API response
        return GenerationStatisticsResponse(
            total_sessions=result.total_sessions,
            completed_sessions=result.completed_sessions,
            failed_sessions=result.failed_sessions,
            success_rate=result.success_rate / 100.0,  # Convert percentage to decimal
            total_tokens_used=result.total_tokens_used,
            average_generation_time=result.average_generation_time_seconds,
            activities_created=result.activities_created
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to retrieve generation statistics"
        )


@router.post(
    "/content-studio/generate",
    response_model=GenerationProgressResponse,
    summary="Content Studio Generation",
    description="Clean Architecture endpoint for Content Studio integrated generation workflow with xAPI events.",
)
async def content_studio_generate(
    request: ContentStudioGenerateRequest,
    current_user: User = Depends(get_current_user),
    generate_content_use_case: GenerateContentUseCase = Depends(get_generate_content_use_case),
) -> GenerationProgressResponse:
    """
    Clean Architecture generation endpoint for Content Studio.
    Creates session, starts generation, and publishes comprehensive xAPI events.
    """

    # Convert API schema to use case request
    generate_request = GenerateContentRequest(
        source_document_ids=request.source_document_ids,
        prompt_config={
            **request.prompt_config,
            "generated_prompt_text": request.generated_prompt or request.prompt_config.get("generated_prompt_text", "")
        },
        generation_type="scenario",  # Content Studio default
        activity_name=request.activity_name,
        activity_description=request.activity_description,
        auto_create_content=False  # Content Studio manages this separately
    )

    try:
        # Execute generation use case with comprehensive business logic
        result = await generate_content_use_case.execute(
            generate_request,
            extract_user_context(current_user)
        )

        # Extract session information from result
        session = result.generation_session
        
        # Handle both enum and string status values
        status_str = session.status.value if hasattr(session.status, "value") else str(session.status)

        # Determine progress based on generation state
        progress_percentage = 10 if result.generation_started else 5
        current_step = "Generation started..." if result.generation_started else "Session created, starting generation..."

        return GenerationProgressResponse(
            session_id=session.id or uuid.uuid4(),  # Ensure not None
            status=status_str,
            progress_percentage=progress_percentage,
            current_step=current_step,
            error_message=session.error_message,
            generated_content=session.generated_content,
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to start generation process"
        )


@router.get(
    "/content-studio/sessions/{session_id}/status",
    response_model=GenerationProgressResponse,
    summary="Content Studio Generation Status",
    description="Get generation status for Content Studio polling using Clean Architecture.",
)
async def content_studio_generation_status(
    session_id: uuid.UUID, 
    current_user: User = Depends(get_current_user),
    status_use_case: GenerationStatusUseCase = Depends(get_generation_status_use_case)
) -> GenerationProgressResponse:
    """Get generation status for Content Studio frontend polling using Clean Architecture."""

    try:
        # Create use case request
        status_request = GenerationStatusRequest(
            session_id=session_id,
            include_progress_details=True,
            include_error_details=True
        )

        # Execute use case
        result = await status_use_case.execute(
            status_request,
            extract_user_context(current_user)
        )

        # Get generated content if completed
        generated_content: Optional[Dict[str, Any]] = None
        if result.is_completed and result.has_generated_content:
            # This would need to be enhanced to get actual content
            # For now, we'll use a placeholder approach
            generated_content = {}  # Would be populated from session data

        # Handle both enum and string status values
        status_str = result.status.value if hasattr(result.status, "value") else str(result.status)

        # Reduced logging - only log when status changes or on errors
        if result.error_message or result.status != GenerationStatus.PROCESSING:
            print("🔍 Generation Status Update:")
            print(f"  - session_id: {result.session_id}")
            print(f"  - status: {status_str}")
            print(f"  - progress_percentage: {result.progress_percentage}")
            if result.error_message:
                print(f"  - error_message: {result.error_message}")
            if generated_content:
                print(f"  - generated_content type: {type(generated_content)}")

        return GenerationProgressResponse(
            session_id=result.session_id,
            status=status_str,
            progress_percentage=result.progress_percentage,
            current_step=result.current_step,
            error_message=result.error_message,
            generated_content=generated_content,
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=str(e)
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to retrieve generation status"
        )
