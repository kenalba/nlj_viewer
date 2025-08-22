"""
Workflow Repository - Data Access Layer.

Handles database operations for version-aware content approval workflows.
Supports both simple approval workflows and multi-stage review processes.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, desc, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workflow import (
    ApprovalWorkflow, ContentVersion, WorkflowReview, WorkflowTemplate,
    WorkflowTemplateStage, WorkflowStageInstance, StageReviewerAssignment,
    WorkflowState, ReviewDecision, VersionStatus, StageType
)
from app.models.content import ContentItem
from app.models.user import User
from .base_repository import BaseRepository


class WorkflowRepository(BaseRepository[ApprovalWorkflow]):
    """Repository for workflow database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, ApprovalWorkflow)

    async def create_version(
        self,
        content_id: uuid.UUID,
        created_by: uuid.UUID,
        title: str,
        nlj_data: dict[str, object],
        description: str | None = None,
        change_summary: str | None = None
    ) -> ContentVersion:
        """Create a new content version."""
        # Get next version number
        query = select(func.max(ContentVersion.version_number)).where(
            ContentVersion.content_id == content_id
        )
        result = await self.session.execute(query)
        max_version = result.scalar() or 0
        
        version = ContentVersion(
            content_id=content_id,
            version_number=max_version + 1,
            version_status=VersionStatus.DRAFT,
            title=title,
            description=description,
            change_summary=change_summary,
            nlj_data=nlj_data,
            created_by=created_by,
            created_at=datetime.now(timezone.utc)
        )
        
        self.session.add(version)
        await self.session.commit()
        await self.session.refresh(version)
        return version

    async def create_workflow(
        self,
        content_version_id: uuid.UUID,
        requires_approval: bool = True,
        auto_publish: bool = False,
        assigned_reviewer_id: uuid.UUID | None = None,
        template_id: uuid.UUID | None = None
    ) -> ApprovalWorkflow:
        """Create a new approval workflow."""
        workflow_data = {
            "content_version_id": content_version_id,
            "current_state": WorkflowState.DRAFT,
            "requires_approval": requires_approval,
            "auto_publish": auto_publish,
            "assigned_reviewer_id": assigned_reviewer_id,
            "template_id": template_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        return await self.create(workflow_data)

    async def get_workflow_by_version(self, version_id: uuid.UUID) -> ApprovalWorkflow | None:
        """Get workflow by content version ID with full relationships."""
        query = (
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version),
                selectinload(ApprovalWorkflow.reviews),
                selectinload(ApprovalWorkflow.stage_instances)
            )
            .where(ApprovalWorkflow.content_version_id == version_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_pending_reviews(self, reviewer_id: uuid.UUID) -> list[ApprovalWorkflow]:
        """Get all workflows pending review by specific reviewer."""
        query = (
            select(ApprovalWorkflow)
            .options(
                selectinload(ApprovalWorkflow.content_version)
                .selectinload(ContentVersion.content)
            )
            .where(
                and_(
                    ApprovalWorkflow.assigned_reviewer_id == reviewer_id,
                    ApprovalWorkflow.current_state.in_([
                        WorkflowState.SUBMITTED_FOR_REVIEW,
                        WorkflowState.IN_REVIEW
                    ])
                )
            )
            .order_by(desc(ApprovalWorkflow.submitted_at))
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def update_workflow_state(
        self,
        workflow_id: uuid.UUID,
        new_state: WorkflowState,
        reviewer_id: uuid.UUID | None = None
    ) -> bool:
        """Update workflow state and track timestamps."""
        workflow = await self.get_by_id(workflow_id)
        if not workflow:
            return False
        
        workflow.current_state = new_state
        workflow.updated_at = datetime.now(timezone.utc)
        
        if new_state == WorkflowState.SUBMITTED_FOR_REVIEW:
            workflow.submitted_at = datetime.now(timezone.utc)
        elif new_state == WorkflowState.APPROVED_PENDING_PUBLISH:
            workflow.approved_at = datetime.now(timezone.utc)
        elif new_state == WorkflowState.PUBLISHED:
            workflow.published_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        return True

    async def create_review(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        decision: ReviewDecision,
        previous_state: WorkflowState,
        new_state: WorkflowState,
        comments: str | None = None,
        feedback_areas: dict[str, object] | None = None
    ) -> WorkflowReview:
        """Create a workflow review record."""
        review = WorkflowReview(
            workflow_id=workflow_id,
            reviewer_id=reviewer_id,
            decision=decision,
            previous_state=previous_state,
            new_state=new_state,
            comments=comments,
            feedback_areas=feedback_areas or {},
            created_at=datetime.now(timezone.utc)
        )
        
        self.session.add(review)
        await self.session.commit()
        await self.session.refresh(review)
        return review

    async def get_version_by_id(self, version_id: uuid.UUID) -> ContentVersion | None:
        """Get content version with full relationships."""
        query = (
            select(ContentVersion)
            .options(
                selectinload(ContentVersion.content),
                selectinload(ContentVersion.creator),
                selectinload(ContentVersion.workflow)
            )
            .where(ContentVersion.id == version_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_content_versions(self, content_id: uuid.UUID) -> list[ContentVersion]:
        """Get all versions for a content item."""
        query = (
            select(ContentVersion)
            .options(selectinload(ContentVersion.workflow))
            .where(ContentVersion.content_id == content_id)
            .order_by(desc(ContentVersion.version_number))
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_published_version(self, content_id: uuid.UUID) -> ContentVersion | None:
        """Get the currently published version of content."""
        query = (
            select(ContentVersion)
            .where(
                and_(
                    ContentVersion.content_id == content_id,
                    ContentVersion.version_status == VersionStatus.PUBLISHED
                )
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def publish_version(self, version_id: uuid.UUID) -> bool:
        """Publish a version and archive the previous published version."""
        version = await self.get_version_by_id(version_id)
        if not version:
            return False
        
        # Archive current published version
        current_published = await self.get_published_version(version.content_id)
        if current_published:
            current_published.version_status = VersionStatus.ARCHIVED
            current_published.archived_at = datetime.now(timezone.utc)
        
        # Publish new version
        version.version_status = VersionStatus.PUBLISHED
        version.published_at = datetime.now(timezone.utc)
        
        # Update workflow if exists
        if version.workflow:
            version.workflow.current_state = WorkflowState.PUBLISHED
            version.workflow.published_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        return True

    async def get_workflow_analytics(self, content_id: uuid.UUID) -> dict[str, object]:
        """Get workflow analytics for content."""
        # Get all versions and workflows
        query = (
            select(ContentVersion)
            .options(selectinload(ContentVersion.workflow))
            .where(ContentVersion.content_id == content_id)
        )
        result = await self.session.execute(query)
        versions = result.scalars().all()
        
        # Calculate analytics
        total_versions = len(versions)
        published_versions = sum(1 for v in versions if v.version_status == VersionStatus.PUBLISHED)
        
        workflows_with_reviews = [v.workflow for v in versions if v.workflow]
        avg_review_time = None
        
        if workflows_with_reviews:
            review_times = []
            for workflow in workflows_with_reviews:
                if workflow.submitted_at and workflow.approved_at:
                    review_time = (workflow.approved_at - workflow.submitted_at).total_seconds()
                    review_times.append(review_time)
            
            if review_times:
                avg_review_time = sum(review_times) / len(review_times)
        
        return {
            "content_id": str(content_id),
            "total_versions": total_versions,
            "published_versions": published_versions,
            "pending_reviews": sum(1 for v in versions 
                                 if v.workflow and v.workflow.current_state in [
                                     WorkflowState.SUBMITTED_FOR_REVIEW,
                                     WorkflowState.IN_REVIEW
                                 ]),
            "average_review_time_seconds": avg_review_time,
            "current_published_version": next(
                (v.version_number for v in versions 
                 if v.version_status == VersionStatus.PUBLISHED), None
            )
        }

    # Multi-stage workflow methods
    async def create_workflow_template(
        self,
        name: str,
        content_type: str,
        created_by: uuid.UUID,
        description: str | None = None,
        is_default: bool = False,
        auto_publish_on_completion: bool = False
    ) -> WorkflowTemplate:
        """Create a workflow template."""
        template = WorkflowTemplate(
            name=name,
            content_type=content_type,
            description=description,
            is_default=is_default,
            is_active=True,
            auto_publish_on_completion=auto_publish_on_completion,
            created_by=created_by,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        self.session.add(template)
        await self.session.commit()
        await self.session.refresh(template)
        return template

    async def get_workflow_templates(
        self,
        content_type: str | None = None,
        active_only: bool = True
    ) -> list[WorkflowTemplate]:
        """Get workflow templates with optional filtering."""
        conditions = []
        if content_type:
            conditions.append(WorkflowTemplate.content_type == content_type)
        if active_only:
            conditions.append(WorkflowTemplate.is_active == True)
        
        query = (
            select(WorkflowTemplate)
            .options(selectinload(WorkflowTemplate.stages))
            .where(and_(*conditions) if conditions else True)
            .order_by(WorkflowTemplate.name)
        )
        result = await self.session.execute(query)
        return result.scalars().all()