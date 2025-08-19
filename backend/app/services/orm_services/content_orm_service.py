"""
Content ORM Service - Clean Architecture Implementation.

Provides transaction-managed CRUD operations for ContentItem entities using repository pattern.
Replaces direct SQLAlchemy usage with proper layer separation.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.content import ContentItem, ContentState, ContentType, LearningStyle
from app.models.user import UserRole
from app.services.orm_repositories.content_repository import ContentRepository
from .base_orm_service import BaseOrmService


class ContentOrmService(BaseOrmService[ContentItem, ContentRepository]):
    """
    Content ORM Service managing ContentItem persistence with Clean Architecture.

    Responsibilities:
    - Content CRUD operations with transaction management
    - Content state validation and transitions
    - Content access control at data layer
    - Content analytics and view tracking
    - Template and content relationship management

    Uses ContentRepository for all data access operations.
    """

    def __init__(self, session: AsyncSession, repository: ContentRepository):
        """Initialize Content ORM Service with session and repository."""
        super().__init__(session, repository)

    # Content-Specific CRUD Operations

    async def create_content(
        self,
        title: str,
        description: str,
        nlj_data: dict[str, Any],
        content_type: ContentType,
        learning_style: LearningStyle,
        creator_id: uuid.UUID,
        is_template: bool = False,
        template_category: str | None = None,
        parent_content_id: uuid.UUID | None = None,
    ) -> ContentItem:
        """
        Create new content item with validation.

        Args:
            title: Content title
            description: Content description
            nlj_data: NLJ scenario data
            content_type: Type of content (TRAINING, SURVEY, etc.)
            learning_style: Learning style (VISUAL, AUDITORY, etc.)
            creator_id: ID of the user creating the content
            is_template: Whether this is a template
            template_category: Category if this is a template
            parent_content_id: ID of parent content if this is a copy

        Returns:
            Created ContentItem

        Raises:
            RuntimeError: If creation fails
            ValueError: If validation fails
        """
        # Validate content data
        content_data = await self.validate_entity_data(
            title=title,
            description=description,
            nlj_data=nlj_data,
            content_type=content_type,
            learning_style=learning_style,
            creator_id=creator_id,
            is_template=is_template,
            template_category=template_category,
            parent_content_id=parent_content_id,
            state=ContentState.DRAFT,  # All content starts as draft
        )

        try:
            content = await self.repository.create(**content_data)
            await self.session.commit()

            # Handle relationships (load creator info)
            return await self.handle_entity_relationships(content)

        except IntegrityError as e:
            await self.session.rollback()
            if "creator" in str(e):
                raise ValueError("Invalid creator ID provided") from e
            elif "parent_content" in str(e):
                raise ValueError("Invalid parent content ID provided") from e
            else:
                raise RuntimeError(f"Content creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create content: {e}") from e

    async def get_content_with_creator(self, content_id: uuid.UUID) -> ContentItem | None:
        """
        Get content by ID with creator information loaded.

        Args:
            content_id: Content UUID

        Returns:
            ContentItem with creator loaded, or None if not found
        """
        try:
            return await self.repository.get_by_id_with_creator(content_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get content with creator: {e}") from e

    async def update_content(
        self,
        content_id: uuid.UUID,
        **update_data: Any,
    ) -> ContentItem | None:
        """
        Update content with validation.

        Args:
            content_id: Content UUID to update
            **update_data: Fields to update

        Returns:
            Updated ContentItem or None if not found

        Raises:
            RuntimeError: If update fails
            ValueError: If content is not in editable state
        """
        try:
            # Get current content to validate state
            content = await self.repository.get_by_id(content_id)
            if not content:
                return None

            # Validate content is editable (business rule)
            if not content.is_editable():
                raise ValueError(f"Content in state '{content.state}' cannot be edited")

            # Validate update data
            validated_data = await self.validate_entity_data(**update_data)

            # Increment version if NLJ data changed
            if "nlj_data" in validated_data and validated_data["nlj_data"] != content.nlj_data:
                validated_data["version"] = content.version + 1

            updated_content = await self.repository.update_by_id(content_id, **validated_data)
            if updated_content:
                await self.session.commit()
                return await self.handle_entity_relationships(updated_content)

            return updated_content

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update content: {e}") from e

    async def delete_content(self, content_id: uuid.UUID) -> bool:
        """
        Delete content with state validation.

        Args:
            content_id: Content UUID to delete

        Returns:
            True if deleted, False if not found

        Raises:
            ValueError: If content cannot be deleted (not in DRAFT state)
            RuntimeError: If deletion fails
        """
        try:
            # Get content to validate state
            content = await self.repository.get_by_id(content_id)
            if not content:
                return False

            # Validate content can be deleted (business rule: only drafts)
            if content.state != ContentState.DRAFT:
                raise ValueError("Only draft content can be deleted")

            deleted = await self.repository.delete_by_id(content_id)
            if deleted:
                await self.session.commit()

            return deleted

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to delete content: {e}") from e

    # Content State Management

    async def update_content_state(
        self,
        content_id: uuid.UUID,
        new_state: ContentState,
    ) -> ContentItem | None:
        """
        Update content state with validation.

        Args:
            content_id: Content UUID
            new_state: New state to transition to

        Returns:
            Updated ContentItem or None if not found

        Raises:
            ValueError: If state transition is invalid
            RuntimeError: If update fails
        """
        try:
            content = await self.repository.get_by_id(content_id)
            if not content:
                return None

            # Validate state transition (delegated to domain model)
            if not content.can_transition_to(new_state):
                raise ValueError(f"Cannot transition from {content.state} to {new_state}")

            update_data = {"state": new_state}

            # Set published timestamp if transitioning to PUBLISHED
            if new_state == ContentState.PUBLISHED:
                update_data["published_at"] = datetime.now(timezone.utc)

            updated_content = await self.repository.update_by_id(content_id, **update_data)
            if updated_content:
                await self.session.commit()
                return await self.handle_entity_relationships(updated_content)

            return updated_content

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update content state: {e}") from e

    # Content Analytics

    async def increment_view_count(self, content_id: uuid.UUID) -> bool:
        """
        Increment content view count for analytics.

        Args:
            content_id: Content UUID

        Returns:
            True if successful, False if content not found
        """
        try:
            return await self.repository.increment_view_count(content_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to increment view count: {e}") from e

    async def increment_completion_count(self, content_id: uuid.UUID) -> bool:
        """
        Increment content completion count for analytics.

        Args:
            content_id: Content UUID

        Returns:
            True if successful, False if content not found
        """
        try:
            return await self.repository.increment_completion_count(content_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to increment completion count: {e}") from e

    # Content Queries

    async def get_published_content(self, limit: int = 50, offset: int = 0) -> list[ContentItem]:
        """Get published content with pagination."""
        try:
            return await self.repository.get_published_content(limit=limit, offset=offset)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get published content: {e}") from e

    async def get_user_content(self, user_id: uuid.UUID, limit: int = 50, offset: int = 0) -> list[ContentItem]:
        """Get content created by specific user."""
        try:
            return await self.repository.get_user_content(user_id=user_id, limit=limit, offset=offset)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user content: {e}") from e

    async def search_content(
        self,
        search_term: str,
        content_type: ContentType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ContentItem]:
        """Search content by title and description."""
        try:
            return await self.repository.search_content(
                search_term=search_term,
                content_type=content_type,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to search content: {e}") from e

    async def get_content_accessible_to_user(self, user_id: uuid.UUID, user_role: UserRole) -> list[ContentItem]:
        """Get content accessible to user based on role."""
        try:
            return await self.repository.get_content_accessible_to_user(user_id, user_role)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get accessible content: {e}") from e

    async def get_templates(self, category: str | None = None) -> list[ContentItem]:
        """Get template content, optionally filtered by category."""
        try:
            return await self.repository.get_templates(category=category)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get templates: {e}") from e

    async def get_popular_content(self, limit: int = 10, min_view_count: int = 10) -> list[ContentItem]:
        """Get popular content by view count."""
        try:
            return await self.repository.get_popular_content(limit=limit, min_view_count=min_view_count)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get popular content: {e}") from e

    async def get_content_statistics(self) -> dict[str, Any]:
        """Get content analytics and statistics."""
        try:
            return await self.repository.get_content_statistics()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get content statistics: {e}") from e

    # Advanced Query Methods

    async def get_content_with_filters(
        self,
        content_type: ContentType | None = None,
        learning_style: LearningStyle | None = None,
        state: ContentState | None = None,
        is_template: bool | None = None,
        creator_id: uuid.UUID | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ContentItem], int]:
        """Get filtered content with total count."""
        try:
            return await self.repository.get_content_with_filters(
                content_type=content_type,
                learning_style=learning_style,
                state=state,
                is_template=is_template,
                creator_id=creator_id,
                search=search,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get filtered content: {e}") from e

    # Abstract Method Implementations

    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """
        Validate content data before persistence.

        Validates required fields, data types, and business rules.
        """
        validated = {}

        # Required fields for creation
        if "title" in kwargs:
            title = kwargs["title"]
            if not isinstance(title, str) or not title.strip():
                raise ValueError("Title must be a non-empty string")
            validated["title"] = title.strip()

        if "description" in kwargs:
            description = kwargs["description"]
            if description is not None:
                if not isinstance(description, str):
                    raise ValueError("Description must be a string")
                validated["description"] = description.strip()

        if "nlj_data" in kwargs:
            nlj_data = kwargs["nlj_data"]
            if not isinstance(nlj_data, dict):
                raise ValueError("NLJ data must be a dictionary")
            # Basic structure validation
            if "nodes" not in nlj_data or "edges" not in nlj_data:
                validated["nlj_data"] = {"nodes": [], "edges": []}
            else:
                validated["nlj_data"] = nlj_data

        # Enum validations
        if "content_type" in kwargs:
            if not isinstance(kwargs["content_type"], ContentType):
                raise ValueError("Content type must be a valid ContentType enum")
            validated["content_type"] = kwargs["content_type"]

        if "learning_style" in kwargs:
            if not isinstance(kwargs["learning_style"], LearningStyle):
                raise ValueError("Learning style must be a valid LearningStyle enum")
            validated["learning_style"] = kwargs["learning_style"]

        if "state" in kwargs:
            if not isinstance(kwargs["state"], ContentState):
                raise ValueError("State must be a valid ContentState enum")
            validated["state"] = kwargs["state"]

        # UUID validations
        if "creator_id" in kwargs:
            if not isinstance(kwargs["creator_id"], uuid.UUID):
                raise ValueError("Creator ID must be a valid UUID")
            validated["created_by"] = kwargs["creator_id"]  # Map to model field name

        if "parent_content_id" in kwargs and kwargs["parent_content_id"] is not None:
            if not isinstance(kwargs["parent_content_id"], uuid.UUID):
                raise ValueError("Parent content ID must be a valid UUID")
            validated["parent_content_id"] = kwargs["parent_content_id"]

        # Boolean validations
        if "is_template" in kwargs:
            validated["is_template"] = bool(kwargs["is_template"])

        # String validations
        if "template_category" in kwargs and kwargs["template_category"] is not None:
            if not isinstance(kwargs["template_category"], str):
                raise ValueError("Template category must be a string")
            validated["template_category"] = kwargs["template_category"].strip()

        # Numeric validations
        for field in ["version", "view_count", "completion_count"]:
            if field in kwargs:
                value = kwargs[field]
                if not isinstance(value, int) or value < 0:
                    raise ValueError(f"{field} must be a non-negative integer")
                validated[field] = value

        # Datetime validations
        if "published_at" in kwargs and kwargs["published_at"] is not None:
            if not isinstance(kwargs["published_at"], datetime):
                raise ValueError("Published at must be a datetime")
            validated["published_at"] = kwargs["published_at"]

        return validated

    async def handle_entity_relationships(self, entity: ContentItem) -> ContentItem:
        """
        Handle content entity relationships after persistence.

        Loads creator relationship and ensures proper data consistency.
        """
        try:
            # Refresh entity to get latest data
            await self.session.refresh(entity)

            # Load creator relationship if not already loaded
            if not entity.creator:
                await self.session.refresh(entity, ["creator"])

            return entity

        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to handle content relationships: {e}") from e
