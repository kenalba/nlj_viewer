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
from app.models import (
    User, WorkflowState, ReviewDecision, VersionStatus,
    WorkflowTemplate, WorkflowTemplateStage, WorkflowStageInstance,
    StageReviewerAssignment, WorkflowTemplateType, StageType
)
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


# Multi-stage workflow request models
class CreateWorkflowTemplateRequest(BaseModel):
    """Request model for creating workflow templates."""
    name: str
    content_type: WorkflowTemplateType
    description: Optional[str] = None
    is_default: bool = False
    auto_publish_on_completion: bool = False
    stages: Optional[List[Dict[str, Any]]] = None


class CreateMultiStageWorkflowRequest(BaseModel):
    """Request model for creating multi-stage workflows."""
    version_id: uuid.UUID
    template_id: uuid.UUID


class AssignStageReviewersRequest(BaseModel):
    """Request model for assigning reviewers to a stage."""
    reviewer_ids: List[uuid.UUID]


class DelegateReviewerRequest(BaseModel):
    """Request model for delegating reviewer assignments."""
    assignment_id: uuid.UUID
    new_reviewer_id: uuid.UUID
    delegation_reason: Optional[str] = None


class SubmitStageReviewRequest(BaseModel):
    """Request model for submitting stage reviews."""
    decision: ReviewDecision
    comments: Optional[str] = None
    feedback_areas: Optional[Dict[str, Any]] = None


# Multi-stage workflow response models
class WorkflowTemplateStageResponse(BaseModel):
    """Response model for workflow template stages."""
    id: uuid.UUID
    template_id: uuid.UUID
    stage_order: int
    stage_type: StageType
    name: str
    description: Optional[str]
    required_approvals: int
    allow_parallel_review: bool
    auto_assign_to_role: Optional[str]
    reviewer_selection_criteria: Optional[Dict[str, Any]]
    estimated_duration_hours: Optional[int]

    class Config:
        from_attributes = True


class WorkflowTemplateResponse(BaseModel):
    """Response model for workflow templates."""
    id: uuid.UUID
    name: str
    content_type: WorkflowTemplateType
    description: Optional[str]
    is_default: bool
    is_active: bool
    auto_publish_on_completion: bool
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    stages: List[WorkflowTemplateStageResponse]

    class Config:
        from_attributes = True


class StageReviewerAssignmentResponse(BaseModel):
    """Response model for stage reviewer assignments."""
    id: uuid.UUID
    stage_instance_id: uuid.UUID
    reviewer_id: Optional[uuid.UUID]
    assigned_role: Optional[str]
    assignment_type: str
    is_active: bool
    has_reviewed: bool
    delegated_from_id: Optional[uuid.UUID]
    delegation_reason: Optional[str]
    assigned_by: uuid.UUID
    assigned_at: datetime

    class Config:
        from_attributes = True


class WorkflowStageInstanceResponse(BaseModel):
    """Response model for workflow stage instances."""
    id: uuid.UUID
    workflow_id: uuid.UUID
    template_stage_id: uuid.UUID
    current_state: WorkflowState
    approvals_received: int
    approvals_required: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    template_stage: WorkflowTemplateStageResponse
    reviewer_assignments: List[StageReviewerAssignmentResponse]

    class Config:
        from_attributes = True


class MultiStageWorkflowResponse(WorkflowResponse):
    """Extended workflow response for multi-stage workflows."""
    template_id: Optional[uuid.UUID]
    current_stage_order: Optional[int]
    stage_instances: List[WorkflowStageInstanceResponse]

    class Config:
        from_attributes = True


# API Endpoints

@router.get("/content/{content_id}/versions", response_model=List[ContentVersionResponse])
async def get_content_versions(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all versions for a content item."""
    try:
        workflow_service = WorkflowService(db)
        versions = await workflow_service.get_content_versions(content_id)
        return [ContentVersionResponse.from_orm(version) for version in versions]
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/versions/{version_id}", response_model=ContentVersionResponse)
async def get_version(
    version_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific version."""
    try:
        workflow_service = WorkflowService(db)
        version = await workflow_service.get_version(version_id)
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Version not found"
            )
        return ContentVersionResponse.from_orm(version)
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


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


# ===== MULTI-STAGE WORKFLOW ENDPOINTS =====

@router.post("/templates", response_model=WorkflowTemplateResponse)
async def create_workflow_template(
    request: CreateWorkflowTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new workflow template."""
    try:
        workflow_service = WorkflowService(db)
        template = await workflow_service.create_workflow_template(
            name=request.name,
            content_type=request.content_type,
            creator_id=current_user.id,
            description=request.description,
            is_default=request.is_default,
            auto_publish_on_completion=request.auto_publish_on_completion,
            stages=request.stages
        )
        return template
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/templates", response_model=List[WorkflowTemplateResponse])
async def get_workflow_templates(
    content_type: Optional[WorkflowTemplateType] = None,
    is_active: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get workflow templates."""
    try:
        workflow_service = WorkflowService(db)
        templates = await workflow_service.get_workflow_templates(
            content_type=content_type,
            is_active=is_active
        )
        return templates
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/templates/default/{content_type}", response_model=Optional[WorkflowTemplateResponse])
async def get_default_template(
    content_type: WorkflowTemplateType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the default template for a content type."""
    try:
        workflow_service = WorkflowService(db)
        template = await workflow_service.get_default_template(content_type)
        return template
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/multi-stage", response_model=MultiStageWorkflowResponse)
async def create_multi_stage_workflow(
    request: CreateMultiStageWorkflowRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a multi-stage workflow from a template."""
    try:
        workflow_service = WorkflowService(db)
        workflow = await workflow_service.create_multi_stage_workflow(
            version_id=request.version_id,
            template_id=request.template_id,
            creator_id=current_user.id
        )
        return workflow
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/stages/{stage_instance_id}/reviewers", response_model=List[StageReviewerAssignmentResponse])
async def assign_stage_reviewers(
    stage_instance_id: uuid.UUID,
    request: AssignStageReviewersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Assign reviewers to a workflow stage."""
    try:
        workflow_service = WorkflowService(db)
        assignments = await workflow_service.assign_stage_reviewers(
            stage_instance_id=stage_instance_id,
            reviewer_ids=request.reviewer_ids,
            assigner_id=current_user.id
        )
        return assignments
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/assignments/delegate", response_model=StageReviewerAssignmentResponse)
async def delegate_reviewer_assignment(
    request: DelegateReviewerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delegate a reviewer assignment to another user."""
    try:
        workflow_service = WorkflowService(db)
        assignment = await workflow_service.delegate_reviewer_assignment(
            assignment_id=request.assignment_id,
            new_reviewer_id=request.new_reviewer_id,
            delegator_id=current_user.id,
            delegation_reason=request.delegation_reason
        )
        return assignment
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/stages/{stage_instance_id}/review", response_model=ReviewResponse)
async def submit_stage_review(
    stage_instance_id: uuid.UUID,
    request: SubmitStageReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a review for a specific stage."""
    try:
        workflow_service = WorkflowService(db)
        review = await workflow_service.submit_stage_review(
            stage_instance_id=stage_instance_id,
            reviewer_id=current_user.id,
            decision=request.decision,
            comments=request.comments,
            feedback_areas=request.feedback_areas
        )
        return review
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/stages/my-reviews", response_model=List[WorkflowStageInstanceResponse])
async def get_my_stage_reviews(
    states: Optional[List[WorkflowState]] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get stage instances assigned to the current user for review."""
    try:
        workflow_service = WorkflowService(db)
        stages = await workflow_service.get_stage_instances_for_reviewer(
            reviewer_id=current_user.id,
            states=states
        )
        return stages
    except WorkflowError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )