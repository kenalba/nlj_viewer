"""
Review Content Use Case - Content Review Workflow.

Handles the complete content review workflow including:
- Permission validation for review actions
- Review decision processing (approve/revision/reject)
- State transitions and notifications
- Auto-publish logic for approved content
- Event publishing for workflow tracking
"""

import uuid
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.models.workflow import ReviewDecision
from app.services.orm_services.workflow_orm_service import WorkflowOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase


class ReviewAction(Enum):
    APPROVE = "approve"
    REQUEST_REVISION = "request_revision"
    REJECT = "reject"


@dataclass
class ReviewContentRequest:
    """Request object for content review."""
    workflow_id: uuid.UUID
    action: ReviewAction
    comments: str | None = None
    feedback_areas: dict[str, object] | None = None
    auto_publish: bool = False


@dataclass
class ReviewContentResponse:
    """Response object for content review."""
    workflow_id: uuid.UUID
    new_state: str
    review_id: uuid.UUID
    auto_published: bool = False


class ReviewContentUseCase(BaseUseCase[ReviewContentRequest, ReviewContentResponse]):
    """
    Use case for reviewing content with workflow state management.
    
    Responsibilities:
    - Validate user has permission to review content
    - Process review decisions with proper state transitions
    - Handle auto-publish logic for approved content
    - Create review records for audit trails
    - Publish review events for notifications and analytics
    - Manage reviewer assignments and delegation
    """
    
    def __init__(
        self,
        session: AsyncSession,
        workflow_orm_service: WorkflowOrmService,
        user_orm_service: UserOrmService
    ):
        super().__init__(session)
        self.workflow_service = workflow_orm_service
        self.user_service = user_orm_service

    async def execute(self, request: ReviewContentRequest) -> ReviewContentResponse:
        """Execute the content review workflow."""
        # Get current user from context
        current_user = await self.get_current_user()
        
        # Get workflow with full context
        workflow = await self.workflow_service.get_by_id(request.workflow_id)
        if not workflow:
            raise ValueError("Workflow not found")
        
        # Validate review permissions
        await self._validate_review_permissions(current_user.id, workflow)
        
        # Process review based on action
        review_result = await self._process_review_action(
            workflow, current_user.id, request
        )
        
        # Publish review event
        await self.publish_event("content.reviewed", {
            "workflow_id": str(request.workflow_id),
            "content_id": str(workflow.content_version.content_id) if workflow.content_version else None,
            "reviewer_id": str(current_user.id),
            "action": request.action.value,
            "new_state": review_result["new_state"],
            "auto_published": review_result["auto_published"],
            "comments": request.comments,
            "has_feedback": bool(request.feedback_areas)
        })
        
        return ReviewContentResponse(
            workflow_id=request.workflow_id,
            new_state=review_result["new_state"],
            review_id=review_result["review_id"],
            auto_published=review_result["auto_published"]
        )

    async def _process_review_action(
        self, workflow, reviewer_id: uuid.UUID, request: ReviewContentRequest
    ) -> dict[str, object]:
        """Process the specific review action."""
        if request.action == ReviewAction.APPROVE:
            success = await self.workflow_service.approve_content(
                workflow_id=workflow.id,
                reviewer_id=reviewer_id,
                comments=request.comments,
                feedback_areas=request.feedback_areas,
                auto_publish=request.auto_publish
            )
            if not success:
                raise ValueError("Failed to approve content")
            
            # Get updated workflow to check final state
            updated_workflow = await self.workflow_service.get_by_id(workflow.id)
            return {
                "new_state": updated_workflow.current_state.value,
                "auto_published": request.auto_publish,
                "review_id": updated_workflow.reviews[-1].id if updated_workflow.reviews else None
            }
        
        elif request.action == ReviewAction.REQUEST_REVISION:
            if not request.comments:
                raise ValueError("Comments are required when requesting revision")
            
            success = await self.workflow_service.request_revision(
                workflow_id=workflow.id,
                reviewer_id=reviewer_id,
                comments=request.comments,
                feedback_areas=request.feedback_areas
            )
            if not success:
                raise ValueError("Failed to request revision")
            
            updated_workflow = await self.workflow_service.get_by_id(workflow.id)
            return {
                "new_state": updated_workflow.current_state.value,
                "auto_published": False,
                "review_id": updated_workflow.reviews[-1].id if updated_workflow.reviews else None
            }
        
        elif request.action == ReviewAction.REJECT:
            if not request.comments:
                raise ValueError("Comments are required when rejecting content")
            
            success = await self.workflow_service.reject_content(
                workflow_id=workflow.id,
                reviewer_id=reviewer_id,
                comments=request.comments,
                feedback_areas=request.feedback_areas
            )
            if not success:
                raise ValueError("Failed to reject content")
            
            updated_workflow = await self.workflow_service.get_by_id(workflow.id)
            return {
                "new_state": updated_workflow.current_state.value,
                "auto_published": False,
                "review_id": updated_workflow.reviews[-1].id if updated_workflow.reviews else None
            }
        
        else:
            raise ValueError(f"Unknown review action: {request.action}")

    async def _validate_review_permissions(self, user_id: uuid.UUID, workflow) -> None:
        """Validate user can review the workflow."""
        # Check if user is assigned reviewer
        if workflow.assigned_reviewer_id == user_id:
            return
        
        # Get user for role check
        user = await self.user_service.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Admin can review any content
        if user.role == UserRole.ADMIN:
            return
        
        # Reviewers can review content if no specific reviewer assigned
        if user.role == UserRole.REVIEWER and not workflow.assigned_reviewer_id:
            return
        
        # Otherwise, no permission to review
        raise PermissionError("You don't have permission to review this content")