"""
Source document repository for document management and conversion tracking.
Handles source documents, file processing, and conversion status tracking.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.models.source_document import SourceDocument, FileType, ConversionStatus
from .base_repository import BaseRepository

if TYPE_CHECKING:
    pass


class SourceDocumentRepository(BaseRepository[SourceDocument]):
    """Repository for SourceDocument entities with document processing."""
    
    @property
    def model(self) -> type[SourceDocument]:
        return SourceDocument
    
    async def get_by_id_with_relationships(self, document_id: UUID) -> SourceDocument | None:
        """Get source document by ID with all relationships loaded."""
        result = await self.session.execute(
            select(SourceDocument)
            .options(
                selectinload(SourceDocument.uploaded_by_user),
                selectinload(SourceDocument.media_items)
            )
            .where(SourceDocument.id == document_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_file_type(
        self,
        file_type: FileType,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[SourceDocument]:
        """Get documents by file type."""
        query = select(SourceDocument).where(SourceDocument.file_type == file_type)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_conversion_status(
        self,
        status: ConversionStatus,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[SourceDocument]:
        """Get documents by conversion status."""
        query = select(SourceDocument).where(SourceDocument.conversion_status == status)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_user_documents(
        self,
        user_id: UUID,
        file_type: FileType | None = None,
        status: ConversionStatus | None = None,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[SourceDocument]:
        """Get documents uploaded by a specific user."""
        conditions = [SourceDocument.uploaded_by == user_id]
        
        if file_type is not None:
            conditions.append(SourceDocument.file_type == file_type)
        if status is not None:
            conditions.append(SourceDocument.conversion_status == status)
        
        query = select(SourceDocument).where(and_(*conditions))
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def search_documents(
        self,
        search_term: str,
        file_type: FileType | None = None,
        limit: int | None = None
    ) -> list[SourceDocument]:
        """Search documents by filename and extracted text."""
        search_condition = or_(
            SourceDocument.original_filename.ilike(f"%{search_term}%"),
            SourceDocument.extracted_text.ilike(f"%{search_term}%")
        )
        
        conditions = [search_condition]
        if file_type is not None:
            conditions.append(SourceDocument.file_type == file_type)
        
        query = select(SourceDocument).where(and_(*conditions))
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_processed_documents(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[SourceDocument]:
        """Get successfully processed documents."""
        query = select(SourceDocument).where(
            SourceDocument.conversion_status == ConversionStatus.COMPLETED
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_failed_documents(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[SourceDocument]:
        """Get documents that failed processing."""
        query = select(SourceDocument).where(
            SourceDocument.conversion_status == ConversionStatus.FAILED
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_large_documents(
        self,
        min_size_bytes: int = 10_000_000,  # 10MB
        limit: int | None = None
    ) -> list[SourceDocument]:
        """Get large documents above a certain size."""
        query = (
            select(SourceDocument)
            .where(SourceDocument.file_size >= min_size_bytes)
            .order_by(desc(SourceDocument.file_size))
        )
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_recent_uploads(
        self,
        days: int = 7,
        limit: int = 20
    ) -> list[SourceDocument]:
        """Get recently uploaded documents."""
        from datetime import datetime, timedelta, timezone
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        query = (
            select(SourceDocument)
            .where(SourceDocument.uploaded_at >= cutoff_date)
            .order_by(desc(SourceDocument.uploaded_at))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_documents_by_size_range(
        self,
        min_size: int | None = None,
        max_size: int | None = None,
        limit: int | None = None
    ) -> list[SourceDocument]:
        """Get documents within a size range."""
        conditions = []
        
        if min_size is not None:
            conditions.append(SourceDocument.file_size >= min_size)
        if max_size is not None:
            conditions.append(SourceDocument.file_size <= max_size)
        
        query = select(SourceDocument)
        if conditions:
            query = query.where(and_(*conditions))
            
        query = query.order_by(SourceDocument.file_size)
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_document_statistics(self) -> dict:
        """Get document statistics for analytics."""
        # Count by file type
        type_counts = await self.session.execute(
            select(SourceDocument.file_type, func.count(SourceDocument.id))
            .group_by(SourceDocument.file_type)
        )
        
        # Count by conversion status
        status_counts = await self.session.execute(
            select(SourceDocument.conversion_status, func.count(SourceDocument.id))
            .group_by(SourceDocument.conversion_status)
        )
        
        # Total documents
        total_documents = await self.count_all()
        
        # Storage statistics
        storage_stats = await self.session.execute(
            select(
                func.sum(SourceDocument.file_size),
                func.avg(SourceDocument.file_size),
                func.max(SourceDocument.file_size)
            )
        )
        
        # Processing success rate
        completed_count = await self.session.execute(
            select(func.count(SourceDocument.id))
            .where(SourceDocument.conversion_status == ConversionStatus.COMPLETED)
        )
        
        failed_count = await self.session.execute(
            select(func.count(SourceDocument.id))
            .where(SourceDocument.conversion_status == ConversionStatus.FAILED)
        )
        
        storage_result = storage_stats.first()
        completed = completed_count.scalar()
        failed = failed_count.scalar()
        total_processed = completed + failed
        success_rate = (completed / total_processed * 100) if total_processed > 0 else 0
        
        return {
            "total_documents": total_documents,
            "by_file_type": dict(type_counts.all()),
            "by_conversion_status": dict(status_counts.all()),
            "total_storage_bytes": storage_result[0] or 0,
            "average_file_size": float(storage_result[1] or 0),
            "largest_file_size": storage_result[2] or 0,
            "processing_success_rate": round(success_rate, 2),
            "completed_documents": completed,
            "failed_documents": failed
        }
    
    async def update_conversion_status(
        self,
        document_id: UUID,
        new_status: ConversionStatus,
        error_message: str | None = None,
        extracted_text: str | None = None
    ) -> bool:
        """Update document conversion status with optional results."""
        update_data = {"conversion_status": new_status}
        
        if error_message is not None:
            update_data["conversion_error"] = error_message
        if extracted_text is not None:
            update_data["extracted_text"] = extracted_text
        if new_status == ConversionStatus.COMPLETED:
            update_data["processed_at"] = func.now()
            
        return await self.update_by_id(document_id, **update_data) is not None
    
    async def mark_as_processing(self, document_id: UUID) -> bool:
        """Mark document as being processed."""
        return await self.update_conversion_status(document_id, ConversionStatus.PROCESSING)
    
    async def mark_as_completed(
        self,
        document_id: UUID,
        extracted_text: str,
        s3_url: str | None = None
    ) -> bool:
        """Mark document as successfully processed."""
        update_data = {
            "conversion_status": ConversionStatus.COMPLETED,
            "extracted_text": extracted_text,
            "processed_at": func.now()
        }
        
        if s3_url is not None:
            update_data["s3_url"] = s3_url
            
        return await self.update_by_id(document_id, **update_data) is not None
    
    async def mark_as_failed(
        self,
        document_id: UUID,
        error_message: str
    ) -> bool:
        """Mark document as failed processing."""
        return await self.update_conversion_status(
            document_id,
            ConversionStatus.FAILED,
            error_message
        )
    
    async def cleanup_old_documents(self, days_old: int = 90) -> int:
        """Clean up old processed documents older than specified days."""
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import delete
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        result = await self.session.execute(
            delete(SourceDocument)
            .where(
                and_(
                    SourceDocument.uploaded_at < cutoff_date,
                    SourceDocument.conversion_status.in_([
                        ConversionStatus.COMPLETED,
                        ConversionStatus.FAILED
                    ])
                )
            )
        )
        
        return result.rowcount