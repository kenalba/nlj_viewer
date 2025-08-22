"""
Activity Source ORM Service - Clean Architecture Implementation.

Provides transaction-managed operations for activity source management.
Handles source creation, search, analytics, and relationship management.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_source import ActivitySource
from app.services.orm_repositories.activity_source_repository import ActivitySourceRepository
from .base_orm_service import BaseOrmService


class ActivitySourceOrmService(BaseOrmService[ActivitySource, ActivitySourceRepository]):
    """ORM service for activity source operations with transaction management."""

    def __init__(self, session: AsyncSession):
        repository = ActivitySourceRepository(session)
        super().__init__(session, repository)
        self.repo = repository

    async def create_activity_source(
        self,
        name: str,
        source_type: str,
        created_by: uuid.UUID,
        description: str | None = None,
        metadata: dict[str, object] | None = None,
        is_active: bool = True
    ) -> ActivitySource:
        """Create a new activity source."""
        try:
            source = await self.repo.create_source(
                name=name,
                source_type=source_type,
                created_by=created_by,
                description=description,
                metadata=metadata,
                is_active=is_active
            )
            await self.commit()
            return source
        except Exception:
            await self.rollback()
            raise

    async def get_source_by_name(self, name: str) -> ActivitySource | None:
        """Get activity source by name."""
        return await self.repo.get_by_name(name)

    async def get_sources_by_type(
        self,
        source_type: str,
        active_only: bool = True
    ) -> list[ActivitySource]:
        """Get activity sources by type."""
        return await self.repo.get_by_type(source_type, active_only)

    async def get_user_sources(
        self,
        user_id: uuid.UUID,
        active_only: bool = True
    ) -> list[ActivitySource]:
        """Get all sources created by a specific user."""
        return await self.repo.get_user_sources(user_id, active_only)

    async def search_sources(
        self,
        query_text: str,
        source_type: str | None = None,
        created_by: uuid.UUID | None = None,
        active_only: bool = True
    ) -> list[ActivitySource]:
        """Search activity sources by name and description."""
        return await self.repo.search_sources(
            query_text=query_text,
            source_type=source_type,
            created_by=created_by,
            active_only=active_only
        )

    async def update_source(
        self,
        source_id: uuid.UUID,
        name: str | None = None,
        description: str | None = None,
        source_type: str | None = None,
        metadata: dict[str, object] | None = None,
        is_active: bool | None = None
    ) -> ActivitySource | None:
        """Update activity source with new data."""
        try:
            updates = {}
            if name is not None:
                updates["name"] = name
            if description is not None:
                updates["description"] = description
            if source_type is not None:
                updates["source_type"] = source_type
            if metadata is not None:
                updates["metadata"] = metadata
            if is_active is not None:
                updates["is_active"] = is_active
            
            if not updates:
                return await self.get_by_id(source_id)
            
            source = await self.repo.update_source(source_id, updates)
            if source:
                await self.commit()
            return source
        except Exception:
            await self.rollback()
            raise

    async def deactivate_source(self, source_id: uuid.UUID) -> bool:
        """Deactivate an activity source."""
        try:
            success = await self.repo.deactivate_source(source_id)
            if success:
                await self.commit()
            return success
        except Exception:
            await self.rollback()
            return False

    async def get_source_analytics(self, source_id: uuid.UUID) -> dict[str, object] | None:
        """Get comprehensive analytics for an activity source."""
        return await self.repo.get_source_analytics(source_id)

    async def get_sources_by_ids(self, source_ids: list[uuid.UUID]) -> list[ActivitySource]:
        """Get multiple activity sources by their IDs."""
        return await self.repo.get_sources_by_ids(source_ids)

    async def get_all_source_types(self) -> list[str]:
        """Get all unique source types in the system."""
        return await self.repo.get_source_types()

    async def get_source_type_statistics(self) -> dict[str, int]:
        """Get count of sources by type."""
        return await self.repo.count_sources_by_type()

    async def bulk_create_sources(
        self,
        sources_data: list[dict[str, object]],
        created_by: uuid.UUID
    ) -> list[ActivitySource]:
        """Create multiple activity sources in a transaction."""
        try:
            sources = []
            for source_data in sources_data:
                source = await self.repo.create_source(
                    name=source_data["name"],
                    source_type=source_data["source_type"],
                    created_by=created_by,
                    description=source_data.get("description"),
                    metadata=source_data.get("metadata"),
                    is_active=source_data.get("is_active", True)
                )
                sources.append(source)
            
            await self.commit()
            return sources
        except Exception:
            await self.rollback()
            raise

    async def validate_source_name_unique(self, name: str, exclude_id: uuid.UUID | None = None) -> bool:
        """Check if source name is unique (excluding optional ID)."""
        existing = await self.repo.get_by_name(name)
        if not existing:
            return True
        return exclude_id is not None and existing.id == exclude_id