"""
Content repository for complex content-related database operations.
Handles advanced querying, filtering, and analytics for ContentItem entities.
"""

from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.orm import selectinload

from app.models.content import ContentItem, ContentState, ContentType, LearningStyle
from app.models.user import UserRole
from .base_repository import BaseRepository


class ContentRepository(BaseRepository[ContentItem]):
    """Repository for ContentItem entities with advanced query capabilities."""
    
    @property
    def model(self) -> type[ContentItem]:
        return ContentItem
    
    async def get_by_id_with_creator(self, content_id: UUID) -> ContentItem | None:
        """Get content by ID with creator information loaded."""
        result = await self.session.execute(
            select(ContentItem)
            .options(selectinload(ContentItem.creator))
            .where(ContentItem.id == content_id)
        )
        return result.scalar_one_or_none()
    
    async def get_published_content(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[ContentItem]:
        """Get all published content items."""
        query = select(ContentItem).where(ContentItem.state == ContentState.PUBLISHED)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_user_content(
        self,
        user_id: UUID,
        state_filter: ContentState | None = None,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[ContentItem]:
        """Get content created by a specific user."""
        query = select(ContentItem).where(ContentItem.created_by == user_id)
        
        if state_filter:
            query = query.where(ContentItem.state == state_filter)
            
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def search_content(
        self,
        search_term: str,
        content_type: ContentType | None = None,
        learning_style: LearningStyle | None = None,
        state_filter: ContentState | None = None,
        limit: int | None = None
    ) -> list[ContentItem]:
        """Search content by title and description."""
        # Create search condition for title and description
        search_condition = or_(
            ContentItem.title.ilike(f"%{search_term}%"),
            ContentItem.description.ilike(f"%{search_term}%")
        )
        
        query = select(ContentItem).where(search_condition)
        
        # Add optional filters
        if content_type:
            query = query.where(ContentItem.content_type == content_type)
        if learning_style:
            query = query.where(ContentItem.learning_style == learning_style)
        if state_filter:
            query = query.where(ContentItem.state == state_filter)
            
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_content_with_filters(
        self,
        state: ContentState | None = None,
        content_type: ContentType | None = None,
        learning_style: LearningStyle | None = None,
        is_template: bool | None = None,
        template_category: str | None = None,
        created_by: UUID | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        limit: int | None = None,
        offset: int | None = None
    ) -> tuple[list[ContentItem], int]:
        """
        Get content with comprehensive filtering and pagination.
        Returns tuple of (content_items, total_count).
        """
        # Build base query
        query = select(ContentItem).options(selectinload(ContentItem.creator))
        count_query = select(func.count(ContentItem.id))
        
        # Build filter conditions
        conditions = []
        
        if state is not None:
            conditions.append(ContentItem.state == state)
        if content_type is not None:
            conditions.append(ContentItem.content_type == content_type)
        if learning_style is not None:
            conditions.append(ContentItem.learning_style == learning_style)
        if is_template is not None:
            conditions.append(ContentItem.is_template == is_template)
        if template_category is not None:
            conditions.append(ContentItem.template_category == template_category)
        if created_by is not None:
            conditions.append(ContentItem.created_by == created_by)
        if search:
            search_condition = or_(
                ContentItem.title.ilike(f"%{search}%"),
                ContentItem.description.ilike(f"%{search}%")
            )
            conditions.append(search_condition)
        
        # Apply filters to both queries
        if conditions:
            filter_condition = and_(*conditions)
            query = query.where(filter_condition)
            count_query = count_query.where(filter_condition)
        
        # Apply sorting
        sort_column = getattr(ContentItem, sort_by, ContentItem.created_at)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(sort_column)
        
        # Apply pagination
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        
        # Execute queries
        content_result = await self.session.execute(query)
        count_result = await self.session.execute(count_query)
        
        content_items = list(content_result.scalars().all())
        total_count = count_result.scalar()
        
        return content_items, total_count
    
    async def get_content_accessible_to_user(
        self,
        user_id: UUID,
        user_role: UserRole,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[ContentItem]:
        """Get content accessible to a user based on their role."""
        conditions = []
        
        if user_role == UserRole.PLAYER or user_role == UserRole.LEARNER:
            # Players/learners can only see published content
            conditions.append(ContentItem.state == ContentState.PUBLISHED)
        elif user_role == UserRole.CREATOR:
            # Creators can see their own content + published content
            conditions.append(
                or_(
                    ContentItem.created_by == user_id,
                    ContentItem.state == ContentState.PUBLISHED
                )
            )
        elif user_role == UserRole.REVIEWER:
            # Reviewers can see submitted, in_review, published content + their own
            conditions.append(
                or_(
                    ContentItem.created_by == user_id,
                    ContentItem.state.in_([
                        ContentState.SUBMITTED,
                        ContentState.IN_REVIEW,
                        ContentState.PUBLISHED
                    ])
                )
            )
        # Approvers and Admins can see all content (no additional restrictions)
        
        query = select(ContentItem)
        if conditions:
            query = query.where(or_(*conditions))
            
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_templates(
        self,
        category: str | None = None,
        limit: int | None = None
    ) -> list[ContentItem]:
        """Get template content items."""
        query = select(ContentItem).where(ContentItem.is_template)
        
        if category:
            query = query.where(ContentItem.template_category == category)
            
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_popular_content(
        self,
        limit: int = 10,
        min_view_count: int = 1
    ) -> list[ContentItem]:
        """Get popular content based on view count."""
        query = (
            select(ContentItem)
            .where(
                and_(
                    ContentItem.view_count >= min_view_count,
                    ContentItem.state == ContentState.PUBLISHED
                )
            )
            .order_by(desc(ContentItem.view_count))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_content_statistics(self) -> dict:
        """Get content statistics for analytics."""
        # Count by state
        state_counts = await self.session.execute(
            select(ContentItem.state, func.count(ContentItem.id))
            .group_by(ContentItem.state)
        )
        
        # Count by type
        type_counts = await self.session.execute(
            select(ContentItem.content_type, func.count(ContentItem.id))
            .group_by(ContentItem.content_type)
        )
        
        # Total counts
        total_content = await self.session.execute(
            select(func.count(ContentItem.id))
        )
        
        # View statistics
        view_stats = await self.session.execute(
            select(
                func.sum(ContentItem.view_count),
                func.avg(ContentItem.view_count),
                func.max(ContentItem.view_count)
            )
        )
        
        view_result = view_stats.first()
        
        return {
            "total_content": total_content.scalar(),
            "by_state": dict(state_counts.all()),
            "by_type": dict(type_counts.all()),
            "total_views": view_result[0] or 0,
            "average_views": float(view_result[1] or 0),
            "max_views": view_result[2] or 0
        }
    
    async def increment_view_count(self, content_id: UUID) -> bool:
        """Increment the view count for a content item."""
        result = await self.session.execute(
            update(ContentItem)
            .where(ContentItem.id == content_id)
            .values(view_count=ContentItem.view_count + 1)
        )
        return result.rowcount > 0
    
    async def increment_completion_count(self, content_id: UUID) -> bool:
        """Increment the completion count for a content item."""
        result = await self.session.execute(
            update(ContentItem)
            .where(ContentItem.id == content_id)
            .values(completion_count=ContentItem.completion_count + 1)
        )
        return result.rowcount > 0