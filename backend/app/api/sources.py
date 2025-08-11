"""
Source library API endpoints for Content Studio.
Manages source document upload, conversion, and Claude integration.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.source_document import SourceDocument, FileType, ConversionStatus
from app.services.source_document_service import SourceDocumentService
from app.schemas.sources import (
    SourceDocumentResponse,
    SourceDocumentSummary,
    SourceDocumentListResponse,
    SourceDocumentUpdate,
    SourceDocumentCreate
)

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post(
    "/upload",
    response_model=SourceDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload source document",
    description="Upload a new source document for Content Studio. Supports PDF, DOCX, PPTX, and TXT files."
)
async def upload_source_document(
    file: UploadFile = File(..., description="Document file to upload"),
    description: Optional[str] = Form(None, description="Optional description"),
    tags: Optional[str] = Form(None, description="Comma-separated tags"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SourceDocumentResponse:
    """Upload a new source document."""
    
    # Permission check: Creators and above can upload
    if current_user.role not in [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to upload source documents"
        )
    
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required"
        )
    
    # Check file size (500MB limit per Claude API)
    content = await file.read()
    if len(content) > 500 * 1024 * 1024:  # 500MB
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 500MB limit"
        )
    
    # Check file type
    allowed_extensions = {'.pdf', '.docx', '.pptx', '.txt', '.doc', '.ppt'}
    file_extension = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Parse tags
        tag_list = []
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        
        # Create source document
        service = SourceDocumentService(db)
        source_doc = await service.create_source_document(
            file_content=content,
            original_filename=file.filename,
            user_id=current_user.id,
            description=description,
            tags=tag_list
        )
        
        # Convert to dict to avoid SQLAlchemy lazy loading issues
        doc_data = {
            "id": source_doc.id,
            "filename": source_doc.filename,
            "original_filename": source_doc.original_filename,
            "file_type": source_doc.file_type if isinstance(source_doc.file_type, str) else source_doc.file_type.value,
            "original_file_type": source_doc.original_file_type if isinstance(source_doc.original_file_type, str) else source_doc.original_file_type.value,
            "conversion_status": source_doc.conversion_status if isinstance(source_doc.conversion_status, str) else source_doc.conversion_status.value,
            "file_size": source_doc.file_size,
            "file_path": source_doc.file_path,
            "extracted_title": source_doc.extracted_title,
            "extracted_author": source_doc.extracted_author,
            "page_count": source_doc.page_count,
            "description": source_doc.description,
            "tags": source_doc.tags or [],
            "usage_count": source_doc.usage_count or 0,
            "last_used_at": source_doc.last_used_at,
            "claude_file_id": source_doc.claude_file_id,
            "uploaded_to_claude_at": source_doc.uploaded_to_claude_at,
            "expires_at": source_doc.expires_at,
            "created_at": source_doc.created_at,
            "updated_at": source_doc.updated_at,
            "conversion_error": source_doc.conversion_error,
            "user_id": source_doc.user_id
        }
        return SourceDocumentResponse(**doc_data)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.get(
    "/",
    response_model=SourceDocumentListResponse,
    summary="List source documents",
    description="Get paginated list of user's source documents with filtering."
)
async def list_source_documents(
    search: Optional[str] = Query(None, description="Search in filename, title, or description"),
    tags: Optional[str] = Query(None, description="Comma-separated list of tags to filter by"),
    file_types: Optional[str] = Query(None, description="Comma-separated list of file types"),
    limit: int = Query(50, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SourceDocumentListResponse:
    """List user's source documents with filtering."""
    
    try:
        # Parse filters
        tag_filter = None
        if tags:
            tag_filter = [tag.strip() for tag in tags.split(',') if tag.strip()]
        
        file_type_filter = None
        if file_types:
            file_type_filter = [ft.strip() for ft in file_types.split(',') if ft.strip()]
        
        service = SourceDocumentService(db)
        documents, total_count = await service.get_user_documents(
            user_id=current_user.id,
            search_query=search,
            tags=tag_filter,
            file_types=file_type_filter,
            limit=limit,
            offset=offset
        )
        
        # Convert to summary format
        document_summaries = [
            SourceDocumentSummary.model_validate(doc) for doc in documents
        ]
        
        return SourceDocumentListResponse(
            items=document_summaries,
            total=total_count,
            limit=limit,
            offset=offset
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list documents: {str(e)}"
        )


@router.get(
    "/{document_id}",
    response_model=SourceDocumentResponse,
    summary="Get source document",
    description="Get detailed information about a specific source document."
)
async def get_source_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SourceDocumentResponse:
    """Get source document by ID."""
    
    service = SourceDocumentService(db)
    document = await service.get_document_by_id(document_id, current_user.id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found"
        )
    
    return SourceDocumentResponse.model_validate(document)


@router.get(
    "/{document_id}/download",
    summary="Download source document",
    description="Download the source document file."
)
async def download_source_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download source document file."""
    
    service = SourceDocumentService(db)
    document = await service.get_document_by_id(document_id, current_user.id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found"
        )
    
    # Check if file exists
    import os
    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source file not found on disk"
        )
    
    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type='application/octet-stream'
    )


@router.put(
    "/{document_id}",
    response_model=SourceDocumentResponse,
    summary="Update source document",
    description="Update source document metadata (description and tags)."
)
async def update_source_document(
    document_id: uuid.UUID,
    update_data: SourceDocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SourceDocumentResponse:
    """Update source document metadata."""
    
    service = SourceDocumentService(db)
    document = await service.update_document_metadata(
        document_id=document_id,
        user_id=current_user.id,
        extracted_title=update_data.extracted_title,
        description=update_data.description,
        tags=update_data.tags
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found"
        )
    
    return SourceDocumentResponse.model_validate(document)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete source document",
    description="Delete a source document and clean up associated files."
)
async def delete_source_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete source document."""
    
    service = SourceDocumentService(db)
    success = await service.delete_document(document_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found"
        )


@router.post(
    "/{document_id}/upload-to-claude",
    response_model=SourceDocumentResponse,
    summary="Upload to Claude",
    description="Upload document to Claude Files API for content generation."
)
async def upload_to_claude(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SourceDocumentResponse:
    """Upload document to Claude Files API."""
    
    service = SourceDocumentService(db)
    document = await service.get_document_by_id(document_id, current_user.id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found"
        )
    
    success = await service.upload_to_claude(document)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document to Claude"
        )
    
    await db.refresh(document)
    return SourceDocumentResponse.model_validate(document)


@router.get(
    "/popular/",
    response_model=List[SourceDocumentSummary],
    summary="Get popular documents",
    description="Get user's most frequently used source documents."
)
async def get_popular_documents(
    limit: int = Query(10, ge=1, le=50, description="Number of documents to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[SourceDocumentSummary]:
    """Get popular source documents."""
    
    service = SourceDocumentService(db)
    documents = await service.get_popular_documents(current_user.id, limit)
    
    return [SourceDocumentSummary.model_validate(doc) for doc in documents]


@router.get(
    "/recent/",
    response_model=List[SourceDocumentSummary],
    summary="Get recent documents",
    description="Get user's most recently used source documents."
)
async def get_recent_documents(
    limit: int = Query(10, ge=1, le=50, description="Number of documents to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[SourceDocumentSummary]:
    """Get recently used source documents."""
    
    service = SourceDocumentService(db)
    documents = await service.get_recent_documents(current_user.id, limit)
    
    return [SourceDocumentSummary.model_validate(doc) for doc in documents]


@router.post(
    "/{document_id}/generate-summary",
    response_model=SourceDocumentResponse,
    summary="Generate document summary",
    description="Generate an AI-powered summary of the document using Claude."
)
async def generate_document_summary(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SourceDocumentResponse:
    """Generate document summary using Claude."""
    
    service = SourceDocumentService(db)
    document = await service.get_document_by_id(document_id, current_user.id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found"
        )
    
    try:
        # Generate summary using Claude
        summary = await service.generate_document_summary(document)
        
        if not summary:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate summary"
            )
        
        await db.refresh(document)
        return SourceDocumentResponse.model_validate(document)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {str(e)}"
        )


@router.post(
    "/cleanup-expired",
    response_model=dict,
    summary="Cleanup expired uploads",
    description="Clean up expired Claude file uploads. Admin only."
)
async def cleanup_expired_uploads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Clean up expired Claude uploads."""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    service = SourceDocumentService(db)
    cleaned_count = await service.cleanup_expired_uploads()
    
    return {"cleaned_count": cleaned_count, "message": f"Cleaned up {cleaned_count} expired uploads"}