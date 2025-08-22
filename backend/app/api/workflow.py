"""
API endpoints for version-aware content approval workflows.
Clean Architecture implementation with Use Cases for all business logic.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict

from app.core.deps import (
    get_current_user, get_create_version_use_case, get_review_content_use_case
)
from app.core.database_manager import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import VersionStatus, WorkflowState, User
from app.models.workflow import ContentVersion
from app.services.use_cases.workflow.create_version_use_case import (
    CreateVersionUseCase, CreateVersionRequest as CreateVersionUseCaseRequest
)
from app.services.use_cases.workflow.review_content_use_case import (
    ReviewContentUseCase, ReviewContentRequest as ReviewContentUseCaseRequest, ReviewAction
)

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


# API Request schemas
class CreateVersionRequest(BaseModel):
    """API request model for creating a new content version."""
    content_id: uuid.UUID
    nlj_data: dict[str, object]
    title: str
    description: str | None = None
    change_summary: str | None = None
    requires_approval: bool = True
    auto_publish: bool = False
    assigned_reviewer_id: uuid.UUID | None = None


class ApproveContentRequest(BaseModel):
    """API request model for approving content."""
    comments: str | None = None
    feedback_areas: dict[str, object] | None = None
    auto_publish: bool = False


class RequestRevisionRequest(BaseModel):
    """API request model for requesting revisions."""
    comments: str = Field(..., description="Comments are required for revision requests")
    feedback_areas: dict[str, object] | None = None


class RejectContentRequest(BaseModel):
    """API request model for rejecting content."""
    comments: str = Field(..., description="Comments are required for rejections")
    feedback_areas: dict[str, object] | None = None


class WithdrawSubmissionRequest(BaseModel):
    """API request model for withdrawing a submission."""
    reason: str | None = None


class PublishVersionRequest(BaseModel):
    """API request model for publishing a version."""
    version_id: uuid.UUID


# API Response schemas
class ContentVersionResponse(BaseModel):
    """API response model for content versions."""
    id: uuid.UUID
    content_id: uuid.UUID
    version_number: int
    version_status: VersionStatus
    title: str
    description: str | None
    change_summary: str | None
    created_by: uuid.UUID
    created_at: datetime
    published_at: datetime | None
    archived_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class WorkflowResponse(BaseModel):
    """API response model for approval workflows."""
    id: uuid.UUID
    content_version_id: uuid.UUID
    current_state: WorkflowState
    submitted_at: datetime | None
    approved_at: datetime | None
    published_at: datetime | None
    assigned_reviewer_id: uuid.UUID | None
    requires_approval: bool
    auto_publish: bool

    model_config = ConfigDict(from_attributes=True)


class CreateVersionResponse(BaseModel):
    """API response model for version creation."""
    version_id: uuid.UUID
    version_number: int
    workflow_id: uuid.UUID | None
    requires_approval: bool
    current_state: str


class ReviewResponse(BaseModel):
    """API response model for review actions."""
    workflow_id: uuid.UUID
    new_state: str
    review_id: uuid.UUID
    auto_published: bool = False


# API Endpoints

@router.post("/versions", response_model=CreateVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_content_version(
    request: CreateVersionRequest,
    create_version_use_case: CreateVersionUseCase = Depends(get_create_version_use_case),
    current_user: User = Depends(get_current_user)
) -> CreateVersionResponse:
    """Create a new version of content using Clean Architecture Use Case."""
    try:
        # Convert API request to Use Case request
        use_case_request = CreateVersionUseCaseRequest(
            content_id=request.content_id,
            title=request.title,
            nlj_data=request.nlj_data,
            description=request.description,
            change_summary=request.change_summary,
            requires_approval=request.requires_approval,
            auto_publish=request.auto_publish,
            assigned_reviewer_id=request.assigned_reviewer_id
        )
        
        # Execute use case
        result = await create_version_use_case.execute(use_case_request)
        
        # Convert Use Case response to API response
        return CreateVersionResponse(
            version_id=result.version_id,
            version_number=result.version_number,
            workflow_id=result.workflow_id,
            requires_approval=result.requires_approval,
            current_state=result.current_state
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/workflows/{workflow_id}/approve", response_model=ReviewResponse)
async def approve_content(
    workflow_id: uuid.UUID,
    request: ApproveContentRequest,
    review_content_use_case: ReviewContentUseCase = Depends(get_review_content_use_case),
    current_user: User = Depends(get_current_user)
) -> ReviewResponse:
    """Approve content using Clean Architecture Use Case."""
    try:
        # Convert API request to Use Case request
        use_case_request = ReviewContentUseCaseRequest(
            workflow_id=workflow_id,
            action=ReviewAction.APPROVE,
            comments=request.comments,
            feedback_areas=request.feedback_areas,
            auto_publish=request.auto_publish
        )
        
        # Execute use case
        result = await review_content_use_case.execute(use_case_request)
        
        # Convert Use Case response to API response
        return ReviewResponse(
            workflow_id=result.workflow_id,
            new_state=result.new_state,
            review_id=result.review_id,
            auto_published=result.auto_published
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/workflows/{workflow_id}/request-revision", response_model=ReviewResponse)
async def request_revision(
    workflow_id: uuid.UUID,
    request: RequestRevisionRequest,
    review_content_use_case: ReviewContentUseCase = Depends(get_review_content_use_case),
    current_user: User = Depends(get_current_user)
) -> ReviewResponse:
    """Request revision for content using Clean Architecture Use Case."""
    try:
        # Convert API request to Use Case request
        use_case_request = ReviewContentUseCaseRequest(
            workflow_id=workflow_id,
            action=ReviewAction.REQUEST_REVISION,
            comments=request.comments,
            feedback_areas=request.feedback_areas,
            auto_publish=False
        )
        
        # Execute use case
        result = await review_content_use_case.execute(use_case_request)
        
        # Convert Use Case response to API response
        return ReviewResponse(
            workflow_id=result.workflow_id,
            new_state=result.new_state,
            review_id=result.review_id,
            auto_published=result.auto_published
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/workflows/{workflow_id}/reject", response_model=ReviewResponse)
async def reject_content(
    workflow_id: uuid.UUID,
    request: RejectContentRequest,
    review_content_use_case: ReviewContentUseCase = Depends(get_review_content_use_case),
    current_user: User = Depends(get_current_user)
) -> ReviewResponse:
    """Reject content using Clean Architecture Use Case."""
    try:
        # Convert API request to Use Case request
        use_case_request = ReviewContentUseCaseRequest(
            workflow_id=workflow_id,
            action=ReviewAction.REJECT,
            comments=request.comments,
            feedback_areas=request.feedback_areas,
            auto_publish=False
        )
        
        # Execute use case
        result = await review_content_use_case.execute(use_case_request)
        
        # Convert Use Case response to API response
        return ReviewResponse(
            workflow_id=result.workflow_id,
            new_state=result.new_state,
            review_id=result.review_id,
            auto_published=result.auto_published
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


def _version_to_response(version: ContentVersion) -> ContentVersionResponse:
    """Convert ContentVersion model to API response, auto-pulling model fields."""
    return ContentVersionResponse(
        id=version.id,
        content_id=version.content_id,
        version_number=version.version_number,
        version_status=version.version_status,
        title=version.title,
        description=version.description,
        change_summary=version.change_summary,
        created_by=version.created_by,
        created_at=version.created_at,
        published_at=version.published_at,
        archived_at=getattr(version, 'archived_at', None)
    )


@router.get("/content/{content_id}/versions", response_model=list[ContentVersionResponse])
async def get_content_versions(
    content_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[ContentVersionResponse]:
    """Get all versions for a content item with modern typing and auto-pulled model fields."""
    from app.services.orm_services.workflow_orm_service import WorkflowOrmService
    
    try:
        workflow_service = WorkflowOrmService(db)
        
        # Get all versions for this content (using modern typing)
        versions: list[ContentVersion] = await workflow_service.get_content_versions(content_id)
        
        # Convert to response format using helper function
        return [_version_to_response(version) for version in versions]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to get versions: {str(e)}"
        )


@router.get("/versions/{version_id}", response_model=ContentVersionResponse)
async def get_version(
    version_id: uuid.UUID,
    # TODO: Add get version use case when implemented
    current_user: User = Depends(get_current_user)
) -> ContentVersionResponse:
    """Get a specific version."""
    # Placeholder - would use a GetVersionUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: uuid.UUID,
    # TODO: Add get workflow use case when implemented
    current_user: User = Depends(get_current_user)
) -> WorkflowResponse:
    """Get a specific workflow."""
    # Placeholder - would use a GetWorkflowUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.post("/versions/{version_id}/publish", response_model=WorkflowResponse)
async def publish_version(
    version_id: uuid.UUID,
    # TODO: Add publish version use case when implemented
    current_user: User = Depends(get_current_user)
) -> WorkflowResponse:
    """Publish a content version."""
    # Placeholder - would use a PublishVersionUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.post("/workflows/{workflow_id}/withdraw", response_model=WorkflowResponse)
async def withdraw_submission(
    workflow_id: uuid.UUID,
    request: WithdrawSubmissionRequest,
    # TODO: Add withdraw submission use case when implemented
    current_user: User = Depends(get_current_user)
) -> WorkflowResponse:
    """Withdraw a submission from review."""
    # Placeholder - would use a WithdrawSubmissionUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/pending-reviews", response_model=list[WorkflowResponse])
async def get_pending_reviews(
    # TODO: Add get pending reviews use case when implemented
    current_user: User = Depends(get_current_user)
) -> list[WorkflowResponse]:
    """Get workflows pending review by current user."""
    # Placeholder - would use a GetPendingReviewsUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")