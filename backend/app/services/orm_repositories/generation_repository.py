"""
Generation session repository for AI content generation tracking.
Handles generation sessions, status tracking, and content lineage.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import selectinload

from app.models.generation_session import GenerationSession, GenerationStatus
from .base_repository import BaseRepository

if TYPE_CHECKING:
    pass


class GenerationSessionRepository(BaseRepository[GenerationSession]):
    """Repository for GenerationSession entities with AI generation tracking."""
    
    @property
    def model(self) -> type[GenerationSession]:
        return GenerationSession
    
    async def get_by_id_with_relationships(self, session_id: UUID) -> GenerationSession | None:
        """Get generation session by ID with all relationships loaded."""
        result = await self.session.execute(
            select(GenerationSession)
            .options(
                selectinload(GenerationSession.user),
                selectinload(GenerationSession.activity_sources),
                selectinload(GenerationSession.created_activities)
            )
            .where(GenerationSession.id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_sessions(
        self,
        user_id: UUID,
        status: GenerationStatus | None = None,
        limit: int | None = None,
        offset: int | None = None
    ) -> tuple[list[GenerationSession], int]:
        """Get generation sessions for a user with pagination."""
        # Build conditions
        conditions = [GenerationSession.user_id == user_id]
        if status is not None:
            conditions.append(GenerationSession.status == status)
        
        # Query for sessions
        query = (
            select(GenerationSession)
            .where(and_(*conditions))
            .order_by(desc(GenerationSession.created_at))
        )
        
        # Count query
        count_query = select(func.count(GenerationSession.id)).where(and_(*conditions))
        
        # Apply pagination
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        
        # Execute queries
        sessions_result = await self.session.execute(query)
        count_result = await self.session.execute(count_query)
        
        sessions = list(sessions_result.scalars().all())
        total_count = count_result.scalar()
        
        return sessions, total_count
    
    async def get_by_status(
        self,
        status: GenerationStatus,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[GenerationSession]:
        """Get generation sessions by status."""
        query = select(GenerationSession).where(GenerationSession.status == status)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_pending_sessions(self, limit: int = 10) -> list[GenerationSession]:
        """Get pending generation sessions for processing."""
        query = (
            select(GenerationSession)
            .where(GenerationSession.status == GenerationStatus.PENDING)
            .order_by(GenerationSession.created_at)
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_processing_sessions(self) -> list[GenerationSession]:
        """Get currently processing generation sessions."""
        result = await self.session.execute(
            select(GenerationSession)
            .where(GenerationSession.status == GenerationStatus.PROCESSING)
            .order_by(GenerationSession.updated_at)
        )
        return list(result.scalars().all())
    
    async def get_failed_sessions(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[GenerationSession]:
        """Get failed generation sessions for analysis."""
        query = (
            select(GenerationSession)
            .where(GenerationSession.status == GenerationStatus.FAILED)
            .order_by(desc(GenerationSession.updated_at))
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_completed_sessions(
        self,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[GenerationSession]:
        """Get completed generation sessions."""
        query = (
            select(GenerationSession)
            .where(GenerationSession.status == GenerationStatus.COMPLETED)
            .order_by(desc(GenerationSession.completed_at))
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_recent_sessions(
        self,
        days: int = 7,
        limit: int = 50
    ) -> list[GenerationSession]:
        """Get recently created generation sessions."""
        from datetime import datetime, timedelta, timezone
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        query = (
            select(GenerationSession)
            .where(GenerationSession.created_at >= cutoff_date)
            .order_by(desc(GenerationSession.created_at))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_sessions_by_source_documents(
        self,
        source_document_ids: list[UUID],
        limit: int | None = None
    ) -> list[GenerationSession]:
        """Get generation sessions that used specific source documents."""
        from app.models.activity_source import ActivitySource
        
        query = (
            select(GenerationSession)
            .join(ActivitySource, GenerationSession.id == ActivitySource.generation_session_id)
            .where(ActivitySource.source_document_id.in_(source_document_ids))
            .distinct()
        )
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_generation_statistics(self) -> dict:
        """Get generation session statistics for analytics."""
        # Count by status
        status_counts = await self.session.execute(
            select(GenerationSession.status, func.count(GenerationSession.id))
            .group_by(GenerationSession.status)
        )
        
        # Total sessions
        total_sessions = await self.count_all()
        
        # Success rate
        completed_count = await self.session.execute(
            select(func.count(GenerationSession.id))
            .where(GenerationSession.status == GenerationStatus.COMPLETED)
        )
        
        failed_count = await self.session.execute(
            select(func.count(GenerationSession.id))
            .where(GenerationSession.status == GenerationStatus.FAILED)
        )
        
        # Average processing time for completed sessions
        avg_processing_time = await self.session.execute(
            select(func.avg(
                func.extract('epoch', GenerationSession.completed_at - GenerationSession.created_at)
            ))
            .where(
                and_(
                    GenerationSession.status == GenerationStatus.COMPLETED,
                    GenerationSession.completed_at.is_not(None)
                )
            )
        )
        
        completed = completed_count.scalar()
        failed = failed_count.scalar()
        total_finished = completed + failed
        success_rate = (completed / total_finished * 100) if total_finished > 0 else 0
        
        return {
            "total_sessions": total_sessions,
            "by_status": dict(status_counts.all()),
            "success_rate": round(success_rate, 2),
            "completed_sessions": completed,
            "failed_sessions": failed,
            "average_processing_time_seconds": float(avg_processing_time.scalar() or 0)
        }
    
    async def update_status(
        self,
        session_id: UUID,
        new_status: GenerationStatus,
        error_message: str | None = None,
        error_details: dict | None = None
    ) -> bool:
        """Update generation session status with optional error information."""
        update_data = {"status": new_status}
        
        if error_message is not None:
            update_data["error_message"] = error_message
        if error_details is not None:
            update_data["error_details"] = error_details
        if new_status == GenerationStatus.COMPLETED:
            update_data["completed_at"] = func.now()
            
        return await self.update_by_id(session_id, **update_data) is not None
    
    async def mark_as_processing(self, session_id: UUID) -> bool:
        """Mark session as processing."""
        return await self.update_status(session_id, GenerationStatus.PROCESSING)
    
    async def mark_as_completed(
        self,
        session_id: UUID,
        generated_content: dict | None = None,
        validated_nlj: dict | None = None
    ) -> bool:
        """Mark session as completed with generated content."""
        update_data = {
            "status": GenerationStatus.COMPLETED,
            "completed_at": func.now()
        }
        
        if generated_content is not None:
            update_data["generated_content"] = generated_content
        if validated_nlj is not None:
            update_data["validated_nlj"] = validated_nlj
            
        return await self.update_by_id(session_id, **update_data) is not None
    
    async def mark_as_failed(
        self,
        session_id: UUID,
        error_message: str,
        error_details: dict | None = None
    ) -> bool:
        """Mark session as failed with error information."""
        return await self.update_status(
            session_id,
            GenerationStatus.FAILED,
            error_message,
            error_details
        )
    
    async def cancel_session(self, session_id: UUID, user_id: UUID) -> bool:
        """Cancel a pending or processing session for a specific user."""
        session = await self.get_by_id(session_id)
        if not session or session.user_id != user_id:
            return False
            
        if session.status not in [GenerationStatus.PENDING, GenerationStatus.PROCESSING]:
            return False
            
        return await self.update_status(session_id, GenerationStatus.CANCELLED)
    
    async def cleanup_old_sessions(self, days_old: int = 30) -> int:
        """Clean up old completed/failed sessions older than specified days."""
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import delete
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        result = await self.session.execute(
            delete(GenerationSession)
            .where(
                and_(
                    GenerationSession.created_at < cutoff_date,
                    GenerationSession.status.in_([
                        GenerationStatus.COMPLETED,
                        GenerationStatus.FAILED,
                        GenerationStatus.CANCELLED
                    ])
                )
            )
        )
        
        return result.rowcount