"""
Media service for managing media items and their lifecycle.
"""

import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import UploadFile
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.models.media import MediaItem, MediaState, MediaType
from app.models.source_document import SourceDocument
from app.services.s3_service import s3_media_service


class MediaService:
    """
    Service for managing media items in the system.
    Handles creation, retrieval, updates, and file management.
    """

    def __init__(self):
        # Check if S3 is configured, fall back to local storage
        self.use_s3 = bool(settings.S3_BUCKET_MEDIA)

        if not self.use_s3:
            # Media storage directory - separate from regular uploads
            self.media_dir = (
                Path(settings.UPLOAD_DIR if hasattr(settings, "UPLOAD_DIR") else "/tmp/nlj_uploads") / "media"
            )
            self.media_dir.mkdir(parents=True, exist_ok=True)

    async def create_media_item(
        self,
        db: AsyncSession,
        title: str,
        media_type: MediaType,
        source_document_id: uuid.UUID,
        user_id: uuid.UUID,
        description: Optional[str] = None,
        generation_config: Optional[Dict[str, Any]] = None,
        voice_config: Optional[Dict[str, Any]] = None,
        selected_keywords: Optional[List[str]] = None,
        selected_objectives: Optional[List[str]] = None,
        media_style: Optional[str] = None,
        generation_prompt: Optional[str] = None,
    ) -> MediaItem:
        """
        Create a new media item in GENERATING state.

        Args:
            db: Database session
            title: Media title
            media_type: Type of media to create
            source_document_id: Source document ID
            user_id: Creator user ID
            description: Optional description
            generation_config: Generation parameters
            voice_config: Voice settings
            selected_keywords: Keywords to focus on
            selected_objectives: Learning objectives to include
            media_style: Style template
            generation_prompt: Custom generation prompt

        Returns:
            Created MediaItem instance
        """
        # Verify source document exists and user has access
        source_doc_query = select(SourceDocument).where(
            and_(SourceDocument.id == source_document_id, SourceDocument.user_id == user_id)
        )
        result = await db.execute(source_doc_query)
        source_document = result.scalar_one_or_none()

        if not source_document:
            raise ValueError("Source document not found or access denied")

        # Create media item
        media_item = MediaItem(
            title=title,
            description=description,
            media_type=media_type,
            media_state=MediaState.GENERATING,
            source_document_id=source_document_id,
            created_by=user_id,
            generation_config=generation_config,
            voice_config=voice_config,
            selected_keywords=selected_keywords or [],
            selected_objectives=selected_objectives or [],
            media_style=media_style,
            generation_prompt=generation_prompt,
            play_count=0,
            is_public=False,
        )

        # Mark generation as started
        media_item.mark_generation_started()

        db.add(media_item)
        await db.commit()
        await db.refresh(media_item)

        return media_item

    async def upload_media_file(
        self, db: AsyncSession, media_id: uuid.UUID, file: UploadFile, user_id: uuid.UUID, make_public: bool = False
    ) -> Optional[MediaItem]:
        """
        Upload media file to S3 storage and update database record.

        Args:
            db: Database session
            media_id: Media item ID
            file: FastAPI UploadFile object
            user_id: User ID for verification
            make_public: Whether to make file publicly accessible

        Returns:
            Updated MediaItem instance
        """
        # Get media item and verify ownership
        media_item = await self.get_media_by_id(db, media_id, user_id)
        if not media_item:
            return None

        try:
            if self.use_s3:
                # Upload to S3
                upload_result = await s3_media_service.upload_media_file(
                    file=file, media_id=media_id, folder=f"media/{media_item.media_type.value}", make_public=make_public
                )

                # Update media item with S3 info
                media_item.file_path = upload_result["s3_key"]
                media_item.file_size = upload_result["file_size"]
                media_item.mime_type = upload_result["content_type"]

                # Set public URL if applicable
                if make_public and upload_result.get("public_url"):
                    # Store public URL in generation_config for easy access
                    if not media_item.generation_config:
                        media_item.generation_config = {}
                    media_item.generation_config["public_url"] = upload_result["public_url"]

            else:
                # Local file storage (fallback)
                file_path = self.get_media_file_path(media_id, media_item.media_type)

                # Save file locally
                file_content = await file.read()
                with open(file_path, "wb") as f:
                    f.write(file_content)

                media_item.file_path = file_path
                media_item.file_size = len(file_content)
                media_item.mime_type = file.content_type

            await db.commit()
            await db.refresh(media_item)
            return media_item

        except Exception as e:
            await db.rollback()
            raise Exception(f"Failed to upload media file: {str(e)}")

    async def get_media_file_url(self, media_item: MediaItem, expires_in: int = 3600) -> Optional[str]:
        """
        Get URL for accessing media file.

        Args:
            media_item: MediaItem instance
            expires_in: URL expiration time in seconds (for private files)

        Returns:
            File access URL or None if file doesn't exist
        """
        if not media_item.file_path:
            return None

        try:
            if self.use_s3:
                # Check if file has public URL
                if media_item.generation_config and media_item.generation_config.get("public_url"):
                    return media_item.generation_config["public_url"]

                # Generate presigned URL for private access
                return s3_media_service.generate_presigned_url(s3_key=media_item.file_path, expires_in=expires_in)

            else:
                # Local file - return relative path or construct URL
                return f"/media/files/{media_item.id}{media_item.get_file_extension()}"

        except Exception as e:
            print(f"Failed to get media file URL: {e}")
            return None

    async def download_media_file(self, media_item: MediaItem) -> Optional[tuple[bytes, str, str]]:
        """
        Download media file content.

        Args:
            media_item: MediaItem instance

        Returns:
            Tuple of (file_content, content_type, filename) or None
        """
        if not media_item.file_path:
            return None

        try:
            if self.use_s3:
                # Download from S3
                return await s3_media_service.download_media_file(s3_key=media_item.file_path, as_attachment=True)

            else:
                # Read local file
                if os.path.exists(media_item.file_path):
                    with open(media_item.file_path, "rb") as f:
                        content = f.read()

                    return (
                        content,
                        media_item.mime_type or "application/octet-stream",
                        media_item.title + media_item.get_file_extension(),
                    )

                return None

        except Exception as e:
            print(f"Failed to download media file: {e}")
            return None

    async def get_user_media(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        search_query: Optional[str] = None,
        media_type: Optional[str] = None,
        media_state: Optional[str] = None,
        source_document_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[MediaItem], int]:
        """
        Get user's media items with filtering.

        Args:
            db: Database session
            user_id: User ID
            search_query: Search in title/description
            media_type: Filter by media type
            media_state: Filter by generation state
            source_document_id: Filter by source document
            limit: Results limit
            offset: Results offset

        Returns:
            Tuple of (media_items, total_count)
        """
        # Build query
        query = select(MediaItem).where(MediaItem.created_by == user_id)

        # Add search filter
        if search_query:
            search_term = f"%{search_query}%"
            query = query.where(or_(MediaItem.title.ilike(search_term), MediaItem.description.ilike(search_term)))

        # Add type filter
        if media_type:
            query = query.where(MediaItem.media_type == media_type)

        # Add state filter
        if media_state:
            query = query.where(MediaItem.media_state == media_state)

        # Add source document filter
        if source_document_id:
            query = query.where(MediaItem.source_document_id == source_document_id)

        # Get total count
        count_query = query.with_only_columns(MediaItem.id)
        count_result = await db.execute(count_query)
        total_count = len(count_result.fetchall())

        # Add ordering and pagination
        query = query.order_by(MediaItem.created_at.desc())
        query = query.offset(offset).limit(limit)

        # Include source document in results
        query = query.options(joinedload(MediaItem.source_document))

        result = await db.execute(query)
        media_items = result.scalars().all()

        return list(media_items), total_count

    async def get_media_by_id(self, db: AsyncSession, media_id: uuid.UUID, user_id: uuid.UUID) -> Optional[MediaItem]:
        """Get media item by ID, ensuring user ownership."""
        query = (
            select(MediaItem)
            .where(and_(MediaItem.id == media_id, MediaItem.created_by == user_id))
            .options(joinedload(MediaItem.source_document))
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def update_media_metadata(
        self,
        db: AsyncSession,
        media_id: uuid.UUID,
        user_id: uuid.UUID,
        title: Optional[str] = None,
        description: Optional[str] = None,
        is_public: Optional[bool] = None,
    ) -> Optional[MediaItem]:
        """Update media item metadata."""
        media_item = await self.get_media_by_id(db, media_id, user_id)
        if not media_item:
            return None

        if title is not None:
            media_item.title = title
        if description is not None:
            media_item.description = description
        if is_public is not None:
            media_item.is_public = is_public

        await db.commit()
        await db.refresh(media_item)
        return media_item

    async def update_media_transcript(
        self, db: AsyncSession, media_id: uuid.UUID, user_id: uuid.UUID, transcript: str
    ) -> Optional[MediaItem]:
        """Update media transcript."""
        media_item = await self.get_media_by_id(db, media_id, user_id)
        if not media_item:
            return None

        media_item.transcript = transcript

        # If media was completed, we might want to regenerate audio
        # For now, just update the transcript

        await db.commit()
        await db.refresh(media_item)
        return media_item

    async def mark_generation_completed(
        self,
        db: AsyncSession,
        media_id: uuid.UUID,
        file_path: str,
        file_size: int,
        mime_type: str,
        duration: Optional[int] = None,
        transcript: Optional[str] = None,
    ) -> Optional[MediaItem]:
        """Mark media generation as completed."""
        query = select(MediaItem).where(MediaItem.id == media_id)
        result = await db.execute(query)
        media_item = result.scalar_one_or_none()

        if not media_item:
            return None

        media_item.mark_generation_completed(file_path, file_size, mime_type, duration)
        if transcript:
            media_item.transcript = transcript

        await db.commit()
        await db.refresh(media_item)
        return media_item

    async def mark_generation_failed(
        self, db: AsyncSession, media_id: uuid.UUID, error_message: str
    ) -> Optional[MediaItem]:
        """Mark media generation as failed."""
        query = select(MediaItem).where(MediaItem.id == media_id)
        result = await db.execute(query)
        media_item = result.scalar_one_or_none()

        if not media_item:
            return None

        media_item.mark_generation_failed(error_message)

        await db.commit()
        await db.refresh(media_item)
        return media_item

    async def delete_media_item(self, db: AsyncSession, media_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete media item and clean up files."""
        media_item = await self.get_media_by_id(db, media_id, user_id)
        if not media_item:
            return False

        try:
            # Delete media file
            if media_item.file_path:
                if self.use_s3:
                    # Delete from S3
                    await s3_media_service.delete_media_file(media_item.file_path)
                else:
                    # Delete local file
                    if os.path.exists(media_item.file_path):
                        os.unlink(media_item.file_path)

            # Delete from database
            from sqlalchemy import delete as sql_delete

            delete_stmt = sql_delete(MediaItem).where(MediaItem.id == media_item.id)
            await db.execute(delete_stmt)
            await db.commit()

            return True

        except Exception as e:
            print(f"Error deleting media item: {e}")
            await db.rollback()
            return False

    async def track_media_play(
        self,
        db: AsyncSession,
        media_id: uuid.UUID,
        user_id: uuid.UUID,
        play_duration: Optional[int] = None,
        completed: bool = False,
    ) -> bool:
        """Track media play event for analytics."""
        media_item = await self.get_media_by_id(db, media_id, user_id)
        if not media_item:
            return False

        media_item.increment_play_count()

        # TODO: Add xAPI event tracking here
        # await xapi_service.track_media_play(
        #     media_item=media_item,
        #     user_id=user_id,
        #     play_duration=play_duration,
        #     completed=completed
        # )

        await db.commit()
        return True

    async def get_popular_media(self, db: AsyncSession, user_id: uuid.UUID, limit: int = 10) -> List[MediaItem]:
        """Get user's most popular media items."""
        query = (
            select(MediaItem)
            .where(MediaItem.created_by == user_id)
            .order_by(MediaItem.play_count.desc(), MediaItem.last_played_at.desc())
            .limit(limit)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_recent_media(self, db: AsyncSession, user_id: uuid.UUID, limit: int = 10) -> List[MediaItem]:
        """Get user's most recently created media."""
        query = (
            select(MediaItem).where(MediaItem.created_by == user_id).order_by(MediaItem.created_at.desc()).limit(limit)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    def get_media_file_path(self, media_id: uuid.UUID, media_type: MediaType) -> str:
        """Generate file path for media storage."""
        extension = self._get_file_extension(media_type)
        filename = f"{media_id}{extension}"
        return str(self.media_dir / filename)

    def _get_file_extension(self, media_type: MediaType) -> str:
        """Get file extension for media type."""
        extensions = {
            MediaType.PODCAST: ".mp3",
            MediaType.AUDIO_SUMMARY: ".mp3",
            MediaType.VIDEO: ".mp4",
            MediaType.IMAGE: ".png",
            MediaType.INFOGRAPHIC: ".svg",
        }
        return extensions.get(media_type, ".bin")


# Global service instance
media_service = MediaService()
