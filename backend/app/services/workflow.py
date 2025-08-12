"""
Workflow service for managing version-aware content approval workflows.
Implements state machine logic for content lifecycle management.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models import (
    ApprovalWorkflow,
    ContentItem,
    ContentVersion,
    ReviewDecision,
    StageReviewerAssignment,
    StageType,
    User,
    VersionStatus,
    WorkflowReview,
    WorkflowStageInstance,
    WorkflowState,
    WorkflowTemplate,
    WorkflowTemplateStage,
    WorkflowTemplateType,
)
from app.models.content import ContentState


class WorkflowError(Exception):
    """Custom exception for workflow-related errors."""


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
        change_summary: Optional[str] = None,
    ) -> ContentVersion:
        """Create a new version of content."""

        # Get the content item
        result = await self.db.execute(
            select(ContentItem).options(joinedload(ContentItem.versions)).where(ContentItem.id == content_id)
        )
        content = result.scalar_one_or_none()

        if not content:
            raise WorkflowError(f"Content with ID {content_id} not found")

        # Calculate next version number
        next_version_number = max(v.version_number for v in content.versions) + 1 if content.versions else 1

        # Create new version
        new_version = ContentVersion(
            content_id=content_id,
            version_number=next_version_number,
            version_status=VersionStatus.DRAFT,
            nlj_data=nlj_data,
            title=title,
            description=description,
            change_summary=change_summary,
            created_by=creator_id,
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
        assigned_reviewer_id: Optional[uuid.UUID] = None,
    ) -> ApprovalWorkflow:
        """Create an approval workflow for a content version."""

        # Check if workflow already exists
        result = await self.db.execute(
            select(ApprovalWorkflow).where(ApprovalWorkflow.content_version_id == version_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            raise WorkflowError(f"Workflow already exists for version {version_id}")

        workflow = ApprovalWorkflow(
            content_version_id=version_id,
            current_state=WorkflowState.DRAFT,
            requires_approval=requires_approval,
            auto_publish=auto_publish,
            assigned_reviewer_id=assigned_reviewer_id,
        )

        self.db.add(workflow)
        await self.db.commit()
        await self.db.refresh(workflow)

        return workflow

    async def submit_for_review(
        self, version_id: uuid.UUID, reviewer_id: Optional[uuid.UUID] = None
    ) -> ApprovalWorkflow:
        """Submit a content version for review."""

        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(joinedload(ApprovalWorkflow.content_version).joinedload(ContentVersion.content))
            .where(ApprovalWorkflow.content_version_id == version_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowError(f"No workflow found for version {version_id}")

        if not workflow.can_submit_for_review():
            raise WorkflowError(f"Cannot submit version in state {workflow.current_state} for review")

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
        # Use the current user ID (submitter) when no reviewer is specified
        log_reviewer_id = reviewer_id if reviewer_id else workflow.content_version.created_by
        await self._log_state_change(
            workflow.id,
            log_reviewer_id,
            ReviewDecision.APPROVE,  # Submission is like an approval to move forward
            previous_state,
            workflow.current_state,
            comments="Submitted for review",
        )

        return workflow

    async def assign_reviewer(
        self, workflow_id: uuid.UUID, reviewer_id: uuid.UUID, assigner_id: uuid.UUID
    ) -> ApprovalWorkflow:
        """Assign a reviewer to a workflow."""

        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(joinedload(ApprovalWorkflow.content_version).joinedload(ContentVersion.content))
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")

        if workflow.current_state != WorkflowState.SUBMITTED_FOR_REVIEW:
            raise WorkflowError(f"Cannot assign reviewer to workflow in state {workflow.current_state}")

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
            comments=f"Assigned to reviewer {reviewer_id}",
        )

        return workflow

    async def approve_content(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        comments: Optional[str] = None,
        feedback_areas: Optional[dict] = None,
        auto_publish: bool = False,
    ) -> ApprovalWorkflow:
        """Approve a content version."""

        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(joinedload(ApprovalWorkflow.content_version).joinedload(ContentVersion.content))
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")

        if not workflow.can_approve():
            raise WorkflowError(f"Cannot approve workflow in state {workflow.current_state}")

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
            feedback_areas=feedback_areas,
        )

        # Auto-publish if requested
        if auto_publish or workflow.auto_publish:
            await self.publish_version(workflow.content_version_id, reviewer_id)

        return workflow

    async def request_revision(
        self, workflow_id: uuid.UUID, reviewer_id: uuid.UUID, comments: str, feedback_areas: Optional[dict] = None
    ) -> ApprovalWorkflow:
        """Request revisions for a content version."""

        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(joinedload(ApprovalWorkflow.content_version).joinedload(ContentVersion.content))
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")

        if not workflow.can_request_revision():
            raise WorkflowError(f"Cannot request revision for workflow in state {workflow.current_state}")

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
            feedback_areas=feedback_areas,
        )

        return workflow

    async def reject_content(
        self, workflow_id: uuid.UUID, reviewer_id: uuid.UUID, comments: str, feedback_areas: Optional[dict] = None
    ) -> ApprovalWorkflow:
        """Reject a content version."""

        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(joinedload(ApprovalWorkflow.content_version).joinedload(ContentVersion.content))
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")

        if workflow.current_state != WorkflowState.IN_REVIEW:
            raise WorkflowError(f"Cannot reject workflow in state {workflow.current_state}")

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
            feedback_areas=feedback_areas,
        )

        return workflow

    async def publish_version(self, version_id: uuid.UUID, publisher_id: uuid.UUID) -> ContentVersion:
        """Publish a content version."""

        result = await self.db.execute(
            select(ContentVersion)
            .options(
                joinedload(ContentVersion.content).joinedload(ContentItem.versions),
                joinedload(ContentVersion.approval_workflow),
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
        self, workflow_id: uuid.UUID, creator_id: uuid.UUID, reason: Optional[str] = None
    ) -> ApprovalWorkflow:
        """Withdraw a content submission from review."""

        result = await self.db.execute(
            select(ApprovalWorkflow)
            .options(joinedload(ApprovalWorkflow.content_version).joinedload(ContentVersion.content))
            .where(ApprovalWorkflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowError(f"Workflow {workflow_id} not found")

        if workflow.current_state not in {WorkflowState.SUBMITTED_FOR_REVIEW, WorkflowState.IN_REVIEW}:
            raise WorkflowError(f"Cannot withdraw workflow in state {workflow.current_state}")

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
            comments=f"Withdrawn by creator: {reason or 'No reason provided'}",
        )

        return workflow

    async def get_pending_reviews(self, reviewer_id: Optional[uuid.UUID] = None) -> List[ApprovalWorkflow]:
        """Get workflows pending review."""

        query = (
            select(ApprovalWorkflow)
            .options(
                joinedload(ApprovalWorkflow.content_version).joinedload(ContentVersion.content),
                joinedload(ApprovalWorkflow.assigned_reviewer),
            )
            .where(ApprovalWorkflow.current_state.in_([WorkflowState.SUBMITTED_FOR_REVIEW, WorkflowState.IN_REVIEW]))
        )

        if reviewer_id:
            query = query.where(ApprovalWorkflow.assigned_reviewer_id == reviewer_id)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_workflow_history(self, workflow_id: uuid.UUID) -> List[WorkflowReview]:
        """Get the review history for a workflow."""

        result = await self.db.execute(
            select(WorkflowReview)
            .options(joinedload(WorkflowReview.reviewer))
            .where(WorkflowReview.workflow_id == workflow_id)
            .order_by(WorkflowReview.created_at.desc())
        )

        return result.scalars().all()

    async def bulk_change_content_status(
        self, content_ids: List[uuid.UUID], new_status: ContentState, user_id: uuid.UUID
    ) -> List[uuid.UUID]:
        """Bulk change content status for multiple items."""

        # Get all content items to update
        result = await self.db.execute(select(ContentItem).where(ContentItem.id.in_(content_ids)))
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
        feedback_areas: Optional[dict] = None,
    ) -> WorkflowReview:
        """Log a workflow state change."""

        review = WorkflowReview(
            workflow_id=workflow_id,
            reviewer_id=reviewer_id,
            decision=decision,
            comments=comments,
            feedback_areas=feedback_areas,
            previous_state=previous_state,
            new_state=new_state,
        )

        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)

        return review

    # ===== MULTI-STAGE WORKFLOW METHODS =====

    async def create_workflow_template(
        self,
        name: str,
        content_type: WorkflowTemplateType,
        creator_id: uuid.UUID,
        description: str | None = None,
        is_default: bool = False,
        auto_publish_on_completion: bool = False,
        stages: list[dict] | None = None,
    ) -> WorkflowTemplate:
        """Create a new workflow template with stages."""

        template = WorkflowTemplate(
            name=name,
            content_type=content_type,
            description=description,
            is_default=is_default,
            is_active=True,
            auto_publish_on_completion=auto_publish_on_completion,
            created_by=creator_id,
        )

        self.db.add(template)
        await self.db.flush()  # Get template ID before creating stages

        # Create stages if provided
        if stages:
            for stage_data in stages:
                stage = WorkflowTemplateStage(
                    template_id=template.id,
                    stage_order=stage_data["stage_order"],
                    stage_type=StageType(stage_data["stage_type"]),
                    name=stage_data["name"],
                    description=stage_data.get("description"),
                    required_approvals=stage_data.get("required_approvals", 1),
                    allow_parallel_review=stage_data.get("allow_parallel_review", False),
                    auto_assign_to_role=stage_data.get("auto_assign_to_role"),
                    reviewer_selection_criteria=stage_data.get("reviewer_selection_criteria"),
                    estimated_duration_hours=stage_data.get("estimated_duration_hours"),
                )
                self.db.add(stage)

        await self.db.commit()
        await self.db.refresh(template)

        return template

    async def get_workflow_templates(
        self, content_type: WorkflowTemplateType | None = None, is_active: bool = True
    ) -> list[WorkflowTemplate]:
        """Get workflow templates, optionally filtered by content type."""

        query = (
            select(WorkflowTemplate)
            .options(joinedload(WorkflowTemplate.stages), joinedload(WorkflowTemplate.creator))
            .where(WorkflowTemplate.is_active == is_active)
        )

        if content_type:
            query = query.where(WorkflowTemplate.content_type == content_type)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_default_template(self, content_type: WorkflowTemplateType) -> WorkflowTemplate | None:
        """Get the default template for a content type."""

        result = await self.db.execute(
            select(WorkflowTemplate)
            .options(joinedload(WorkflowTemplate.stages))
            .where(
                WorkflowTemplate.content_type == content_type,
                WorkflowTemplate.is_default,
                WorkflowTemplate.is_active,
            )
        )

        return result.scalar_one_or_none()

    async def create_multi_stage_workflow(
        self, version_id: uuid.UUID, template_id: uuid.UUID, creator_id: uuid.UUID
    ) -> ApprovalWorkflow:
        """Create a multi-stage workflow from a template."""

        # Get the template with stages
        result = await self.db.execute(
            select(WorkflowTemplate)
            .options(joinedload(WorkflowTemplate.stages))
            .where(WorkflowTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise WorkflowError(f"Template {template_id} not found")

        if not template.stages:
            raise WorkflowError(f"Template {template_id} has no stages defined")

        # Create the main workflow
        workflow = ApprovalWorkflow(
            content_version_id=version_id,
            current_state=WorkflowState.DRAFT,
            template_id=template_id,
            current_stage_order=1,  # Start with first stage
            requires_approval=True,
            auto_publish=template.auto_publish_on_completion,
        )

        self.db.add(workflow)
        await self.db.flush()  # Get workflow ID

        # Create stage instances for all stages in the template
        for stage_template in template.stages:
            stage_instance = WorkflowStageInstance(
                workflow_id=workflow.id,
                template_stage_id=stage_template.id,
                current_state=WorkflowState.DRAFT,
                approvals_required=stage_template.required_approvals,
                approvals_received=0,
            )
            self.db.add(stage_instance)

        await self.db.commit()
        await self.db.refresh(workflow)

        return workflow

    async def assign_stage_reviewers(
        self, stage_instance_id: uuid.UUID, reviewer_ids: list[uuid.UUID], assigner_id: uuid.UUID
    ) -> list[StageReviewerAssignment]:
        """Assign reviewers to a specific stage instance."""

        # Get the stage instance
        result = await self.db.execute(
            select(WorkflowStageInstance)
            .options(joinedload(WorkflowStageInstance.template_stage))
            .where(WorkflowStageInstance.id == stage_instance_id)
        )
        stage_instance = result.scalar_one_or_none()

        if not stage_instance:
            raise WorkflowError(f"Stage instance {stage_instance_id} not found")

        assignments = []

        for reviewer_id in reviewer_ids:
            assignment = StageReviewerAssignment(
                stage_instance_id=stage_instance_id,
                reviewer_id=reviewer_id,
                assignment_type="direct",
                is_active=True,
                has_reviewed=False,
                assigned_by=assigner_id,
            )
            self.db.add(assignment)
            assignments.append(assignment)

        await self.db.commit()

        # Refresh all assignments
        for assignment in assignments:
            await self.db.refresh(assignment)

        return assignments

    async def delegate_reviewer_assignment(
        self,
        assignment_id: uuid.UUID,
        new_reviewer_id: uuid.UUID,
        delegator_id: uuid.UUID,
        delegation_reason: str | None = None,
    ) -> StageReviewerAssignment:
        """Delegate a reviewer assignment to another user."""

        # Get the original assignment
        result = await self.db.execute(
            select(StageReviewerAssignment).where(StageReviewerAssignment.id == assignment_id)
        )
        original_assignment = result.scalar_one_or_none()

        if not original_assignment:
            raise WorkflowError(f"Assignment {assignment_id} not found")

        if original_assignment.reviewer_id != delegator_id:
            raise WorkflowError("Only the assigned reviewer can delegate their assignment")

        if original_assignment.has_reviewed:
            raise WorkflowError("Cannot delegate an assignment that has already been reviewed")

        # Deactivate the original assignment
        original_assignment.is_active = False

        # Create new delegated assignment
        new_assignment = StageReviewerAssignment(
            stage_instance_id=original_assignment.stage_instance_id,
            reviewer_id=new_reviewer_id,
            assignment_type="delegated",
            is_active=True,
            has_reviewed=False,
            delegated_from_id=delegator_id,
            delegation_reason=delegation_reason,
            assigned_by=original_assignment.assigned_by,
        )

        self.db.add(new_assignment)
        await self.db.commit()
        await self.db.refresh(new_assignment)

        return new_assignment

    async def submit_stage_review(
        self,
        stage_instance_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        decision: ReviewDecision,
        comments: str | None = None,
        feedback_areas: dict | None = None,
    ) -> WorkflowReview:
        """Submit a review for a specific stage."""

        # Get stage instance with related data
        result = await self.db.execute(
            select(WorkflowStageInstance)
            .options(
                joinedload(WorkflowStageInstance.workflow)
                .joinedload(ApprovalWorkflow.content_version)
                .joinedload(ContentVersion.content),
                joinedload(WorkflowStageInstance.template_stage),
                joinedload(WorkflowStageInstance.reviewer_assignments),
            )
            .where(WorkflowStageInstance.id == stage_instance_id)
        )
        stage_instance = result.scalar_one_or_none()

        if not stage_instance:
            raise WorkflowError(f"Stage instance {stage_instance_id} not found")

        # Verify reviewer is assigned to this stage
        reviewer_assignment = None
        for assignment in stage_instance.reviewer_assignments:
            if assignment.reviewer_id == reviewer_id and assignment.is_active:
                reviewer_assignment = assignment
                break

        if not reviewer_assignment:
            raise WorkflowError(f"Reviewer {reviewer_id} is not assigned to this stage")

        if reviewer_assignment.has_reviewed:
            raise WorkflowError("Reviewer has already submitted a review for this stage")

        # Create the review
        previous_state = stage_instance.current_state

        # Update stage instance based on decision
        if decision == ReviewDecision.APPROVE:
            stage_instance.approvals_received += 1

            # Mark reviewer as having reviewed
            reviewer_assignment.has_reviewed = True

            # Check if stage is complete
            if stage_instance.approvals_received >= stage_instance.approvals_required:
                stage_instance.current_state = WorkflowState.APPROVED_PENDING_PUBLISH
                stage_instance.completed_at = datetime.utcnow()

                # Check if we can advance to next stage
                await self._advance_to_next_stage(stage_instance.workflow)

        elif decision == ReviewDecision.REQUEST_REVISION:
            stage_instance.current_state = WorkflowState.REVISION_REQUESTED
            # Update parent workflow and content state
            stage_instance.workflow.current_state = WorkflowState.REVISION_REQUESTED
            if stage_instance.workflow.content_version and stage_instance.workflow.content_version.content:
                stage_instance.workflow.content_version.content.state = ContentState.DRAFT

        elif decision == ReviewDecision.REJECT:
            stage_instance.current_state = WorkflowState.REJECTED
            # Update parent workflow and content state
            stage_instance.workflow.current_state = WorkflowState.REJECTED
            if stage_instance.workflow.content_version and stage_instance.workflow.content_version.content:
                stage_instance.workflow.content_version.content.state = ContentState.REJECTED

        # Create review record
        review = WorkflowReview(
            workflow_id=stage_instance.workflow_id,
            stage_instance_id=stage_instance_id,
            reviewer_id=reviewer_id,
            decision=decision,
            comments=comments,
            feedback_areas=feedback_areas,
            previous_state=previous_state,
            new_state=stage_instance.current_state,
        )

        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)

        return review

    async def _advance_to_next_stage(self, workflow: ApprovalWorkflow) -> bool:
        """Advance workflow to the next stage if current stage is complete."""

        if not workflow.is_multi_stage():
            return False

        current_stage = workflow.get_current_stage()
        if not current_stage or not current_stage.is_complete():
            return False

        # Find next stage
        next_stage_order = workflow.current_stage_order + 1
        next_stage = None

        for stage in workflow.stage_instances:
            if stage.template_stage.stage_order == next_stage_order:
                next_stage = stage
                break

        if next_stage:
            # Advance to next stage
            workflow.current_stage_order = next_stage_order
            workflow.current_state = WorkflowState.IN_REVIEW

            next_stage.current_state = WorkflowState.IN_REVIEW
            next_stage.started_at = datetime.utcnow()

            # Auto-assign reviewers if configured
            await self._auto_assign_stage_reviewers(next_stage)

            await self.db.commit()
            return True
        else:
            # No more stages - workflow is complete
            workflow.current_state = WorkflowState.APPROVED_PENDING_PUBLISH
            workflow.approved_at = datetime.utcnow()

            # Update content state
            if workflow.content_version and workflow.content_version.content:
                workflow.content_version.content.state = ContentState.APPROVED

            # Auto-publish if configured
            if workflow.auto_publish:
                await self.publish_version(workflow.content_version_id, workflow.content_version.created_by)

            await self.db.commit()
            return True

    async def _auto_assign_stage_reviewers(self, stage_instance: WorkflowStageInstance):
        """Auto-assign reviewers to a stage based on template configuration."""

        template_stage = stage_instance.template_stage

        if template_stage.auto_assign_to_role:
            # Find users with the specified role
            result = await self.db.execute(select(User).where(User.role == template_stage.auto_assign_to_role))
            role_users = result.scalars().all()

            # Assign up to required_approvals number of users
            for i, user in enumerate(role_users[: template_stage.required_approvals]):
                assignment = StageReviewerAssignment(
                    stage_instance_id=stage_instance.id,
                    reviewer_id=user.id,
                    assigned_role=template_stage.auto_assign_to_role,
                    assignment_type="role_based",
                    is_active=True,
                    has_reviewed=False,
                    assigned_by=stage_instance.workflow.content_version.created_by,  # Assign by content creator
                )
                self.db.add(assignment)

    async def get_stage_instances_for_reviewer(
        self, reviewer_id: uuid.UUID, states: list[WorkflowState] | None = None
    ) -> list[WorkflowStageInstance]:
        """Get stage instances assigned to a specific reviewer."""

        query = (
            select(WorkflowStageInstance)
            .options(
                joinedload(WorkflowStageInstance.workflow)
                .joinedload(ApprovalWorkflow.content_version)
                .joinedload(ContentVersion.content),
                joinedload(WorkflowStageInstance.template_stage),
                joinedload(WorkflowStageInstance.reviewer_assignments),
            )
            .join(StageReviewerAssignment, WorkflowStageInstance.id == StageReviewerAssignment.stage_instance_id)
            .where(
                StageReviewerAssignment.reviewer_id == reviewer_id,
                StageReviewerAssignment.is_active,
                not StageReviewerAssignment.has_reviewed,
            )
        )

        if states:
            query = query.where(WorkflowStageInstance.current_state.in_(states))

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_content_versions(self, content_id: uuid.UUID) -> List[ContentVersion]:
        """Get all versions for a content item."""
        from app.models import ContentVersion

        result = await self.db.execute(
            select(ContentVersion)
            .where(ContentVersion.content_id == content_id)
            .order_by(ContentVersion.version_number.desc())
        )
        return result.scalars().all()

    async def get_version(self, version_id: uuid.UUID) -> Optional[ContentVersion]:
        """Get a specific version by ID."""
        from app.models import ContentVersion

        result = await self.db.execute(select(ContentVersion).where(ContentVersion.id == version_id))
        return result.scalar_one_or_none()
