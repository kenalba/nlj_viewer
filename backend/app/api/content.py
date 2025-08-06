"""
Content API endpoints for NLJ scenario management.
Provides CRUD operations with role-based access control.
"""

import uuid
import math
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.content import ContentState, ContentType, LearningStyle
from app.services.content import ContentService
from app.schemas.content import (
    ContentCreate,
    ContentUpdate,
    ContentResponse,
    ContentSummary,
    ContentListResponse,
    ContentStateUpdate,
    ContentFilters
)

router = APIRouter(prefix="/content", tags=["content"])


@router.post(
    "/",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new content",
    description="Create a new NLJ scenario. Requires Creator role or higher."
)
async def create_content(
    content_data: ContentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ContentResponse:
    """Create new content item."""
    
    # Permission check: Creator role or higher
    if current_user.role not in [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create content"
        )
    
    service = ContentService(db)
    
    try:
        content = await service.create_content(content_data, current_user.id)
        
        # Refresh to ensure all attributes are loaded
        await db.refresh(content, ["creator"])
        
        # Create response data within the session context
        response_data = {
            "id": content.id,
            "title": content.title,
            "description": content.description,
            "content_type": content.content_type,
            "nlj_data": content.nlj_data,
            "learning_style": content.learning_style,
            "is_template": content.is_template,
            "template_category": content.template_category,
            "state": content.state,
            "version": content.version,
            "view_count": content.view_count,
            "completion_count": content.completion_count,
            "created_by": content.created_by,
            "parent_content_id": getattr(content, 'parent_content_id', None),
            "created_at": content.created_at,
            "updated_at": content.updated_at,
            "published_at": getattr(content, 'published_at', None),
            "creator": {
                "id": content.creator.id,
                "username": content.creator.username,
                "full_name": content.creator.full_name,
                "role": content.creator.role
            } if content.creator else None
        }
        
        return ContentResponse.model_validate(response_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create content: {str(e)}"
        )


@router.get(
    "/",
    response_model=ContentListResponse,
    summary="List content items",
    description="Get paginated list of content with filtering and role-based access."
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
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ContentListResponse:
    """Get paginated content list with filters."""
    
    # Build filters object - handle enum conversions
    try:
        filters = ContentFilters(
            page=page,
            size=size,
            state=ContentState(state) if state else None,
            content_type=ContentType(content_type) if content_type else None,
            learning_style=LearningStyle(learning_style) if learning_style else None,
            is_template=is_template,
            template_category=template_category,
            created_by=uuid.UUID(created_by) if created_by else None,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid filter parameter: {str(e)}"
        )
    
    service = ContentService(db)
    
    try:
        items, total = await service.get_content_list(
            filters, current_user.id, current_user.role
        )
        
        # Convert to summary format (without full NLJ data for performance)
        content_summaries = []
        for item in items:
            try:
                summary = ContentSummary.model_validate(item)
                if item.creator:
                    summary.creator_name = item.creator.full_name or item.creator.username
                content_summaries.append(summary)
            except Exception as e:
                # Log the error but continue processing other items
                print(f"Warning: Failed to process content item {getattr(item, 'id', 'unknown')}: {e}")
                continue
        
        pages = math.ceil(total / size) if total > 0 else 1
        
        return ContentListResponse(
            items=content_summaries,
            total=total,
            page=page,
            size=size,
            pages=pages
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list content: {str(e)}"
        )


@router.get(
    "/{content_id}",
    response_model=ContentResponse,
    summary="Get content by ID",
    description="Get specific content item with full NLJ data."
)
async def get_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ContentResponse:
    """Get content by ID."""
    
    service = ContentService(db)
    content = await service.get_content_by_id(content_id)
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )
    
    # Permission check: role-based access
    if current_user.role == UserRole.CREATOR:
        # Creators can see their own content, published content, or any content for preview
        # Allow preview access to draft content for testing/preview purposes
        if content.created_by != current_user.id and content.state not in ["draft", "submitted", "in_review", "published"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    elif current_user.role == UserRole.REVIEWER:
        # Reviewers can see their own content, submitted content, published content, or draft content for preview
        # Allow preview access to all content including drafts
        if (content.created_by != current_user.id and 
            content.state not in ["draft", "submitted", "in_review", "published"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    # Approvers and Admins can see all content (no additional check needed)
    
    # Refresh the object to ensure all attributes are loaded
    await db.refresh(content, ["creator"])
    
    # Create response data within the session context
    response_data = {
        "id": content.id,
        "title": content.title,
        "description": content.description,
        "content_type": content.content_type,
        "nlj_data": content.nlj_data,
        "learning_style": content.learning_style,
        "is_template": content.is_template,
        "template_category": content.template_category,
        "state": content.state,
        "version": content.version,
        "view_count": content.view_count,
        "completion_count": content.completion_count,
        "created_by": content.created_by,
        "created_at": content.created_at,
        "updated_at": content.updated_at,
        "creator": {
            "id": content.creator.id,
            "username": content.creator.username,
            "full_name": content.creator.full_name,
            "role": content.creator.role
        } if content.creator else None
    }
    
    # Increment view count for analytics
    await service.increment_view_count(content_id)
    
    return ContentResponse.model_validate(response_data)


@router.put(
    "/{content_id}",
    response_model=ContentResponse,
    summary="Update content",
    description="Update existing content. Only creator or admin can edit."
)
async def update_content(
    content_id: uuid.UUID,
    content_data: ContentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ContentResponse:
    """Update content item."""
    
    service = ContentService(db)
    
    try:
        content = await service.update_content(
            content_id, content_data, current_user.id, current_user.role
        )
        
        if not content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )
        
        # Refresh to ensure all attributes are loaded
        await db.refresh(content, ["creator"])
        
        # Create response data within the session context
        response_data = {
            "id": content.id,
            "title": content.title,
            "description": content.description,
            "content_type": content.content_type,
            "nlj_data": content.nlj_data,
            "learning_style": content.learning_style,
            "is_template": content.is_template,
            "template_category": content.template_category,
            "state": content.state,
            "version": content.version,
            "view_count": content.view_count,
            "completion_count": content.completion_count,
            "created_by": content.created_by,
            "parent_content_id": getattr(content, 'parent_content_id', None),
            "created_at": content.created_at,
            "updated_at": content.updated_at,
            "published_at": getattr(content, 'published_at', None),
            "creator": {
                "id": content.creator.id,
                "username": content.creator.username,
                "full_name": content.creator.full_name,
                "role": content.creator.role
            } if content.creator else None
        }
        
        return ContentResponse.model_validate(response_data)
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update content: {str(e)}"
        )


@router.delete(
    "/{content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete content",
    description="Delete content item. Only creator or admin can delete draft content."
)
async def delete_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete content item."""
    
    service = ContentService(db)
    
    try:
        deleted = await service.delete_content(
            content_id, current_user.id, current_user.role
        )
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete content: {str(e)}"
        )


@router.patch(
    "/{content_id}/state",
    response_model=ContentResponse,
    summary="Update content state",
    description="Update content workflow state with role-based validation."
)
async def update_content_state(
    content_id: uuid.UUID,
    state_update: ContentStateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ContentResponse:
    """Update content state."""
    
    service = ContentService(db)
    
    try:
        content = await service.update_content_state(
            content_id, state_update, current_user.id, current_user.role
        )
        
        if not content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )
        
        # Refresh to ensure all attributes are loaded
        await db.refresh(content, ["creator"])
        
        # Create response data within the session context
        response_data = {
            "id": content.id,
            "title": content.title,
            "description": content.description,
            "content_type": content.content_type,
            "nlj_data": content.nlj_data,
            "learning_style": content.learning_style,
            "is_template": content.is_template,
            "template_category": content.template_category,
            "state": content.state,
            "version": content.version,
            "view_count": content.view_count,
            "completion_count": content.completion_count,
            "created_by": content.created_by,
            "parent_content_id": getattr(content, 'parent_content_id', None),
            "created_at": content.created_at,
            "updated_at": content.updated_at,
            "published_at": getattr(content, 'published_at', None),
            "creator": {
                "id": content.creator.id,
                "username": content.creator.username,
                "full_name": content.creator.full_name,
                "role": content.creator.role
            } if content.creator else None
        }
        
        return ContentResponse.model_validate(response_data)
        
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update content state: {str(e)}"
        )


@router.post(
    "/{content_id}/analytics/view",
    status_code=status.HTTP_200_OK,
    summary="Record content view",
    description="Increment view count for analytics."
)
async def record_content_view(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record content view for analytics."""
    
    service = ContentService(db)
    success = await service.increment_view_count(content_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )
    
    return {"message": "View recorded"}


@router.post(
    "/{content_id}/analytics/completion",
    status_code=status.HTTP_200_OK,
    summary="Record content completion",
    description="Increment completion count for analytics."
)
async def record_content_completion(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record content completion for analytics."""
    
    service = ContentService(db)
    success = await service.increment_completion_count(content_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )
    
    return {"message": "Completion recorded"}