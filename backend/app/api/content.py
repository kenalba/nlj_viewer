"""
Content API endpoints for NLJ scenario management.
Provides CRUD operations with role-based access control.
Refactored for Clean Architecture compliance.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import (
    RequireContentManager,
    get_create_content_use_case,
    get_update_content_use_case,
    get_review_workflow_use_case,
    get_get_content_use_case,
    get_list_content_use_case,
    get_delete_content_use_case,
    get_record_content_view_use_case,
    get_record_content_completion_use_case,
    get_current_user
)
from app.core.user_context import extract_user_context
from app.models.user import User
from app.models.content import ContentState, ContentType, LearningStyle
# SQLAlchemy no longer needed - using Clean Architecture with use cases
from app.services.use_cases.content.create_content_use_case import CreateContentRequest
from app.services.use_cases.content.update_content_use_case import UpdateContentRequest
from app.services.use_cases.content.review_workflow_use_case import ReviewWorkflowRequest, ReviewAction
from app.schemas.content import (
    ContentCreate,
    ContentListResponse,
    ContentResponse,
    ContentStateUpdate,
    ContentSummary,
    ContentUpdate,
)
from app.services.use_cases.content.create_content_use_case import CreateContentUseCase
from app.services.use_cases.content.update_content_use_case import UpdateContentUseCase
from app.services.use_cases.content.review_workflow_use_case import ReviewWorkflowUseCase
from app.services.use_cases.content.get_content_use_case import GetContentUseCase, GetContentRequest
from app.services.use_cases.content.list_content_use_case import ListContentUseCase, ListContentRequest, ContentListSortBy, ContentListSortOrder
from app.services.use_cases.content.delete_content_use_case import DeleteContentUseCase, DeleteContentRequest
from app.services.use_cases.content.record_content_view_use_case import RecordContentViewUseCase, RecordContentViewRequest
from app.services.use_cases.content.record_content_completion_use_case import RecordContentCompletionUseCase, RecordContentCompletionRequest, CompletionResult

router = APIRouter(prefix="/content", tags=["content"])


@router.post(
    "/",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new content",
    description="Create a new NLJ scenario. Requires Creator role or higher.",
)
async def create_content(
    content_data: ContentCreate,
    current_user: RequireContentManager,
    create_content_use_case: CreateContentUseCase = Depends(get_create_content_use_case),
) -> ContentResponse:
    """Create new content item using Clean Architecture pattern."""
    try:
        # Convert API schema to use case request with inline conversion
        request = CreateContentRequest(
            title=content_data.title,
            description=content_data.description,
            content_type=content_data.content_type,
            learning_style=content_data.learning_style,
            is_template=content_data.is_template,
            template_category=content_data.template_category,
            nlj_data=content_data.nlj_data,
            parent_content_id=content_data.parent_content_id
        )
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await create_content_use_case.execute(request, user_context)
        
        # Convert service response to API response
        return ContentResponse(
            id=response.content.id,
            title=response.content.title,
            description=response.content.description,
            content_type=response.content.content_type,
            learning_style=response.content.learning_style,
            state=response.content.state,
            is_template=response.content.is_template,
            template_category=response.content.template_category,
            nlj_data=response.content.nlj_data,
            version=response.content.version or 1,
            view_count=response.content.view_count or 0,
            completion_count=response.content.completion_count or 0,
            created_by=response.content.created_by,
            parent_content_id=response.content.parent_content_id,
            created_at=response.content.created_at,
            updated_at=response.content.updated_at,
            published_at=getattr(response.content, 'published_at', None),
            creator={
                "id": response.content.created_by,
                "username": response.content.creator.username if hasattr(response.content, 'creator') else "",
                "full_name": response.content.creator.full_name if hasattr(response.content, 'creator') else "",
                "role": response.content.creator.role if hasattr(response.content, 'creator') else current_user.role,
            },
            import_source=response.content.import_source,
            import_filename=response.content.import_filename,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get(
    "/",
    response_model=ContentListResponse,
    summary="List content items",
    description="Get paginated list of content with filtering and role-based access.",
)
async def list_content(
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    # Filters
    state: str = Query(None, description="Filter by state"),
    content_type: str = Query(None, description="Filter by content type"),
    learning_style: str = Query(None, description="Filter by learning style"),
    is_template: bool = Query(None, description="Filter templates only"),
    template_category: str = Query(None, description="Filter by template category"),
    created_by: str = Query(None, description="Filter by creator ID"),
    search: str = Query(None, min_length=1, max_length=100, description="Search in title/description"),
    # Sorting
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
    current_user: User = Depends(get_current_user),
    list_content_use_case: ListContentUseCase = Depends(get_list_content_use_case),
) -> ContentListResponse:
    """Get paginated content list with filters using Clean Architecture pattern."""
    try:
        # Convert API parameters to use case request with inline conversion
        use_case_request = ListContentRequest(
            page=page,
            per_page=size,
            state_filter=ContentState(state) if state else None,
            content_type_filter=ContentType(content_type) if content_type else None,
            learning_style_filter=LearningStyle(learning_style) if learning_style else None,
            is_template=is_template,
            template_category=template_category,
            created_by=created_by,
            search=search,
            sort_by=ContentListSortBy(sort_by) if sort_by in [e.value for e in ContentListSortBy] else ContentListSortBy.CREATED_AT,
            sort_order=ContentListSortOrder(sort_order) if sort_order in ["asc", "desc"] else ContentListSortOrder.DESC
        )
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await list_content_use_case.execute(use_case_request, user_context)
        
        # Convert service response to API response
        content_summaries = []
        for content in response.content_items:
            summary = ContentSummary(
                id=content.id,
                title=content.title,
                description=content.description,
                content_type=content.content_type,
                learning_style=content.learning_style,
                state=content.state,
                is_template=content.is_template,
                template_category=content.template_category,
                version=content.version,
                view_count=content.view_count,
                completion_count=content.completion_count,
                created_by=content.created_by,
                parent_content_id=content.parent_content_id,
                created_at=content.created_at,
                updated_at=content.updated_at,
                creator_name=""  # Will be filled by additional lookup if needed
            )
            content_summaries.append(summary)
        
        pages = response.total_pages
        
        return ContentListResponse(
            items=content_summaries, 
            total=response.total, 
            page=response.page, 
            size=response.per_page, 
            pages=pages
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list content: {str(e)}")


@router.get(
    "/{content_id}",
    response_model=ContentResponse,
    summary="Get content by ID",
    description="Get specific content item with full NLJ data.",
)
async def get_content(
    content_id: uuid.UUID, 
    current_user: User = Depends(get_current_user), 
    get_content_use_case: GetContentUseCase = Depends(get_get_content_use_case)
) -> ContentResponse:
    """Get content by ID using Clean Architecture pattern."""
    try:
        # Create use case request with inline conversion
        request = GetContentRequest(content_id=content_id)
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await get_content_use_case.execute(request, user_context)
        
        # Convert service response to API response
        return ContentResponse(
            id=response.content.id,
            title=response.content.title,
            description=response.content.description,
            content_type=response.content.content_type,
            learning_style=response.content.learning_style,
            state=response.content.state,
            is_template=response.content.is_template,
            template_category=response.content.template_category,
            nlj_data=response.content.nlj_data,
            version=response.content.version or 1,
            view_count=response.content.view_count or 0,
            completion_count=response.content.completion_count or 0,
            created_by=response.content.created_by,
            parent_content_id=response.content.parent_content_id,
            created_at=response.content.created_at,
            updated_at=response.content.updated_at,
            published_at=response.content.published_at,
            creator={
                "id": response.content.created_by,
                "username": "",  # Would need additional lookup for creator details
                "full_name": "",
                "role": current_user.role,  # Placeholder
            },
            import_source=response.content.import_source,
            import_filename=response.content.import_filename,
        )
        
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get content: {str(e)}")


@router.put(
    "/{content_id}",
    response_model=ContentResponse,
    summary="Update content",
    description="Update existing content. Only creator or admin can edit.",
)
async def update_content(
    content_id: uuid.UUID,
    content_data: ContentUpdate,
    current_user: User = Depends(get_current_user),
    update_content_use_case: UpdateContentUseCase = Depends(get_update_content_use_case),
) -> ContentResponse:
    """Update content item using Clean Architecture pattern."""
    try:
        # Convert API schema to use case request with inline conversion
        request = UpdateContentRequest(
            content_id=content_id,
            title=content_data.title,
            description=content_data.description,
            content_type=content_data.content_type,
            learning_style=content_data.learning_style,
            nlj_data=content_data.nlj_data,
            is_template=content_data.is_template,
            template_category=content_data.template_category
        )
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await update_content_use_case.execute(request, user_context)
        
        # Convert service response to API response
        return ContentResponse(
            id=response.content.id,
            title=response.content.title,
            description=response.content.description,
            content_type=response.content.content_type,
            learning_style=response.content.learning_style,
            state=response.content.state,
            is_template=response.content.is_template,
            template_category=response.content.template_category,
            nlj_data=response.content.nlj_data,
            version=response.content.version or 1,
            view_count=response.content.view_count or 0,
            completion_count=response.content.completion_count or 0,
            created_by=response.content.created_by,
            parent_content_id=response.content.parent_content_id,
            created_at=response.content.created_at,
            updated_at=response.content.updated_at,
            published_at=response.content.published_at,
            creator={
                "id": response.content.created_by,
                "username": "",  # Would need additional lookup for creator details
                "full_name": "",
                "role": current_user.role,  # Placeholder
            },
            import_source=response.content.import_source,
            import_filename=response.content.import_filename,
        )
        
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update content: {str(e)}")


@router.delete(
    "/{content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete content",
    description="Delete content item. Only creator or admin can delete draft content.",
)
async def delete_content(
    content_id: uuid.UUID, 
    current_user: User = Depends(get_current_user), 
    delete_content_use_case: DeleteContentUseCase = Depends(get_delete_content_use_case)
):
    """Delete content item using Clean Architecture pattern."""
    try:
        # Create use case request with inline conversion
        request = DeleteContentRequest(content_id=content_id)
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await delete_content_use_case.execute(request, user_context)
        
        return {"message": response.message, "deleted_id": str(response.deleted_content_id)}
        
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete content: {str(e)}")


@router.patch(
    "/{content_id}/state",
    response_model=ContentResponse,
    summary="Update content state",
    description="Update content workflow state with role-based validation.",
)
async def update_content_state(
    content_id: uuid.UUID,
    state_update: ContentStateUpdate,
    current_user: User = Depends(get_current_user),
    review_workflow_use_case: ReviewWorkflowUseCase = Depends(get_review_workflow_use_case),
) -> ContentResponse:
    """Update content state using Clean Architecture pattern."""
    try:
        # Convert state update to review action
        action_mapping = {
            "draft": ReviewAction.SAVE_DRAFT,
            "pending_review": ReviewAction.SUBMIT,
            "in_review": ReviewAction.START_REVIEW,
            "approved": ReviewAction.APPROVE,
            "rejected": ReviewAction.REJECT,
            "published": ReviewAction.PUBLISH
        }
        
        # Create use case request with inline conversion
        action = action_mapping.get(state_update.state.lower(), ReviewAction.SAVE_DRAFT)
        request = ReviewWorkflowRequest(
            content_id=content_id,
            action=action,
            comment=getattr(state_update, 'comment', None),
            reviewer_notes=getattr(state_update, 'reviewer_notes', None)
        )
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await review_workflow_use_case.execute(request, user_context)
        
        # Convert service response to API response
        return ContentResponse(
            id=response.content.id,
            title=response.content.title,
            description=response.content.description,
            content_type=response.content.content_type,
            learning_style=response.content.learning_style,
            state=response.content.state,
            is_template=response.content.is_template,
            template_category=response.content.template_category,
            nlj_data=response.content.nlj_data,
            version=response.content.version or 1,
            view_count=response.content.view_count or 0,
            completion_count=response.content.completion_count or 0,
            created_by=response.content.created_by,
            parent_content_id=response.content.parent_content_id,
            created_at=response.content.created_at,
            updated_at=response.content.updated_at,
            published_at=response.content.published_at,
            creator={
                "id": response.content.created_by,
                "username": "",  # Would need additional lookup for creator details
                "full_name": "",
                "role": current_user.role,  # Placeholder
            },
            import_source=response.content.import_source,
            import_filename=response.content.import_filename,
        )
        
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update content state: {str(e)}")


@router.post(
    "/{content_id}/analytics/view",
    status_code=status.HTTP_200_OK,
    summary="Record content view",
    description="Increment view count for analytics.",
)
async def record_content_view(
    content_id: uuid.UUID, 
    current_user: User = Depends(get_current_user), 
    record_view_use_case: RecordContentViewUseCase = Depends(get_record_content_view_use_case)
):
    """Record content view for analytics using Clean Architecture pattern."""
    try:
        # Create use case request with inline conversion
        request = RecordContentViewRequest(content_id=content_id)
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await record_view_use_case.execute(request, user_context)
        
        return {
            "message": "View recorded", 
            "view_count": response.view_count,
            "user_view_count": response.user_view_count
        }
        
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to record view: {str(e)}")


@router.post(
    "/{content_id}/analytics/completion",
    status_code=status.HTTP_200_OK,
    summary="Record content completion",
    description="Increment completion count for analytics.",
)
async def record_content_completion(
    content_id: uuid.UUID, 
    current_user: User = Depends(get_current_user), 
    record_completion_use_case: RecordContentCompletionUseCase = Depends(get_record_content_completion_use_case)
):
    """Record content completion for analytics using Clean Architecture pattern."""
    try:
        # Create use case request with inline conversion
        request = RecordContentCompletionRequest(
            content_id=content_id,
            result=CompletionResult(success=True)  # Basic completion without assessment
        )
        
        # Extract user context for use case
        user_context = extract_user_context(current_user)
        
        # Execute use case
        response = await record_completion_use_case.execute(request, user_context)
        
        return {
            "message": "Completion recorded", 
            "completion_count": response.completion_count,
            "user_completion_count": response.user_completion_count,
            "mastery_achieved": response.mastery_achieved,
            "achievements_unlocked": response.achievements_unlocked
        }
        
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to record completion: {str(e)}")
