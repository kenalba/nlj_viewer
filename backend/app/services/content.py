"""
Content service for managing NLJ scenarios with async operations.
Handles CRUD operations, filtering, and business logic.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.content import ContentItem, ContentState
from app.models.user import UserRole
from app.schemas.content import (
    ContentCreate,
    ContentFilters,
    ContentStateUpdate,
    ContentUpdate,
)


class ContentService:
    """Service for managing content operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_content(self, content_data: ContentCreate, creator_id: uuid.UUID) -> ContentItem:
        """Create new content item."""

        content = ContentItem(
            title=content_data.title,
            description=content_data.description,
            nlj_data=content_data.nlj_data,
            content_type=content_data.content_type,
            learning_style=content_data.learning_style,
            is_template=content_data.is_template,
            template_category=content_data.template_category,
            parent_content_id=content_data.parent_content_id,
            created_by=creator_id,
            state=ContentState.DRAFT,
        )

        self.db.add(content)
        await self.db.commit()
        await self.db.refresh(content)

        # Load relationships
        await self.db.refresh(content, ["creator"])

        return content

    async def get_content_by_id(self, content_id: uuid.UUID, include_nlj_data: bool = True) -> Optional[ContentItem]:
        """Get content by ID with optional NLJ data."""

        query = select(ContentItem).where(ContentItem.id == content_id)

        if include_nlj_data:
            query = query.options(joinedload(ContentItem.creator))

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_content_list(
        self,
        filters: ContentFilters,
        user_id: Optional[uuid.UUID] = None,
        user_role: Optional[UserRole] = None,
    ) -> Tuple[List[ContentItem], int]:
        """Get paginated content list with filters."""

        # Base query with joined loading to avoid N+1 queries
        query = select(ContentItem).options(joinedload(ContentItem.creator))
        count_query = select(func.count(ContentItem.id))

        # Apply filters
        conditions = []

        # Role-based access control
        if user_role in [UserRole.CREATOR, UserRole.REVIEWER]:
            # Creators and reviewers see their own content + published content
            conditions.append(
                or_(
                    ContentItem.created_by == user_id,
                    ContentItem.state == ContentState.PUBLISHED,
                )
            )
        elif user_role == UserRole.APPROVER:
            # Approvers see content in review or their own
            conditions.append(
                or_(
                    ContentItem.created_by == user_id,
                    ContentItem.state.in_(
                        [
                            ContentState.SUBMITTED,
                            ContentState.IN_REVIEW,
                            ContentState.PUBLISHED,
                        ]
                    ),
                )
            )
        # Admin sees everything (no additional filter)

        # State filter
        if filters.state:
            conditions.append(ContentItem.state == filters.state)

        # Content type filter
        if filters.content_type:
            conditions.append(ContentItem.content_type == filters.content_type)

        # Learning style filter
        if filters.learning_style:
            conditions.append(ContentItem.learning_style == filters.learning_style)

        # Template filter
        if filters.is_template is not None:
            conditions.append(ContentItem.is_template == filters.is_template)

        # Template category filter
        if filters.template_category:
            conditions.append(ContentItem.template_category == filters.template_category)

        # Creator filter
        if filters.created_by:
            conditions.append(ContentItem.created_by == filters.created_by)

        # Search filter
        if filters.search:
            search_term = f"%{filters.search}%"
            conditions.append(
                or_(
                    ContentItem.title.ilike(search_term),
                    ContentItem.description.ilike(search_term),
                )
            )

        # Apply all conditions
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Get total count
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Apply sorting
        if filters.sort_by == "title":
            sort_field = ContentItem.title
        elif filters.sort_by == "updated_at":
            sort_field = ContentItem.updated_at
        elif filters.sort_by == "view_count":
            sort_field = ContentItem.view_count
        else:  # Default to created_at
            sort_field = ContentItem.created_at

        if filters.sort_order == "asc":
            query = query.order_by(sort_field.asc())
        else:
            query = query.order_by(sort_field.desc())

        # Apply pagination
        offset = (filters.page - 1) * filters.size
        query = query.offset(offset).limit(filters.size)

        # Execute query
        result = await self.db.execute(query)
        items = result.scalars().all()

        return list(items), total

    async def update_content(
        self,
        content_id: uuid.UUID,
        content_data: ContentUpdate,
        user_id: uuid.UUID,
        user_role: UserRole,
    ) -> Optional[ContentItem]:
        """Update content item with permission checks."""

        content = await self.get_content_by_id(content_id)
        if not content:
            return None

        # Permission check: only creator or admin can edit
        if user_role != UserRole.ADMIN and content.created_by != user_id:
            raise PermissionError("Only content creator or admin can edit content")

        # State check: only editable states can be modified
        if not content.is_editable():
            raise ValueError(f"Content in state '{content.state}' cannot be edited")

        # Update fields
        update_data = content_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(content, field, value)

        # Update version if NLJ data changed
        if content_data.nlj_data is not None:
            content.version += 1

        await self.db.commit()
        await self.db.refresh(content, ["creator"])

        return content

    async def delete_content(self, content_id: uuid.UUID, user_id: uuid.UUID, user_role: UserRole) -> bool:
        """Delete content item with permission checks."""

        content = await self.get_content_by_id(content_id)
        if not content:
            return False

        # Permission check: only creator or admin can delete
        if user_role != UserRole.ADMIN and content.created_by != user_id:
            raise PermissionError("Only content creator or admin can delete content")

        # State check: only draft content can be deleted
        if content.state != ContentState.DRAFT:
            raise ValueError("Only draft content can be deleted")

        await self.db.delete(content)
        await self.db.commit()

        return True

    async def update_content_state(
        self,
        content_id: uuid.UUID,
        state_update: ContentStateUpdate,
        user_id: uuid.UUID,
        user_role: UserRole,
    ) -> Optional[ContentItem]:
        """Update content state with workflow validation."""

        content = await self.get_content_by_id(content_id)
        if not content:
            return None

        # Validate state transition based on user role
        if not await self._can_change_state(content, state_update.state, user_id, user_role):
            raise PermissionError(f"User cannot change content state to {state_update.state}")

        # Update state and timestamp
        content.state = state_update.state

        if state_update.state == ContentState.PUBLISHED:
            content.published_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(content, ["creator"])

        return content

    async def increment_view_count(self, content_id: uuid.UUID) -> bool:
        """Increment view count for analytics."""

        content = await self.get_content_by_id(content_id, include_nlj_data=False)
        if not content:
            return False

        content.increment_view_count()
        await self.db.commit()

        return True

    async def increment_completion_count(self, content_id: uuid.UUID) -> bool:
        """Increment completion count for analytics."""

        content = await self.get_content_by_id(content_id, include_nlj_data=False)
        if not content:
            return False

        content.increment_completion_count()
        await self.db.commit()

        return True

    async def _can_change_state(
        self,
        content: ContentItem,
        new_state: ContentState,
        user_id: uuid.UUID,
        user_role: UserRole,
    ) -> bool:
        """Check if user can change content to new state."""

        # Admin can change any state
        if user_role == UserRole.ADMIN:
            return True

        # Creator permissions
        if content.created_by == user_id:
            if user_role == UserRole.CREATOR:
                # Creators can submit drafts and withdrawn rejected content
                return (content.state == ContentState.DRAFT and new_state == ContentState.SUBMITTED) or (
                    content.state == ContentState.REJECTED and new_state == ContentState.DRAFT
                )

        # Reviewer permissions
        if user_role == UserRole.REVIEWER:
            # Reviewers can move submitted content to in_review or rejected
            return content.state == ContentState.SUBMITTED and new_state in [
                ContentState.IN_REVIEW,
                ContentState.REJECTED,
            ]

        # Approver permissions
        if user_role == UserRole.APPROVER:
            # Approvers can approve/reject reviewed content or publish approved content
            return (
                content.state == ContentState.IN_REVIEW and new_state in [ContentState.APPROVED, ContentState.REJECTED]
            ) or (content.state == ContentState.APPROVED and new_state == ContentState.PUBLISHED)

        return False
