"""
Get Content Use Case - Content Retrieval Business Workflow.

Handles secure content retrieval with proper permission validation:
- Single content retrieval by ID with access control
- Permission validation (users can see published content, creators can see their own, admins see all)
- Content existence validation
- Privacy-aware data filtering based on roles
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.models.content import ContentState
from app.schemas.services.content_schemas import ContentServiceSchema
from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class GetContentRequest:
    """Request object for content retrieval operations."""
    content_id: UUID
    include_draft_data: bool = False  # For creators/admins who need to see draft data


@dataclass
class GetContentResponse:
    """Response object for content retrieval operations."""
    content: ContentServiceSchema
    can_modify: bool  # Whether the requesting user can modify this content
    can_review: bool  # Whether the requesting user can review this content


class GetContentUseCase(BaseUseCase[GetContentRequest, GetContentResponse]):
    """
    Use case for secure content retrieval with permission validation.

    Responsibilities:
    - Validate content access permissions based on state and user role
    - Retrieve content data through ORM service
    - Filter sensitive data based on permissions
    - Return structured content information with metadata

    Events Published:
    - Content view events (nlj.content.viewed) for analytics and audit trails
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService
    ) -> None:
        """
        Initialize get content use case.

        Args:
            session: Database session for transaction management
            content_orm_service: Content data access service
        """
        super().__init__(
            session,
            content_orm_service=content_orm_service
        )

    async def execute(
        self,
        request: GetContentRequest,
        user_context: Dict[str, Any]
    ) -> GetContentResponse:
        """
        Execute content retrieval workflow.

        Args:
            request: Content retrieval request with target content ID
            user_context: Current user context for permissions

        Returns:
            Content retrieval response with content data and permissions

        Raises:
            PermissionError: If user lacks permission to view target content
            ValueError: If target content not found
            RuntimeError: If content retrieval fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get target content
            content_orm_service = self.dependencies["content_orm_service"]
            content = await content_orm_service.get_by_id(request.content_id)

            if not content:
                raise ValueError(f"Content not found: {request.content_id}")

            # Validate permissions
            await self._validate_view_permissions(
                current_user_id, current_user_role, content
            )

            # Determine permissions for response
            can_modify = await self._can_modify_content(
                current_user_id, current_user_role, content
            )
            
            can_review = await self._can_review_content(
                current_user_id, current_user_role, content
            )

            # Convert to service schema
            content_schema = ContentServiceSchema.from_orm_model(content)

            response = GetContentResponse(
                content=content_schema,
                can_modify=can_modify,
                can_review=can_review
            )

            # Publish content view event - wrapped for resilience
            try:
                await self._publish_content_view_event(request, user_context, response)
            except Exception as e:
                # Log but don't fail the business operation
                logger.warning(f"Failed to publish content view event: {e}")

            logger.info(f"Content retrieved: {request.content_id} by user {current_user_id}")
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"get content {request.content_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"get content {request.content_id}")
            raise

    async def _validate_view_permissions(
        self,
        current_user_id: UUID,
        current_user_role: UserRole | None,
        content: Any
    ) -> None:
        """Validate content view permissions based on state and role."""
        # Admins can view any content
        if current_user_role == UserRole.ADMIN:
            return

        # Content creators can view their own content in any state
        if content.created_by == current_user_id:
            return

        # Reviewers can view content in review state
        if (current_user_role in [UserRole.REVIEWER, UserRole.APPROVER] and 
            content.state in [ContentState.PENDING_REVIEW, ContentState.IN_REVIEW]):
            return

        # All users can view published content
        if content.state == ContentState.PUBLISHED:
            return

        # All other combinations are not allowed
        raise PermissionError("Not authorized to view this content")

    async def _can_modify_content(
        self,
        current_user_id: UUID,
        current_user_role: UserRole | None,
        content: Any
    ) -> bool:
        """Check if user can modify the content."""
        # Admins can modify any content
        if current_user_role == UserRole.ADMIN:
            return True

        # Creators can modify their own content that's not published
        if (content.created_by == current_user_id and 
            content.state != ContentState.PUBLISHED):
            return True

        return False

    async def _can_review_content(
        self,
        current_user_id: UUID,
        current_user_role: UserRole | None,
        content: Any
    ) -> bool:
        """Check if user can review the content."""
        # Reviewers and Approvers can review content in appropriate states
        if current_user_role in [UserRole.REVIEWER, UserRole.APPROVER]:
            return content.state in [ContentState.PENDING_REVIEW, ContentState.IN_REVIEW]

        # Admins can always review
        if current_user_role == UserRole.ADMIN:
            return True

        return False

    async def _publish_content_view_event(
        self,
        request: GetContentRequest,
        user_context: Dict[str, Any],
        response: GetContentResponse
    ) -> None:
        """Publish content view event for analytics and audit trail."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_content_viewed",
            content_id=str(request.content_id),
            viewer_user_id=actor_info["user_id"],
            viewer_name=actor_info["user_name"],
            viewer_email=actor_info["user_email"],
            view_timestamp=datetime.now().isoformat(),
            content_title=response.content.title,
            content_type=response.content.content_type.value if response.content.content_type else None,
            content_state=response.content.state.value if response.content.state else None,
            can_modify=response.can_modify,
            can_review=response.can_review
        )

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error