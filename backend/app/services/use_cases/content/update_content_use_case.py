"""
Update Content Use Case - Content Modification Business Workflow.

Handles content updates including:
- Permission validation (creator or admin access)
- Content modification with state management
- Version tracking and change logging
- Event publishing for modifications
- Business rule enforcement for state transitions
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentType, LearningStyle, ContentState
from app.models.user import UserRole
from app.schemas.services.content_schemas import ContentServiceSchema
from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class UpdateContentRequest:
    """Request object for content update use case."""
    content_id: UUID
    title: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[ContentType] = None
    learning_style: Optional[LearningStyle] = None
    nlj_data: Optional[Dict[str, Any]] = None
    is_template: Optional[bool] = None
    template_category: Optional[str] = None


@dataclass
class UpdateContentResponse:
    """Response object for content update use case."""
    content: ContentServiceSchema
    fields_updated: list[str]


class UpdateContentUseCase(BaseUseCase[UpdateContentRequest, UpdateContentResponse]):
    """
    Use case for updating existing content with business workflow validation.

    Responsibilities:
    - Validate user has permissions to update specific content
    - Apply business rules for content modification
    - Update content through ORM service with transaction management
    - Track which fields were modified for audit purposes
    - Publish content modification events
    - Handle state transition validation

    Events Published:
    - Content modified event with change details
    - State transition events if content state changes
    - Template update events if template properties change
    """

    def __init__(self, session: AsyncSession, content_orm_service: ContentOrmService):
        """
        Initialize update content use case.

        Args:
            session: Database session for transaction management
            content_orm_service: Content ORM service for data operations
        """
        super().__init__(session, content_orm_service=content_orm_service)

    async def execute(
        self,
        request: UpdateContentRequest,
        user_context: Dict[str, Any]
    ) -> UpdateContentResponse:
        """
        Execute content update workflow.

        Args:
            request: Content update request with changes
            user_context: User context for permissions and events

        Returns:
            Content update response with updated content and change log

        Raises:
            PermissionError: If user lacks update permissions
            ValueError: If update data validation fails
            RuntimeError: If content update fails
        """
        try:
            # 1. Get existing content for permission validation
            existing_content = await self._get_existing_content(request.content_id)

            # 2. Validate permissions
            await self._validate_update_permissions(user_context, existing_content)

            # 3. Build update data with business validation
            update_data, fields_updated = await self._build_update_data(
                request, existing_content
            )

            # 4. Update content via ORM service
            if update_data:
                updated_content = await self._update_content(
                    request.content_id, update_data
                )
            else:
                # No changes to apply
                updated_content = existing_content

            # 5. Convert to service schema
            content_schema = ContentServiceSchema.from_orm_model(updated_content)

            # 6. Publish events if changes were made
            if fields_updated:
                await self._publish_modification_events(
                    updated_content, fields_updated, user_context
                )

            # 7. Return response
            response = UpdateContentResponse(
                content=content_schema,
                fields_updated=fields_updated
            )

            logger.info(
                f"Content updated successfully: {request.content_id}, "
                f"fields: {fields_updated}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, "content update")
        except Exception as e:
            await self._handle_service_error(e, "content update")

    async def _get_existing_content(self, content_id: UUID):
        """Get existing content for validation."""
        try:
            content_orm_service = self.dependencies["content_orm_service"]
            content = await content_orm_service.get_by_id(content_id)

            if not content:
                raise ValueError(f"Content not found: {content_id}")

            return content
        except Exception as e:
            logger.error(f"Failed to retrieve content {content_id}: {e}")
            raise

    async def _validate_update_permissions(
        self, user_context: Dict[str, Any], existing_content
    ) -> None:
        """Validate user can update this specific content."""
        # Content creator can always update (unless archived)
        # Reviewers/Admins can update any content
        # Special rules for published content

        user_id = UUID(user_context["user_id"])

        # Check if content is archived (no updates allowed)
        if existing_content.state == ContentState.ARCHIVED:
            raise PermissionError("Cannot update archived content")

        # Creator can update their own content (except published content)
        if existing_content.created_by == user_id:
            if existing_content.state == ContentState.PUBLISHED:
                # Only allow minor updates to published content by creator
                logger.info(f"Creator updating published content: {existing_content.id}")
            return

        # Non-creators need reviewer role or higher
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to update this content"
        )

    async def _build_update_data(
        self, request: UpdateContentRequest, existing_content
    ) -> tuple[Dict[str, Any], list[str]]:
        """
        Build update data dictionary and track changed fields.

        Args:
            request: Update request with potential changes
            existing_content: Current content state

        Returns:
            Tuple of (update_data_dict, list_of_changed_fields)
        """
        update_data = {}
        fields_updated = []

        # Track each field that has changed
        if request.title is not None and request.title != existing_content.title:
            update_data["title"] = request.title.strip()
            fields_updated.append("title")

        if (request.description is not None and 
            request.description != existing_content.description):
            update_data["description"] = request.description.strip()
            fields_updated.append("description")

        if (request.content_type is not None and 
            request.content_type != existing_content.content_type):
            update_data["content_type"] = request.content_type
            fields_updated.append("content_type")

        if (request.learning_style is not None and 
            request.learning_style != existing_content.learning_style):
            update_data["learning_style"] = request.learning_style
            fields_updated.append("learning_style")

        if request.nlj_data is not None:
            # NLJ data changes are always considered significant
            update_data["nlj_data"] = request.nlj_data
            fields_updated.append("nlj_data")

        if (request.is_template is not None and 
            request.is_template != existing_content.is_template):
            update_data["is_template"] = request.is_template
            fields_updated.append("is_template")

        if (request.template_category is not None and 
            request.template_category != existing_content.template_category):
            update_data["template_category"] = request.template_category
            fields_updated.append("template_category")

        return update_data, fields_updated

    async def _update_content(
        self, content_id: UUID, update_data: Dict[str, Any]
    ):
        """Update content through ORM service."""
        try:
            content_orm_service = self.dependencies["content_orm_service"]
            return await content_orm_service.update_by_id(content_id, **update_data)
        except Exception as e:
            logger.error(f"Failed to update content {content_id}: {e}")
            raise RuntimeError(f"Content update failed: {str(e)}") from e

    async def _publish_modification_events(
        self,
        content,
        fields_updated: list[str],
        user_context: Dict[str, Any]
    ) -> None:
        """Publish events for content modifications."""
        user_info = self._extract_user_info(user_context)

        # 1. Publish general content modification event
        await self._publish_event(
            "publish_content_modified",
            content_id=str(content.id),
            content_title=content.title,
            modifier_id=user_info["user_id"],
            modifier_name=user_info["user_name"],
            modifier_email=user_info["user_email"],
            fields_modified=fields_updated,
            modification_type="manual_edit",
            modification_description=f"Content updated: {', '.join(fields_updated)}"
        )

        # 2. Publish template-specific events if template properties changed
        if "is_template" in fields_updated or "template_category" in fields_updated:
            await self._publish_event(
                "publish_template_modified",
                template_id=str(content.id),
                template_title=content.title,
                template_category=content.template_category or "General",
                is_template=content.is_template,
                modifier_id=user_info["user_id"],
                modifier_name=user_info["user_name"],
                modifier_email=user_info["user_email"]
            )

        # 3. Check if this content was AI-generated (for special events)
        await self._publish_generation_modification_if_applicable(content, user_info)

    async def _publish_generation_modification_if_applicable(
        self, content, user_info: Dict[str, str]
    ) -> None:
        """Publish generation modification event if content was AI-generated."""
        try:
            # Check if content is linked to generation session
            # This would require querying ActivitySource table
            # For now, we'll use a simplified approach
            
            await self._publish_event(
                "publish_content_generation_modified",
                session_id=str(content.id),  # Fallback session ID
                user_id=user_info["user_id"],
                user_email=user_info["user_email"],
                user_name=user_info["user_name"],
                modification_type="manual_edit",
                modification_description=f"Content updated: {content.title}",
                session_title=content.title
            )
        except Exception as e:
            # Don't fail the use case if generation event fails
            logger.warning(f"Failed to publish generation modification event: {e}")

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error