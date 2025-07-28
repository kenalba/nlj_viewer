"""
Workflow service for managing version-aware content approval workflows.
Implements state machine logic for content lifecycle management.
"""

import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models import (
    ContentItem, ContentVersion, ApprovalWorkflow, WorkflowReview,
    VersionStatus, WorkflowState, ReviewDecision, User
)
from app.models.content import ContentState


class WorkflowError(Exception):
    """Custom exception for workflow-related errors."""
    pass


class WorkflowService:
    """Service for managing content approval workflows."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_content_version(
        self,
        content_id: uuid.UUID,
        creator_id: uuid.UUID,
        nlj_data: dict,
        title: str,
        description: Optional[str] = None,
        change_summary: Optional[str] = None
    ) -> ContentVersion:
        """Create a new version of content."""
        
        # Get the content item
        result = await self.db.execute(
            select(ContentItem)
            .options(selectinload(ContentItem.versions))
            .where(ContentItem.id == content_id)
        )
        content = result.scalar_one_or_none()
        
        if not content:
            raise WorkflowError(f"Content with ID {content_id} not found")
        
        # Calculate next version number
        next_version_number = (
            max(v.version_number for v in content.versions) + 1 
            if content.versions else 1
        )
        
        # Create new version
        new_version = ContentVersion(
            content_id=content_id,
            version_number=next_version_number,
            version_status=VersionStatus.DRAFT,
            nlj_data=nlj_data,
            title=title,
            description=description,
            change_summary=change_summary,
            created_by=creator_id
        )
        
        self.db.add(new_version)
        await self.db.commit()
        await self.db.refresh(new_version)
        
        return new_version
    
    async def create_approval_workflow(
        self,
        version_id: uuid.UUID,
        requires_approval: bool = True,
        auto_publish: bool = False,
        assigned_reviewer_id: Optional[uuid.UUID] = None
    ) -> ApprovalWorkflow:
        """Create an approval workflow for a content version."""
        
        # Check if workflow already exists
        result = await self.db.execute(
            select(ApprovalWorkflow)
            .where(ApprovalWorkflow.content_version_id == version_id)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise WorkflowError(f"Workflow already exists for version {version_id}")
        
        workflow = ApprovalWorkflow(
            content_version_id=version_id,
            current_state=WorkflowState.DRAFT,
            requires_approval=requires_approval,
            auto_publish=auto_publish,
            assigned_reviewer_id=assigned_reviewer_id
        )
        
        self.db.add(workflow)
        await self.db.commit()
        await self.db.refresh(workflow)
        
        return workflow
    
    async def submit_for_review(
        self,
        version_id: uuid.UUID,
        reviewer_id: Optional[uuid.UUID] = None
    ) -> ApprovalWorkflow:
        """Submit a content version for review."""
        
        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version).selectinload(ContentVersion.content)
            )
            .where(ApprovalWorkflow.content_version_id == version_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise WorkflowError(f"No workflow found for version {version_id}")
        
        if not workflow.can_submit_for_review():
            raise WorkflowError(
                f"Cannot submit version in state {workflow.current_state} for review"
            )
        
        # Update workflow state
        previous_state = workflow.current_state
        workflow.current_state = WorkflowState.SUBMITTED_FOR_REVIEW
        workflow.submitted_at = datetime.utcnow()
        
        if reviewer_id:
            workflow.assigned_reviewer_id = reviewer_id
            workflow.current_state = WorkflowState.IN_REVIEW
        
        # CRITICAL: Update parent content state to SUBMITTED (not PUBLISHED)
        if workflow.content_version and workflow.content_version.content:
            workflow.content_version.content.state = ContentState.SUBMITTED
        
        await self.db.commit()
        await self.db.refresh(workflow)
        
        # Log the state change
        await self._log_state_change(
            workflow.id,
            reviewer_id,  # Submitter becomes the reviewer for logging
            ReviewDecision.APPROVE,  # Submission is like an approval to move forward
            previous_state,
            workflow.current_state,
            comments="Submitted for review"
        )
        
        return workflow
    
    async def assign_reviewer(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        assigner_id: uuid.UUID
    ) -> ApprovalWorkflow:
        """Assign a reviewer to a workflow."""
        
        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version).selectinload(ContentVersion.content)
            )
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")
        
        if workflow.current_state != WorkflowState.SUBMITTED_FOR_REVIEW:
            raise WorkflowError(
                f"Cannot assign reviewer to workflow in state {workflow.current_state}"
            )
        
        previous_state = workflow.current_state
        workflow.assigned_reviewer_id = reviewer_id
        workflow.current_state = WorkflowState.IN_REVIEW
        
        # Update parent content state to IN_REVIEW when reviewer is assigned
        if workflow.content_version and workflow.content_version.content:
            workflow.content_version.content.state = ContentState.IN_REVIEW
        
        await self.db.commit()
        await self.db.refresh(workflow)
        
        # Log the assignment
        await self._log_state_change(
            workflow_id,
            assigner_id,
            ReviewDecision.APPROVE,
            previous_state,
            workflow.current_state,
            comments=f"Assigned to reviewer {reviewer_id}"
        )
        
        return workflow
    
    async def approve_content(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        comments: Optional[str] = None,
        feedback_areas: Optional[dict] = None,
        auto_publish: bool = False
    ) -> ApprovalWorkflow:
        """Approve a content version."""
        
        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version).selectinload(ContentVersion.content)
            )
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")
        
        if not workflow.can_approve():
            raise WorkflowError(
                f"Cannot approve workflow in state {workflow.current_state}"
            )
        
        # Update workflow state
        previous_state = workflow.current_state
        workflow.current_state = WorkflowState.APPROVED_PENDING_PUBLISH
        workflow.approved_at = datetime.utcnow()
        
        # Update parent content state to APPROVED
        if workflow.content_version and workflow.content_version.content:
            workflow.content_version.content.state = ContentState.APPROVED
        
        await self.db.commit()
        await self.db.refresh(workflow)
        
        # Log the approval
        await self._log_state_change(
            workflow_id,
            reviewer_id,
            ReviewDecision.APPROVE,
            previous_state,
            workflow.current_state,
            comments=comments,
            feedback_areas=feedback_areas
        )
        
        # Auto-publish if requested
        if auto_publish or workflow.auto_publish:
            await self.publish_version(workflow.content_version_id, reviewer_id)
        
        return workflow
    
    async def request_revision(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        comments: str,
        feedback_areas: Optional[dict] = None
    ) -> ApprovalWorkflow:
        """Request revisions for a content version."""
        
        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version).selectinload(ContentVersion.content)
            )
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")
        
        if not workflow.can_request_revision():
            raise WorkflowError(
                f"Cannot request revision for workflow in state {workflow.current_state}"
            )
        
        # Update workflow state
        previous_state = workflow.current_state
        workflow.current_state = WorkflowState.REVISION_REQUESTED
        
        # Update parent content state back to DRAFT for revision
        if workflow.content_version and workflow.content_version.content:
            workflow.content_version.content.state = ContentState.DRAFT
        
        await self.db.commit()
        await self.db.refresh(workflow)
        
        # Log the revision request
        await self._log_state_change(
            workflow_id,
            reviewer_id,
            ReviewDecision.REQUEST_REVISION,
            previous_state,
            workflow.current_state,
            comments=comments,
            feedback_areas=feedback_areas
        )
        
        return workflow
    
    async def reject_content(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        comments: str,
        feedback_areas: Optional[dict] = None
    ) -> ApprovalWorkflow:
        """Reject a content version."""
        
        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version).selectinload(ContentVersion.content)
            )
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")
        
        if workflow.current_state != WorkflowState.IN_REVIEW:
            raise WorkflowError(
                f"Cannot reject workflow in state {workflow.current_state}"
            )
        
        # Update workflow state
        previous_state = workflow.current_state
        workflow.current_state = WorkflowState.REJECTED
        
        # Update parent content state to REJECTED
        if workflow.content_version and workflow.content_version.content:
            workflow.content_version.content.state = ContentState.REJECTED
        
        await self.db.commit()
        await self.db.refresh(workflow)
        
        # Log the rejection
        await self._log_state_change(
            workflow_id,
            reviewer_id,
            ReviewDecision.REJECT,
            previous_state,
            workflow.current_state,
            comments=comments,
            feedback_areas=feedback_areas
        )
        
        return workflow
    
    async def publish_version(
        self,
        version_id: uuid.UUID,
        publisher_id: uuid.UUID
    ) -> ContentVersion:
        """Publish a content version."""
        
        result = await self.db.execute(
            select(ContentVersion)
            .options(
                selectinload(ContentVersion.content).selectinload(ContentItem.versions),
                selectinload(ContentVersion.approval_workflow)
            )
            .where(ContentVersion.id == version_id)
        )
        version = result.scalar_one_or_none()
        
        if not version:
            raise WorkflowError(f"Version {version_id} not found")
        
        # Check if version can be published
        if version.approval_workflow and not version.approval_workflow.can_publish():
            raise WorkflowError(
                f"Version cannot be published in workflow state {version.approval_workflow.current_state}"
            )
        
        # Archive current published version if it exists
        current_published = None
        for v in version.content.versions:
            if v.version_status == VersionStatus.PUBLISHED:
                current_published = v
                break
        
        if current_published:
            current_published.version_status = VersionStatus.ARCHIVED
            current_published.archived_at = datetime.utcnow()
        
        # Publish the new version
        version.version_status = VersionStatus.PUBLISHED
        version.published_at = datetime.utcnow()
        
        # Update workflow if exists
        if version.approval_workflow:
            version.approval_workflow.current_state = WorkflowState.PUBLISHED
            version.approval_workflow.published_at = datetime.utcnow()
        
        # Update parent content state
        version.content.state = ContentState.PUBLISHED
        version.content.published_at = datetime.utcnow()
        
        await self.db.commit()
        
        return version
    
    async def withdraw_submission(
        self,
        workflow_id: uuid.UUID,
        creator_id: uuid.UUID,
        reason: Optional[str] = None
    ) -> ApprovalWorkflow:
        """Withdraw a content submission from review."""
        
        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version).selectinload(ContentVersion.content)
            )
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")
        
        if workflow.current_state not in {
            WorkflowState.SUBMITTED_FOR_REVIEW,
            WorkflowState.IN_REVIEW
        }:
            raise WorkflowError(
                f"Cannot withdraw workflow in state {workflow.current_state}"
            )
        
        previous_state = workflow.current_state
        workflow.current_state = WorkflowState.WITHDRAWN
        
        # Update parent content state back to DRAFT when withdrawn
        if workflow.content_version and workflow.content_version.content:
            workflow.content_version.content.state = ContentState.DRAFT
        
        await self.db.commit()
        await self.db.refresh(workflow)
        
        # Log the withdrawal
        await self._log_state_change(
            workflow_id,
            creator_id,
            ReviewDecision.REQUEST_REVISION,  # Closest equivalent
            previous_state,
            workflow.current_state,
            comments=f"Withdrawn by creator: {reason or 'No reason provided'}"
        )
        
        return workflow
    
    async def get_pending_reviews(
        self,
        reviewer_id: Optional[uuid.UUID] = None
    ) -> List[ApprovalWorkflow]:
        """Get workflows pending review."""
        
        query = select(ApprovalWorkflow).options(
            selectinload(ApprovalWorkflow.content_version).selectinload(ContentVersion.content),
            selectinload(ApprovalWorkflow.assigned_reviewer)
        ).where(
            ApprovalWorkflow.current_state.in_([
                WorkflowState.SUBMITTED_FOR_REVIEW,
                WorkflowState.IN_REVIEW
            ])
        )
        
        if reviewer_id:
            query = query.where(ApprovalWorkflow.assigned_reviewer_id == reviewer_id)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_workflow_history(
        self,
        workflow_id: uuid.UUID
    ) -> List[WorkflowReview]:
        """Get the review history for a workflow."""
        
        result = await self.db.execute(
            select(WorkflowReview)
            .options(selectinload(WorkflowReview.reviewer))
            .where(WorkflowReview.workflow_id == workflow_id)
            .order_by(WorkflowReview.created_at.desc())
        )
        
        return result.scalars().all()
    
    async def bulk_change_content_status(
        self,
        content_ids: List[uuid.UUID],
        new_status: ContentState,
        user_id: uuid.UUID
    ) -> List[uuid.UUID]:
        """Bulk change content status for multiple items."""
        
        # Get all content items to update
        result = await self.db.execute(
            select(ContentItem)
            .where(ContentItem.id.in_(content_ids))
        )
        content_items = result.scalars().all()
        
        updated_ids = []
        
        for content_item in content_items:
            # Validate state transition
            if not self._can_change_status(content_item.state, new_status):
                continue
            
            # Update content state
            content_item.state = new_status
            updated_ids.append(content_item.id)
        
        await self.db.commit()
        
        return updated_ids
    
    def _can_change_status(self, current_state: ContentState, new_state: ContentState) -> bool:
        """Check if a status change is allowed."""
        
        # Allow most transitions for now, but prevent some invalid ones
        invalid_transitions = {
            # Can't go directly from REJECTED to PUBLISHED without review
            (ContentState.REJECTED, ContentState.PUBLISHED),
            # Can't go from ARCHIVED back to active states without proper workflow
            (ContentState.ARCHIVED, ContentState.PUBLISHED),
            (ContentState.ARCHIVED, ContentState.APPROVED),
        }
        
        transition = (current_state, new_state)
        return transition not in invalid_transitions
    
    async def _log_state_change(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        decision: ReviewDecision,
        previous_state: WorkflowState,
        new_state: WorkflowState,
        comments: Optional[str] = None,
        feedback_areas: Optional[dict] = None
    ) -> WorkflowReview:
        """Log a workflow state change."""
        
        review = WorkflowReview(
            workflow_id=workflow_id,
            reviewer_id=reviewer_id,
            decision=decision,
            comments=comments,
            feedback_areas=feedback_areas,
            previous_state=previous_state,
            new_state=new_state
        )
        
        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)
        
        return review