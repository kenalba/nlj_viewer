"""
Activity Source Repository - Data Access Layer.

Handles database operations for activity sources and their relationships.
Focuses on source management and activity generation tracking.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, desc, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity_source import ActivitySource
from app.models.content import ContentItem
from app.models.user import User
from .base_repository import BaseRepository


class ActivitySourceRepository(BaseRepository[ActivitySource]):
    """Repository for activity source database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, ActivitySource)

    async def create_source(
        self,
        name: str,
        source_type: str,
        created_by: uuid.UUID,
        description: str | None = None,
        metadata: dict[str, object] | None = None,
        is_active: bool = True
    ) -> ActivitySource:
        """Create a new activity source."""
        source_data = {
            "name": name,
            "source_type": source_type,
            "description": description,
            "metadata": metadata or {},
            "is_active": is_active,
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        return await self.create(source_data)

    async def get_by_name(self, name: str) -> ActivitySource | None:
        """Get activity source by name."""
        query = select(ActivitySource).where(ActivitySource.name == name)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_type(
        self,
        source_type: str,
        active_only: bool = True
    ) -> list[ActivitySource]:
        """Get activity sources by type."""
        conditions = [ActivitySource.source_type == source_type]
        if active_only:
            conditions.append(ActivitySource.is_active == True)
        
        query = (
            select(ActivitySource)
            .where(and_(*conditions))
            .order_by(desc(ActivitySource.created_at))
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_user_sources(
        self,
        user_id: uuid.UUID,
        active_only: bool = True
    ) -> list[ActivitySource]:
        """Get all sources created by a specific user."""
        conditions = [ActivitySource.created_by == user_id]
        if active_only:
            conditions.append(ActivitySource.is_active == True)
        
        query = (
            select(ActivitySource)
            .where(and_(*conditions))
            .order_by(desc(ActivitySource.created_at))
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def search_sources(
        self,
        query_text: str,
        source_type: str | None = None,
        created_by: uuid.UUID | None = None,
        active_only: bool = True
    ) -> list[ActivitySource]:
        """Search activity sources by name and description."""
        conditions = []
        
        # Text search in name and description
        conditions.append(
            ActivitySource.name.ilike(f"%{query_text}%") |
            ActivitySource.description.ilike(f"%{query_text}%")
        )
        
        # Optional filters
        if source_type:
            conditions.append(ActivitySource.source_type == source_type)
        if created_by:
            conditions.append(ActivitySource.created_by == created_by)
        if active_only:
            conditions.append(ActivitySource.is_active == True)
        
        query = (
            select(ActivitySource)
            .where(and_(*conditions))
            .order_by(desc(ActivitySource.updated_at))
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def update_source(
        self,
        source_id: uuid.UUID,
        updates: dict[str, object]
    ) -> ActivitySource | None:
        """Update activity source with new data."""
        source = await self.get_by_id(source_id)
        if not source:
            return None
        
        # Update fields
        for field, value in updates.items():
            if hasattr(source, field):
                setattr(source, field, value)
        
        source.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        return source

    async def deactivate_source(self, source_id: uuid.UUID) -> bool:
        """Deactivate an activity source."""
        source = await self.get_by_id(source_id)
        if not source:
            return False
        
        source.is_active = False
        source.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        return True

    async def get_source_analytics(self, source_id: uuid.UUID) -> dict[str, object] | None:
        """Get analytics data for an activity source."""
        source = await self.get_by_id(source_id)
        if not source:
            return None
        
        # Count related activities (if relationship exists)
        # This would depend on how ActivitySource relates to other entities
        
        return {
            "source_id": str(source.id),
            "name": source.name,
            "source_type": source.source_type,
            "is_active": source.is_active,
            "created_at": source.created_at.isoformat(),
            "updated_at": source.updated_at.isoformat(),
            "metadata": source.metadata
        }

    async def get_sources_by_ids(self, source_ids: list[uuid.UUID]) -> list[ActivitySource]:
        """Get multiple activity sources by their IDs."""
        query = select(ActivitySource).where(ActivitySource.id.in_(source_ids))
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_source_types(self) -> list[str]:
        """Get all unique source types in the system."""
        query = select(ActivitySource.source_type.distinct())
        result = await self.session.execute(query)
        return [row[0] for row in result.fetchall()]

    async def count_sources_by_type(self) -> dict[str, int]:
        """Count sources by type."""
        query = (
            select(ActivitySource.source_type, func.count(ActivitySource.id))
            .where(ActivitySource.is_active == True)
            .group_by(ActivitySource.source_type)
        )
        result = await self.session.execute(query)
        return {source_type: count for source_type, count in result.fetchall()}