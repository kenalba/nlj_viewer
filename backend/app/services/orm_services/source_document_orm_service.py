"""
Source Document ORM Service - Clean Architecture Implementation.

Provides transaction-managed CRUD operations for SourceDocument entities using repository pattern.
Handles document upload, processing, metadata extraction, and content lineage.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.source_document import SourceDocument
from app.services.orm_repositories.source_document_repository import SourceDocumentRepository
from .base_orm_service import BaseOrmService


class SourceDocumentOrmService(BaseOrmService[SourceDocument, SourceDocumentRepository]):
    """
    Source Document ORM Service managing SourceDocument persistence with Clean Architecture.

    Responsibilities:
    - Document CRUD operations with transaction management
    - File upload and processing workflow management
    - Document metadata extraction and validation
    - Content relationship tracking and lineage
    - Document deduplication and organization

    Uses SourceDocumentRepository for all data access operations.
    """

    def __init__(self, session: AsyncSession, repository: SourceDocumentRepository):
        """Initialize Source Document ORM Service with session and repository."""
        super().__init__(session, repository)

    async def create_document(
        self,
        filename: str,
        original_filename: str,
        file_path: str,
        file_size: int,
        file_type: str,
        original_file_type: str,
        user_id: uuid.UUID,
        content_hash: str | None = None,
        summary: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> SourceDocument:
        """
        Create new source document with validation.

        Args:
            filename: Current document filename (may be converted)
            original_filename: Original uploaded filename
            file_path: Path to uploaded file
            file_size: File size in bytes
            file_type: Current file type (after conversion if applicable)
            original_file_type: Original file type before conversion
            user_id: ID of user who uploaded document
            content_hash: Hash of file content for deduplication
            summary: AI-generated summary of document content
            metadata: Document metadata

        Returns:
            Created SourceDocument
        """
        document_data = await self.validate_entity_data(
            filename=filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            file_type=file_type,
            original_file_type=original_file_type,
            user_id=user_id,
            content_hash=content_hash,
            summary=summary,
            metadata=metadata or {},
        )

        try:
            document = await self.repository.create(**document_data)
            await self.session.commit()
            return await self.handle_entity_relationships(document)
        except IntegrityError as e:
            await self.session.rollback()
            if "creator" in str(e):
                raise ValueError("Invalid creator ID provided") from e
            else:
                raise RuntimeError(f"Document creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create document: {e}") from e

    async def get_document_with_relationships(self, doc_id: uuid.UUID) -> SourceDocument | None:
        """Get document by ID with all relationships loaded."""
        try:
            return await self.repository.get_by_id_with_relationships(doc_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get document with relationships: {e}") from e

    async def get_user_documents(self, user_id: uuid.UUID, limit: int = 50, offset: int = 0) -> list[SourceDocument]:
        """Get documents uploaded by specific user."""
        try:
            return await self.repository.get_user_documents(user_id=user_id, limit=limit, offset=offset)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user documents: {e}") from e

    async def search_documents(
        self,
        search_term: str,
        file_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SourceDocument]:
        """Search documents by title and content."""
        try:
            return await self.repository.search_documents(
                search_term=search_term,
                file_type=file_type,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to search documents: {e}") from e

    async def find_duplicate_documents(self, content_hash: str) -> list[SourceDocument]:
        """Find documents with same content hash."""
        try:
            return await self.repository.find_by_content_hash(content_hash)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to find duplicate documents: {e}") from e

    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """Validate source document data before persistence."""
        validated = {}

        if "filename" in kwargs:
            filename = kwargs["filename"]
            if not isinstance(filename, str) or not filename.strip():
                raise ValueError("Filename must be a non-empty string")
            validated["filename"] = filename.strip()

        if "original_filename" in kwargs:
            original_filename = kwargs["original_filename"]
            if not isinstance(original_filename, str) or not original_filename.strip():
                raise ValueError("Original filename must be a non-empty string")
            validated["original_filename"] = original_filename.strip()

        if "file_path" in kwargs:
            path = kwargs["file_path"]
            if not isinstance(path, str) or not path.strip():
                raise ValueError("File path must be a non-empty string")
            validated["file_path"] = path.strip()

        if "file_type" in kwargs:
            file_type = kwargs["file_type"]
            if not isinstance(file_type, str) or not file_type.strip():
                raise ValueError("File type must be a non-empty string")
            # Convert MIME type to FileType enum value
            if file_type == "application/pdf":
                validated["file_type"] = "pdf"
            elif file_type.startswith("text/"):
                validated["file_type"] = "txt"
            else:
                validated["file_type"] = file_type.strip()

        if "original_file_type" in kwargs:
            original_file_type = kwargs["original_file_type"]
            if not isinstance(original_file_type, str) or not original_file_type.strip():
                raise ValueError("Original file type must be a non-empty string")
            # Convert MIME type to FileType enum value
            if original_file_type == "application/pdf":
                validated["original_file_type"] = "pdf"
            elif original_file_type.startswith("text/"):
                validated["original_file_type"] = "txt"
            else:
                validated["original_file_type"] = original_file_type.strip()

        if "file_size" in kwargs:
            size = kwargs["file_size"]
            if not isinstance(size, int) or size < 0:
                raise ValueError("File size must be a non-negative integer")
            validated["file_size"] = size

        if "user_id" in kwargs:
            if not isinstance(kwargs["user_id"], uuid.UUID):
                raise ValueError("User ID must be a valid UUID")
            validated["user_id"] = kwargs["user_id"]

        if "content_hash" in kwargs and kwargs["content_hash"] is not None:
            hash_val = kwargs["content_hash"]
            if not isinstance(hash_val, str) or not hash_val.strip():
                raise ValueError("Content hash must be a non-empty string if provided")
            validated["content_hash"] = hash_val.strip()

        if "summary" in kwargs and kwargs["summary"] is not None:
            text = kwargs["summary"]
            if not isinstance(text, str):
                raise ValueError("Summary text must be a string")
            validated["summary"] = text

        if "metadata" in kwargs:
            metadata = kwargs["metadata"]
            if not isinstance(metadata, dict):
                raise ValueError("Metadata must be a dictionary")
            # Handle specific metadata fields that map to model columns
            if "keywords" in metadata:
                validated["keywords"] = metadata["keywords"]
            if "learning_objectives" in metadata:
                validated["learning_objectives"] = metadata["learning_objectives"]
            if "target_audience" in metadata:
                validated["target_audience"] = metadata["target_audience"]

        return validated

    async def handle_entity_relationships(self, entity: SourceDocument) -> SourceDocument:
        """Handle source document entity relationships after persistence."""
        try:
            await self.session.refresh(entity)
            if not hasattr(entity, 'owner') or not entity.owner:
                await self.session.refresh(entity, ["owner"])
            return entity
        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to handle document relationships: {e}") from e
