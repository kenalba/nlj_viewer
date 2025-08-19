"""
Knowledge Extraction API - Endpoints for metadata extraction and taxonomy management.

Provides REST endpoints for:
- Extracting metadata from content
- Managing learning objectives and keywords taxonomy
- Viewing normalization results and confidence scores
- Manual override and quality assurance workflows
"""

import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.core.database_manager import get_db
from app.models.user import User
from app.models.learning_objective import LearningObjective, Keyword
from app.models.node import Node
from app.models.content import ContentItem
from app.services.knowledge_extraction_service import KnowledgeExtractionService, ExtractedMetadata
from app.utils.permissions import can_edit_content
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/api/knowledge", tags=["knowledge-extraction"])


# Pydantic models
class ExtractMetadataRequest(BaseModel):
    content: str = Field(..., description="Content to analyze")
    content_type: str = Field(default="unknown", description="Type of content")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context")


class ExtractMetadataResponse(BaseModel):
    learning_objectives: List[str]
    keywords: List[str]
    domain: Optional[str]
    difficulty_level: Optional[int]
    cognitive_levels: List[str]
    confidence_score: float
    content_hash: str


class NormalizedTermResponse(BaseModel):
    canonical_term: str
    original_term: str
    similarity_score: float
    action_taken: str


class NormalizeMetadataRequest(BaseModel):
    learning_objectives: List[str]
    keywords: List[str]
    domain: Optional[str] = None
    difficulty_level: Optional[int] = None
    content_id: Optional[uuid.UUID] = None
    node_id: Optional[uuid.UUID] = None
    auto_apply: bool = True


class NormalizeMetadataResponse(BaseModel):
    learning_objectives: List[NormalizedTermResponse]
    keywords: List[NormalizedTermResponse]


class LearningObjectiveResponse(BaseModel):
    id: str
    objective_text: str
    domain: Optional[str]
    cognitive_level: Optional[str]
    difficulty_level: Optional[int]
    usage_count: int
    created_at: str
    node_count: int


class KeywordResponse(BaseModel):
    id: str
    keyword_text: str
    domain: Optional[str]
    category: Optional[str]
    usage_count: int
    created_at: str
    node_count: int


class TaxonomyStatsResponse(BaseModel):
    total_objectives: int
    total_keywords: int
    objectives_by_domain: Dict[str, int]
    keywords_by_domain: Dict[str, int]
    objectives_by_cognitive_level: Dict[str, int]
    keywords_by_category: Dict[str, int]


@router.post("/extract", response_model=ExtractMetadataResponse)
async def extract_metadata(
    request: ExtractMetadataRequest,
    current_user: User = Depends(get_current_user)
):
    """Extract learning objectives and keywords from content using LLM."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        service = KnowledgeExtractionService()
        
        extracted = await service.extract_content_metadata(
            content=request.content,
            content_type=request.content_type,
            context=request.context
        )
        
        return ExtractMetadataResponse(
            learning_objectives=extracted.learning_objectives,
            keywords=extracted.keywords,
            domain=extracted.domain,
            difficulty_level=extracted.difficulty_level,
            cognitive_levels=extracted.cognitive_levels,
            confidence_score=extracted.confidence_score,
            content_hash=extracted.content_hash
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/normalize", response_model=NormalizeMetadataResponse)
async def normalize_metadata(
    request: NormalizeMetadataRequest,
    current_user: User = Depends(get_current_user)
):
    """Normalize extracted metadata against existing taxonomy."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        service = KnowledgeExtractionService()
        
        # Create ExtractedMetadata object
        extracted = ExtractedMetadata(
            learning_objectives=request.learning_objectives,
            keywords=request.keywords,
            domain=request.domain,
            difficulty_level=request.difficulty_level or 3,
            cognitive_levels=['understand'],  # Default
            confidence_score=1.0,  # Manual input assumed high confidence
            content_hash="manual",
            raw_llm_response={}
        )
        
        normalized = await service.normalize_and_store_metadata(
            extracted=extracted,
            content_id=request.content_id,
            node_id=request.node_id,
            auto_apply=request.auto_apply
        )
        
        return NormalizeMetadataResponse(
            learning_objectives=[
                NormalizedTermResponse(
                    canonical_term=term.canonical_term,
                    original_term=term.original_term,
                    similarity_score=term.similarity_score,
                    action_taken=term.action_taken
                ) for term in normalized['learning_objectives']
            ],
            keywords=[
                NormalizedTermResponse(
                    canonical_term=term.canonical_term,
                    original_term=term.original_term,
                    similarity_score=term.similarity_score,
                    action_taken=term.action_taken
                ) for term in normalized['keywords']
            ]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Normalization failed: {str(e)}")


@router.get("/objectives", response_model=List[LearningObjectiveResponse])
async def list_learning_objectives(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    cognitive_level: Optional[str] = Query(None, description="Filter by cognitive level"),
    min_usage: Optional[int] = Query(None, description="Minimum usage count"),
    limit: int = Query(100, le=1000, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Results offset"),
    session: AsyncSession = Depends(get_db)
):
    """List learning objectives with optional filtering."""
    try:
        stmt = select(LearningObjective).options(
            selectinload(LearningObjective.node_relationships)
        )
        
        if domain:
            stmt = stmt.where(LearningObjective.domain == domain)
        if cognitive_level:
            stmt = stmt.where(LearningObjective.cognitive_level == cognitive_level)
        if min_usage:
            stmt = stmt.where(LearningObjective.usage_count >= min_usage)
        
        stmt = stmt.order_by(LearningObjective.usage_count.desc()).offset(offset).limit(limit)
        
        result = await session.execute(stmt)
        objectives = result.scalars().all()
        
        return [
            LearningObjectiveResponse(
                id=str(obj.id),
                objective_text=obj.objective_text,
                domain=obj.domain,
                cognitive_level=obj.cognitive_level,
                difficulty_level=obj.difficulty_level,
                usage_count=obj.usage_count,
                created_at=obj.created_at.isoformat(),
                node_count=len(obj.node_relationships)
            ) for obj in objectives
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list objectives: {str(e)}")


@router.get("/keywords", response_model=List[KeywordResponse])
async def list_keywords(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    category: Optional[str] = Query(None, description="Filter by category"),
    min_usage: Optional[int] = Query(None, description="Minimum usage count"),
    limit: int = Query(100, le=1000, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Results offset"),
    session: AsyncSession = Depends(get_db)
):
    """List keywords with optional filtering."""
    try:
        stmt = select(Keyword).options(
            selectinload(Keyword.node_relationships)
        )
        
        if domain:
            stmt = stmt.where(Keyword.domain == domain)
        if category:
            stmt = stmt.where(Keyword.category == category)
        if min_usage:
            stmt = stmt.where(Keyword.usage_count >= min_usage)
        
        stmt = stmt.order_by(Keyword.usage_count.desc()).offset(offset).limit(limit)
        
        result = await session.execute(stmt)
        keywords = result.scalars().all()
        
        return [
            KeywordResponse(
                id=str(kw.id),
                keyword_text=kw.keyword_text,
                domain=kw.domain,
                category=kw.category,
                usage_count=kw.usage_count,
                created_at=kw.created_at.isoformat(),
                node_count=len(kw.node_relationships)
            ) for kw in keywords
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list keywords: {str(e)}")


@router.get("/taxonomy/stats", response_model=TaxonomyStatsResponse)
async def get_taxonomy_stats(session: AsyncSession = Depends(get_db)):
    """Get statistics about the knowledge taxonomy."""
    try:
        # Count objectives
        obj_count_result = await session.execute(select(func.count(LearningObjective.id)))
        total_objectives = obj_count_result.scalar()
        
        # Count keywords
        kw_count_result = await session.execute(select(func.count(Keyword.id)))
        total_keywords = kw_count_result.scalar()
        
        # Objectives by domain
        obj_domain_result = await session.execute(
            select(LearningObjective.domain, func.count(LearningObjective.id))
            .group_by(LearningObjective.domain)
        )
        objectives_by_domain = {
            domain or 'unclassified': count 
            for domain, count in obj_domain_result.fetchall()
        }
        
        # Keywords by domain
        kw_domain_result = await session.execute(
            select(Keyword.domain, func.count(Keyword.id))
            .group_by(Keyword.domain)
        )
        keywords_by_domain = {
            domain or 'unclassified': count 
            for domain, count in kw_domain_result.fetchall()
        }
        
        # Objectives by cognitive level
        obj_cognitive_result = await session.execute(
            select(LearningObjective.cognitive_level, func.count(LearningObjective.id))
            .group_by(LearningObjective.cognitive_level)
        )
        objectives_by_cognitive_level = {
            level or 'unclassified': count 
            for level, count in obj_cognitive_result.fetchall()
        }
        
        # Keywords by category
        kw_category_result = await session.execute(
            select(Keyword.category, func.count(Keyword.id))
            .group_by(Keyword.category)
        )
        keywords_by_category = {
            category or 'unclassified': count 
            for category, count in kw_category_result.fetchall()
        }
        
        return TaxonomyStatsResponse(
            total_objectives=total_objectives,
            total_keywords=total_keywords,
            objectives_by_domain=objectives_by_domain,
            keywords_by_domain=keywords_by_domain,
            objectives_by_cognitive_level=objectives_by_cognitive_level,
            keywords_by_category=keywords_by_category
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.post("/nodes/{node_id}/extract")
async def extract_node_metadata(
    node_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Extract and normalize metadata for a specific node using event-driven processing."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Verify node exists
    stmt = select(Node).where(Node.id == node_id)
    result = await session.execute(stmt)
    node = result.scalar_one_or_none()
    
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # Generate extraction ID and publish start event
    extraction_id = str(uuid.uuid4())
    
    # Get event service and publish start event
    from app.services.kafka_service import get_xapi_event_service
    event_service = get_xapi_event_service()
    
    await event_service.publish_knowledge_extraction_started(
        extraction_id=extraction_id,
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_name=current_user.full_name or current_user.username,
        extraction_type="node",
        target_id=str(node_id),
        target_count=1
    )
    
    # The actual processing will be handled by event consumers
    # This follows the same pattern as content generation
    
    return {
        "extraction_id": extraction_id,
        "message": f"Metadata extraction started for node {node_id}",
        "status": "started"
    }


@router.post("/activities/{activity_id}/extract")
async def extract_activity_metadata(
    activity_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Extract and normalize metadata for an entire activity using event-driven processing."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Verify activity exists
    stmt = select(ContentItem).where(ContentItem.id == activity_id)
    result = await session.execute(stmt)
    activity = result.scalar_one_or_none()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Generate extraction ID and publish start event
    extraction_id = str(uuid.uuid4())
    
    # Get event service and publish start event
    from app.services.kafka_service import get_xapi_event_service
    event_service = get_xapi_event_service()
    
    await event_service.publish_knowledge_extraction_started(
        extraction_id=extraction_id,
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_name=current_user.full_name or current_user.username,
        extraction_type="activity",
        target_id=str(activity_id),
        target_count=1
    )
    
    return {
        "extraction_id": extraction_id,
        "message": f"Metadata extraction started for activity {activity_id}",
        "status": "started"
    }


@router.post("/bulk/extract")
async def extract_bulk_metadata(
    extraction_type: str = Query(..., description="Type: 'all_nodes', 'all_activities', or 'mixed'"),
    limit: Optional[int] = Query(None, description="Limit number of items to process"),
    current_user: User = Depends(get_current_user)
):
    """Start bulk metadata extraction for multiple items using event-driven processing."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    if extraction_type not in ['all_nodes', 'all_activities', 'mixed']:
        raise HTTPException(status_code=400, detail="Invalid extraction_type")
    
    # Generate extraction ID
    extraction_id = str(uuid.uuid4())
    
    # Estimate target count (this could be more precise with actual counts)
    estimated_count = limit or 1000  # Default estimate
    
    # Get event service and publish start event
    from app.services.kafka_service import get_xapi_event_service
    event_service = get_xapi_event_service()
    
    await event_service.publish_knowledge_extraction_started(
        extraction_id=extraction_id,
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_name=current_user.full_name or current_user.username,
        extraction_type="bulk",
        target_id=extraction_type,
        target_count=estimated_count
    )
    
    return {
        "extraction_id": extraction_id,
        "message": f"Bulk metadata extraction started for {extraction_type}",
        "status": "started",
        "extraction_type": extraction_type,
        "estimated_count": estimated_count
    }


@router.get("/extractions/{extraction_id}/status")
async def get_extraction_status(
    extraction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get the status of a knowledge extraction process."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # In a real implementation, this would query the extraction status
    # from a database or cache that's updated by event consumers
    # For now, return a placeholder response
    
    return {
        "extraction_id": extraction_id,
        "status": "in_progress",
        "progress_percentage": 50,
        "current_step": "Processing nodes",
        "items_processed": 25,
        "items_total": 50,
        "objectives_extracted": 75,
        "keywords_extracted": 150
    }