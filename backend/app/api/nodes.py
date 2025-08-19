"""
Node API endpoints for comprehensive node management and analytics.

Provides CRUD operations, performance analytics, content optimization,
and learning intelligence for first-class node entities.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import db_manager
from app.core.deps import get_current_user
from app.models.user import User
from app.services.node_service import NodeService
from app.services.node_analytics_service import NodeAnalyticsService
from app.utils.permissions import require_permission, PermissionLevel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


# Pydantic schemas for request/response models
class NodeCreateRequest(BaseModel):
    node_type: str
    content: Dict[str, Any]
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[int] = Field(None, ge=1, le=10)
    base_language: str = "en-US"


class NodeUpdateRequest(BaseModel):
    node_type: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[int] = Field(None, ge=1, le=10)


class NodeResponse(BaseModel):
    id: str
    node_type: str
    content: Dict[str, Any]
    content_hash: Optional[str] = None
    concept_fingerprint: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[int] = None
    avg_completion_time: Optional[int] = None
    success_rate: Optional[float] = None
    difficulty_score: Optional[float] = None
    engagement_score: Optional[float] = None
    current_version_id: Optional[str] = None
    base_language: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NodesListResponse(BaseModel):
    items: List[NodeResponse]
    total: int
    limit: int
    offset: int


async def get_node_service(
    session: AsyncSession = Depends(db_manager.get_session),
    user: User = Depends(get_current_user)
) -> NodeService:
    """Dependency to get NodeService with user context."""
    return NodeService(session)


async def get_node_analytics_service(
    session: AsyncSession = Depends(db_manager.get_session),
    user: User = Depends(get_current_user)
) -> NodeAnalyticsService:
    """Dependency to get NodeAnalyticsService with user context."""
    return NodeAnalyticsService(session)


@router.get("/", response_model=NodesListResponse)
async def list_nodes(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    node_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("updated_at", regex="^(created_at|updated_at|success_rate|usage_count)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    node_service: NodeService = Depends(get_node_service),
    user: User = Depends(get_current_user)
):
    """Get paginated list of nodes with filtering and sorting."""
    try:
        # Convert to internal filter format
        filters = {}
        if node_type:
            filters['node_type'] = node_type
        if search:
            filters['search'] = search

        # Get nodes from service
        nodes, total = await node_service.list_nodes(
            limit=limit,
            offset=offset,
            filters=filters,
            sort_by=sort_by,
            sort_order=sort_order
        )

        # Convert to response format
        node_responses = []
        for node in nodes:
            node_responses.append(NodeResponse(
                id=str(node.id),
                node_type=node.node_type,
                content=node.content,
                content_hash=node.content_hash,
                concept_fingerprint=node.concept_fingerprint,
                title=node.title,
                description=node.description,
                difficulty_level=node.difficulty_level,
                avg_completion_time=node.avg_completion_time,
                success_rate=float(node.success_rate) if node.success_rate else None,
                difficulty_score=float(node.difficulty_score) if node.difficulty_score else None,
                engagement_score=float(node.engagement_score) if node.engagement_score else None,
                current_version_id=str(node.current_version_id) if node.current_version_id else None,
                base_language=node.base_language,
                created_by=str(node.created_by),
                created_at=node.created_at,
                updated_at=node.updated_at
            ))

        return NodesListResponse(
            items=node_responses,
            total=total,
            limit=limit,
            offset=offset
        )

    except Exception as e:
        logger.error(f"Error listing nodes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve nodes"
        )


@router.get("/trending", response_model=Dict[str, Any])
async def get_trending_nodes(
    time_window_days: int = Query(7, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    analytics_service: NodeAnalyticsService = Depends(get_node_analytics_service),
    user: User = Depends(get_current_user)
):
    """Get trending nodes based on recent performance and usage."""
    try:
        # Get trending nodes from analytics service
        trending_data = await analytics_service.get_trending_nodes(
            time_window_days=time_window_days,
            limit=limit
        )

        return {
            "time_window_days": time_window_days,
            "trending_nodes": trending_data,
            "generated_at": datetime.utcnow()
        }

    except Exception as e:
        logger.error(f"Error getting trending nodes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve trending nodes"
        )


@router.get("/{node_id}", response_model=NodeResponse)
async def get_node(
    node_id: str,
    node_service: NodeService = Depends(get_node_service),
    user: User = Depends(get_current_user)
):
    """Get single node by ID."""
    try:
        node_uuid = UUID(node_id)
        node = await node_service.get_node_by_id(node_uuid)
        
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Node not found"
            )

        return NodeResponse(
            id=str(node.id),
            node_type=node.node_type,
            content=node.content,
            content_hash=node.content_hash,
            concept_fingerprint=node.concept_fingerprint,
            title=node.title,
            description=node.description,
            difficulty_level=node.difficulty_level,
            avg_completion_time=node.avg_completion_time,
            success_rate=float(node.success_rate) if node.success_rate else None,
            difficulty_score=float(node.difficulty_score) if node.difficulty_score else None,
            engagement_score=float(node.engagement_score) if node.engagement_score else None,
            current_version_id=str(node.current_version_id) if node.current_version_id else None,
            base_language=node.base_language,
            created_by=str(node.created_by),
            created_at=node.created_at,
            updated_at=node.updated_at
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid node ID format"
        )
    except Exception as e:
        logger.error(f"Error getting node {node_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve node"
        )


@router.post("/", response_model=NodeResponse)
async def create_node(
    request: NodeCreateRequest,
    node_service: NodeService = Depends(get_node_service),
    user: User = Depends(require_permission(PermissionLevel.CREATOR))
):
    """Create new node."""
    try:
        # Create node using service
        node = await node_service.create_node(
            node_type=request.node_type,
            content=request.content,
            title=request.title,
            description=request.description,
            difficulty_level=request.difficulty_level,
            base_language=request.base_language,
            created_by=user.id
        )

        return NodeResponse(
            id=str(node.id),
            node_type=node.node_type,
            content=node.content,
            content_hash=node.content_hash,
            concept_fingerprint=node.concept_fingerprint,
            title=node.title,
            description=node.description,
            difficulty_level=node.difficulty_level,
            avg_completion_time=node.avg_completion_time,
            success_rate=float(node.success_rate) if node.success_rate else None,
            difficulty_score=float(node.difficulty_score) if node.difficulty_score else None,
            engagement_score=float(node.engagement_score) if node.engagement_score else None,
            current_version_id=str(node.current_version_id) if node.current_version_id else None,
            base_language=node.base_language,
            created_by=str(node.created_by),
            created_at=node.created_at,
            updated_at=node.updated_at
        )

    except Exception as e:
        logger.error(f"Error creating node: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create node"
        )


@router.get("/{node_id}/analytics", response_model=Dict[str, Any])
async def get_node_analytics(
    node_id: str,
    analytics_service: NodeAnalyticsService = Depends(get_node_analytics_service),
    user: User = Depends(get_current_user)
):
    """Get comprehensive node analytics summary."""
    try:
        node_uuid = UUID(node_id)
        
        # Get comprehensive analytics from service
        analytics = await analytics_service.get_node_summary(node_uuid)
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Node analytics not found"
            )

        return analytics

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid node ID format"
        )
    except Exception as e:
        logger.error(f"Error getting node analytics for {node_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve node analytics"
        )


@router.get("/{node_id}/interactions", response_model=Dict[str, Any])
async def get_node_interactions(
    node_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    activity_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    node_service: NodeService = Depends(get_node_service),
    user: User = Depends(get_current_user)
):
    """Get node interactions for analytics."""
    try:
        node_uuid = UUID(node_id)
        
        # Prepare filters
        filters = {}
        if activity_id:
            filters['activity_id'] = UUID(activity_id)
        if user_id:
            filters['user_id'] = UUID(user_id)
        if start_date:
            filters['start_date'] = datetime.fromisoformat(start_date)
        if end_date:
            filters['end_date'] = datetime.fromisoformat(end_date)
        
        # Get interactions from service
        interactions, total = await node_service.get_node_interactions(
            node_uuid,
            limit=limit,
            offset=offset,
            filters=filters
        )
        
        # Convert to response format
        interaction_responses = []
        for interaction in interactions:
            interaction_responses.append({
                "id": str(interaction.id),
                "node_id": str(interaction.node_id),
                "user_id": str(interaction.user_id),
                "activity_id": str(interaction.activity_id) if interaction.activity_id else None,
                "session_id": interaction.session_id,
                "response_data": interaction.response_data,
                "is_correct": interaction.is_correct,
                "score": float(interaction.score) if interaction.score else None,
                "time_to_respond": interaction.time_to_respond,
                "attempts": interaction.attempts,
                "activity_session_id": interaction.activity_session_id,
                "created_at": interaction.created_at
            })

        return {
            "items": interaction_responses,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    except Exception as e:
        logger.error(f"Error getting node interactions for {node_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve node interactions"
        )


@router.get("/search", response_model=NodesListResponse)
async def search_nodes(
    q: str = Query(..., min_length=1),
    node_types: Optional[List[str]] = Query(None),
    min_success_rate: Optional[float] = Query(None, ge=0.0, le=1.0),
    max_difficulty: Optional[int] = Query(None, ge=1, le=10),
    limit: int = Query(20, ge=1, le=100),
    node_service: NodeService = Depends(get_node_service),
    user: User = Depends(get_current_user)
):
    """Search nodes by content or metadata."""
    try:
        # Prepare search filters
        filters = {}
        if node_types:
            filters['node_types'] = node_types
        if min_success_rate is not None:
            filters['min_success_rate'] = min_success_rate
        if max_difficulty is not None:
            filters['max_difficulty'] = max_difficulty
        
        # Search nodes using service
        nodes, total = await node_service.search_nodes(
            query=q,
            filters=filters,
            limit=limit
        )
        
        # Convert to response format
        node_responses = []
        for node in nodes:
            node_responses.append(NodeResponse(
                id=str(node.id),
                node_type=node.node_type,
                content=node.content,
                content_hash=node.content_hash,
                concept_fingerprint=node.concept_fingerprint,
                title=node.title,
                description=node.description,
                difficulty_level=node.difficulty_level,
                avg_completion_time=node.avg_completion_time,
                success_rate=float(node.success_rate) if node.success_rate else None,
                difficulty_score=float(node.difficulty_score) if node.difficulty_score else None,
                engagement_score=float(node.engagement_score) if node.engagement_score else None,
                current_version_id=str(node.current_version_id) if node.current_version_id else None,
                base_language=node.base_language,
                created_by=str(node.created_by),
                created_at=node.created_at,
                updated_at=node.updated_at
            ))

        return NodesListResponse(
            items=node_responses,
            total=total,
            limit=limit,
            offset=0  # Search doesn't use offset, starts from 0
        )

    except Exception as e:
        logger.error(f"Error searching nodes with query '{q}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search nodes"
        )


@router.get("/{node_id}/optimize", response_model=Dict[str, Any])
async def get_node_optimization(
    node_id: str,
    analytics_service: NodeAnalyticsService = Depends(get_node_analytics_service),
    user: User = Depends(get_current_user)
):
    """Get content optimization suggestions for a node."""
    try:
        node_uuid = UUID(node_id)
        
        # Get optimization suggestions from analytics service
        optimization = await analytics_service.get_content_optimization_suggestions(node_uuid)
        
        if not optimization:
            # Return empty optimization if none found
            return {
                "optimization_score": 0.0,
                "suggestions": [],
                "last_analyzed": None
            }

        return optimization

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid node ID format"
        )
    except Exception as e:
        logger.error(f"Error getting node optimization for {node_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve node optimization"
        )


@router.get("/{node_id}/trends", response_model=Dict[str, Any])
async def get_node_trends(
    node_id: str,
    time_range: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    analytics_service: NodeAnalyticsService = Depends(get_node_analytics_service),
    user: User = Depends(get_current_user)
):
    """Get performance trends for a node over time."""
    try:
        node_uuid = UUID(node_id)
        
        # Convert time_range to days
        time_mapping = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
        days = time_mapping.get(time_range, 30)
        
        # Get performance trends from analytics service
        trends = await analytics_service.get_node_performance_trends(node_uuid, days)
        
        if not trends:
            # Return empty trends if none found
            return {
                "time_range": time_range,
                "summary": {
                    "trend_direction": "stable",
                    "period_comparison": {
                        "success_rate_change": 0.0,
                        "completion_time_change": 0.0
                    }
                },
                "data_points": [],
                "generated_at": datetime.utcnow()
            }

        return trends

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid node ID format"
        )
    except Exception as e:
        logger.error(f"Error getting node trends for {node_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve node trends"
        )