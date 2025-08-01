"""
Generation service for Content Studio.
Manages AI content generation sessions with full lineage tracking.
"""

import uuid
import time
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.generation_session import GenerationSession, GenerationStatus
from app.models.source_document import SourceDocument
from app.models.activity_source import ActivitySource
from app.models.content import ContentItem, ContentType
from app.services.claude_service import claude_service
from app.services.source_document_service import SourceDocumentService


class GenerationService:
    """
    Service for managing AI content generation sessions.
    Handles the complete workflow from prompt configuration to activity creation.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.source_service = SourceDocumentService(db)
    
    async def create_generation_session(
        self,
        user_id: uuid.UUID,
        prompt_config: Dict[str, Any],
        source_document_ids: List[uuid.UUID]
    ) -> GenerationSession:
        """
        Create a new generation session.
        
        Args:
            user_id: ID of the user creating the session
            prompt_config: LLM prompt configuration
            source_document_ids: List of source document IDs to use
            
        Returns:
            Created GenerationSession instance
        """
        # Validate source documents exist and belong to user
        source_docs = []
        for doc_id in source_document_ids:
            doc = await self.source_service.get_document_by_id(doc_id, user_id)
            if doc:
                source_docs.append(doc)
        
        if not source_docs:
            raise ValueError("No valid source documents provided")
        
        # Create session
        session = GenerationSession(
            user_id=user_id,
            prompt_config=prompt_config,
            status=GenerationStatus.PENDING
        )
        
        # Add source documents
        session.source_documents = source_docs
        
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        return session
    
    async def start_generation(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """
        Start the generation process for a session.
        
        Args:
            session_id: Generation session ID
            user_id: User ID (for ownership validation)
            
        Returns:
            True if generation started successfully
        """
        # Get session with source documents
        query = select(GenerationSession).options(
            selectinload(GenerationSession.source_documents)
        ).where(
            and_(
                GenerationSession.id == session_id,
                GenerationSession.user_id == user_id,
                GenerationSession.status == GenerationStatus.PENDING
            )
        )
        
        result = await self.db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            return False
        
        try:
            # Mark as processing
            session.start_processing()
            await self.db.commit()
            
            # Ensure all source documents are uploaded to Claude
            claude_file_ids = []
            for source_doc in session.source_documents:
                if await self.source_service.ensure_claude_upload(source_doc):
                    claude_file_ids.append(source_doc.claude_file_id)
                    # Increment usage count
                    await self.source_service.increment_usage(source_doc.id, user_id)
            
            if not claude_file_ids:
                session.fail_with_error("Failed to upload source documents to Claude")
                await self.db.commit()
                return False
            
            # Generate prompt text from configuration
            prompt_text = self._build_prompt_from_config(session.prompt_config)
            
            # Call Claude API
            start_time = time.time()
            generated_content, error_message, tokens_used = await claude_service.generate_content(
                prompt_text=prompt_text,
                file_ids=claude_file_ids,
                model=session.prompt_config.get('model', 'claude-3-5-sonnet-20241022'),
                max_tokens=session.prompt_config.get('max_tokens', 8192),
                temperature=session.prompt_config.get('temperature', 0.1)
            )
            generation_time = time.time() - start_time
            
            if error_message:
                session.fail_with_error(error_message)
                await self.db.commit()
                return False
            
            if not generated_content:
                session.fail_with_error("No content generated by Claude")
                await self.db.commit()
                return False
            
            # Validate NLJ schema if JSON was generated
            validated_nlj = None
            validation_errors = None
            
            if 'generated_json' in generated_content:
                is_valid, errors = await claude_service.validate_nlj_schema(
                    generated_content['generated_json']
                )
                if is_valid:
                    validated_nlj = generated_content['generated_json']
                else:
                    validation_errors = errors
            
            # Complete the session
            session.complete_successfully(
                generated_content=generated_content,
                validated_nlj=validated_nlj,
                tokens_used=tokens_used,
                generation_time=generation_time
            )
            
            if validation_errors:
                session.validation_errors = validation_errors
            
            await self.db.commit()
            return True
            
        except Exception as e:
            session.fail_with_error(f"Generation error: {str(e)}")
            await self.db.commit()
            return False
    
    def _build_prompt_from_config(self, config: Dict[str, Any]) -> str:
        """
        Build prompt text from configuration.
        This uses the same logic as the existing LLMPromptGenerator.
        """
        # Import the existing prompt generation logic
        from frontend.shared.LLMPromptGenerator import generatePrompt  # This won't work as-is
        
        # For now, create a basic prompt - we'll integrate with the existing generator later
        prompt_parts = [
            "# NLJ Scenario Generation Request",
            "",
            f"**Audience**: {config.get('audiencePersona', 'General learners')}",
            f"**Learning Objective**: {config.get('learningObjective', 'Complete the learning activity')}",
            f"**Content Style**: {config.get('contentStyle', 'conversational')}",
            f"**Complexity Level**: {config.get('complexityLevel', 5)}/10",
            "",
            "Please generate a valid NLJ JSON scenario based on the provided source documents.",
            "Follow the NLJ schema requirements and include proper node types, links, and structure.",
            "",
            "Important:",
            "- Use HTML formatting instead of markdown",
            "- Include start and end nodes",
            "- Ensure all links reference existing node IDs",
            "- Validate the JSON structure before responding",
            "",
            "Return only valid JSON in the following format:",
            "```json",
            "{",
            '  "id": "unique-scenario-id",',
            '  "name": "Descriptive Scenario Name",',
            '  "nodes": [...],',
            '  "links": [...]',
            "}",
            "```"
        ]
        
        return "\n".join(prompt_parts)
    
    async def get_user_sessions(
        self,
        user_id: uuid.UUID,
        status: Optional[GenerationStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[GenerationSession], int]:
        """Get user's generation sessions with filtering."""
        query = select(GenerationSession).options(
            selectinload(GenerationSession.source_documents)
        ).where(GenerationSession.user_id == user_id)
        
        if status:
            query = query.where(GenerationSession.status == status)
        
        # Get total count
        count_query = query.with_only_columns(GenerationSession.id)
        count_result = await self.db.execute(count_query)
        total_count = len(count_result.fetchall())
        
        # Add pagination and ordering
        query = query.order_by(GenerationSession.created_at.desc())
        query = query.offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        sessions = list(result.scalars().all())
        
        return sessions, total_count
    
    async def get_session_by_id(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Optional[GenerationSession]:
        """Get generation session by ID with ownership validation."""
        query = select(GenerationSession).options(
            selectinload(GenerationSession.source_documents),
            selectinload(GenerationSession.created_activities)
        ).where(
            and_(
                GenerationSession.id == session_id,
                GenerationSession.user_id == user_id
            )
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def create_activity_from_session(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        description: Optional[str] = None
    ) -> Optional[ContentItem]:
        """
        Create an activity from a completed generation session.
        
        Args:
            session_id: Generation session ID
            user_id: User ID
            title: Activity title
            description: Optional activity description
            
        Returns:
            Created ContentItem or None if creation failed
        """
        session = await self.get_session_by_id(session_id, user_id)
        
        if not session or not session.has_valid_nlj():
            return None
        
        try:
            # Create the content item
            from app.services.content import ContentService
            from app.schemas.content import ContentCreate
            from app.models.content import ContentType
            
            content_service = ContentService(self.db)
            
            # Determine content type from NLJ data
            content_type = self._determine_content_type(session.validated_nlj)
            
            content_data = ContentCreate(
                title=title,
                description=description,
                content_type=content_type,
                nlj_data=session.validated_nlj
            )
            
            # Create the activity
            activity = await content_service.create_content(content_data, user_id)
            
            # Link to generation session
            activity.generation_session_id = session.id
            
            # Create source lineage records
            for source_doc in session.source_documents:
                lineage = ActivitySource(
                    activity_id=activity.id,
                    source_document_id=source_doc.id,
                    generation_session_id=session.id
                )
                self.db.add(lineage)
            
            await self.db.commit()
            await self.db.refresh(activity)
            
            return activity
            
        except Exception as e:
            print(f"Error creating activity from session: {e}")
            return None
    
    def _determine_content_type(self, nlj_data: Dict[str, Any]) -> ContentType:
        """Determine content type from NLJ data."""
        # Simple heuristic based on node types
        node_types = [node.get('type', '') for node in nlj_data.get('nodes', [])]
        
        if any('game' in nt or 'connections' in nt or 'wordle' in nt for nt in node_types):
            return ContentType.GAME
        elif any('survey' in nt or 'likert' in nt or 'rating' in nt for nt in node_types):
            return ContentType.SURVEY
        elif any('assessment' in nt or 'quiz' in nt for nt in node_types):
            return ContentType.ASSESSMENT
        else:
            return ContentType.TRAINING
    
    async def cancel_session(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Cancel a pending or processing generation session."""
        session = await self.get_session_by_id(session_id, user_id)
        
        if session and session.status in [GenerationStatus.PENDING, GenerationStatus.PROCESSING]:
            session.cancel()
            await self.db.commit()
            return True
        
        return False
    
    async def retry_failed_session(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Retry a failed generation session."""
        session = await self.get_session_by_id(session_id, user_id)
        
        if session and session.is_failed():
            # Reset session status
            session.status = GenerationStatus.PENDING
            session.error_message = None
            session.validation_errors = None
            session.started_at = None
            session.completed_at = None
            
            await self.db.commit()
            
            # Start generation again
            return await self.start_generation(session_id, user_id)
        
        return False
    
    async def get_session_statistics(self, user_id: uuid.UUID) -> Dict[str, Any]:
        """Get user's generation session statistics."""
        query = select(GenerationSession).where(GenerationSession.user_id == user_id)
        result = await self.db.execute(query)
        sessions = list(result.scalars().all())
        
        total_sessions = len(sessions)
        completed_sessions = len([s for s in sessions if s.is_completed()])
        failed_sessions = len([s for s in sessions if s.is_failed()])
        
        total_tokens = sum(s.total_tokens_used or 0 for s in sessions if s.total_tokens_used)
        avg_generation_time = None
        
        generation_times = [s.generation_time_seconds for s in sessions if s.generation_time_seconds]
        if generation_times:
            avg_generation_time = sum(generation_times) / len(generation_times)
        
        return {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "failed_sessions": failed_sessions,
            "success_rate": completed_sessions / total_sessions if total_sessions > 0 else 0,
            "total_tokens_used": total_tokens,
            "average_generation_time": avg_generation_time,
            "activities_created": len([s for s in sessions if s.created_activities])
        }