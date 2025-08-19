"""
Generation Session ORM Service - Clean Architecture Implementation.

Provides transaction-managed CRUD operations for GenerationSession entities using repository pattern.
Handles AI content generation tracking, status management, and session orchestration.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.generation_session import GenerationSession, GenerationStatus
from app.services.orm_repositories.generation_repository import GenerationSessionRepository
from .base_orm_service import BaseOrmService


class GenerationSessionOrmService(BaseOrmService[GenerationSession, GenerationSessionRepository]):
    """
    Generation Session ORM Service managing GenerationSession persistence with Clean Architecture.

    Responsibilities:
    - Generation session CRUD operations with transaction management
    - AI generation status tracking and state transitions
    - Content generation lineage and relationships
    - Session orchestration and progress monitoring
    - Error handling and recovery for generation processes

    Uses GenerationSessionRepository for all data access operations.
    """

    def __init__(self, session: AsyncSession, repository: GenerationSessionRepository):
        """Initialize Generation Session ORM Service with session and repository."""
        super().__init__(session, repository)

    # Generation Session-Specific CRUD Operations

    async def create_generation_session(
        self,
        user_id: uuid.UUID,
        session_type: str,
        config: dict[str, Any],
        activity_title: str | None = None,
        source_document_ids: list[uuid.UUID] | None = None,
        parent_activity_id: uuid.UUID | None = None,
    ) -> GenerationSession:
        """
        Create new generation session with validation.

        Args:
            user_id: ID of the user creating the session
            session_type: Type of generation session
            config: Generation configuration parameters
            activity_title: Title for the activity to be generated
            source_document_ids: List of source document IDs
            parent_activity_id: Parent activity ID if this is a derivative

        Returns:
            Created GenerationSession

        Raises:
            RuntimeError: If creation fails
            ValueError: If validation fails
        """
        # Validate session data
        session_data = await self.validate_entity_data(
            user_id=user_id,
            session_type=session_type,
            config=config,
            activity_title=activity_title,
            source_document_ids=source_document_ids or [],
            parent_activity_id=parent_activity_id,
            status=GenerationStatus.PENDING,  # Default status
        )

        try:
            session_obj = await self.repository.create(**session_data)
            await self.session.commit()

            return await self.handle_entity_relationships(session_obj)

        except IntegrityError as e:
            await self.session.rollback()
            if "user" in str(e):
                raise ValueError("Invalid user ID provided") from e
            elif "parent_activity" in str(e):
                raise ValueError("Invalid parent activity ID provided") from e
            else:
                raise RuntimeError(f"Generation session creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create generation session: {e}") from e

    async def get_session_with_relationships(self, session_id: uuid.UUID) -> GenerationSession | None:
        """
        Get generation session by ID with all relationships loaded.

        Args:
            session_id: Session UUID

        Returns:
            GenerationSession with relationships loaded, or None if not found
        """
        try:
            return await self.repository.get_by_id_with_relationships(session_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get session with relationships: {e}") from e

    # Generation Status Management

    async def update_session_status(
        self,
        session_id: uuid.UUID,
        status: GenerationStatus,
        progress: int | None = None,
        current_step: str | None = None,
        error_message: str | None = None,
    ) -> GenerationSession | None:
        """
        Update generation session status and progress.

        Args:
            session_id: Session UUID
            status: New generation status
            progress: Progress percentage (0-100)
            current_step: Current processing step description
            error_message: Error message if status is FAILED

        Returns:
            Updated GenerationSession or None if not found

        Raises:
            ValueError: If status transition is invalid
            RuntimeError: If update fails
        """
        try:
            # Get current session to validate status transition
            current_session = await self.repository.get_by_id(session_id)
            if not current_session:
                return None

            # Validate status transition
            if not self._can_transition_to_status(current_session.status, status):
                raise ValueError(f"Cannot transition from {current_session.status} to {status}")

            update_data = {"status": status}

            if progress is not None:
                if not (0 <= progress <= 100):
                    raise ValueError("Progress must be between 0 and 100")
                update_data["progress"] = progress

            if current_step:
                update_data["current_step"] = current_step

            if error_message:
                update_data["error_message"] = error_message

            # Set completion timestamp if completing
            if status in [GenerationStatus.COMPLETED, GenerationStatus.FAILED]:
                update_data["completed_at"] = datetime.now(timezone.utc)

            updated_session = await self.repository.update_by_id(session_id, **update_data)
            if updated_session:
                await self.session.commit()
                return await self.handle_entity_relationships(updated_session)

            return updated_session

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update session status: {e}") from e

    async def start_session(self, session_id: uuid.UUID) -> GenerationSession | None:
        """Start a pending generation session."""
        return await self.update_session_status(
            session_id, GenerationStatus.IN_PROGRESS, progress=0, current_step="Starting generation process"
        )

    async def complete_session(
        self, session_id: uuid.UUID, generated_content: dict[str, Any] | None = None
    ) -> GenerationSession | None:
        """Complete a generation session with optional generated content."""
        update_data = {"progress": 100, "current_step": "Generation completed"}

        if generated_content:
            update_data["generated_content"] = generated_content

        return await self.update_session_status(session_id, GenerationStatus.COMPLETED, **update_data)

    async def fail_session(self, session_id: uuid.UUID, error_message: str) -> GenerationSession | None:
        """Mark a generation session as failed with error message."""
        return await self.update_session_status(session_id, GenerationStatus.FAILED, error_message=error_message)

    # Generation Session Queries

    async def get_user_sessions(
        self,
        user_id: uuid.UUID,
        status: GenerationStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[GenerationSession]:
        """Get generation sessions for a specific user."""
        try:
            return await self.repository.get_user_sessions(
                user_id=user_id,
                status=status,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user sessions: {e}") from e

    async def get_by_status(
        self,
        status: GenerationStatus,
        limit: int = 50,
        offset: int = 0,
    ) -> list[GenerationSession]:
        """Get generation sessions by status."""
        try:
            return await self.repository.get_by_status(
                status=status,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get sessions by status: {e}") from e

    async def get_active_sessions(self, limit: int = 20) -> list[GenerationSession]:
        """Get currently active (in-progress) generation sessions."""
        return await self.get_by_status(GenerationStatus.IN_PROGRESS, limit=limit)

    async def get_pending_sessions(self, limit: int = 10) -> list[GenerationSession]:
        """Get pending generation sessions ready to be processed."""
        return await self.get_by_status(GenerationStatus.PENDING, limit=limit)

    async def get_failed_sessions(self, limit: int = 50, offset: int = 0) -> list[GenerationSession]:
        """Get failed generation sessions for debugging."""
        return await self.get_by_status(GenerationStatus.FAILED, limit=limit)

    async def get_session_statistics(self) -> dict[str, Any]:
        """Get generation session analytics and statistics."""
        try:
            return await self.repository.get_session_statistics()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get session statistics: {e}") from e

    async def search_sessions(
        self,
        search_term: str,
        user_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[GenerationSession]:
        """Search generation sessions by title or session type."""
        try:
            return await self.repository.search_sessions(
                search_term=search_term,
                user_id=user_id,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to search sessions: {e}") from e

    # Helper Methods

    def _can_transition_to_status(self, current_status: GenerationStatus, new_status: GenerationStatus) -> bool:
        """
        Check if status transition is valid.

        Valid transitions:
        - PENDING -> IN_PROGRESS, FAILED
        - IN_PROGRESS -> COMPLETED, FAILED, PAUSED
        - PAUSED -> IN_PROGRESS, FAILED
        - COMPLETED/FAILED -> (no transitions allowed)
        """
        valid_transitions = {
            GenerationStatus.PENDING: [GenerationStatus.IN_PROGRESS, GenerationStatus.FAILED],
            GenerationStatus.IN_PROGRESS: [
                GenerationStatus.COMPLETED,
                GenerationStatus.FAILED,
                GenerationStatus.PAUSED,
            ],
            GenerationStatus.PAUSED: [GenerationStatus.IN_PROGRESS, GenerationStatus.FAILED],
            GenerationStatus.COMPLETED: [],  # Terminal state
            GenerationStatus.FAILED: [],  # Terminal state
        }

        return new_status in valid_transitions.get(current_status, [])

    # Abstract Method Implementations

    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """
        Validate generation session data before persistence.

        Validates required fields, configuration, and session parameters.
        """
        validated = {}

        # UUID validations
        if "user_id" in kwargs:
            if not isinstance(kwargs["user_id"], uuid.UUID):
                raise ValueError("User ID must be a valid UUID")
            validated["user_id"] = kwargs["user_id"]

        if "parent_activity_id" in kwargs and kwargs["parent_activity_id"] is not None:
            if not isinstance(kwargs["parent_activity_id"], uuid.UUID):
                raise ValueError("Parent activity ID must be a valid UUID")
            validated["parent_activity_id"] = kwargs["parent_activity_id"]

        # String validations
        if "session_type" in kwargs:
            session_type = kwargs["session_type"]
            if not isinstance(session_type, str) or not session_type.strip():
                raise ValueError("Session type must be a non-empty string")
            validated["session_type"] = session_type.strip()

        if "activity_title" in kwargs and kwargs["activity_title"] is not None:
            title = kwargs["activity_title"]
            if not isinstance(title, str):
                raise ValueError("Activity title must be a string")
            validated["activity_title"] = title.strip() if title.strip() else None

        if "current_step" in kwargs and kwargs["current_step"] is not None:
            step = kwargs["current_step"]
            if not isinstance(step, str):
                raise ValueError("Current step must be a string")
            validated["current_step"] = step.strip() if step.strip() else None

        if "error_message" in kwargs and kwargs["error_message"] is not None:
            error = kwargs["error_message"]
            if not isinstance(error, str):
                raise ValueError("Error message must be a string")
            validated["error_message"] = error.strip() if error.strip() else None

        # Dictionary/List validations
        if "config" in kwargs:
            config = kwargs["config"]
            if not isinstance(config, dict):
                raise ValueError("Config must be a dictionary")
            validated["config"] = config

        if "source_document_ids" in kwargs:
            doc_ids = kwargs["source_document_ids"]
            if not isinstance(doc_ids, list):
                raise ValueError("Source document IDs must be a list")
            if doc_ids and not all(isinstance(doc_id, uuid.UUID) for doc_id in doc_ids):
                raise ValueError("All source document IDs must be valid UUIDs")
            validated["source_document_ids"] = doc_ids

        if "generated_content" in kwargs and kwargs["generated_content"] is not None:
            content = kwargs["generated_content"]
            if not isinstance(content, dict):
                raise ValueError("Generated content must be a dictionary")
            validated["generated_content"] = content

        # Enum validation
        if "status" in kwargs:
            if not isinstance(kwargs["status"], GenerationStatus):
                raise ValueError("Status must be a valid GenerationStatus enum")
            validated["status"] = kwargs["status"]

        # Numeric validations
        if "progress" in kwargs and kwargs["progress"] is not None:
            progress = kwargs["progress"]
            if not isinstance(progress, int) or not (0 <= progress <= 100):
                raise ValueError("Progress must be an integer between 0 and 100")
            validated["progress"] = progress

        # Datetime validations
        if "completed_at" in kwargs and kwargs["completed_at"] is not None:
            if not isinstance(kwargs["completed_at"], datetime):
                raise ValueError("Completed at must be a datetime")
            validated["completed_at"] = kwargs["completed_at"]

        return validated

    async def handle_entity_relationships(self, entity: GenerationSession) -> GenerationSession:
        """
        Handle generation session entity relationships after persistence.

        Loads user and related entity relationships.
        """
        try:
            # Refresh entity to get latest data
            await self.session.refresh(entity)

            # Load user relationship if not already loaded
            if not entity.user:
                await self.session.refresh(entity, ["user"])

            # Load activity sources and created activities if available
            if hasattr(entity, "activity_sources") and not entity.activity_sources:
                await self.session.refresh(entity, ["activity_sources"])

            if hasattr(entity, "created_activities") and not entity.created_activities:
                await self.session.refresh(entity, ["created_activities"])

            return entity

        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to handle generation session relationships: {e}") from e
