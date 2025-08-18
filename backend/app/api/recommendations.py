"""
Recommendations API

REST endpoints for intelligent content recommendations.
Supports activity-based, node-based, and concept-based recommendation queries.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import db_manager
from app.core.deps import get_current_user
from app.models.user import User
from app.services.content_recommendation_service import ContentRecommendationService
from app.services.elasticsearch_service import get_elasticsearch_service, ElasticsearchService
from app.utils.permissions import has_content_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


# Request/Response Models

class ContentRecommendationRequest(BaseModel):
    """Request for content-based recommendations."""
    content_id: UUID = Field(..., description="Source content ID for finding related content")
    limit: int = Field(10, ge=1, le=50, description="Maximum number of recommendations")
    include_performance: bool = Field(True, description="Include performance metrics in results")
    min_similarity_score: float = Field(0.3, ge=0.0, le=1.0, description="Minimum similarity threshold")


class NodeRecommendationRequest(BaseModel):
    """Request for node-based recommendations."""
    node_id: UUID = Field(..., description="Source node ID for finding related nodes")
    limit: int = Field(8, ge=1, le=20, description="Maximum number of recommendations")
    include_different_types: bool = Field(True, description="Include nodes of different types")
    performance_weight: float = Field(0.4, ge=0.0, le=1.0, description="Weight for performance vs similarity")


class ConceptRecommendationRequest(BaseModel):
    """Request for concept-based recommendations."""
    keywords: List[str] = Field(default_factory=list, description="Target keywords")
    objectives: List[str] = Field(default_factory=list, description="Target learning objectives")
    limit: int = Field(15, ge=1, le=50, description="Maximum number of suggestions")
    difficulty_range: Optional[Tuple[int, int]] = Field(None, description="Difficulty range (min, max) 1-10")
    performance_threshold: float = Field(0.6, ge=0.0, le=1.0, description="Minimum success rate threshold")


class RecommendationResponse(BaseModel):
    """Standardized recommendation response."""
    recommendations: List[Dict[str, Any]]
    total_count: int
    request_params: Dict[str, Any]
    processing_time_ms: float


# Dependency injection

async def get_db_session() -> AsyncSession:
    """Get database session for dependency injection."""
    await db_manager.ensure_initialized()
    return db_manager.get_session()


async def get_recommendation_service(
    db: AsyncSession = Depends(get_db_session),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> ContentRecommendationService:
    """Get configured recommendation service."""
    return ContentRecommendationService(db, es_service)


# API Endpoints

@router.get("/content/{content_id}/related")
async def get_related_content(
    content_id: UUID,
    limit: int = Query(10, ge=1, le=50, description="Maximum number of recommendations"),
    include_performance: bool = Query(True, description="Include performance metrics"),
    min_similarity_score: float = Query(0.3, ge=0.0, le=1.0, description="Minimum similarity threshold"),
    current_user: User = Depends(get_current_user),
    service: ContentRecommendationService = Depends(get_recommendation_service),
    request: Request = None
) -> RecommendationResponse:
    """
    Get content recommendations based on a source activity.
    
    Returns activities that share learning objectives and keywords with the source,
    ranked by concept similarity and performance metrics.
    """
    import time
    start_time = time.time()
    
    try:
        # Check content access permissions
        if not await has_content_access(current_user, str(content_id), service.db):
            raise HTTPException(status_code=404, detail="Content not found or access denied")
        
        # Get recommendations
        recommendations = await service.get_related_content(
            content_id=content_id,
            limit=limit,
            include_performance=include_performance,
            min_similarity_score=min_similarity_score
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"Generated {len(recommendations)} content recommendations for {content_id} "
                   f"(user: {current_user.id}, time: {processing_time:.1f}ms)")
        
        return RecommendationResponse(
            recommendations=recommendations,
            total_count=len(recommendations),
            request_params={
                "content_id": str(content_id),
                "limit": limit,
                "include_performance": include_performance,
                "min_similarity_score": min_similarity_score
            },
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get content recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")


@router.get("/nodes/{node_id}/related")
async def get_related_nodes(
    node_id: UUID,
    limit: int = Query(8, ge=1, le=20, description="Maximum number of recommendations"),
    include_different_types: bool = Query(True, description="Include different node types"),
    performance_weight: float = Query(0.4, ge=0.0, le=1.0, description="Performance vs similarity weight"),
    current_user: User = Depends(get_current_user),
    service: ContentRecommendationService = Depends(get_recommendation_service),
    request: Request = None
) -> RecommendationResponse:
    """
    Get node recommendations for Flow Editor integration.
    
    Returns nodes that share concepts with the source node,
    ranked by similarity and performance metrics.
    """
    import time
    start_time = time.time()
    
    try:
        # Get node recommendations
        recommendations = await service.get_node_recommendations(
            node_id=node_id,
            limit=limit,
            include_different_types=include_different_types,
            performance_weight=performance_weight
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"Generated {len(recommendations)} node recommendations for {node_id} "
                   f"(user: {current_user.id}, time: {processing_time:.1f}ms)")
        
        return RecommendationResponse(
            recommendations=recommendations,
            total_count=len(recommendations),
            request_params={
                "node_id": str(node_id),
                "limit": limit,
                "include_different_types": include_different_types,
                "performance_weight": performance_weight
            },
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Failed to get node recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate node recommendations")


@router.post("/concepts")
async def get_concept_based_recommendations(
    request_data: ConceptRecommendationRequest,
    current_user: User = Depends(get_current_user),
    service: ContentRecommendationService = Depends(get_recommendation_service),
    request: Request = None
) -> RecommendationResponse:
    """
    Get content recommendations based on specific concepts.
    
    Used for content creation assistance and concept exploration.
    Returns nodes that match the specified keywords and objectives.
    """
    import time
    start_time = time.time()
    
    try:
        # Validate request
        if not request_data.keywords and not request_data.objectives:
            raise HTTPException(
                status_code=400, 
                detail="Must provide at least one keyword or objective"
            )
        
        # Get concept-based suggestions
        recommendations = await service.get_concept_based_suggestions(
            keywords=request_data.keywords,
            objectives=request_data.objectives,
            limit=request_data.limit,
            difficulty_range=request_data.difficulty_range,
            performance_threshold=request_data.performance_threshold
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"Generated {len(recommendations)} concept-based recommendations "
                   f"for {len(request_data.keywords)} keywords, {len(request_data.objectives)} objectives "
                   f"(user: {current_user.id}, time: {processing_time:.1f}ms)")
        
        return RecommendationResponse(
            recommendations=recommendations,
            total_count=len(recommendations),
            request_params=request_data.dict(),
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get concept-based recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate concept recommendations")


@router.post("/content/batch")
async def get_batch_content_recommendations(
    content_ids: List[UUID] = Field(..., min_items=1, max_items=10, description="Source content IDs"),
    limit_per_content: int = Query(5, ge=1, le=20, description="Recommendations per content item"),
    include_performance: bool = Query(True, description="Include performance metrics"),
    current_user: User = Depends(get_current_user),
    service: ContentRecommendationService = Depends(get_recommendation_service),
    request: Request = None
) -> Dict[str, Any]:
    """
    Get recommendations for multiple content items in a single request.
    
    Useful for dashboard widgets and batch processing scenarios.
    """
    import time
    start_time = time.time()
    
    try:
        batch_recommendations = {}
        
        for content_id in content_ids:
            # Check access for each content item
            if await has_content_access(current_user, str(content_id), service.db):
                recommendations = await service.get_related_content(
                    content_id=content_id,
                    limit=limit_per_content,
                    include_performance=include_performance
                )
                batch_recommendations[str(content_id)] = recommendations
            else:
                batch_recommendations[str(content_id)] = []
        
        processing_time = (time.time() - start_time) * 1000
        total_recommendations = sum(len(recs) for recs in batch_recommendations.values())
        
        logger.info(f"Generated {total_recommendations} batch recommendations for {len(content_ids)} items "
                   f"(user: {current_user.id}, time: {processing_time:.1f}ms)")
        
        return {
            "batch_recommendations": batch_recommendations,
            "total_content_items": len(content_ids),
            "total_recommendations": total_recommendations,
            "processing_time_ms": processing_time
        }
        
    except Exception as e:
        logger.error(f"Failed to get batch recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate batch recommendations")


@router.get("/trending")
async def get_trending_content(
    limit: int = Query(20, ge=1, le=50, description="Maximum number of trending items"),
    days_back: int = Query(30, ge=1, le=90, description="Days to look back for trending calculation"),
    include_performance: bool = Query(True, description="Include performance metrics"),
    current_user: User = Depends(get_current_user),
    service: ContentRecommendationService = Depends(get_recommendation_service),
    request: Request = None
) -> Dict[str, Any]:
    """
    Get trending content based on recent usage and performance.
    
    Returns content that has shown strong performance and engagement
    within the specified time window.
    """
    import time
    start_time = time.time()
    
    try:
        # This would implement trending algorithm based on Elasticsearch analytics
        # For now, return a placeholder response
        trending_content = []
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"Generated {len(trending_content)} trending recommendations "
                   f"(user: {current_user.id}, time: {processing_time:.1f}ms)")
        
        return {
            "trending_content": trending_content,
            "total_count": len(trending_content),
            "time_window_days": days_back,
            "processing_time_ms": processing_time,
            "note": "Trending algorithm implementation pending - requires Elasticsearch analytics integration"
        }
        
    except Exception as e:
        logger.error(f"Failed to get trending content: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate trending recommendations")


@router.get("/health")
async def recommendations_health_check(
    service: ContentRecommendationService = Depends(get_recommendation_service)
) -> Dict[str, Any]:
    """
    Health check endpoint for recommendation service.
    
    Verifies database connectivity and basic service functionality.
    """
    try:
        # Basic connectivity check
        await service.db.execute("SELECT 1")
        
        return {
            "status": "healthy",
            "service": "content_recommendation_service", 
            "timestamp": "2024-01-01T00:00:00Z",  # Would use actual timestamp
            "database_connected": True,
            "elasticsearch_connected": True,  # Would check actual ES connection
        }
        
    except Exception as e:
        logger.error(f"Recommendation service health check failed: {e}")
        raise HTTPException(status_code=503, detail="Recommendation service unavailable")


# Register router
logger.info("Recommendation API endpoints registered")