"""
API endpoints for version-aware content approval workflows.
Provides REST endpoints for workflow management and review operations.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, get_db
from app.models import User, WorkflowState, ReviewDecision, VersionStatus
from app.models.content import ContentState
from app.services.workflow import WorkflowService, WorkflowError

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


# Pydantic schemas for request/response models
class CreateVersionRequest(BaseModel):
    """Request model for creating a new content version."""
    content_id: uuid.UUID
    nlj_data: Dict[str, Any]
    title: str
    description: Optional[str] = None
    change_summary: Optional[str] = None


class CreateWorkflowRequest(BaseModel):
    """Request model for creating an approval workflow."""
    version_id: uuid.UUID
    requires_approval: bool = True
    auto_publish: bool = False
    assigned_reviewer_id: Optional[uuid.UUID] = None


class SubmitForReviewRequest(BaseModel):
    """Request model for submitting content for review."""
    version_id: uuid.UUID
    reviewer_id: Optional[uuid.UUID] = None


class AssignReviewerRequest(BaseModel):
    """Request model for assigning a reviewer."""
    reviewer_id: uuid.UUID


class ReviewContentRequest(BaseModel):
    """Base request model for review actions."""
    comments: Optional[str] = None
    feedback_areas: Optional[Dict[str, Any]] = None


class ApproveContentRequest(ReviewContentRequest):
    """Request model for approving content."""
    auto_publish: bool = False


class RequestRevisionRequest(ReviewContentRequest):
    """Request model for requesting revisions."""
    comments: str = Field(..., description="Comments are required for revision requests")


class RejectContentRequest(ReviewContentRequest):
    """Request model for rejecting content."""
    comments: str = Field(..., description="Comments are required for rejections")


class WithdrawSubmissionRequest(BaseModel):
    """Request model for withdrawing a submission."""
    reason: Optional[str] = None


class PublishVersionRequest(BaseModel):
    """Request model for publishing a version."""
    version_id: uuid.UUID


class BulkStatusChangeRequest(BaseModel):
    """Request model for bulk status changes."""
    content_ids: List[uuid.UUID]
    new_status: str = Field(..., description="New status for content items")


# Response models
class ContentVersionResponse(BaseModel):
    """Response model for content versions."""
    id: uuid.UUID
    content_id: uuid.UUID
    version_number: int
    version_status: VersionStatus
    title: str
    description: Optional[str]
    change_summary: Optional[str]
    created_by: uuid.UUID
    created_at: datetime
    published_at: Optional[datetime]
    archived_at: Optional[datetime]

    class Config:
        from_attributes = True


class WorkflowResponse(BaseModel):
    """Response model for approval workflows."""
    id: uuid.UUID
    content_version_id: uuid.UUID
    current_state: WorkflowState
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    published_at: Optional[datetime]
    assigned_reviewer_id: Optional[uuid.UUID]
    requires_approval: bool
    auto_publish: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewResponse(BaseModel):
    """Response model for workflow reviews."""
    id: uuid.UUID
    workflow_id: uuid.UUID
    reviewer_id: uuid.UUID
    decision: ReviewDecision
    comments: Optional[str]
    feedback_areas: Optional[Dict[str, Any]]
    previous_state: WorkflowState
    new_state: WorkflowState
    created_at: datetime

    class Config:
        from_attributes = True


class PendingReviewResponse(BaseModel):
    """Response model for pending reviews."""
    workflow: WorkflowResponse
    content_id: uuid.UUID
    content_title: str
    content_description: Optional[str]
    version_number: int
    creator_name: str
    submitted_at: Optional[datetime]

    class Config:
        from_attributes = True


# API Endpoints

@router.post("/versions", response_model=ContentVersionResponse)
async def create_content_version(
    request: CreateVersionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new version of content."""
    try:
        workflow_service = WorkflowService(db)
        version = await workflow_service.create_content_version(
            content_id=request.content_id,
            creator_id=current_user.id,
            nlj_data=request.nlj_data,
            title=request.title,
            description=request.description,
            change_summary=request.change_summary
        )
        return ContentVersionResponse.from_orm(version)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/workflows", response_model=WorkflowResponse)
async def create_approval_workflow(
    request: CreateWorkflowRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create an approval workflow for a content version."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.create_approval_workflow(
            version_id=request.version_id,
            requires_approval=request.requires_approval,
            auto_publish=request.auto_publish,
            assigned_reviewer_id=request.assigned_reviewer_id
        )
        return WorkflowResponse.from_orm(workflow)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/submit-for-review", response_model=WorkflowResponse)
async def submit_for_review(
    request: SubmitForReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a content version for review."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.submit_for_review(
            version_id=request.version_id,
            reviewer_id=request.reviewer_id
        )
        return WorkflowResponse.from_orm(workflow)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/workflows/{workflow_id}/assign-reviewer", response_model=WorkflowResponse)
async def assign_reviewer(
    workflow_id: uuid.UUID,
    request: AssignReviewerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Assign a reviewer to a workflow."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.assign_reviewer(
            workflow_id=workflow_id,
            reviewer_id=request.reviewer_id,
            assigner_id=current_user.id
        )
        return WorkflowResponse.from_orm(workflow)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/workflows/{workflow_id}/approve", response_model=WorkflowResponse)
async def approve_content(
    workflow_id: uuid.UUID,
    request: ApproveContentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Approve a content version."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.approve_content(
            workflow_id=workflow_id,
            reviewer_id=current_user.id,
            comments=request.comments,
            feedback_areas=request.feedback_areas,
            auto_publish=request.auto_publish
        )
        return WorkflowResponse.from_orm(workflow)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/workflows/{workflow_id}/request-revision", response_model=WorkflowResponse)
async def request_revision(
    workflow_id: uuid.UUID,
    request: RequestRevisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Request revisions for a content version."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.request_revision(
            workflow_id=workflow_id,
            reviewer_id=current_user.id,
            comments=request.comments,
            feedback_areas=request.feedback_areas
        )
        return WorkflowResponse.from_orm(workflow)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/workflows/{workflow_id}/reject", response_model=WorkflowResponse)
async def reject_content(
    workflow_id: uuid.UUID,
    request: RejectContentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reject a content version."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.reject_content(
            workflow_id=workflow_id,
            reviewer_id=current_user.id,
            comments=request.comments,
            feedback_areas=request.feedback_areas
        )
        return WorkflowResponse.from_orm(workflow)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/publish", response_model=ContentVersionResponse)
async def publish_version(
    request: PublishVersionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish a content version."""
    try:
        workflow_service = WorkflowService(db)
        version = await workflow_service.publish_version(
            version_id=request.version_id,
            publisher_id=current_user.id
        )
        return ContentVersionResponse.from_orm(version)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/workflows/{workflow_id}/withdraw", response_model=WorkflowResponse)
async def withdraw_submission(
    workflow_id: uuid.UUID,
    request: WithdrawSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Withdraw a content submission from review."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.withdraw_submission(
            workflow_id=workflow_id,
            creator_id=current_user.id,
            reason=request.reason
        )
        return WorkflowResponse.from_orm(workflow)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/pending-reviews", response_model=List[PendingReviewResponse])
async def get_pending_reviews(
    reviewer_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get workflows pending review."""
    try:
        workflow_service = WorkflowService(db)
        
        # If no reviewer_id specified, show all pending for reviewers/admins
        if reviewer_id is None and current_user.role in ['reviewer', 'approver', 'admin']:
            reviewer_id = current_user.id
        
        workflows = await workflow_service.get_pending_reviews(reviewer_id)
        
        responses = []
        for workflow in workflows:
            responses.append(PendingReviewResponse(
                workflow=WorkflowResponse.from_orm(workflow),
                content_id=workflow.content_version.content_id,
                content_title=workflow.content_version.title,
                content_description=workflow.content_version.description,
                version_number=workflow.content_version.version_number,
                creator_name=workflow.content_version.creator.full_name,
                submitted_at=workflow.submitted_at
            ))
        
        return responses
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/workflows/{workflow_id}/history", response_model=List[ReviewResponse])
async def get_workflow_history(
    workflow_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the review history for a workflow."""
    try:
        workflow_service = WorkflowService(db)
        reviews = await workflow_service.get_workflow_history(workflow_id)
        return [ReviewResponse.from_orm(review) for review in reviews]
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/bulk-status-change", response_model=Dict[str, Any])
async def bulk_change_status(
    request: BulkStatusChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Bulk change status for multiple content items."""
    try:
        # Validate status value
        try:
            new_status = ContentState(request.new_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {request.new_status}"
            )
        
        workflow_service = WorkflowService(db)
        updated_ids = await workflow_service.bulk_change_content_status(
            content_ids=request.content_ids,
            new_status=new_status,
            user_id=current_user.id
        )
        
        return {
            "updated_count": len(updated_ids),
            "updated_ids": updated_ids,
            "skipped_count": len(request.content_ids) - len(updated_ids),
            "new_status": request.new_status
        }
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )