"""
Review Workflow Use Case - Content Approval Business Workflow.

Handles the complete content review workflow including:
- Submit content for review with reviewer assignment
- Approve content with optional auto-publish
- Reject content with detailed feedback
- Request revisions with specific feedback areas
- Publish approved content
- Withdraw submissions by creators

All actions include proper permission validation and comprehensive event publishing.
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentState
from app.models.user import UserRole
from app.schemas.services.content_schemas import ContentServiceSchema
from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class ReviewAction(Enum):
    """Available review workflow actions."""
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_REVISION = "request_revision"
    PUBLISH = "publish"
    WITHDRAW = "withdraw"


@dataclass
class ReviewWorkflowRequest:
    """Request object for review workflow actions."""
    content_id: UUID
    action: ReviewAction
    comments: Optional[str] = None
    reviewer_id: Optional[UUID] = None
    auto_publish: bool = False
    feedback_areas: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    revision_notes: Optional[str] = None


@dataclass
class ReviewWorkflowResponse:
    """Response object for review workflow actions."""
    content: ContentServiceSchema
    previous_state: ContentState
    new_state: ContentState
    action_taken: ReviewAction


class ReviewWorkflowUseCase(BaseUseCase[ReviewWorkflowRequest, ReviewWorkflowResponse]):
    """
    Consolidated review workflow use case handling all review actions.

    Responsibilities:
    - Route review actions to appropriate handlers
    - Validate permissions for each type of review action
    - Apply business rules for state transitions
    - Coordinate with existing workflow infrastructure
    - Publish comprehensive workflow events
    - Handle reviewer assignment and notification

    Events Published:
    - Workflow submission events (nlj.workflow.submission)
    - Workflow approval events (nlj.workflow.approval)
    - Workflow rejection events (nlj.workflow.rejection)
    - Workflow revision request events (nlj.workflow.revision)
    - Content publication events (nlj.content.publication)
    """

    def __init__(self, session: AsyncSession, content_orm_service: ContentOrmService):
        """
        Initialize review workflow use case.

        Args:
            session: Database session for transaction management
            content_orm_service: Content ORM service for state management
        """
        super().__init__(session, content_orm_service=content_orm_service)

    async def execute(
        self,
        request: ReviewWorkflowRequest,
        user_context: Dict[str, Any]
    ) -> ReviewWorkflowResponse:
        """
        Execute review workflow action.

        Args:
            request: Review workflow request with action and parameters
            user_context: User context for permissions and events

        Returns:
            Review workflow response with state changes

        Raises:
            PermissionError: If user lacks permissions for the action
            ValueError: If action or state transition is invalid
            RuntimeError: If workflow execution fails
        """
        try:
            # Get existing content for validation
            existing_content = await self._get_existing_content(request.content_id)
            previous_state = existing_content.state

            # Route to specific action handler
            if request.action == ReviewAction.SUBMIT:
                updated_content = await self._handle_submit(
                    request, existing_content, user_context
                )
            elif request.action == ReviewAction.APPROVE:
                updated_content = await self._handle_approve(
                    request, existing_content, user_context
                )
            elif request.action == ReviewAction.REJECT:
                updated_content = await self._handle_reject(
                    request, existing_content, user_context
                )
            elif request.action == ReviewAction.REQUEST_REVISION:
                updated_content = await self._handle_request_revision(
                    request, existing_content, user_context
                )
            elif request.action == ReviewAction.PUBLISH:
                updated_content = await self._handle_publish(
                    request, existing_content, user_context
                )
            elif request.action == ReviewAction.WITHDRAW:
                updated_content = await self._handle_withdraw(
                    request, existing_content, user_context
                )
            else:
                raise ValueError(f"Unsupported review action: {request.action}")

            # Create response
            response = ReviewWorkflowResponse(
                content=ContentServiceSchema.from_orm_model(updated_content),
                previous_state=previous_state,
                new_state=updated_content.state,
                action_taken=request.action
            )

            logger.info(
                f"Review workflow executed: {request.action.value} on "
                f"content {request.content_id}, state: {previous_state} → "
                f"{updated_content.state}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"review workflow {request.action.value}")
        except Exception as e:
            await self._handle_service_error(e, f"review workflow {request.action.value}")

    async def _get_existing_content(self, content_id: UUID):
        """Get existing content with error handling."""
        try:
            content_orm_service = self.dependencies["content_orm_service"]
            content = await content_orm_service.get_by_id(content_id)

            if not content:
                raise ValueError(f"Content not found: {content_id}")

            return content
        except Exception as e:
            logger.error(f"Failed to retrieve content {content_id}: {e}")
            raise

    async def _handle_submit(
        self,
        request: ReviewWorkflowRequest,
        existing_content,
        user_context: Dict[str, Any]
    ):
        """Handle content submission for review."""
        # Validate permissions - creator or reviewer can submit
        await self._validate_content_permissions(
            user_context,
            existing_content.created_by,
            required_roles_for_others=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            allow_creator=True
        )

        # Validate state transition
        if existing_content.state not in [ContentState.DRAFT, ContentState.REJECTED]:
            raise ValueError(
                f"Cannot submit content in state {existing_content.state} for review"
            )

        # Update content state
        content_orm_service = self.dependencies["content_orm_service"]
        updated_content = await content_orm_service.update_content_state(
            request.content_id,
            ContentState.SUBMITTED
        )

        # Publish workflow submitted event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_workflow_submitted",
            workflow_id=str(updated_content.id),
            content_id=str(updated_content.id),
            content_title=updated_content.title,
            submitter_id=user_info["user_id"],
            submitter_name=user_info["user_name"],
            submitter_email=user_info["user_email"],
            reviewer_id=str(request.reviewer_id) if request.reviewer_id else None,
            reviewer_name=None  # Would need to lookup reviewer name
        )

        return updated_content

    async def _handle_approve(
        self,
        request: ReviewWorkflowRequest,
        existing_content,
        user_context: Dict[str, Any]
    ):
        """Handle content approval."""
        # Validate permissions - only reviewers and above
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to approve content"
        )

        # Validate state transition
        if existing_content.state not in [ContentState.SUBMITTED, ContentState.IN_REVIEW]:
            raise ValueError(
                f"Cannot approve content in state {existing_content.state}"
            )

        # Determine new state
        new_state = ContentState.PUBLISHED if request.auto_publish else ContentState.APPROVED

        # Update content state
        content_orm_service = self.dependencies["content_orm_service"]
        updated_content = await content_orm_service.update_content_state(
            request.content_id,
            new_state
        )

        # Publish workflow approved event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_workflow_approved",
            workflow_id=str(updated_content.id),
            content_id=str(updated_content.id),
            content_title=updated_content.title,
            approver_id=user_info["user_id"],
            approver_name=user_info["user_name"],
            approver_email=user_info["user_email"],
            comments=request.comments,
            auto_publish=request.auto_publish
        )

        # Publish publication event if auto-published
        if request.auto_publish:
            await self._publish_event(
                "publish_content_published",
                content_id=str(updated_content.id),
                content_title=updated_content.title,
                version_number=updated_content.version,
                publisher_id=user_info["user_id"],
                publisher_name=user_info["user_name"],
                publisher_email=user_info["user_email"],
                workflow_id=str(updated_content.id)
            )

        return updated_content

    async def _handle_reject(
        self,
        request: ReviewWorkflowRequest,
        existing_content,
        user_context: Dict[str, Any]
    ):
        """Handle content rejection."""
        # Validate permissions
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to reject content"
        )

        # Validate required rejection reason
        if not request.rejection_reason:
            raise ValueError("Rejection reason is required")

        # Update content state
        content_orm_service = self.dependencies["content_orm_service"]
        updated_content = await content_orm_service.update_content_state(
            request.content_id,
            ContentState.REJECTED
        )

        # Publish workflow rejected event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_workflow_rejected",
            workflow_id=str(updated_content.id),
            content_id=str(updated_content.id),
            content_title=updated_content.title,
            reviewer_id=user_info["user_id"],
            reviewer_name=user_info["user_name"],
            reviewer_email=user_info["user_email"],
            rejection_reason=request.rejection_reason,
            comments=request.comments
        )

        return updated_content

    async def _handle_request_revision(
        self,
        request: ReviewWorkflowRequest,
        existing_content,
        user_context: Dict[str, Any]
    ):
        """Handle revision request."""
        # Validate permissions
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to request revisions"
        )

        # Validate required revision notes
        if not request.revision_notes:
            raise ValueError("Revision notes are required")

        # Update content state back to draft for revisions
        content_orm_service = self.dependencies["content_orm_service"]
        updated_content = await content_orm_service.update_content_state(
            request.content_id,
            ContentState.DRAFT
        )

        # Publish workflow revision requested event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_workflow_revision_requested",
            workflow_id=str(updated_content.id),
            content_id=str(updated_content.id),
            content_title=updated_content.title,
            reviewer_id=user_info["user_id"],
            reviewer_name=user_info["user_name"],
            reviewer_email=user_info["user_email"],
            revision_notes=request.revision_notes,
            feedback_areas=request.feedback_areas
        )

        return updated_content

    async def _handle_publish(
        self,
        request: ReviewWorkflowRequest,
        existing_content,
        user_context: Dict[str, Any]
    ):
        """Handle content publishing."""
        # Validate permissions - approvers and admins can publish
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to publish content"
        )

        # Validate state - can only publish approved content
        if existing_content.state != ContentState.APPROVED:
            raise ValueError(
                f"Cannot publish content in state {existing_content.state}. "
                "Content must be approved first."
            )

        # Update content state
        content_orm_service = self.dependencies["content_orm_service"]
        updated_content = await content_orm_service.update_content_state(
            request.content_id,
            ContentState.PUBLISHED
        )

        # Publish content publication event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_content_published",
            content_id=str(updated_content.id),
            content_title=updated_content.title,
            version_number=updated_content.version,
            publisher_id=user_info["user_id"],
            publisher_name=user_info["user_name"],
            publisher_email=user_info["user_email"],
            workflow_id=str(updated_content.id)
        )

        return updated_content

    async def _handle_withdraw(
        self,
        request: ReviewWorkflowRequest,
        existing_content,
        user_context: Dict[str, Any]
    ):
        """Handle submission withdrawal."""
        # Validate permissions - creator or admin can withdraw
        await self._validate_content_permissions(
            user_context,
            existing_content.created_by,
            required_roles_for_others=[UserRole.ADMIN],
            allow_creator=True
        )

        # Validate state - can only withdraw submitted/in-review content
        if existing_content.state not in [ContentState.SUBMITTED, ContentState.IN_REVIEW]:
            raise ValueError(
                f"Cannot withdraw content in state {existing_content.state}"
            )

        # Update content state back to draft
        content_orm_service = self.dependencies["content_orm_service"]
        updated_content = await content_orm_service.update_content_state(
            request.content_id,
            ContentState.DRAFT
        )

        # Publish workflow withdrawal event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_workflow_withdrawn",
            workflow_id=str(updated_content.id),
            content_id=str(updated_content.id),
            content_title=updated_content.title,
            withdrawer_id=user_info["user_id"],
            withdrawer_name=user_info["user_name"],
            withdrawer_email=user_info["user_email"],
            withdrawal_reason=request.comments or "Withdrawal requested"
        )

        return updated_content

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error