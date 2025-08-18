"""
Node Tagging API - Manual tagging endpoints and quality assurance tools.

Provides REST endpoints for:
- Manual tagging operations and overrides
- Quality assurance and review workflows
- Auto-tagging suggestions and approvals
- Batch tagging operations
"""

import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.deps import get_current_user
from app.core.database_manager import get_db
from app.models.user import User
from app.models.learning_objective import LearningObjective, Keyword, NodeLearningObjective, NodeKeyword
from app.models.node import Node
from app.services.node_auto_tagger import NodeAutoTaggerService, TaggingStrategy, TaggingQuality, AutoTaggingConfig
from app.utils.concept_analyzer import ConceptAnalyzer
from app.utils.permissions import can_edit_content, can_review_content
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/api/nodes", tags=["node-tagging"])


# Pydantic models
class ManualTagRequest(BaseModel):
    objective_ids: Optional[List[uuid.UUID]] = Field(default=[], description="Learning objective IDs to add")
    keyword_ids: Optional[List[uuid.UUID]] = Field(default=[], description="Keyword IDs to add")
    remove_objective_ids: Optional[List[uuid.UUID]] = Field(default=[], description="Objective IDs to remove")
    remove_keyword_ids: Optional[List[uuid.UUID]] = Field(default=[], description="Keyword IDs to remove")
    relevance_overrides: Optional[Dict[str, float]] = Field(default={}, description="Override relevance scores")
    

class AutoTagRequest(BaseModel):
    strategy: Optional[TaggingStrategy] = Field(default=TaggingStrategy.BALANCED, description="Auto-tagging strategy")
    force_retag: bool = Field(default=False, description="Re-tag even if already tagged")
    

class BatchAutoTagRequest(BaseModel):
    node_ids: List[uuid.UUID] = Field(..., description="Nodes to auto-tag")
    strategy: Optional[TaggingStrategy] = Field(default=TaggingStrategy.BALANCED)
    force_retag: bool = Field(default=False)


class SuggestionApprovalRequest(BaseModel):
    approved_objectives: List[Dict[str, Any]] = Field(default=[], description="Approved objective suggestions")
    approved_keywords: List[Dict[str, Any]] = Field(default=[], description="Approved keyword suggestions")
    rejected_items: List[str] = Field(default=[], description="Rejected suggestion IDs")


class TaggingResultResponse(BaseModel):
    node_id: str
    strategy_used: str
    overall_quality: str
    confidence_score: float
    objectives_added: List[Dict[str, Any]]
    keywords_added: List[Dict[str, Any]]
    objectives_suggested: List[Dict[str, Any]]
    keywords_suggested: List[Dict[str, Any]]
    processing_time: float
    analysis_metadata: Dict[str, Any]


class NodeTagSummaryResponse(BaseModel):
    node_id: str
    node_type: str
    title: Optional[str]
    current_tags: Dict[str, Any]
    auto_tag_suggestions: Dict[str, Any]
    quality_assessment: Dict[str, Any]
    last_tagged: Optional[str]


class TaggingCandidatesResponse(BaseModel):
    candidates: List[Dict[str, Any]]
    total_untagged: int
    recommended_batch_size: int


@router.post("/{node_id}/tags", response_model=Dict[str, Any])
async def add_manual_tags(
    node_id: uuid.UUID,
    request: ManualTagRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Manually add or remove tags from a node."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Verify node exists
        stmt = select(Node).where(Node.id == node_id)
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        changes_made = {
            "objectives_added": [],
            "keywords_added": [],
            "objectives_removed": [],
            "keywords_removed": []
        }
        
        # Add new objective tags
        for obj_id in request.objective_ids:
            # Check if relationship already exists
            existing = await session.execute(
                select(NodeLearningObjective).where(
                    and_(
                        NodeLearningObjective.node_id == node_id,
                        NodeLearningObjective.objective_id == obj_id
                    )
                )
            )
            
            if not existing.scalar_one_or_none():
                relevance = request.relevance_overrides.get(str(obj_id), 1.0)
                
                relationship = NodeLearningObjective(
                    node_id=node_id,
                    objective_id=obj_id,
                    relevance_score=relevance,
                    auto_tagged=False,
                    tagged_by=current_user.id
                )
                session.add(relationship)
                
                # Get objective text for response
                obj_result = await session.execute(select(LearningObjective).where(LearningObjective.id == obj_id))
                obj = obj_result.scalar_one_or_none()
                
                if obj:
                    changes_made["objectives_added"].append({
                        "id": str(obj_id),
                        "text": obj.objective_text,
                        "relevance": relevance
                    })
        
        # Add new keyword tags
        for kw_id in request.keyword_ids:
            # Check if relationship already exists
            existing = await session.execute(
                select(NodeKeyword).where(
                    and_(
                        NodeKeyword.node_id == node_id,
                        NodeKeyword.keyword_id == kw_id
                    )
                )
            )
            
            if not existing.scalar_one_or_none():
                relevance = request.relevance_overrides.get(str(kw_id), 1.0)
                
                relationship = NodeKeyword(
                    node_id=node_id,
                    keyword_id=kw_id,
                    relevance_score=relevance,
                    auto_tagged=False,
                    tagged_by=current_user.id
                )
                session.add(relationship)
                
                # Get keyword text for response
                kw_result = await session.execute(select(Keyword).where(Keyword.id == kw_id))
                kw = kw_result.scalar_one_or_none()
                
                if kw:
                    changes_made["keywords_added"].append({
                        "id": str(kw_id),
                        "text": kw.keyword_text,
                        "relevance": relevance
                    })
        
        # Remove objective tags
        for obj_id in request.remove_objective_ids:
            result = await session.execute(
                select(NodeLearningObjective).where(
                    and_(
                        NodeLearningObjective.node_id == node_id,
                        NodeLearningObjective.objective_id == obj_id
                    )
                )
            )
            relationship = result.scalar_one_or_none()
            
            if relationship:
                # Get objective text before deleting
                obj_result = await session.execute(select(LearningObjective).where(LearningObjective.id == obj_id))
                obj = obj_result.scalar_one_or_none()
                
                await session.delete(relationship)
                
                if obj:
                    changes_made["objectives_removed"].append({
                        "id": str(obj_id),
                        "text": obj.objective_text
                    })
        
        # Remove keyword tags
        for kw_id in request.remove_keyword_ids:
            result = await session.execute(
                select(NodeKeyword).where(
                    and_(
                        NodeKeyword.node_id == node_id,
                        NodeKeyword.keyword_id == kw_id
                    )
                )
            )
            relationship = result.scalar_one_or_none()
            
            if relationship:
                # Get keyword text before deleting
                kw_result = await session.execute(select(Keyword).where(Keyword.id == kw_id))
                kw = kw_result.scalar_one_or_none()
                
                await session.delete(relationship)
                
                if kw:
                    changes_made["keywords_removed"].append({
                        "id": str(kw_id),
                        "text": kw.keyword_text
                    })
        
        await session.commit()
        
        return {
            "message": "Node tags updated successfully",
            "node_id": str(node_id),
            "changes": changes_made,
            "tagged_by": current_user.username,
            "tagged_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update tags: {str(e)}")


@router.post("/{node_id}/auto-tag")
async def auto_tag_node(
    node_id: uuid.UUID,
    request: AutoTagRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Auto-tag a single node using event-driven LLM analysis."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Verify node exists
        stmt = select(Node).where(Node.id == node_id)
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Generate tagging ID and publish start event
        tagging_id = str(uuid.uuid4())
        
        # Get event service and publish start event
        from app.services.kafka_service import get_xapi_event_service
        event_service = get_xapi_event_service()
        
        await event_service.publish_auto_tagging_started(
            tagging_id=tagging_id,
            node_id=str(node_id),
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_name=current_user.full_name or current_user.username,
            strategy=request.strategy.value
        )
        
        # The actual processing will be handled by event consumers
        # This follows the same pattern as knowledge extraction
        
        return {
            "tagging_id": tagging_id,
            "message": f"Auto-tagging started for node {node_id}",
            "status": "started",
            "strategy": request.strategy.value,
            "force_retag": request.force_retag,
            "status_endpoint": f"/api/nodes/{node_id}/tagging-status/{tagging_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start auto-tagging: {str(e)}")


@router.post("/batch/auto-tag")
async def batch_auto_tag(
    request: BatchAutoTagRequest,
    current_user: User = Depends(get_current_user)
):
    """Auto-tag multiple nodes in batch with event-driven progress tracking."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    if len(request.node_ids) > 100:
        raise HTTPException(status_code=400, detail="Batch size limited to 100 nodes")
    
    try:
        # Generate batch ID and publish start event
        batch_id = str(uuid.uuid4())
        
        # Get event service and publish batch start event
        from app.services.kafka_service import get_xapi_event_service
        event_service = get_xapi_event_service()
        
        await event_service.publish_batch_auto_tagging_started(
            batch_id=batch_id,
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_name=current_user.full_name or current_user.username,
            node_count=len(request.node_ids),
            strategy=request.strategy.value
        )
        
        # The actual batch processing will be handled by event consumers
        # This follows the same pattern as other batch operations
        
        return {
            "message": "Batch auto-tagging started",
            "batch_id": batch_id,
            "node_count": len(request.node_ids),
            "strategy": request.strategy.value,
            "estimated_time_minutes": len(request.node_ids) / 10,  # Rough estimate
            "status_endpoint": f"/api/nodes/batch/{batch_id}/status"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start batch tagging: {str(e)}")


@router.get("/{node_id}/tag-summary", response_model=NodeTagSummaryResponse)
async def get_node_tag_summary(
    node_id: uuid.UUID,
    include_suggestions: bool = Query(True, description="Include auto-tag suggestions"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get comprehensive tag summary for a node including suggestions."""
    try:
        # Get node with all relationships
        stmt = select(Node).options(
            selectinload(Node.learning_objective_relationships).selectinload(NodeLearningObjective.learning_objective),
            selectinload(Node.keyword_relationships).selectinload(NodeKeyword.keyword)
        ).where(Node.id == node_id)
        
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Current tags
        current_objectives = []
        current_keywords = []
        last_tagged = None
        
        for rel in node.learning_objective_relationships:
            current_objectives.append({
                "id": str(rel.objective_id),
                "text": rel.learning_objective.objective_text,
                "relevance_score": float(rel.relevance_score),
                "auto_tagged": rel.auto_tagged,
                "tagged_at": rel.created_at.isoformat()
            })
            if not last_tagged or rel.created_at > last_tagged:
                last_tagged = rel.created_at
        
        for rel in node.keyword_relationships:
            current_keywords.append({
                "id": str(rel.keyword_id),
                "text": rel.keyword.keyword_text,
                "relevance_score": float(rel.relevance_score),
                "auto_tagged": rel.auto_tagged,
                "tagged_at": rel.created_at.isoformat()
            })
            if not last_tagged or rel.created_at > last_tagged:
                last_tagged = rel.created_at
        
        current_tags = {
            "objectives": current_objectives,
            "keywords": current_keywords,
            "total_count": len(current_objectives) + len(current_keywords)
        }
        
        # Get auto-tag suggestions if requested
        auto_suggestions = {}
        quality_assessment = {}
        
        if include_suggestions and can_edit_content(current_user):
            try:
                # Analyze content for suggestions
                analyzer = ConceptAnalyzer()
                
                # Extract content text
                content_text = ""
                if node.title:
                    content_text += node.title + " "
                if node.description:
                    content_text += node.description + " "
                
                if isinstance(node.content, dict):
                    for key in ['text', 'content', 'question']:
                        if key in node.content and node.content[key]:
                            content_text += str(node.content[key]) + " "
                
                content_analysis = analyzer.analyze_content(content_text, node.node_type)
                
                quality_assessment = {
                    "complexity_level": content_analysis.complexity_level.value,
                    "taggability_score": content_analysis.taggability_score,
                    "recommended_strategy": content_analysis.recommended_strategy,
                    "suggested_focus": content_analysis.suggested_focus,
                    "confidence_adjustment": content_analysis.confidence_adjustment
                }
                
                # Mock auto-suggestions (in real implementation, this would use auto-tagger)
                auto_suggestions = {
                    "available": True,
                    "recommended_objectives": [],
                    "recommended_keywords": [],
                    "confidence_threshold": 0.7,
                    "suggestion_count": 0
                }
                
            except Exception as e:
                auto_suggestions = {"available": False, "error": str(e)}
                quality_assessment = {"available": False, "error": str(e)}
        
        return NodeTagSummaryResponse(
            node_id=str(node_id),
            node_type=node.node_type,
            title=node.title,
            current_tags=current_tags,
            auto_tag_suggestions=auto_suggestions,
            quality_assessment=quality_assessment,
            last_tagged=last_tagged.isoformat() if last_tagged else None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tag summary: {str(e)}")


@router.get("/tagging-candidates", response_model=TaggingCandidatesResponse)
async def get_tagging_candidates(
    limit: int = Query(50, le=200, description="Maximum candidates to return"),
    min_content_length: int = Query(20, description="Minimum content length"),
    exclude_recently_tagged: bool = Query(True, description="Exclude recently auto-tagged nodes"),
    current_user: User = Depends(get_current_user)
):
    """Get nodes that are good candidates for auto-tagging."""
    if not can_edit_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Initialize auto-tagger service
        config = AutoTaggingConfig()
        auto_tagger = NodeAutoTaggerService(config)
        
        # Get candidates
        candidates = await auto_tagger.get_auto_tagging_candidates(
            limit=limit,
            exclude_recently_tagged=exclude_recently_tagged,
            min_content_length=min_content_length
        )
        
        # Estimate total untagged nodes
        # (In real implementation, this would be a separate optimized query)
        total_untagged = min(len(candidates) * 2, 1000)  # Rough estimate
        
        # Recommend batch size based on candidates
        recommended_batch_size = min(max(len(candidates) // 5, 10), 50)
        
        return TaggingCandidatesResponse(
            candidates=candidates,
            total_untagged=total_untagged,
            recommended_batch_size=recommended_batch_size
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tagging candidates: {str(e)}")


@router.post("/{node_id}/suggestions/approve")
async def approve_tag_suggestions(
    node_id: uuid.UUID,
    request: SuggestionApprovalRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Approve auto-tag suggestions and apply them to the node."""
    if not can_review_content(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions for review actions")
    
    try:
        # Verify node exists
        stmt = select(Node).where(Node.id == node_id)
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        approved_count = 0
        
        # Apply approved objectives
        for obj_approval in request.approved_objectives:
            obj_id = uuid.UUID(obj_approval.get("entity_id"))
            confidence = obj_approval.get("confidence", 1.0)
            
            # Check if relationship already exists
            existing = await session.execute(
                select(NodeLearningObjective).where(
                    and_(
                        NodeLearningObjective.node_id == node_id,
                        NodeLearningObjective.objective_id == obj_id
                    )
                )
            )
            
            if not existing.scalar_one_or_none():
                relationship = NodeLearningObjective(
                    node_id=node_id,
                    objective_id=obj_id,
                    relevance_score=confidence,
                    auto_tagged=True,  # Mark as auto-tagged but approved
                    tagged_by=current_user.id
                )
                session.add(relationship)
                approved_count += 1
        
        # Apply approved keywords
        for kw_approval in request.approved_keywords:
            kw_id = uuid.UUID(kw_approval.get("entity_id"))
            confidence = kw_approval.get("confidence", 1.0)
            
            # Check if relationship already exists
            existing = await session.execute(
                select(NodeKeyword).where(
                    and_(
                        NodeKeyword.node_id == node_id,
                        NodeKeyword.keyword_id == kw_id
                    )
                )
            )
            
            if not existing.scalar_one_or_none():
                relationship = NodeKeyword(
                    node_id=node_id,
                    keyword_id=kw_id,
                    relevance_score=confidence,
                    auto_tagged=True,  # Mark as auto-tagged but approved
                    tagged_by=current_user.id
                )
                session.add(relationship)
                approved_count += 1
        
        await session.commit()
        
        return {
            "message": f"Approved and applied {approved_count} tag suggestions",
            "node_id": str(node_id),
            "approved_count": approved_count,
            "rejected_count": len(request.rejected_items),
            "reviewed_by": current_user.username,
            "reviewed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve suggestions: {str(e)}")


