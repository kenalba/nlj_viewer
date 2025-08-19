"""
Media repository for media asset management and queries.
Handles media items, generation tracking, and file organization.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.models.media import MediaItem, MediaState, MediaType, VoiceType
from .base_repository import BaseRepository

if TYPE_CHECKING:
    pass


class MediaRepository(BaseRepository[MediaItem]):
    """Repository for MediaItem entities with media-specific operations."""
    
    @property
    def model(self) -> type[MediaItem]:
        return MediaItem
    
    async def get_by_id_with_relationships(self, media_id: UUID) -> MediaItem | None:
        """Get media item by ID with all relationships loaded."""
        result = await self.session.execute(
            select(MediaItem)
            .options(
                selectinload(MediaItem.creator),
                selectinload(MediaItem.shared_tokens)
            )
            .where(MediaItem.id == media_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_type(
        self,
        media_type: MediaType,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[MediaItem]:
        """Get media items by type."""
        query = select(MediaItem).where(MediaItem.media_type == media_type)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_state(
        self,
        state: MediaState,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[MediaItem]:
        """Get media items by processing state."""
        query = select(MediaItem).where(MediaItem.state == state)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_user_media(
        self,
        user_id: UUID,
        media_type: MediaType | None = None,
        state: MediaState | None = None,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[MediaItem]:
        """Get media items created by a specific user."""
        conditions = [MediaItem.created_by == user_id]
        
        if media_type is not None:
            conditions.append(MediaItem.media_type == media_type)
        if state is not None:
            conditions.append(MediaItem.state == state)
        
        query = select(MediaItem).where(and_(*conditions))
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def search_media(
        self,
        search_term: str,
        media_type: MediaType | None = None,
        limit: int | None = None
    ) -> list[MediaItem]:
        """Search media by title and description."""
        search_condition = or_(
            MediaItem.title.ilike(f"%{search_term}%"),
            MediaItem.description.ilike(f"%{search_term}%")
        )
        
        conditions = [search_condition]
        if media_type is not None:
            conditions.append(MediaItem.media_type == media_type)
        
        query = select(MediaItem).where(and_(*conditions))
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_completed_media(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[MediaItem]:
        """Get all completed media items."""
        query = select(MediaItem).where(MediaItem.state == MediaState.COMPLETED)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_failed_media(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[MediaItem]:
        """Get media items that failed processing."""
        query = select(MediaItem).where(MediaItem.state == MediaState.FAILED)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_voice_type(
        self,
        voice_type: VoiceType,
        limit: int | None = None
    ) -> list[MediaItem]:
        """Get media items by voice type (for podcasts/audio)."""
        query = select(MediaItem).where(
            and_(
                MediaItem.voice_type == voice_type,
                MediaItem.media_type.in_([MediaType.PODCAST])
            )
        )
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_media_by_source_document(
        self,
        source_document_id: UUID,
        limit: int | None = None
    ) -> list[MediaItem]:
        """Get media items generated from a specific source document."""
        query = select(MediaItem).where(MediaItem.source_document_id == source_document_id)
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_recent_media(
        self,
        days: int = 7,
        limit: int = 20
    ) -> list[MediaItem]:
        """Get recently created media items."""
        from datetime import datetime, timedelta, timezone
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        query = (
            select(MediaItem)
            .where(MediaItem.created_at >= cutoff_date)
            .order_by(desc(MediaItem.created_at))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_media_statistics(self) -> dict:
        """Get media statistics for analytics."""
        # Count by type
        type_counts = await self.session.execute(
            select(MediaItem.media_type, func.count(MediaItem.id))
            .group_by(MediaItem.media_type)
        )
        
        # Count by state
        state_counts = await self.session.execute(
            select(MediaItem.state, func.count(MediaItem.id))
            .group_by(MediaItem.state)
        )
        
        # Count by voice type for audio content
        voice_counts = await self.session.execute(
            select(MediaItem.voice_type, func.count(MediaItem.id))
            .where(MediaItem.voice_type.is_not(None))
            .group_by(MediaItem.voice_type)
        )
        
        # Total counts
        total_media = await self.count_all()
        
        # Storage statistics
        storage_stats = await self.session.execute(
            select(
                func.sum(MediaItem.file_size),
                func.avg(MediaItem.file_size),
                func.max(MediaItem.file_size)
            )
        )
        
        storage_result = storage_stats.first()
        
        return {
            "total_media": total_media,
            "by_type": dict(type_counts.all()),
            "by_state": dict(state_counts.all()),
            "by_voice_type": dict(voice_counts.all()),
            "total_storage_bytes": storage_result[0] or 0,
            "average_file_size": float(storage_result[1] or 0),
            "largest_file_size": storage_result[2] or 0
        }
    
    async def update_processing_state(
        self, 
        media_id: UUID, 
        new_state: MediaState,
        error_message: str | None = None
    ) -> bool:
        """Update media processing state with optional error message."""
        update_data = {"state": new_state}
        if error_message is not None:
            update_data["error_message"] = error_message
        if new_state == MediaState.COMPLETED:
            update_data["completed_at"] = func.now()
            
        return await self.update_by_id(media_id, **update_data) is not None
    
    async def mark_as_failed(self, media_id: UUID, error_message: str) -> bool:
        """Mark media item as failed with error message."""
        return await self.update_processing_state(media_id, MediaState.FAILED, error_message)
    
    async def mark_as_completed(self, media_id: UUID, file_url: str, file_size: int) -> bool:
        """Mark media item as completed with file details."""
        update_data = {
            "state": MediaState.COMPLETED,
            "file_url": file_url,
            "file_size": file_size,
            "completed_at": func.now()
        }
        return await self.update_by_id(media_id, **update_data) is not None