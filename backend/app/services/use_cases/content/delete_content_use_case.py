"""
Delete Content Use Case - Content Deletion Business Workflow.

Handles secure content deletion with proper permission validation and xAPI events:
- Content deletion with access control validation
- Permission validation (only creators and admins can delete)
- Cascading deletion of related data
- xAPI event publishing for audit and analytics
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.models.content import ContentState
from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class DeleteContentRequest:
    """Request object for content deletion operations."""
    content_id: UUID
    force_delete: bool = False  # For admin users to force delete published content


@dataclass
class DeleteContentResponse:
    """Response object for content deletion operations."""
    deleted_content_id: UUID
    success: bool = True
    message: str = "Content deleted successfully"


class DeleteContentUseCase(BaseUseCase[DeleteContentRequest, DeleteContentResponse]):
    """
    Use case for secure content deletion with permission validation and xAPI events.

    Responsibilities:
    - Validate content deletion permissions (creators own content, admins any content)
    - Ensure content is in deletable state (not published unless force_delete)
    - Perform cascading deletion of related entities
    - Publish xAPI events for content deletion audit trail

    Events Published:
    - Content deleted events (nlj.content.deleted) with xAPI formatting
    - Content archived events if soft deletion is used
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService
    ) -> None:
        """
        Initialize delete content use case.

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
        request: DeleteContentRequest,
        user_context: Dict[str, Any]
    ) -> DeleteContentResponse:
        """
        Execute content deletion workflow.

        Args:
            request: Content deletion request with target content ID
            user_context: Current user context for permissions

        Returns:
            Content deletion response with success status

        Raises:
            PermissionError: If user lacks permission to delete target content
            ValueError: If target content not found or not deletable
            RuntimeError: If content deletion fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get target content
            content_orm_service = self.dependencies["content_orm_service"]
            content = await content_orm_service.get_by_id(request.content_id)

            if not content:
                raise ValueError(f"Content not found: {request.content_id}")

            # Store content details for event publishing before deletion
            content_details = {
                "content_id": str(content.id),
                "title": content.title,
                "content_type": content.content_type.value if content.content_type else None,
                "state": content.state.value if content.state else None,
                "creator_id": str(content.created_by) if content.created_by else None,
                "created_at": content.created_at.isoformat() if content.created_at else None,
                "version": content.version or 1
            }

            # Validate deletion permissions
            await self._validate_delete_permissions(
                current_user_id, current_user_role, content, request.force_delete
            )

            # Perform deletion through ORM service
            deletion_success = await content_orm_service.delete_content(
                request.content_id,
                cascade=True  # Delete related entities
            )

            if not deletion_success:
                raise RuntimeError("Failed to delete content")

            response = DeleteContentResponse(
                deleted_content_id=request.content_id,
                success=True,
                message="Content deleted successfully"
            )

            # Publish content deletion xAPI event - wrapped for resilience
            try:
                await self._publish_content_deletion_event(
                    request, user_context, content_details
                )
            except Exception as e:
                # Log but don't fail the business operation
                logger.warning(f"Failed to publish content deletion event: {e}")

            logger.info(
                f"Content deleted: {request.content_id} by user {current_user_id}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"delete content {request.content_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"delete content {request.content_id}")
            raise

    async def _validate_delete_permissions(
        self,
        current_user_id: UUID,
        current_user_role: UserRole | None,
        content: Any,
        force_delete: bool
    ) -> None:
        """Validate content deletion permissions."""
        # Admins can delete any content
        if current_user_role == UserRole.ADMIN:
            return

        # Content creators can only delete their own content
        if content.created_by != current_user_id:
            raise PermissionError("Not authorized to delete this content")

        # Check content state - published content requires force delete
        if content.state == ContentState.PUBLISHED and not force_delete:
            raise PermissionError(
                "Cannot delete published content without force_delete flag. "
                "Consider archiving instead."
            )

        # Creators cannot use force_delete (admin only)
        if force_delete and current_user_role != UserRole.ADMIN:
            raise PermissionError("Force delete is only available to administrators")

    async def _publish_content_deletion_event(
        self,
        request: DeleteContentRequest,
        user_context: Dict[str, Any],
        content_details: Dict[str, Any]
    ) -> None:
        """Publish content deletion xAPI event through Kafka."""
        actor_info = self._extract_user_info(user_context)
        
        # Publish through the existing event system with xAPI structure
        await self._publish_event(
            "publish_content_deleted",
            # xAPI Actor (who performed the action)
            actor_user_id=actor_info["user_id"],
            actor_name=actor_info["user_name"],
            actor_email=actor_info["user_email"],
            
            # xAPI Verb (what action was taken)
            verb="deleted",
            verb_display="deleted",
            
            # xAPI Object (what was acted upon)
            object_id=content_details["content_id"],
            object_type="content",
            object_name=content_details["title"],
            content_type=content_details["content_type"],
            content_state=content_details["state"],
            content_version=content_details["version"],
            
            # xAPI Context
            timestamp=datetime.now().isoformat(),
            force_delete=request.force_delete,
            deletion_type="hard_delete",  # vs soft_delete/archive
            
            # Additional metadata
            original_creator_id=content_details["creator_id"],
            original_created_at=content_details["created_at"],
            
            # Platform context
            platform="nlj-platform",
            platform_version="1.0"
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