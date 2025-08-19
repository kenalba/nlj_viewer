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
        title: str,
        file_path: str,
        file_size: int,
        file_type: str,
        creator_id: uuid.UUID,
        content_hash: str | None = None,
        extracted_text: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> SourceDocument:
        """
        Create new source document with validation.

        Args:
            title: Document title
            file_path: Path to uploaded file
            file_size: File size in bytes
            file_type: MIME type of file
            creator_id: ID of user who uploaded document
            content_hash: Hash of file content for deduplication
            extracted_text: Extracted text content
            metadata: Document metadata

        Returns:
            Created SourceDocument
        """
        document_data = await self.validate_entity_data(
            title=title,
            file_path=file_path,
            file_size=file_size,
            file_type=file_type,
            creator_id=creator_id,
            content_hash=content_hash,
            extracted_text=extracted_text,
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

        if "title" in kwargs:
            title = kwargs["title"]
            if not isinstance(title, str) or not title.strip():
                raise ValueError("Title must be a non-empty string")
            validated["title"] = title.strip()

        if "file_path" in kwargs:
            path = kwargs["file_path"]
            if not isinstance(path, str) or not path.strip():
                raise ValueError("File path must be a non-empty string")
            validated["file_path"] = path.strip()

        if "file_type" in kwargs:
            file_type = kwargs["file_type"]
            if not isinstance(file_type, str) or not file_type.strip():
                raise ValueError("File type must be a non-empty string")
            validated["file_type"] = file_type.strip()

        if "file_size" in kwargs:
            size = kwargs["file_size"]
            if not isinstance(size, int) or size < 0:
                raise ValueError("File size must be a non-negative integer")
            validated["file_size"] = size

        if "creator_id" in kwargs:
            if not isinstance(kwargs["creator_id"], uuid.UUID):
                raise ValueError("Creator ID must be a valid UUID")
            validated["uploaded_by"] = kwargs["creator_id"]

        if "content_hash" in kwargs and kwargs["content_hash"] is not None:
            hash_val = kwargs["content_hash"]
            if not isinstance(hash_val, str) or not hash_val.strip():
                raise ValueError("Content hash must be a non-empty string if provided")
            validated["content_hash"] = hash_val.strip()

        if "extracted_text" in kwargs and kwargs["extracted_text"] is not None:
            text = kwargs["extracted_text"]
            if not isinstance(text, str):
                raise ValueError("Extracted text must be a string")
            validated["extracted_text"] = text

        if "metadata" in kwargs:
            metadata = kwargs["metadata"]
            if not isinstance(metadata, dict):
                raise ValueError("Metadata must be a dictionary")
            validated["metadata"] = metadata

        return validated

    async def handle_entity_relationships(self, entity: SourceDocument) -> SourceDocument:
        """Handle source document entity relationships after persistence."""
        try:
            await self.session.refresh(entity)
            if not entity.uploaded_by_user:
                await self.session.refresh(entity, ["uploaded_by_user"])
            return entity
        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to handle document relationships: {e}") from e
