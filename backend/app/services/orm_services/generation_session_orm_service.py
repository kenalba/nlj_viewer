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
        # Validate session data (only fields that exist in the model)
        session_data = await self.validate_entity_data(
            user_id=user_id,
            config=config,
            status=GenerationStatus.PENDING,  # Default status
        )

        try:
            # Create the session first
            session_obj = await self.repository.create(**session_data)
            
            # Handle source document relationships if provided
            if source_document_ids:
                await self._link_source_documents(session_obj, source_document_ids)
            
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
            session_id, GenerationStatus.PROCESSING, progress=0, current_step="Starting generation process"
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

    async def update_session_metadata(self, session_id: uuid.UUID, metadata: dict[str, Any]) -> bool:
        """Update session metadata with additional information."""
        try:
            session = await self.repository.get_by_id(session_id)
            if not session:
                return False
            
            # Update metadata (assuming there's a metadata field on the model)
            if hasattr(session, 'metadata'):
                if session.metadata is None:
                    session.metadata = {}
                session.metadata.update(metadata)
            else:
                # If no metadata field, we can store it in prompt_config for now
                if session.prompt_config is None:
                    session.prompt_config = {}
                session.prompt_config.update(metadata)
            
            await self.session.commit()
            return True
            
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update session metadata: {e}") from e

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

    async def get_user_sessions_count(
        self,
        user_id: uuid.UUID,
        status: GenerationStatus | None = None,
    ) -> int:
        """Get count of generation sessions for a specific user."""
        try:
            return await self.repository.get_user_sessions_count(
                user_id=user_id,
                status=status,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user sessions count: {e}") from e

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
        return await self.get_by_status(GenerationStatus.PROCESSING, limit=limit)

    async def get_pending_sessions(self, limit: int = 10) -> list[GenerationSession]:
        """Get pending generation sessions ready to be processed."""
        return await self.get_by_status(GenerationStatus.PENDING, limit=limit)

    async def get_failed_sessions(self, limit: int = 50, offset: int = 0) -> list[GenerationSession]:
        """Get failed generation sessions for debugging."""
        return await self.get_by_status(GenerationStatus.FAILED, limit=limit, offset=offset)

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
        - PENDING -> PROCESSING, FAILED, CANCELLED
        - PROCESSING -> COMPLETED, FAILED, CANCELLED
        - COMPLETED/FAILED/CANCELLED -> (no transitions allowed)
        """
        valid_transitions = {
            GenerationStatus.PENDING: [GenerationStatus.PROCESSING, GenerationStatus.FAILED, GenerationStatus.CANCELLED],
            GenerationStatus.PROCESSING: [
                GenerationStatus.COMPLETED,
                GenerationStatus.FAILED,
                GenerationStatus.CANCELLED,
            ],
            GenerationStatus.COMPLETED: [],  # Terminal state
            GenerationStatus.FAILED: [],  # Terminal state
            GenerationStatus.CANCELLED: [],  # Terminal state
        }

        return new_status in valid_transitions.get(current_status, [])

    # Abstract Method Implementations

    async def validate_entity_data(self, **kwargs: Any) -> dict[str, Any]:
        """
        Validate generation session data before persistence.
        Only validates and returns fields that exist in the GenerationSession model.
        """
        validated = {}

        # UUID validations - only actual model fields
        if "user_id" in kwargs:
            if not isinstance(kwargs["user_id"], uuid.UUID):
                raise ValueError("User ID must be a valid UUID")
            validated["user_id"] = kwargs["user_id"]

        # String validations - only actual model fields  
        if "error_message" in kwargs and kwargs["error_message"] is not None:
            error = kwargs["error_message"]
            if not isinstance(error, str):
                raise ValueError("Error message must be a string")
            validated["error_message"] = error.strip() if error.strip() else None

        if "claude_conversation_id" in kwargs and kwargs["claude_conversation_id"] is not None:
            conv_id = kwargs["claude_conversation_id"]
            if not isinstance(conv_id, str):
                raise ValueError("Claude conversation ID must be a string")
            validated["claude_conversation_id"] = conv_id.strip() if conv_id.strip() else None

        if "claude_message_id" in kwargs and kwargs["claude_message_id"] is not None:
            msg_id = kwargs["claude_message_id"]
            if not isinstance(msg_id, str):
                raise ValueError("Claude message ID must be a string")
            validated["claude_message_id"] = msg_id.strip() if msg_id.strip() else None

        # Dictionary validations - only actual model fields
        if "config" in kwargs:
            config = kwargs["config"]
            if not isinstance(config, dict):
                raise ValueError("Config must be a dictionary")
            # Store config as prompt_config (matching the model field name)
            validated["prompt_config"] = config

        if "generated_content" in kwargs and kwargs["generated_content"] is not None:
            content = kwargs["generated_content"]
            if not isinstance(content, dict):
                raise ValueError("Generated content must be a dictionary")
            validated["generated_content"] = content

        if "validated_nlj" in kwargs and kwargs["validated_nlj"] is not None:
            nlj = kwargs["validated_nlj"]
            if not isinstance(nlj, dict):
                raise ValueError("Validated NLJ must be a dictionary")
            validated["validated_nlj"] = nlj

        if "validation_errors" in kwargs and kwargs["validation_errors"] is not None:
            errors = kwargs["validation_errors"]
            if not isinstance(errors, list):
                raise ValueError("Validation errors must be a list")
            validated["validation_errors"] = errors

        # Enum/Status validations
        if "status" in kwargs:
            status = kwargs["status"]
            if isinstance(status, str):
                # Convert string to GenerationStatus enum
                try:
                    status = GenerationStatus(status)
                except ValueError:
                    raise ValueError(f"Invalid status: {status}")
            elif not isinstance(status, GenerationStatus):
                raise ValueError("Status must be a GenerationStatus enum or valid string")
            validated["status"] = status

        # Numeric validations
        if "total_tokens_used" in kwargs and kwargs["total_tokens_used"] is not None:
            tokens = kwargs["total_tokens_used"]
            if not isinstance(tokens, int) or tokens < 0:
                raise ValueError("Total tokens used must be a non-negative integer")
            validated["total_tokens_used"] = tokens

        if "generation_time_seconds" in kwargs and kwargs["generation_time_seconds"] is not None:
            time_val = kwargs["generation_time_seconds"]
            if not isinstance(time_val, (int, float)) or time_val < 0:
                raise ValueError("Generation time must be a non-negative number")
            validated["generation_time_seconds"] = float(time_val)

        # Datetime validations
        for field in ["started_at", "completed_at"]:
            if field in kwargs and kwargs[field] is not None:
                dt_val = kwargs[field]
                if not isinstance(dt_val, datetime):
                    raise ValueError(f"{field} must be a datetime object")
                validated[field] = dt_val

        return validated

    async def handle_entity_relationships(self, entity: GenerationSession) -> GenerationSession:
        """
        Handle generation session entity relationships after persistence.
        Simply refresh the entity to ensure it's properly attached to the session.
        """
        try:
            # Refresh entity to get latest data and ensure it's attached to the session
            await self.session.refresh(entity)
            return entity

        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to handle generation session relationships: {e}") from e
    
    async def _link_source_documents(self, session: GenerationSession, source_document_ids: list[uuid.UUID]) -> None:
        """
        Link source documents to a generation session using the association table.
        
        Args:
            session: GenerationSession to link documents to
            source_document_ids: List of source document UUIDs to link
        """
        try:
            from app.models.source_document import SourceDocument
            from app.models.generation_session import generation_session_sources
            from sqlalchemy import select, insert
            
            # Validate that all source document IDs exist
            for doc_id in source_document_ids:
                if not isinstance(doc_id, uuid.UUID):
                    raise ValueError("Each source document ID must be a valid UUID")
            
            # Verify all source documents exist
            stmt = select(SourceDocument.id).where(SourceDocument.id.in_(source_document_ids))
            result = await self.session.execute(stmt)
            found_ids = {row[0] for row in result}
            
            missing_ids = set(source_document_ids) - found_ids
            if missing_ids:
                raise ValueError(f"Source documents not found: {missing_ids}")
            
            # Insert into association table directly to avoid relationship lazy loading
            for doc_id in source_document_ids:
                stmt = insert(generation_session_sources).values(
                    generation_session_id=session.id,
                    source_document_id=doc_id
                )
                await self.session.execute(stmt)
            
        except Exception as e:
            raise RuntimeError(f"Failed to link source documents: {str(e)}") from e
