"""
Workflow ORM Service - Clean Architecture Implementation.

Provides transaction-managed operations for version-aware content approval workflows.
Handles workflow creation, state transitions, reviews, and multi-stage processes.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import (
    ApprovalWorkflow, ContentVersion, WorkflowTemplate,
    WorkflowState, ReviewDecision
)
from app.services.orm_repositories.workflow_repository import WorkflowRepository
from .base_orm_service import BaseOrmService


class WorkflowOrmService(BaseOrmService[ApprovalWorkflow, WorkflowRepository]):
    """ORM service for workflow operations with transaction management."""

    def __init__(self, session: AsyncSession):
        repository = WorkflowRepository(session)
        super().__init__(session, repository)
        self.repo = repository

    async def create_content_version(
        self,
        content_id: uuid.UUID,
        created_by: uuid.UUID,
        title: str,
        nlj_data: dict[str, object],
        description: str | None = None,
        change_summary: str | None = None
    ) -> ContentVersion:
        """Create a new content version with transaction management."""
        try:
            version = await self.repo.create_version(
                content_id=content_id,
                created_by=created_by,
                title=title,
                nlj_data=nlj_data,
                description=description,
                change_summary=change_summary
            )
            await self.commit()
            return version
        except Exception:
            await self.rollback()
            raise

    async def create_approval_workflow(
        self,
        content_version_id: uuid.UUID,
        requires_approval: bool = True,
        auto_publish: bool = False,
        assigned_reviewer_id: uuid.UUID | None = None,
        template_id: uuid.UUID | None = None
    ) -> ApprovalWorkflow:
        """Create a new approval workflow."""
        try:
            workflow = await self.repo.create_workflow(
                content_version_id=content_version_id,
                requires_approval=requires_approval,
                auto_publish=auto_publish,
                assigned_reviewer_id=assigned_reviewer_id,
                template_id=template_id
            )
            await self.commit()
            return workflow
        except Exception:
            await self.rollback()
            raise

    async def get_workflow_by_version(self, version_id: uuid.UUID) -> ApprovalWorkflow | None:
        """Get workflow by content version ID with full relationships."""
        return await self.repo.get_workflow_by_version(version_id)

    async def get_pending_reviews_for_user(self, reviewer_id: uuid.UUID) -> list[ApprovalWorkflow]:
        """Get all workflows pending review by specific reviewer."""
        return await self.repo.get_pending_reviews(reviewer_id)

    async def submit_for_review(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID | None = None
    ) -> bool:
        """Submit workflow for review."""
        try:
            success = await self.repo.update_workflow_state(
                workflow_id=workflow_id,
                new_state=WorkflowState.SUBMITTED_FOR_REVIEW,
                reviewer_id=reviewer_id
            )
            if success:
                await self.commit()
            return success
        except Exception:
            await self.rollback()
            return False

    async def approve_content(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        comments: str | None = None,
        feedback_areas: dict[str, object] | None = None,
        auto_publish: bool = False
    ) -> bool:
        """Approve content and optionally auto-publish."""
        try:
            workflow = await self.get_by_id(workflow_id)
            if not workflow:
                return False

            # Update workflow state
            new_state = WorkflowState.PUBLISHED if auto_publish else WorkflowState.APPROVED_PENDING_PUBLISH
            await self.repo.update_workflow_state(workflow_id, new_state, reviewer_id)
            
            # Create review record
            await self.repo.create_review(
                workflow_id=workflow_id,
                reviewer_id=reviewer_id,
                decision=ReviewDecision.APPROVE,
                previous_state=workflow.current_state,
                new_state=new_state,
                comments=comments,
                feedback_areas=feedback_areas
            )
            
            # Auto-publish if requested
            if auto_publish and workflow.content_version_id:
                await self.repo.publish_version(workflow.content_version_id)
            
            await self.commit()
            return True
        except Exception:
            await self.rollback()
            return False

    async def request_revision(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        comments: str,
        feedback_areas: dict[str, object] | None = None
    ) -> bool:
        """Request revision for content."""
        try:
            workflow = await self.get_by_id(workflow_id)
            if not workflow:
                return False

            await self.repo.update_workflow_state(workflow_id, WorkflowState.REVISION_REQUESTED)
            
            await self.repo.create_review(
                workflow_id=workflow_id,
                reviewer_id=reviewer_id,
                decision=ReviewDecision.REQUEST_REVISION,
                previous_state=workflow.current_state,
                new_state=WorkflowState.REVISION_REQUESTED,
                comments=comments,
                feedback_areas=feedback_areas
            )
            
            await self.commit()
            return True
        except Exception:
            await self.rollback()
            return False

    async def reject_content(
        self,
        workflow_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        comments: str,
        feedback_areas: dict[str, object] | None = None
    ) -> bool:
        """Reject content permanently."""
        try:
            workflow = await self.get_by_id(workflow_id)
            if not workflow:
                return False

            await self.repo.update_workflow_state(workflow_id, WorkflowState.REJECTED)
            
            await self.repo.create_review(
                workflow_id=workflow_id,
                reviewer_id=reviewer_id,
                decision=ReviewDecision.REJECT,
                previous_state=workflow.current_state,
                new_state=WorkflowState.REJECTED,
                comments=comments,
                feedback_areas=feedback_areas
            )
            
            await self.commit()
            return True
        except Exception:
            await self.rollback()
            return False

    async def withdraw_submission(self, workflow_id: uuid.UUID) -> bool:
        """Withdraw content from review."""
        try:
            success = await self.repo.update_workflow_state(workflow_id, WorkflowState.WITHDRAWN)
            if success:
                await self.commit()
            return success
        except Exception:
            await self.rollback()
            return False

    async def publish_version(self, version_id: uuid.UUID) -> bool:
        """Publish a content version."""
        try:
            success = await self.repo.publish_version(version_id)
            if success:
                await self.commit()
            return success
        except Exception:
            await self.rollback()
            return False

    async def get_content_version(self, version_id: uuid.UUID) -> ContentVersion | None:
        """Get content version with full relationships."""
        return await self.repo.get_version_by_id(version_id)

    async def get_content_versions(self, content_id: uuid.UUID) -> list[ContentVersion]:
        """Get all versions for a content item."""
        return await self.repo.get_content_versions(content_id)

    async def get_published_version(self, content_id: uuid.UUID) -> ContentVersion | None:
        """Get the currently published version of content."""
        return await self.repo.get_published_version(content_id)

    async def get_workflow_analytics(self, content_id: uuid.UUID) -> dict[str, object]:
        """Get comprehensive workflow analytics for content."""
        return await self.repo.get_workflow_analytics(content_id)

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
        """Create a workflow template for multi-stage reviews."""
        try:
            template = await self.repo.create_workflow_template(
                name=name,
                content_type=content_type,
                created_by=created_by,
                description=description,
                is_default=is_default,
                auto_publish_on_completion=auto_publish_on_completion
            )
            await self.commit()
            return template
        except Exception:
            await self.rollback()
            raise

    async def get_workflow_templates(
        self,
        content_type: str | None = None,
        active_only: bool = True
    ) -> list[WorkflowTemplate]:
        """Get available workflow templates."""
        return await self.repo.get_workflow_templates(content_type, active_only)

    # Implementation of abstract methods from BaseOrmService
    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """Validate workflow entity data before persistence."""
        # Basic validation for workflow entities
        validated_data = {}
        
        # For ContentVersion creation
        if 'content_id' in kwargs and 'created_by' in kwargs:
            if not kwargs['content_id'] or not kwargs['created_by']:
                raise ValueError("content_id and created_by are required for content version")
            validated_data.update({
                'content_id': kwargs['content_id'],
                'created_by': kwargs['created_by']
            })
        
        # For ApprovalWorkflow creation
        if 'content_version_id' in kwargs:
            if not kwargs['content_version_id']:
                raise ValueError("content_version_id is required for approval workflow")
            validated_data['content_version_id'] = kwargs['content_version_id']
        
        # Copy all other provided fields
        for key, value in kwargs.items():
            if key not in validated_data:
                validated_data[key] = value
        
        return validated_data

    async def handle_entity_relationships(self, entity: ApprovalWorkflow) -> ApprovalWorkflow:
        """Handle workflow entity relationships after persistence."""
        # For workflows, relationships (version, reviewer, etc.) are handled by SQLAlchemy
        return entity