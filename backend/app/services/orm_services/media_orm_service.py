"""
Media ORM Service - Clean Architecture Implementation.

Provides transaction-managed CRUD operations for MediaItem entities using repository pattern.
Handles media processing, state management, and file organization.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.media import MediaItem, MediaState, MediaType, VoiceType
from app.services.orm_repositories.media_repository import MediaRepository
from .base_orm_service import BaseOrmService


class MediaOrmService(BaseOrmService[MediaItem, MediaRepository]):
    """
    Media ORM Service managing MediaItem persistence with Clean Architecture.

    Responsibilities:
    - Media CRUD operations with transaction management
    - Media processing state management
    - File organization and metadata handling
    - Media type validation and queries
    - Audio generation and voice processing

    Uses MediaRepository for all data access operations.
    """

    def __init__(self, session: AsyncSession, repository: MediaRepository):
        """Initialize Media ORM Service with session and repository."""
        super().__init__(session, repository)

    # Media-Specific CRUD Operations

    async def create_media(
        self,
        title: str,
        file_path: str,
        media_type: MediaType,
        creator_id: uuid.UUID,
        content_id: uuid.UUID | None = None,
        file_size: int | None = None,
        duration: float | None = None,
        voice_type: VoiceType | None = None,
        generation_prompt: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> MediaItem:
        """
        Create new media item with validation.

        Args:
            title: Media title
            file_path: Path to media file
            media_type: Type of media (PODCAST, AUDIO, etc.)
            creator_id: ID of the user creating the media
            content_id: Associated content ID if any
            file_size: Size of media file in bytes
            duration: Duration in seconds for audio/video
            voice_type: Voice type for generated audio
            generation_prompt: AI generation prompt if generated
            metadata: Additional media metadata

        Returns:
            Created MediaItem

        Raises:
            RuntimeError: If creation fails
            ValueError: If validation fails
        """
        # Validate media data
        media_data = await self.validate_entity_data(
            title=title,
            file_path=file_path,
            media_type=media_type,
            creator_id=creator_id,
            content_id=content_id,
            file_size=file_size,
            duration=duration,
            voice_type=voice_type,
            generation_prompt=generation_prompt,
            metadata=metadata or {},
            media_state=MediaState.PROCESSING,  # Default state
        )

        try:
            media = await self.repository.create(**media_data)
            await self.session.commit()

            return await self.handle_entity_relationships(media)

        except IntegrityError as e:
            await self.session.rollback()
            if "creator" in str(e):
                raise ValueError("Invalid creator ID provided") from e
            elif "content" in str(e):
                raise ValueError("Invalid content ID provided") from e
            else:
                raise RuntimeError(f"Media creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create media: {e}") from e

    async def get_media_with_relationships(self, media_id: uuid.UUID) -> MediaItem | None:
        """
        Get media by ID with all relationships loaded.

        Args:
            media_id: Media UUID

        Returns:
            MediaItem with relationships loaded, or None if not found
        """
        try:
            return await self.repository.get_by_id_with_relationships(media_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get media with relationships: {e}") from e

    # Media State Management

    async def update_processing_state(
        self,
        media_id: uuid.UUID,
        new_state: MediaState,
        error_message: str | None = None,
    ) -> bool:
        """
        Update media processing state.

        Args:
            media_id: Media UUID
            new_state: New processing state
            error_message: Error message if state is FAILED

        Returns:
            True if successful, False if media not found

        Raises:
            RuntimeError: If update fails
        """
        try:
            update_data = {"media_state": new_state}
            if error_message:
                update_data["error_message"] = error_message

            updated = await self.repository.update_by_id(media_id, **update_data)
            if updated:
                await self.session.commit()
                return True
            return False

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update processing state: {e}") from e

    async def mark_as_completed(
        self,
        media_id: uuid.UUID,
        final_file_path: str | None = None,
        duration: float | None = None,
        file_size: int | None = None,
    ) -> bool:
        """
        Mark media processing as completed.

        Args:
            media_id: Media UUID
            final_file_path: Final processed file path
            duration: Final duration if audio/video
            file_size: Final file size

        Returns:
            True if successful, False if media not found
        """
        update_data = {"media_state": MediaState.COMPLETED}

        if final_file_path:
            update_data["file_path"] = final_file_path
        if duration is not None:
            update_data["duration"] = duration
        if file_size is not None:
            update_data["file_size"] = file_size

        try:
            updated = await self.repository.update_by_id(media_id, **update_data)
            if updated:
                await self.session.commit()
                return True
            return False

        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to mark media as completed: {e}") from e

    async def mark_as_failed(
        self,
        media_id: uuid.UUID,
        error_message: str,
    ) -> bool:
        """
        Mark media processing as failed.

        Args:
            media_id: Media UUID
            error_message: Error description

        Returns:
            True if successful, False if media not found
        """
        return await self.update_processing_state(media_id, MediaState.FAILED, error_message)

    # Media Queries

    async def get_by_type(
        self,
        media_type: MediaType,
        limit: int = 50,
        offset: int = 0,
    ) -> list[MediaItem]:
        """Get media items by type."""
        try:
            return await self.repository.get_by_type(
                media_type=media_type,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get media by type: {e}") from e

    async def get_by_state(
        self,
        state: MediaState,
        limit: int = 50,
        offset: int = 0,
    ) -> list[MediaItem]:
        """Get media items by processing state."""
        try:
            return await self.repository.get_by_state(
                state=state,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get media by state: {e}") from e

    async def get_user_media(
        self,
        user_id: uuid.UUID,
        media_type: MediaType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[MediaItem]:
        """Get media created by specific user."""
        try:
            return await self.repository.get_user_media(
                user_id=user_id,
                media_type=media_type,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user media: {e}") from e

    async def get_content_media(
        self,
        content_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[MediaItem]:
        """Get media associated with specific content."""
        try:
            return await self.repository.get_content_media(
                content_id=content_id,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get content media: {e}") from e

    async def search_media(
        self,
        search_term: str,
        media_type: MediaType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[MediaItem]:
        """Search media by title and metadata."""
        try:
            return await self.repository.search_media(
                search_term=search_term,
                media_type=media_type,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to search media: {e}") from e

    async def get_processing_queue(self, limit: int = 10) -> list[MediaItem]:
        """Get media items in processing queue."""
        try:
            return await self.repository.get_processing_queue(limit=limit)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get processing queue: {e}") from e

    async def get_media_statistics(self) -> dict[str, Any]:
        """Get media analytics and statistics."""
        try:
            return await self.repository.get_media_statistics()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get media statistics: {e}") from e

    # Abstract Method Implementations

    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """
        Validate media data before persistence.

        Validates required fields, file paths, and media-specific constraints.
        """
        validated = {}

        # Required fields
        if "title" in kwargs:
            title = kwargs["title"]
            if not isinstance(title, str) or not title.strip():
                raise ValueError("Title must be a non-empty string")
            validated["title"] = title.strip()

        if "file_path" in kwargs:
            file_path = kwargs["file_path"]
            if not isinstance(file_path, str) or not file_path.strip():
                raise ValueError("File path must be a non-empty string")
            validated["file_path"] = file_path.strip()

        # Enum validations
        if "media_type" in kwargs:
            if not isinstance(kwargs["media_type"], MediaType):
                raise ValueError("Media type must be a valid MediaType enum")
            validated["media_type"] = kwargs["media_type"]

        if "media_state" in kwargs:
            if not isinstance(kwargs["media_state"], MediaState):
                raise ValueError("Media state must be a valid MediaState enum")
            validated["media_state"] = kwargs["media_state"]

        if "voice_type" in kwargs and kwargs["voice_type"] is not None:
            if not isinstance(kwargs["voice_type"], VoiceType):
                raise ValueError("Voice type must be a valid VoiceType enum")
            validated["voice_type"] = kwargs["voice_type"]

        # UUID validations
        if "creator_id" in kwargs:
            if not isinstance(kwargs["creator_id"], uuid.UUID):
                raise ValueError("Creator ID must be a valid UUID")
            validated["created_by"] = kwargs["creator_id"]  # Map to model field name

        if "content_id" in kwargs and kwargs["content_id"] is not None:
            if not isinstance(kwargs["content_id"], uuid.UUID):
                raise ValueError("Content ID must be a valid UUID")
            validated["content_id"] = kwargs["content_id"]

        # Numeric validations
        if "file_size" in kwargs and kwargs["file_size"] is not None:
            file_size = kwargs["file_size"]
            if not isinstance(file_size, int) or file_size < 0:
                raise ValueError("File size must be a non-negative integer")
            validated["file_size"] = file_size

        if "duration" in kwargs and kwargs["duration"] is not None:
            duration = kwargs["duration"]
            if not isinstance(duration, (int, float)) or duration < 0:
                raise ValueError("Duration must be a non-negative number")
            validated["duration"] = float(duration)

        # String validations
        if "generation_prompt" in kwargs and kwargs["generation_prompt"] is not None:
            prompt = kwargs["generation_prompt"]
            if not isinstance(prompt, str):
                raise ValueError("Generation prompt must be a string")
            validated["generation_prompt"] = prompt.strip() if prompt.strip() else None

        if "error_message" in kwargs and kwargs["error_message"] is not None:
            error = kwargs["error_message"]
            if not isinstance(error, str):
                raise ValueError("Error message must be a string")
            validated["error_message"] = error.strip() if error.strip() else None

        # Dictionary validation
        if "metadata" in kwargs:
            metadata = kwargs["metadata"]
            if not isinstance(metadata, dict):
                raise ValueError("Metadata must be a dictionary")
            validated["metadata"] = metadata

        return validated

    async def handle_entity_relationships(self, entity: MediaItem) -> MediaItem:
        """
        Handle media entity relationships after persistence.

        Loads creator and content relationships.
        """
        try:
            # Refresh entity to get latest data
            await self.session.refresh(entity)

            # Load relationships if not already loaded
            if not entity.creator:
                await self.session.refresh(entity, ["creator"])

            if entity.content_id and not entity.content:
                await self.session.refresh(entity, ["content"])

            return entity

        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to handle media relationships: {e}") from e
