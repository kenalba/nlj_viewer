"""
Source document service for Content Studio.
Manages the complete lifecycle of source documents from upload to Claude integration.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path

import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.models.source_document import SourceDocument, FileType, ConversionStatus
from app.models.user import User
from app.services.document_converter import document_converter, DocumentMetadata
from app.services.claude_service import claude_service
from app.core.config import settings


class SourceDocumentService:
    """
    Service for managing source documents in Content Studio.
    Handles upload, conversion, metadata extraction, and Claude integration.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.upload_dir = Path(settings.UPLOAD_DIR if hasattr(settings, 'UPLOAD_DIR') else '/tmp/nlj_uploads')
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    async def create_source_document(
        self,
        file_content: bytes,
        original_filename: str,
        user_id: uuid.UUID,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> SourceDocument:
        """
        Create a new source document from uploaded file content.
        
        Args:
            file_content: Raw file content
            original_filename: Original filename
            user_id: ID of the uploading user
            description: Optional description
            tags: Optional list of tags
            
        Returns:
            Created SourceDocument instance
        """
        # Generate unique filename to avoid conflicts
        file_id = uuid.uuid4()
        file_extension = Path(original_filename).suffix
        local_filename = f"{file_id}{file_extension}"
        local_path = self.upload_dir / local_filename
        
        # Save file to local storage
        async with aiofiles.open(local_path, 'wb') as f:
            await f.write(file_content)
        
        # Detect file type
        file_type = await document_converter.detect_file_type(str(local_path))
        original_file_type = file_type
        
        # Extract metadata
        metadata = await document_converter.extract_metadata(str(local_path), file_type)
        
        # Create database record
        source_doc = SourceDocument(
            filename=local_filename,
            original_filename=original_filename,
            file_type=FileType(file_type) if file_type in [ft.value for ft in FileType] else FileType.PDF,
            original_file_type=FileType(original_file_type) if original_file_type in [ft.value for ft in FileType] else FileType.PDF,
            conversion_status=ConversionStatus.PENDING if file_type != "pdf" else ConversionStatus.NOT_REQUIRED,
            file_size=len(file_content),
            file_path=str(local_path),
            extracted_title=metadata.title,
            extracted_author=metadata.author,
            page_count=metadata.page_count,
            description=description,
            tags=tags or [],
            user_id=user_id
        )
        
        self.db.add(source_doc)
        await self.db.commit()
        await self.db.refresh(source_doc)
        
        # Skip conversion for now to test basic upload
        # if source_doc.conversion_status == ConversionStatus.PENDING:
        #     await self._convert_document(source_doc)
        
        return source_doc
    
    async def _convert_document(self, source_doc: SourceDocument) -> bool:
        """
        Convert document to PDF format if needed.
        
        Args:
            source_doc: SourceDocument to convert
            
        Returns:
            True if conversion was successful or not needed
        """
        try:
            source_doc.conversion_status = ConversionStatus.CONVERTING
            await self.db.commit()
            
            # Attempt conversion
            file_type_str = source_doc.original_file_type if isinstance(source_doc.original_file_type, str) else source_doc.original_file_type.value
            converted_path = await document_converter.convert_to_pdf(
                source_doc.file_path, 
                file_type_str
            )
            
            if converted_path and converted_path != source_doc.file_path:
                # Update document record with converted file
                source_doc.file_path = converted_path
                source_doc.filename = Path(converted_path).name
                source_doc.file_type = FileType.PDF
                source_doc.conversion_status = ConversionStatus.CONVERTED
                
                # Extract metadata from converted PDF
                metadata = await document_converter.extract_metadata(converted_path, "pdf")
                if metadata.page_count:
                    source_doc.page_count = metadata.page_count
                
                # Update file size using async file operations
                async with aiofiles.open(converted_path, 'rb') as f:
                    await f.seek(0, 2)  # Seek to end
                    source_doc.file_size = await f.tell()
                
            elif source_doc.original_file_type == FileType.PDF:
                source_doc.conversion_status = ConversionStatus.NOT_REQUIRED
            else:
                source_doc.conversion_status = ConversionStatus.FAILED
                source_doc.conversion_error = "Conversion tools not available"
            
            await self.db.commit()
            return source_doc.conversion_status in [ConversionStatus.CONVERTED, ConversionStatus.NOT_REQUIRED]
            
        except Exception as e:
            source_doc.conversion_status = ConversionStatus.FAILED
            source_doc.conversion_error = str(e)
            await self.db.commit()
            return False
    
    async def upload_to_claude(self, source_doc: SourceDocument) -> bool:
        """
        Upload document to Claude Files API.
        
        Args:
            source_doc: SourceDocument to upload
            
        Returns:
            True if upload was successful
        """
        try:
            # Make sure document is converted if needed
            if source_doc.conversion_status == ConversionStatus.PENDING:
                await self._convert_document(source_doc)
            
            if source_doc.conversion_status == ConversionStatus.FAILED:
                return False
            
            # Upload to Claude
            file_object = await claude_service.upload_file(
                source_doc.file_path,
                source_doc.original_filename
            )
            
            if file_object:
                source_doc.claude_file_id = file_object.id
                source_doc.uploaded_to_claude_at = datetime.now(timezone.utc)
                # Files expire after 24 hours according to Claude documentation
                source_doc.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
                await self.db.commit()
                return True
            
        except Exception as e:
            print(f"Error uploading to Claude: {e}")
        
        return False
    
    async def ensure_claude_upload(self, source_doc: SourceDocument) -> bool:
        """
        Ensure document is uploaded to Claude and not expired.
        
        Args:
            source_doc: SourceDocument to check/upload
            
        Returns:
            True if document is available in Claude
        """
        if source_doc.needs_reupload():
            return await self.upload_to_claude(source_doc)
        return True
    
    async def get_user_documents(
        self,
        user_id: uuid.UUID,
        search_query: Optional[str] = None,
        tags: Optional[List[str]] = None,
        file_types: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[SourceDocument], int]:
        """
        Get user's source documents with filtering.
        
        Args:
            user_id: User ID
            search_query: Optional search in filename/title/description
            tags: Optional tag filter
            file_types: Optional file type filter
            limit: Results limit
            offset: Results offset
            
        Returns:
            Tuple of (documents, total_count)
        """
        # Build query
        query = select(SourceDocument).where(SourceDocument.user_id == user_id)
        
        # Add search filter
        if search_query:
            search_term = f"%{search_query}%"
            query = query.where(
                or_(
                    SourceDocument.filename.ilike(search_term),
                    SourceDocument.original_filename.ilike(search_term),
                    SourceDocument.extracted_title.ilike(search_term),
                    SourceDocument.description.ilike(search_term)
                )
            )
        
        # Add tag filter
        if tags:
            query = query.where(SourceDocument.tags.op('&&')(tags))
        
        # Add file type filter
        if file_types:
            query = query.where(SourceDocument.file_type.in_(file_types))
        
        # Get total count
        count_query = query.with_only_columns(SourceDocument.id)
        count_result = await self.db.execute(count_query)
        total_count = len(count_result.fetchall())
        
        # Add ordering and pagination
        query = query.order_by(SourceDocument.created_at.desc())
        query = query.offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        documents = result.scalars().all()
        
        return list(documents), total_count
    
    async def get_document_by_id(self, document_id: uuid.UUID, user_id: uuid.UUID) -> Optional[SourceDocument]:
        """Get source document by ID, ensuring user ownership."""
        query = select(SourceDocument).where(
            and_(
                SourceDocument.id == document_id,
                SourceDocument.user_id == user_id
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def update_document_metadata(
        self,
        document_id: uuid.UUID,
        user_id: uuid.UUID,
        extracted_title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Optional[SourceDocument]:
        """Update document metadata."""
        document = await self.get_document_by_id(document_id, user_id)
        if not document:
            return None
        
        if extracted_title is not None:
            document.extracted_title = extracted_title
        if description is not None:
            document.description = description
        if tags is not None:
            document.tags = tags
        
        await self.db.commit()
        await self.db.refresh(document)
        return document
    
    async def delete_document(self, document_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete source document and clean up files."""
        document = await self.get_document_by_id(document_id, user_id)
        if not document:
            return False
        
        try:
            # Delete from Claude if uploaded
            if document.claude_file_id:
                await claude_service.delete_file(document.claude_file_id)
            
            # Delete local files
            if os.path.exists(document.file_path):
                os.unlink(document.file_path)
            
            # Clean up any temporary conversion files
            document_converter.cleanup_temp_file(document.file_path)
            
            # Delete from database - use proper SQLAlchemy syntax
            from sqlalchemy import delete as sql_delete
            delete_stmt = sql_delete(SourceDocument).where(SourceDocument.id == document.id)
            await self.db.execute(delete_stmt)
            await self.db.commit()
            
            print(f"Successfully deleted document {document.id}")
            return True
            
        except Exception as e:
            print(f"Error deleting document: {e}")
            import traceback
            traceback.print_exc()
            await self.db.rollback()
            return False
    
    async def increment_usage(self, document_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Increment usage count for a document."""
        document = await self.get_document_by_id(document_id, user_id)
        if document:
            document.increment_usage()
            await self.db.commit()
            return True
        return False
    
    async def get_popular_documents(self, user_id: uuid.UUID, limit: int = 10) -> List[SourceDocument]:
        """Get user's most frequently used documents."""
        query = select(SourceDocument).where(
            SourceDocument.user_id == user_id
        ).order_by(
            SourceDocument.usage_count.desc(),
            SourceDocument.last_used_at.desc()
        ).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_recent_documents(self, user_id: uuid.UUID, limit: int = 10) -> List[SourceDocument]:
        """Get user's most recently used documents."""
        query = select(SourceDocument).where(
            and_(
                SourceDocument.user_id == user_id,
                SourceDocument.last_used_at.is_not(None)
            )
        ).order_by(
            SourceDocument.last_used_at.desc()
        ).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def cleanup_expired_uploads(self) -> int:
        """Clean up expired Claude uploads and optionally re-upload."""
        query = select(SourceDocument).where(
            and_(
                SourceDocument.expires_at.is_not(None),
                SourceDocument.expires_at < datetime.now(timezone.utc)
            )
        )
        
        result = await self.db.execute(query)
        expired_docs = result.scalars().all()
        
        cleaned_count = 0
        for doc in expired_docs:
            doc.claude_file_id = None
            doc.uploaded_to_claude_at = None
            doc.expires_at = None
            cleaned_count += 1
        
        if cleaned_count > 0:
            await self.db.commit()
        
        return cleaned_count
    
    async def generate_document_summary(self, document: SourceDocument) -> Optional[str]:
        """
        Generate an AI-powered summary of the document using Claude.
        
        Args:
            document: Source document to summarize
            
        Returns:
            Generated summary text or None if failed
        """
        try:
            print(f"Starting summary generation for document: {document.id}")
            print(f"Document has Claude file ID: {document.claude_file_id}")
            
            # Ensure document is uploaded to Claude
            if not document.claude_file_id:
                print("Document not uploaded to Claude, uploading now...")
                success = await self.upload_to_claude(document)
                if not success:
                    print("Failed to upload document to Claude")
                    return None
                print(f"Successfully uploaded to Claude, file ID: {document.claude_file_id}")
            
            # Generate comprehensive metadata using Claude Messages API with prefilling
            prompt = """Please analyze this document and provide comprehensive metadata in the following JSON format. All fields are optional - only include them if you can determine the information from the content:

{
  "summary": "A concise 150-200 word summary focusing on main topics, key information, purpose, and conclusions",
  "keywords": ["array", "of", "key", "terms", "and", "concepts"],
  "learning_objectives": ["What learners could achieve", "after studying this content"],
  "content_type_classification": "training|reference|process|policy|guide|manual|presentation|report|other",
  "difficulty_level": "beginner|intermediate|advanced",
  "estimated_reading_time": 15,
  "key_concepts": ["Main ideas that", "could become quiz questions"],
  "target_audience": "Who this content is intended for",
  "subject_matter_areas": ["sales", "technical", "compliance", "etc"],
  "actionable_items": ["Specific steps", "that could become scenarios"],
  "assessment_opportunities": ["What could be tested", "from this content"],
  "content_gaps": ["What additional info", "might be needed"]
}

Analyze the document thoroughly and provide only valid JSON with the fields you can determine. Focus on making this metadata useful for creating training content and learning activities."""

            print("Calling Claude API for comprehensive metadata generation...")
            response = await claude_service.generate_content_with_file_and_prefill(
                file_id=document.claude_file_id,
                prompt=prompt,
                prefill="{"
            )
            
            print(f"Claude API response: {response[:200] if response else 'None'}...")
            
            if response:
                # With prefilling, the response should be clean JSON
                try:
                    import json
                    print(f"Attempting to parse JSON response: {response[:200]}...")
                    metadata = json.loads(response)
                    print(f"Successfully parsed JSON with {len(metadata)} fields")
                    
                    # Update document with all available metadata
                    if 'summary' in metadata:
                        document.summary = metadata['summary']
                        print(f"Updated summary: {len(metadata['summary'])} characters")
                    if 'keywords' in metadata:
                        document.keywords = metadata['keywords']
                        print(f"Updated keywords: {len(metadata['keywords'])} items")
                    if 'learning_objectives' in metadata:
                        document.learning_objectives = metadata['learning_objectives']
                        print(f"Updated learning objectives: {len(metadata['learning_objectives'])} items")
                    if 'content_type_classification' in metadata:
                        document.content_type_classification = metadata['content_type_classification']
                        print(f"Updated content type: {metadata['content_type_classification']}")
                    if 'difficulty_level' in metadata:
                        document.difficulty_level = metadata['difficulty_level']
                        print(f"Updated difficulty level: {metadata['difficulty_level']}")
                    if 'estimated_reading_time' in metadata:
                        document.estimated_reading_time = metadata['estimated_reading_time']
                        print(f"Updated reading time: {metadata['estimated_reading_time']} minutes")
                    if 'key_concepts' in metadata:
                        document.key_concepts = metadata['key_concepts']
                        print(f"Updated key concepts: {len(metadata['key_concepts'])} items")
                    if 'target_audience' in metadata:
                        document.target_audience = metadata['target_audience']
                        print(f"Updated target audience: {metadata['target_audience']}")
                    if 'subject_matter_areas' in metadata:
                        document.subject_matter_areas = metadata['subject_matter_areas']
                        print(f"Updated subject areas: {len(metadata['subject_matter_areas'])} items")
                    if 'actionable_items' in metadata:
                        document.actionable_items = metadata['actionable_items']
                        print(f"Updated actionable items: {len(metadata['actionable_items'])} items")
                    if 'assessment_opportunities' in metadata:
                        document.assessment_opportunities = metadata['assessment_opportunities']
                        print(f"Updated assessment opportunities: {len(metadata['assessment_opportunities'])} items")
                    if 'content_gaps' in metadata:
                        document.content_gaps = metadata['content_gaps']
                        print(f"Updated content gaps: {len(metadata['content_gaps'])} items")
                    
                    document.updated_at = datetime.now(timezone.utc)
                    await self.db.commit()
                    print("Comprehensive metadata saved to database successfully")
                    
                    return metadata.get('summary', 'Metadata generated successfully')
                    
                except json.JSONDecodeError as e:
                    print(f"Failed to parse JSON response: {e}")
                    print(f"Raw response (first 500 chars): {response[:500]}")
                    print(f"Response type: {type(response)}")
                    
                    # Try to extract JSON from markdown if prefilling didn't work as expected
                    import re
                    json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
                    if json_match:
                        try:
                            json_content = json_match.group(1)
                            print(f"Found JSON in markdown block, attempting to parse...")
                            metadata = json.loads(json_content)
                            
                            # Apply the same metadata updates as above
                            if 'summary' in metadata:
                                document.summary = metadata['summary']
                            if 'keywords' in metadata:
                                document.keywords = metadata['keywords']
                            if 'learning_objectives' in metadata:
                                document.learning_objectives = metadata['learning_objectives']
                            if 'content_type_classification' in metadata:
                                document.content_type_classification = metadata['content_type_classification']
                            if 'difficulty_level' in metadata:
                                document.difficulty_level = metadata['difficulty_level']
                            if 'estimated_reading_time' in metadata:
                                document.estimated_reading_time = metadata['estimated_reading_time']
                            if 'key_concepts' in metadata:
                                document.key_concepts = metadata['key_concepts']
                            if 'target_audience' in metadata:
                                document.target_audience = metadata['target_audience']
                            if 'subject_matter_areas' in metadata:
                                document.subject_matter_areas = metadata['subject_matter_areas']
                            if 'actionable_items' in metadata:
                                document.actionable_items = metadata['actionable_items']
                            if 'assessment_opportunities' in metadata:
                                document.assessment_opportunities = metadata['assessment_opportunities']
                            if 'content_gaps' in metadata:
                                document.content_gaps = metadata['content_gaps']
                            
                            document.updated_at = datetime.now(timezone.utc)
                            await self.db.commit()
                            print("Metadata extracted from markdown and saved successfully")
                            
                            return metadata.get('summary', 'Metadata generated successfully')
                            
                        except json.JSONDecodeError as markdown_error:
                            print(f"Failed to parse JSON from markdown: {markdown_error}")
                    
                    # Final fallback: save the response as summary if it looks like meaningful text
                    if len(response) > 50:  # Reasonable summary length
                        document.summary = response
                        document.updated_at = datetime.now(timezone.utc)
                        await self.db.commit()
                        print("Saved response as summary (JSON parsing failed)")
                        return response
                
            return None
            
        except Exception as e:
            print(f"Error generating summary: {e}")
            import traceback
            traceback.print_exc()
            return None