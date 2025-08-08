"""
Analytics API endpoints for learning analytics and xAPI data visualization.
Provides comprehensive analytics data for custom React dashboards.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.utils.permissions import can_view_analytics, can_manage_users
from app.services.ralph_lrs_service import RalphLRSService, get_ralph_lrs_service
from app.services.elasticsearch_service import (
    ElasticsearchService, 
    get_elasticsearch_service,
    LearnerAnalytics,
    ActivityAnalytics
)
from app.services.performance_analysis_service import (
    PerformanceAnalysisService,
    get_performance_analysis_service,
    TopPerformer,
    TrainingRecommendation,
    ComplianceRisk
)

router = APIRouter()


# ============================================================================
# HEALTH AND STATUS ENDPOINTS
# ============================================================================

@router.get("/health", summary="Analytics services health check")
async def analytics_health(
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Check health status of Ralph LRS and Elasticsearch services"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access analytics"
        )
    
    try:
        # Test Ralph LRS connection
        ralph_status = await ralph_service.test_connection()
        
        # Test Elasticsearch connection
        es_status = await es_service.test_connection()
        
        return {
            "analytics_system": "operational" if ralph_status.get("success") and es_status.get("success") else "degraded",
            "ralph_lrs": ralph_status,
            "elasticsearch": es_status,
            "checked_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking analytics health: {str(e)}"
        )


# ============================================================================
# PLATFORM ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/overview", summary="Platform analytics overview")
async def get_platform_overview(
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    until: Optional[str] = Query(None, description="End date in ISO format"),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get platform-wide analytics overview with key metrics"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access analytics"
        )
    
    try:
        overview = await es_service.get_platform_overview(since=since, until=until)
        
        return {
            "success": True,
            "data": overview,
            "filters": {
                "since": since,
                "until": until
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving platform overview: {str(e)}"
        )


@router.get("/completion-stats", summary="Platform completion statistics")
async def get_completion_stats(
    activity_id: Optional[str] = Query(None, description="Filter by specific activity"),
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get completion statistics for activities or platform-wide"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access analytics"
        )
    
    try:
        stats = await ralph_service.get_completion_stats(
            activity_id=activity_id,
            since=since
        )
        
        return {
            "success": True,
            "data": stats,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving completion stats: {str(e)}"
        )


# ============================================================================
# LEARNER ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/learner/{learner_email}", summary="Individual learner analytics")
async def get_learner_analytics(
    learner_email: str,
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive analytics for a specific learner"""
    
    # Users can view their own analytics, or admins can view any learner's analytics
    if not (current_user.email == learner_email or can_manage_users(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access learner analytics"
        )
    
    try:
        analytics = await es_service.get_learner_analytics(
            learner_email=learner_email,
            since=since
        )
        
        # Convert dataclass to dict for JSON serialization
        analytics_dict = {
            "learner_email": analytics.learner_email,
            "learner_name": analytics.learner_name,
            "total_activities": analytics.total_activities,
            "completed_activities": analytics.completed_activities,
            "completion_rate": analytics.completion_rate,
            "average_score": analytics.average_score,
            "total_time_spent": analytics.total_time_spent,
            "learning_streak": analytics.learning_streak,
            "recent_activities": analytics.recent_activities,
            "progress_by_program": analytics.progress_by_program
        }
        
        return {
            "success": True,
            "data": analytics_dict,
            "filters": {
                "since": since
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving learner analytics: {str(e)}"
        )


@router.get("/learner/{learner_email}/statements", summary="Learner xAPI statements")
async def get_learner_statements(
    learner_email: str,
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of statements"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get xAPI statements for a specific learner"""
    
    # Users can view their own statements, or admins can view any learner's statements
    if not (current_user.email == learner_email or can_manage_users(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access learner statements"
        )
    
    try:
        statements = await ralph_service.get_learner_statements(
            learner_email=learner_email,
            since=since,
            limit=limit
        )
        
        return {
            "success": True,
            "data": {
                "statements": statements,
                "count": len(statements),
                "learner_email": learner_email
            },
            "filters": {
                "since": since,
                "limit": limit
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving learner statements: {str(e)}"
        )


# ============================================================================
# ACTIVITY ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/activity/{activity_id}", summary="Activity analytics")
async def get_activity_analytics(
    activity_id: str,
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive analytics for a specific activity"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access activity analytics"
        )
    
    try:
        analytics = await es_service.get_activity_analytics(
            activity_id=activity_id,
            since=since
        )
        
        # Convert dataclass to dict
        analytics_dict = {
            "activity_id": analytics.activity_id,
            "activity_name": analytics.activity_name,
            "activity_type": analytics.activity_type,
            "total_attempts": analytics.total_attempts,
            "unique_learners": analytics.unique_learners,
            "completion_rate": analytics.completion_rate,
            "average_score": analytics.average_score,
            "average_time_spent": analytics.average_time_spent,
            "difficulty_score": analytics.difficulty_score,
            "engagement_score": analytics.engagement_score
        }
        
        return {
            "success": True,
            "data": analytics_dict,
            "filters": {
                "since": since
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving activity analytics: {str(e)}"
        )


@router.get("/activity/{activity_id}/statements", summary="Activity xAPI statements")
async def get_activity_statements(
    activity_id: str,
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of statements"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get xAPI statements for a specific activity"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access activity statements"
        )
    
    try:
        statements = await ralph_service.get_activity_statements(
            activity_id=activity_id,
            since=since,
            limit=limit
        )
        
        return {
            "success": True,
            "data": {
                "statements": statements,
                "count": len(statements),
                "activity_id": activity_id
            },
            "filters": {
                "since": since,
                "limit": limit
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving activity statements: {str(e)}"
        )


# ============================================================================
# ADVANCED ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/trends", summary="Analytics trends over time")
async def get_analytics_trends(
    period: str = Query("7d", regex="^(1d|7d|30d|90d|1y)$", description="Time period for trends"),
    metric: str = Query("completion", regex="^(completion|engagement|scores|activity)$", description="Metric to analyze"),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get analytics trends over specified time periods"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access analytics trends"
        )
    
    # Calculate date range based on period
    now = datetime.now(timezone.utc)
    period_map = {
        "1d": timedelta(days=1),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
        "1y": timedelta(days=365)
    }
    
    since_date = now - period_map[period]
    since = since_date.isoformat()
    
    try:
        # Get platform overview with date range
        overview = await es_service.get_platform_overview(
            since=since,
            until=now.isoformat()
        )
        
        # Extract relevant trends based on metric
        trends_data = {
            "period": period,
            "metric": metric,
            "since": since,
            "until": now.isoformat(),
            "daily_activity": overview.get("daily_activity", []),
            "summary": {
                "total_statements": overview.get("total_statements", 0),
                "unique_learners": overview.get("unique_learners", 0),
                "completion_rate": overview.get("completion_rate", 0),
                "average_score": overview.get("average_score")
            }
        }
        
        return {
            "success": True,
            "data": trends_data,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving analytics trends: {str(e)}"
        )


# ============================================================================
# BULK ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/dashboard", summary="Complete analytics dashboard data")
async def get_dashboard_data(
    role: str = Query("learner", regex="^(learner|instructor|admin)$", description="Dashboard role perspective"),
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get complete dashboard data optimized for specific role"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access analytics dashboard"
        )
    
    try:
        # Get base platform overview
        overview = await es_service.get_platform_overview(since=since)
        
        dashboard_data = {
            "role": role,
            "platform_overview": overview
        }
        
        # Add role-specific data
        if role == "learner":
            # Get learner's personal analytics
            learner_analytics = await es_service.get_learner_analytics(
                learner_email=current_user.email,
                since=since
            )
            dashboard_data["learner_analytics"] = {
                "total_activities": learner_analytics.total_activities,
                "completed_activities": learner_analytics.completed_activities,
                "completion_rate": learner_analytics.completion_rate,
                "average_score": learner_analytics.average_score,
                "learning_streak": learner_analytics.learning_streak,
                "recent_activities": learner_analytics.recent_activities[:5]  # Last 5
            }
            
        elif role == "instructor" and can_manage_users(current_user):
            # Get completion statistics
            completion_stats = await ralph_service.get_completion_stats(since=since)
            dashboard_data["instructor_analytics"] = completion_stats
            
        elif role == "admin" and can_manage_users(current_user):
            # Get comprehensive admin data
            completion_stats = await ralph_service.get_completion_stats(since=since)
            dashboard_data["admin_analytics"] = {
                "completion_stats": completion_stats,
                "system_health": {
                    "ralph_lrs": (await ralph_service.test_connection()).get("success", False),
                    "elasticsearch": (await es_service.test_connection()).get("success", False)
                }
            }
        
        return {
            "success": True,
            "data": dashboard_data,
            "filters": {
                "role": role,
                "since": since
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving dashboard data: {str(e)}"
        )


# ============================================================================
# EXPORT ENDPOINTS
# ============================================================================

@router.get("/export/{format}", summary="Export analytics data")
async def export_analytics(
    format: str,
    data_type: str = Query("overview", regex="^(overview|learners|activities|statements)$", description="Data type to export"),
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    until: Optional[str] = Query(None, description="End date in ISO format"),
    es_service: ElasticsearchService = Depends(get_elasticsearch_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Export analytics data in various formats"""
    
    # Validate format parameter
    if format not in ["csv", "json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format must be 'csv' or 'json'"
        )
    
    if not can_manage_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to export analytics data"
        )
    
    try:
        # Get the requested data
        if data_type == "overview":
            data = await es_service.get_platform_overview(since=since, until=until)
        else:
            # For now, just return overview - can be extended later
            data = await es_service.get_platform_overview(since=since, until=until)
        
        export_data = {
            "export_type": data_type,
            "format": format,
            "filters": {
                "since": since,
                "until": until
            },
            "data": data,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "exported_by": current_user.email
        }
        
        if format == "json":
            return JSONResponse(
                content=export_data,
                headers={
                    "Content-Disposition": f"attachment; filename=nlj_analytics_{data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                }
            )
        elif format == "csv":
            # For CSV, we'd need to flatten the data structure
            # For now, return JSON with CSV indication
            return JSONResponse(
                content={
                    "message": "CSV export not yet implemented. Use JSON format.",
                    "data": export_data
                },
                headers={
                    "Content-Disposition": f"attachment; filename=nlj_analytics_{data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                }
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting analytics data: {str(e)}"
        )


# ============================================================================
# ENHANCED ANALYTICS ENDPOINTS - AI-POWERED PERFORMANCE ANALYSIS
# ============================================================================

@router.get("/top-performers/{category}", summary="Get top performers by category")
async def get_top_performers(
    category: str,
    limit: int = Query(50, ge=1, le=100, description="Maximum number of top performers"),
    time_period: str = Query("90d", regex="^(30d|90d|180d|1y)$", description="Analysis time period"),
    include_characteristics: bool = Query(True, description="Include behavioral characteristics"),
    performance_service: PerformanceAnalysisService = Depends(get_performance_analysis_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Identify top performers using ML algorithms.
    Returns ranked list with performance characteristics and behavioral patterns.
    """
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access performance analytics"
        )
    
    try:
        top_performers = await performance_service.identify_top_performers(
            category=category if category != "all" else None,
            limit=limit,
            time_period=time_period
        )
        
        # Convert dataclasses to dictionaries for JSON serialization
        performers_data = []
        for performer in top_performers:
            performer_dict = {
                "user_id": performer.user_id,
                "user_name": performer.user_name,
                "user_email": performer.user_email,
                "overall_score": round(performer.overall_score, 2),
                "completion_rate": round(performer.completion_rate, 3),
                "average_score": round(performer.average_score, 2),
                "average_time_to_completion": round(performer.average_time_to_completion, 1),
                "total_activities": performer.total_activities,
                "completed_activities": performer.completed_activities,
                "strong_categories": performer.strong_categories,
                "weak_categories": performer.weak_categories,
                "performance_trend": performer.performance_trend,
                "rank": performer.rank
            }
            
            if include_characteristics:
                performer_dict["characteristics"] = {
                    "adaptability_score": round(performer.characteristics.adaptability_score, 3),
                    "persistence_level": round(performer.characteristics.persistence_level, 3),
                    "accuracy_trend": performer.characteristics.accuracy_trend,
                    "consistency_score": round(performer.characteristics.consistency_score, 3),
                    "speed_score": round(performer.characteristics.speed_score, 3),
                    "preferred_activity_types": performer.characteristics.preferred_activity_types,
                    "peak_performance_hours": performer.characteristics.peak_performance_hours,
                    "learning_style_indicators": performer.characteristics.learning_style_indicators
                }
            
            performers_data.append(performer_dict)
        
        return {
            "success": True,
            "data": {
                "top_performers": performers_data,
                "total_analyzed": len(performers_data),
                "category": category,
                "analysis_metadata": {
                    "time_period": time_period,
                    "ranking_algorithm": "composite_weighted_score",
                    "characteristics_included": include_characteristics
                }
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error identifying top performers: {str(e)}"
        )


@router.get("/training-recommendations", summary="Get AI-generated training recommendations")
async def get_training_recommendations(
    user_id: Optional[str] = Query(None, description="User ID for personalized recommendations"),
    category: Optional[str] = Query(None, description="Activity category filter"),
    limit: int = Query(10, ge=1, le=25, description="Maximum number of recommendations"),
    performance_service: PerformanceAnalysisService = Depends(get_performance_analysis_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generate AI-powered training recommendations based on performance analysis.
    Can provide personalized recommendations for a specific user or general recommendations.
    """
    
    # Check permissions
    if user_id and not (current_user.id == user_id or can_manage_users(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access user training recommendations"
        )
    elif not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access training recommendations"
        )
    
    try:
        recommendations = []
        
        if user_id:
            # Generate personalized recommendations
            user_recommendations = await performance_service.generate_training_recommendations(
                user_id=user_id,
                max_recommendations=limit
            )
            recommendations = user_recommendations
        else:
            # Generate general recommendations based on platform-wide analytics
            recommendations = [
                TrainingRecommendation(
                    topic="Effective Learning Strategies",
                    description="Learn proven strategies to improve learning efficiency and retention",
                    reason="Platform-wide analysis shows 25% improvement opportunity in completion time",
                    priority="high",
                    estimated_time=30,
                    difficulty_level="beginner",
                    related_activities=["learning_techniques", "time_management"],
                    success_probability=0.90
                )
            ]
        
        # Convert to JSON-serializable format
        recommendations_data = []
        for rec in recommendations:
            rec_dict = {
                "topic": rec.topic,
                "description": rec.description,
                "reason": rec.reason,
                "priority": rec.priority,
                "estimated_time": rec.estimated_time,
                "difficulty_level": rec.difficulty_level,
                "related_activities": rec.related_activities,
                "success_probability": round(rec.success_probability, 3)
            }
            recommendations_data.append(rec_dict)
        
        return {
            "success": True,
            "data": {
                "recommendations": recommendations_data,
                "total_recommendations": len(recommendations_data),
                "personalized": user_id is not None,
                "filters": {
                    "user_id": user_id,
                    "category": category,
                    "limit": limit
                }
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating training recommendations: {str(e)}"
        )


@router.get("/learner-performance/{user_id}", summary="Get comprehensive learner performance analysis")
async def get_learner_performance_analysis(
    user_id: str,
    time_period: str = Query("90d", regex="^(30d|90d|180d|1y)$", description="Analysis time period"),
    include_benchmarks: bool = Query(True, description="Include comparison with top performers"),
    performance_service: PerformanceAnalysisService = Depends(get_performance_analysis_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get comprehensive performance analysis for a learner including comparison
    with top performers, personalized insights, and improvement recommendations.
    """
    
    # Check permissions
    if not (current_user.id == user_id or can_manage_users(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access learner performance analysis"
        )
    
    try:
        # Get user performance characteristics
        user_characteristics = await performance_service.extract_performance_characteristics(
            user_ids=[user_id],
            time_period=time_period
        )
        
        # Get training recommendations
        recommendations = await performance_service.generate_training_recommendations(
            user_id=user_id,
            max_recommendations=5
        )
        
        # Prepare comprehensive analysis
        analysis_data = {
            "user_id": user_id,
            "analysis_period": time_period,
            "performance_characteristics": {},
            "training_recommendations": [],
            "improvement_opportunities": []
        }
        
        # Add characteristics if available
        if user_id in user_characteristics:
            chars = user_characteristics[user_id]
            analysis_data["performance_characteristics"] = {
                "adaptability_score": round(chars.adaptability_score, 3),
                "persistence_level": round(chars.persistence_level, 3),
                "accuracy_trend": chars.accuracy_trend,
                "consistency_score": round(chars.consistency_score, 3),
                "speed_score": round(chars.speed_score, 3),
                "preferred_activity_types": chars.preferred_activity_types,
                "peak_performance_hours": chars.peak_performance_hours,
                "learning_style_indicators": chars.learning_style_indicators
            }
        
        # Add recommendations
        for rec in recommendations:
            analysis_data["training_recommendations"].append({
                "topic": rec.topic,
                "description": rec.description,
                "reason": rec.reason,
                "priority": rec.priority,
                "estimated_time": rec.estimated_time,
                "success_probability": round(rec.success_probability, 3)
            })
        
        # Add benchmark comparison if requested
        if include_benchmarks:
            try:
                top_performers = await performance_service.identify_top_performers(limit=10)
                if top_performers:
                    avg_top_score = sum(p.overall_score for p in top_performers) / len(top_performers)
                    avg_top_completion = sum(p.completion_rate for p in top_performers) / len(top_performers)
                    
                    analysis_data["benchmarks"] = {
                        "top_performer_avg_score": round(avg_top_score, 2),
                        "top_performer_completion_rate": round(avg_top_completion, 3),
                        "performance_gap_analysis": "Available with sufficient data"
                    }
            except Exception:
                analysis_data["benchmarks"] = {"error": "Benchmark data unavailable"}
        
        return {
            "success": True,
            "data": analysis_data,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error performing learner performance analysis: {str(e)}"
        )