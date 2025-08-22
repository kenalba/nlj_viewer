"""
Content generation API endpoints for Content Studio.
Manages AI content generation sessions and activity creation.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
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
    get_generation_statistics_use_case,
)
from app.core.database_manager import get_db
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
from app.services.use_cases.content.generate_content_use_case import GenerateContentUseCase, GenerateContentRequest
from app.services.use_cases.content.list_generation_sessions_use_case import (
    ListGenerationSessionsUseCase,
    ListGenerationSessionsRequest,
)
from app.services.use_cases.content.get_generation_session_use_case import (
    GetGenerationSessionUseCase,
    GetGenerationSessionRequest,
)
from app.services.use_cases.content.cancel_generation_use_case import CancelGenerationUseCase, CancelGenerationRequest
from app.services.use_cases.content.generation_status_use_case import GenerationStatusUseCase, GenerationStatusRequest
from app.services.use_cases.content.create_activity_from_generation_use_case import (
    CreateActivityFromGenerationUseCase,
    CreateActivityFromGenerationRequest,
)
from app.services.use_cases.content.start_generation_use_case import StartGenerationUseCase, StartGenerationRequest
from app.services.use_cases.content.retry_generation_use_case import RetryGenerationUseCase, RetryGenerationRequest
from app.services.use_cases.content.get_generation_statistics_use_case import (
    GetGenerationStatisticsUseCase,
    GetGenerationStatisticsRequest,
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
    generation_type: Optional[str] = Field(
        "scenario", description="Type of content to generate (activity, assessment, survey, etc.)"
    )


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
        prompt_config={**session_data.prompt_config, "generation_type": "scenario"},  # Ensure required field is present
        generation_type="scenario",  # Default type
        activity_name=getattr(session_data, "activity_name", None),
        activity_description=getattr(session_data, "activity_description", None),
        auto_create_content=False,  # Just create session, don't auto-create content
    )

    try:
        # Execute generation use case (creates session but doesn't start generation)
        result = await generate_content_use_case.execute(generate_request, extract_user_context(current_user))

        # Convert use case response to API response
        session = result.generation_session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),  # Ensure not None
            user_id=session.user_id or uuid.uuid4(),  # Ensure not None
            status=session.status.value if hasattr(session.status, "value") else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, "started_at", None),
            completed_at=getattr(session, "completed_at", None),
            total_tokens_used=getattr(session, "total_tokens_used", None),
            generation_time_seconds=getattr(session, "generation_time_seconds", None),
            source_documents=[],  # Will be populated from source_document_ids if needed
            has_valid_nlj=False,  # Will be updated based on generated content
            validation_errors=None,
            prompt_config=getattr(session, "prompt_config", session.config if hasattr(session, "config") else {}),
            claude_conversation_id=getattr(session, "claude_conversation_id", None),
            claude_message_id=getattr(session, "claude_message_id", None),
            generated_content=session.generated_content,
            validated_nlj=None,  # Will be populated after validation
            error_message=session.error_message,
            created_activities_count=0,  # New session
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create generation session"
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
    start_generation_use_case: StartGenerationUseCase = Depends(get_start_generation_use_case),
) -> GenerationSessionResponse:
    """Start generation process using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        start_request = StartGenerationRequest(
            session_id=session_id, force_restart=False  # Only allow starting PENDING sessions
        )

        # Execute use case
        result = await start_generation_use_case.execute(start_request, extract_user_context(current_user))

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, "value") else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, "started_at", None),
            completed_at=getattr(session, "completed_at", None),
            total_tokens_used=getattr(session, "total_tokens_used", None),
            generation_time_seconds=getattr(session, "generation_time_seconds", None),
            source_documents=[],  # Could be populated from session data
            has_valid_nlj=False,  # Will be updated when generation completes
            validation_errors=None,
            prompt_config=getattr(session, "prompt_config", {}),
            claude_conversation_id=getattr(session, "claude_conversation_id", None),
            claude_message_id=getattr(session, "claude_message_id", None),
            generated_content=session.generated_content,
            validated_nlj=None,
            error_message=session.error_message,
            created_activities_count=0,  # New processing session
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to start generation process"
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
            user_id=None, status_filter=status_enum, limit=limit, offset=offset  # None means current user
        )

        # Execute use case
        result = await list_sessions_use_case.execute(list_request, extract_user_context(current_user))

        # Convert use case response to API response
        session_summaries = []
        for session_schema in result.sessions:
            summary = GenerationSessionSummary(
                id=session_schema.id or uuid.uuid4(),
                status=(
                    session_schema.status.value
                    if hasattr(session_schema.status, "value")
                    else str(session_schema.status)
                ),
                created_at=session_schema.created_at or datetime.now(),
                started_at=getattr(session_schema, "started_at", None),
                completed_at=getattr(session_schema, "completed_at", None),
                total_tokens_used=getattr(session_schema, "total_tokens_used", None),
                generation_time_seconds=getattr(session_schema, "generation_time_seconds", None),
                source_documents=[],  # Could be populated if needed
                has_valid_nlj=bool(session_schema.generated_content),
                validation_errors=None,
            )
            session_summaries.append(summary)

        return GenerationSessionListResponse(
            items=session_summaries, total=result.total_count, limit=result.limit, offset=result.offset
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list generation sessions"
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
    get_session_use_case: GetGenerationSessionUseCase = Depends(get_get_generation_session_use_case),
) -> GenerationSessionResponse:
    """Get generation session by ID using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        get_request = GetGenerationSessionRequest(session_id=session_id, include_activity_data=True)

        # Execute use case
        result = await get_session_use_case.execute(get_request, extract_user_context(current_user))

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, "value") else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, "started_at", None),
            completed_at=getattr(session, "completed_at", None),
            total_tokens_used=getattr(session, "total_tokens_used", None),
            generation_time_seconds=getattr(session, "generation_time_seconds", None),
            source_documents=[],  # Could be populated from session data
            has_valid_nlj=result.can_create_activity,
            validation_errors=None,
            prompt_config=getattr(session, "prompt_config", {}),
            claude_conversation_id=getattr(session, "claude_conversation_id", None),
            claude_message_id=getattr(session, "claude_message_id", None),
            generated_content=session.generated_content,
            validated_nlj=None,  # Could be enhanced
            error_message=session.error_message,
            created_activities_count=result.activity_count,
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve generation session"
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
    cancel_use_case: CancelGenerationUseCase = Depends(get_cancel_generation_use_case),
) -> GenerationSessionResponse:
    """Cancel generation session using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        cancel_request = CancelGenerationRequest(
            session_id=session_id, cancellation_reason="User requested cancellation"
        )

        # Execute use case
        result = await cancel_use_case.execute(cancel_request, extract_user_context(current_user))

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, "value") else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, "started_at", None),
            completed_at=getattr(session, "completed_at", None),
            total_tokens_used=getattr(session, "total_tokens_used", None),
            generation_time_seconds=getattr(session, "generation_time_seconds", None),
            source_documents=[],
            has_valid_nlj=False,  # Cancelled session
            validation_errors=None,
            prompt_config=getattr(session, "prompt_config", {}),
            claude_conversation_id=getattr(session, "claude_conversation_id", None),
            claude_message_id=getattr(session, "claude_message_id", None),
            generated_content=session.generated_content,
            validated_nlj=None,
            error_message=session.error_message,
            created_activities_count=0,  # Cancelled session
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to cancel generation session"
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
    retry_generation_use_case: RetryGenerationUseCase = Depends(get_retry_generation_use_case),
) -> GenerationSessionResponse:
    """Retry failed generation session using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        retry_request = RetryGenerationRequest(
            session_id=session_id,
            reset_configuration=False,  # Keep original configuration
            preserve_error_history=True,  # Keep error history for debugging
        )

        # Execute use case
        result = await retry_generation_use_case.execute(retry_request, extract_user_context(current_user))

        # Convert use case response to API response
        session = result.session
        return GenerationSessionResponse(
            id=session.id or uuid.uuid4(),
            user_id=session.user_id or uuid.uuid4(),
            status=session.status.value if hasattr(session.status, "value") else str(session.status),
            created_at=session.created_at or datetime.now(),
            started_at=getattr(session, "started_at", None),
            completed_at=getattr(session, "completed_at", None),
            total_tokens_used=getattr(session, "total_tokens_used", None),
            generation_time_seconds=getattr(session, "generation_time_seconds", None),
            source_documents=[],  # Could be populated from session data
            has_valid_nlj=False,  # Will be updated when generation completes
            validation_errors=None,
            prompt_config=getattr(session, "prompt_config", {}),
            claude_conversation_id=getattr(session, "claude_conversation_id", None),
            claude_message_id=getattr(session, "claude_message_id", None),
            generated_content=session.generated_content,
            validated_nlj=None,
            error_message=session.error_message,  # May include retry history
            created_activities_count=0,  # Retrying session
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retry generation process"
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
    create_activity_use_case: CreateActivityFromGenerationUseCase = Depends(
        get_create_activity_from_generation_use_case
    ),
) -> Dict[str, Any]:
    """Create activity from generation session using Clean Architecture with event-driven workflows."""

    try:
        # Create use case request
        create_request = CreateActivityFromGenerationRequest(
            session_id=session_id,
            activity_title=activity_data.title,
            activity_description=activity_data.description,
            override_content_type=None,  # Use default
            add_generation_metadata=True,  # Include generation metadata
        )

        # Execute use case
        result = await create_activity_use_case.execute(create_request, extract_user_context(current_user))

        # Return API response
        response_dict: Dict[str, Any] = {
            "activity_id": str(result.activity.id),
            "message": "Activity created successfully",
            "flow_editor_url": f"/app/flow/{result.activity.id}",
            "generation_quality": result.generation_data_quality,
            "validation_warnings": result.validation_warnings,
        }
        return response_dict

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create activity from generation session",
        )


@router.get(
    "/statistics",
    response_model=GenerationStatisticsResponse,
    summary="Get generation statistics",
    description="Get user's generation session statistics and usage metrics using Clean Architecture.",
)
async def get_generation_statistics(
    current_user: User = Depends(get_current_user),
    statistics_use_case: GetGenerationStatisticsUseCase = Depends(get_generation_statistics_use_case),
) -> GenerationStatisticsResponse:
    """Get generation statistics using Clean Architecture with comprehensive analytics."""

    try:
        # Create use case request
        stats_request = GetGenerationStatisticsRequest(
            user_id=None,  # Current user
            include_global_stats=False,  # User stats only
            time_period_days=None,  # All time
        )

        # Execute use case
        result = await statistics_use_case.execute(stats_request, extract_user_context(current_user))

        # Convert use case response to API response
        return GenerationStatisticsResponse(
            total_sessions=result.total_sessions,
            completed_sessions=result.completed_sessions,
            failed_sessions=result.failed_sessions,
            success_rate=result.success_rate / 100.0,  # Convert percentage to decimal
            total_tokens_used=result.total_tokens_used,
            average_generation_time=result.average_generation_time_seconds,
            activities_created=result.activities_created,
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve generation statistics"
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
    from app.utils.logging_context import get_session_logger, with_session_context, log_api_request

    # Generate a session ID for tracking (will be replaced with actual session ID later)
    temp_session_id = str(uuid.uuid4())

    with with_session_context(
        session_id=temp_session_id,
        user_id=str(current_user.id),
        user_email=current_user.email,
        operation="content_generation_api",
        endpoint="/content-studio/generate",
    ):
        logger = get_session_logger(__name__)

        log_api_request(
            logger,
            "/content-studio/generate",
            generation_type=request.generation_type or "scenario",
            source_documents=len(request.source_document_ids),
            activity_name=request.activity_name,
            prompt_length=len(request.generated_prompt or ""),
            prompt_config_keys=list(request.prompt_config.keys()) if request.prompt_config else [],
        )

        # Convert API schema to use case request
        generation_type = request.generation_type or "scenario"
        generate_request = GenerateContentRequest(
            source_document_ids=request.source_document_ids,
            prompt_config={
                **request.prompt_config,
                "generated_prompt_text": request.generated_prompt
                or request.prompt_config.get("generated_prompt_text", ""),
                "generation_type": generation_type,  # Required field in prompt_config
            },
            generation_type=generation_type,
            activity_name=request.activity_name,
            activity_description=request.activity_description,
            auto_create_content=False,  # Content Studio manages this separately
        )

        logger.info("📝 Prepared use case request")
        logger.info(f"  - Source document IDs: {[str(id) for id in generate_request.source_document_ids]}")
        logger.info(f"  - Prompt config length: {len(generate_request.prompt_config.get('generated_prompt_text', ''))}")

        try:
            logger.info("🔄 Executing GenerateContentUseCase...")

            # Execute generation use case with comprehensive business logic
            result = await generate_content_use_case.execute(generate_request, extract_user_context(current_user))

            logger.info("✅ GenerateContentUseCase execution completed")
            logger.info(f"  - Session ID: {result.generation_session.id}")
            logger.info(f"  - Generation started: {result.generation_started}")
            logger.info(f"  - Session status: {result.generation_session.status}")

            # Extract session information from result
            session = result.generation_session

            # Handle both enum and string status values
            status_str = session.status.value if hasattr(session.status, "value") else str(session.status)

            # Determine progress based on generation state
            progress_percentage = 10 if result.generation_started else 5
            current_step = (
                "Generation started..." if result.generation_started else "Session created, starting generation..."
            )

            logger.info("📤 Returning API response")
            logger.info(f"  - Session ID: {session.id}")
            logger.info(f"  - Status: {status_str}")
            logger.info(f"  - Progress: {progress_percentage}%")
            logger.info(f"  - Current step: {current_step}")
            logger.info(f"  - Events published to Kafka for async processing")
            logger.info(f"  - FastStream consumer should pick up events and call Claude API")

            return GenerationProgressResponse(
                session_id=session.id or uuid.uuid4(),  # Ensure not None
                status=status_str,
                progress_percentage=progress_percentage,
                current_step=current_step,
                error_message=session.error_message,
                generated_content=session.generated_content,
            )

        except PermissionError as e:
            from app.utils.logging_context import log_error_with_context

            log_error_with_context(logger, e, "permission_check", user=current_user.email)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        except ValueError as e:
            from app.utils.logging_context import log_error_with_context

            log_error_with_context(logger, e, "request_validation", request_type=generation_type)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except RuntimeError as e:
            from app.utils.logging_context import log_error_with_context

            log_error_with_context(logger, e, "use_case_execution")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to start generation process"
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
    status_use_case: GenerationStatusUseCase = Depends(get_generation_status_use_case),
) -> GenerationProgressResponse:
    """Get generation status for Content Studio frontend polling using Clean Architecture."""

    try:
        # Create use case request
        status_request = GenerationStatusRequest(
            session_id=session_id, include_progress_details=True, include_error_details=True
        )

        # Execute use case
        result = await status_use_case.execute(status_request, extract_user_context(current_user))

        # Get generated content if completed
        generated_content: Optional[Dict[str, Any]] = None
        if result.is_completed and result.has_generated_content:
            print(f"🎯 Generation completed, fetching generated content...")
            print(f"  - Session ID: {session_id}")
            print(f"  - Has generated content: {result.has_generated_content}")

            # Get the actual generated content from the session
            generated_content = result.generated_content if hasattr(result, "generated_content") else None
            if not generated_content:
                print(f"⚠️ No generated_content in result, trying alternative approach...")
                # TODO: Fetch from session directly if needed
                generated_content = {}
            else:
                print(f"✅ Found generated content:")
                print(f"  - Type: {type(generated_content)}")
                print(
                    f"  - Keys (if dict): {list(generated_content.keys()) if isinstance(generated_content, dict) else 'N/A'}"
                )
                print(f"  - Content preview: {str(generated_content)[:500]}...")

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

        response = GenerationProgressResponse(
            session_id=result.session_id,
            status=status_str,
            progress_percentage=result.progress_percentage,
            current_step=result.current_step,
            error_message=result.error_message,
            generated_content=generated_content,
        )

        return response

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve generation status"
        )


# ==============================================
# DEBUGGING ENDPOINTS
# ==============================================


@router.get(
    "/debug/sessions/{session_id}",
    summary="Debug Session Details",
    description="Get comprehensive session details for debugging purposes.",
)
async def debug_session_details(
    session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get detailed session information for debugging."""
    from app.utils.logging_context import get_session_logger, with_session_context, log_api_request

    with with_session_context(
        session_id=str(session_id),
        user_id=str(current_user.id),
        user_email=current_user.email,
        operation="debug_session",
        endpoint=f"/debug/sessions/{session_id}",
    ):
        logger = get_session_logger(__name__)

        log_api_request(logger, f"/debug/sessions/{session_id}", method="GET")

        try:
            # Get the session with all details
            from app.models.generation_session import GenerationSession
            from app.models.source_document import SourceDocument
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            # Get session with source documents
            stmt = (
                select(GenerationSession)
                .options(selectinload(GenerationSession.source_documents))
                .where(GenerationSession.id == session_id)
            )
            result = await db.execute(stmt)
            session = result.scalar_one_or_none()

            if not session:
                raise HTTPException(status_code=404, detail="Generation session not found")

            # Get user details
            from app.models.user import User

            user = await db.get(User, session.user_id)

            # Collect debug information
            debug_info = {
                "session_id": str(session.id),
                "session_details": {
                    "status": session.status.value if hasattr(session.status, "value") else str(session.status),
                    "created_at": session.created_at.isoformat() if session.created_at else None,
                    "started_at": session.started_at.isoformat() if session.started_at else None,
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                    "failed_at": session.failed_at.isoformat() if session.failed_at else None,
                    "last_updated": session.last_updated.isoformat() if session.last_updated else None,
                    "progress": session.progress,
                    "error_message": session.error_message,
                    "total_tokens_used": session.total_tokens_used,
                    "generation_time_seconds": session.generation_time_seconds,
                },
                "user_details": {
                    "id": str(user.id) if user else None,
                    "email": user.email if user else None,
                    "full_name": user.full_name if user else None,
                    "role": (
                        user.role.value if user and hasattr(user.role, "value") else str(user.role) if user else None
                    ),
                },
                "prompt_config": session.prompt_config or {},
                "source_documents": [
                    {
                        "id": str(doc.id),
                        "original_filename": doc.original_filename,
                        "content_type": doc.content_type,
                        "file_size": doc.file_size,
                        "claude_file_id": doc.claude_file_id,
                        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                    }
                    for doc in session.source_documents
                ],
                "generated_content": {
                    "has_content": bool(session.generated_content),
                    "content_keys": list(session.generated_content.keys()) if session.generated_content else [],
                    "content_size": len(str(session.generated_content)) if session.generated_content else 0,
                    "raw_preview": str(session.generated_content)[:500] + "..." if session.generated_content else None,
                },
                "validated_nlj": {
                    "has_nlj": bool(session.validated_nlj),
                    "nlj_type": type(session.validated_nlj).__name__ if session.validated_nlj else None,
                    "nlj_keys": list(session.validated_nlj.keys()) if isinstance(session.validated_nlj, dict) else [],
                    "node_count": (
                        len(session.validated_nlj.get("nodes", [])) if isinstance(session.validated_nlj, dict) else 0
                    ),
                    "link_count": (
                        len(session.validated_nlj.get("links", [])) if isinstance(session.validated_nlj, dict) else 0
                    ),
                    "nlj_preview": str(session.validated_nlj)[:500] + "..." if session.validated_nlj else None,
                },
                "history": {
                    "progress_messages": session.progress_messages or [],
                    "modification_history": session.modification_history or [],
                    "import_history": session.import_history or [],
                    "review_history": session.review_history or [],
                },
                "timing": {
                    "total_duration_seconds": (
                        (
                            (session.completed_at or session.failed_at or datetime.now(timezone.utc))
                            - session.created_at
                        ).total_seconds()
                        if session.created_at
                        else None
                    ),
                    "generation_duration_seconds": (
                        ((session.completed_at or session.failed_at) - session.started_at).total_seconds()
                        if session.started_at and (session.completed_at or session.failed_at)
                        else None
                    ),
                },
            }

            logger.info("✅ Debug session details retrieved successfully")
            return debug_info

        except HTTPException:
            raise
        except Exception as e:
            from app.utils.logging_context import log_error_with_context

            log_error_with_context(logger, e, "debug_session_retrieval")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve debug session details: {str(e)}")


@router.get(
    "/debug/sessions",
    summary="Debug Recent Sessions",
    description="Get recent generation sessions for debugging purposes.",
)
async def debug_recent_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    user_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """Get recent generation sessions with basic debug info."""
    from app.utils.logging_context import get_session_logger, with_session_context, log_api_request

    with with_session_context(
        session_id="debug_recent",
        user_id=str(current_user.id),
        user_email=current_user.email,
        operation="debug_recent_sessions",
        endpoint="/debug/sessions",
    ):
        logger = get_session_logger(__name__)

        log_api_request(
            logger, "/debug/sessions", method="GET", limit=limit, user_filter=user_filter, status_filter=status_filter
        )

        try:
            from app.models.generation_session import GenerationSession, GenerationStatus
            from app.models.user import User
            from sqlalchemy import select, desc
            from sqlalchemy.orm import selectinload

            # Build query
            stmt = (
                select(GenerationSession)
                .options(selectinload(GenerationSession.source_documents))
                .order_by(desc(GenerationSession.created_at))
                .limit(limit)
            )

            # Apply filters
            if status_filter:
                try:
                    status_enum = GenerationStatus(status_filter.upper())
                    stmt = stmt.where(GenerationSession.status == status_enum)
                except ValueError:
                    pass  # Invalid status filter, ignore

            if user_filter:
                # Filter by user email or ID
                user_stmt = select(User).where(
                    (User.email.ilike(f"%{user_filter}%"))
                    | (User.id == uuid.UUID(user_filter) if user_filter.count("-") == 4 else False)
                )
                user_result = await db.execute(user_stmt)
                matching_users = user_result.scalars().all()
                if matching_users:
                    user_ids = [u.id for u in matching_users]
                    stmt = stmt.where(GenerationSession.user_id.in_(user_ids))

            result = await db.execute(stmt)
            sessions = result.scalars().all()

            # Get user details for all sessions
            user_ids = list(set(s.user_id for s in sessions))
            user_stmt = select(User).where(User.id.in_(user_ids))
            user_result = await db.execute(user_stmt)
            users_by_id = {u.id: u for u in user_result.scalars().all()}

            sessions_info = []
            for session in sessions:
                user = users_by_id.get(session.user_id)
                sessions_info.append(
                    {
                        "id": str(session.id),
                        "status": session.status.value if hasattr(session.status, "value") else str(session.status),
                        "created_at": session.created_at.isoformat() if session.created_at else None,
                        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                        "failed_at": session.failed_at.isoformat() if session.failed_at else None,
                        "progress": session.progress,
                        "error_message": session.error_message,
                        "user_email": user.email if user else None,
                        "source_doc_count": len(session.source_documents),
                        "has_generated_content": bool(session.generated_content),
                        "has_validated_nlj": bool(session.validated_nlj),
                        "tokens_used": session.total_tokens_used,
                        "generation_time": session.generation_time_seconds,
                    }
                )

            summary = {"total_sessions": len(sessions_info), "status_counts": {}, "recent_errors": []}

            # Calculate status counts and recent errors
            for session_info in sessions_info:
                status = session_info["status"]
                summary["status_counts"][status] = summary["status_counts"].get(status, 0) + 1

                if session_info["error_message"]:
                    summary["recent_errors"].append(
                        {
                            "session_id": session_info["id"],
                            "error": session_info["error_message"],
                            "failed_at": session_info["failed_at"],
                        }
                    )

            logger.info(f"✅ Retrieved {len(sessions_info)} recent sessions for debugging")

            return {
                "summary": summary,
                "sessions": sessions_info,
                "filters_applied": {"limit": limit, "user_filter": user_filter, "status_filter": status_filter},
            }

        except Exception as e:
            from app.utils.logging_context import log_error_with_context

            log_error_with_context(logger, e, "debug_recent_sessions")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve recent sessions: {str(e)}")
