"""
Node Analytics Service for comprehensive node performance metrics.

Provides analytics and insights for individual learning nodes across
activities, enabling content optimization and performance tracking.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import db_manager
from app.models.node import Node, NodeInteraction, ActivityNode
from app.models.content import ContentItem
from app.models.user import User
from app.models.learning_objective import LearningObjective, Keyword
from app.services.elasticsearch_service import ElasticsearchService, get_elasticsearch_service

logger = logging.getLogger(__name__)


class NodeAnalyticsService:
    """
    Service for comprehensive node performance analytics and insights.
    
    Combines PostgreSQL and Elasticsearch data to provide rich analytics
    on node usage, performance, and optimization opportunities.
    """
    
    def __init__(
        self, 
        session: AsyncSession, 
        elasticsearch_service: Optional[ElasticsearchService] = None
    ):
        self.session = session
        # Get elasticsearch service synchronously since it's not async
        if elasticsearch_service:
            self.elasticsearch_service = elasticsearch_service
        else:
            # Import locally to avoid circular import
            from app.services.elasticsearch_service import elasticsearch_service as es_service
            self.elasticsearch_service = es_service
    
    async def get_node_summary(self, node_id: UUID) -> Dict[str, Any]:
        """Get comprehensive summary for a single node"""
        
        # Get basic node info
        node = await self.session.get(Node, node_id)
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        # Get interaction statistics from PostgreSQL
        interaction_stats = await self._get_node_interaction_stats(node_id)
        
        # Get activity usage stats
        activity_stats = await self._get_node_activity_usage(node_id)
        
        # Get learning concepts
        concepts = await self._get_node_concepts(node_id)
        
        # Get Elasticsearch analytics if available
        elasticsearch_analytics = None
        try:
            elasticsearch_analytics = await self.elasticsearch_service.get_node_performance_analytics(
                str(node_id), include_activity_breakdown=True
            )
        except Exception as e:
            logger.warning(f"Failed to get Elasticsearch analytics for node {node_id}: {e}")
        
        return {
            "node_info": {
                "id": str(node_id),
                "node_type": node.node_type,
                "title": node.title,
                "description": node.description,
                "difficulty_level": node.difficulty_level,
                "content_hash": node.content_hash,
                "created_at": node.created_at.isoformat() if node.created_at else None,
                "updated_at": node.updated_at.isoformat() if node.updated_at else None
            },
            "performance_metrics": {
                "success_rate": float(node.success_rate) if node.success_rate else None,
                "avg_completion_time_ms": node.avg_completion_time,
                "difficulty_score": float(node.difficulty_score) if node.difficulty_score else None,
                "engagement_score": float(node.engagement_score) if node.engagement_score else None
            },
            "interaction_stats": interaction_stats,
            "activity_usage": activity_stats,
            "learning_concepts": concepts,
            "elasticsearch_analytics": elasticsearch_analytics,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_nodes_performance_comparison(
        self, 
        node_ids: List[UUID],
        include_content: bool = False
    ) -> Dict[str, Any]:
        """Compare performance metrics across multiple nodes"""
        
        if not node_ids:
            return {"nodes": [], "comparison_summary": {}}
        
        comparison_data = []
        
        for node_id in node_ids:
            try:
                node = await self.session.get(Node, node_id)
                if not node:
                    continue
                
                interaction_stats = await self._get_node_interaction_stats(node_id)
                
                node_data = {
                    "id": str(node_id),
                    "node_type": node.node_type,
                    "title": node.title,
                    "difficulty_level": node.difficulty_level,
                    "success_rate": float(node.success_rate) if node.success_rate else 0.0,
                    "avg_completion_time_ms": node.avg_completion_time or 0,
                    "difficulty_score": float(node.difficulty_score) if node.difficulty_score else 0.0,
                    "engagement_score": float(node.engagement_score) if node.engagement_score else 0.0,
                    "total_interactions": interaction_stats["total_interactions"],
                    "unique_users": interaction_stats["unique_users"]
                }
                
                if include_content:
                    node_data["content"] = node.content
                
                comparison_data.append(node_data)
                
            except Exception as e:
                logger.error(f"Failed to get data for node {node_id}: {e}")
                continue
        
        # Calculate comparison summary
        if comparison_data:
            success_rates = [n["success_rate"] for n in comparison_data if n["success_rate"] is not None]
            completion_times = [n["avg_completion_time_ms"] for n in comparison_data if n["avg_completion_time_ms"] is not None and n["avg_completion_time_ms"] > 0]
            
            comparison_summary = {
                "node_count": len(comparison_data),
                "avg_success_rate": sum(success_rates) / len(success_rates) if success_rates else 0,
                "min_success_rate": min(success_rates) if success_rates else 0,
                "max_success_rate": max(success_rates) if success_rates else 0,
                "avg_completion_time_ms": sum(completion_times) / len(completion_times) if completion_times else 0,
                "fastest_completion_ms": min(completion_times) if completion_times else 0,
                "slowest_completion_ms": max(completion_times) if completion_times else 0,
                "best_performing_node": max(comparison_data, key=lambda x: x["success_rate"]) if comparison_data else None,
                "most_engaging_node": max(comparison_data, key=lambda x: x["engagement_score"]) if comparison_data else None
            }
        else:
            comparison_summary = {}
        
        return {
            "nodes": comparison_data,
            "comparison_summary": comparison_summary,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_activity_node_analytics(self, activity_id: UUID) -> Dict[str, Any]:
        """Get analytics for all nodes within a specific activity"""
        
        # Get activity info
        activity = await self.session.get(ContentItem, activity_id)
        if not activity:
            raise ValueError(f"Activity {activity_id} not found")
        
        # Get all nodes for this activity
        nodes_query = (
            select(Node, ActivityNode)
            .join(ActivityNode, Node.id == ActivityNode.node_id)
            .where(ActivityNode.activity_id == activity_id)
            .order_by(ActivityNode.position)
        )
        
        result = await self.session.execute(nodes_query)
        nodes_data = []
        
        for node, activity_node in result.all():
            interaction_stats = await self._get_node_interaction_stats(
                node.id, activity_id=activity_id
            )
            
            nodes_data.append({
                "node_id": str(node.id),
                "node_type": node.node_type,
                "title": node.title,
                "position": activity_node.position,
                "difficulty_level": node.difficulty_level,
                "success_rate": float(node.success_rate) if node.success_rate else None,
                "avg_completion_time_ms": node.avg_completion_time,
                "activity_specific_stats": interaction_stats,
                "configuration_overrides": activity_node.configuration_overrides
            })
        
        # Calculate activity-level analytics
        activity_analytics = await self._calculate_activity_node_analytics(nodes_data)
        
        return {
            "activity_info": {
                "id": str(activity_id),
                "title": activity.title,
                "total_nodes": len(nodes_data)
            },
            "nodes": nodes_data,
            "activity_analytics": activity_analytics,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_content_optimization_suggestions(
        self, 
        node_id: UUID
    ) -> Dict[str, Any]:
        """Get AI-powered suggestions for optimizing node content"""
        
        node_summary = await self.get_node_summary(node_id)
        suggestions = []
        
        # Analyze performance metrics for suggestions
        performance = node_summary["performance_metrics"]
        interaction_stats = node_summary["interaction_stats"]
        
        success_rate = performance.get("success_rate") or 0
        avg_time = performance.get("avg_completion_time_ms") or 0
        difficulty_level = node_summary["node_info"]["difficulty_level"] or 0
        
        # Success rate suggestions
        if success_rate and success_rate < 60:
            suggestions.append({
                "type": "low_success_rate",
                "severity": "high",
                "title": "Low Success Rate Detected",
                "description": f"Success rate of {success_rate:.1f}% is below optimal range. Consider simplifying content or adding hints.",
                "recommendations": [
                    "Review question clarity and wording",
                    "Add explanatory content or examples", 
                    "Consider reducing difficulty level",
                    "Add hint or help functionality"
                ]
            })
        elif success_rate > 95:
            suggestions.append({
                "type": "high_success_rate", 
                "severity": "medium",
                "title": "Very High Success Rate",
                "description": f"Success rate of {success_rate:.1f}% may indicate content is too easy.",
                "recommendations": [
                    "Consider increasing difficulty level",
                    "Add more challenging variations",
                    "Include deeper thinking prompts"
                ]
            })
        
        # Completion time suggestions
        if avg_time and avg_time > 120000:  # > 2 minutes
            suggestions.append({
                "type": "slow_completion",
                "severity": "medium", 
                "title": "Long Completion Time",
                "description": f"Average completion time of {avg_time/1000:.1f} seconds may indicate content complexity.",
                "recommendations": [
                    "Break complex questions into smaller parts",
                    "Simplify language and instructions",
                    "Add visual aids or examples",
                    "Consider progressive disclosure"
                ]
            })
        
        # Low engagement suggestions
        engagement_score = performance.get("engagement_score", 0)
        if engagement_score and engagement_score < 0.3:
            suggestions.append({
                "type": "low_engagement",
                "severity": "medium",
                "title": "Low Engagement Score", 
                "description": "Learners may not be fully engaging with this content.",
                "recommendations": [
                    "Add interactive elements",
                    "Include multimedia content",
                    "Gamify the interaction",
                    "Make content more personally relevant"
                ]
            })
        
        # Usage frequency suggestions
        total_interactions = interaction_stats.get("total_interactions", 0)
        if total_interactions < 10:
            suggestions.append({
                "type": "low_usage",
                "severity": "low",
                "title": "Low Usage Frequency",
                "description": "This node has limited interaction data for reliable optimization.",
                "recommendations": [
                    "Increase sample size before optimization",
                    "Promote activities containing this node", 
                    "A/B test different versions"
                ]
            })
        
        return {
            "node_id": str(node_id),
            "suggestions": suggestions,
            "optimization_score": self._calculate_optimization_score(node_summary),
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_trending_nodes(
        self, 
        time_window_days: int = 7,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get trending nodes based on recent performance and usage"""
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=time_window_days)
        
        # Get nodes with recent interactions
        trending_query = (
            select(
                Node.id,
                Node.node_type, 
                Node.title,
                Node.success_rate,
                Node.avg_completion_time,
                func.count(NodeInteraction.id).label('recent_interactions'),
                func.count(func.distinct(NodeInteraction.user_id)).label('unique_recent_users'),
                func.avg(NodeInteraction.score).label('recent_avg_score')
            )
            .join(NodeInteraction, Node.id == NodeInteraction.node_id)
            .where(NodeInteraction.created_at >= cutoff_date)
            .group_by(Node.id)
            .order_by(desc('recent_interactions'))
            .limit(limit)
        )
        
        result = await self.session.execute(trending_query)
        trending_nodes = []
        
        for row in result.all():
            trending_nodes.append({
                "node_id": str(row.id),
                "node_type": row.node_type,
                "title": row.title,
                "overall_success_rate": float(row.success_rate) if row.success_rate else None,
                "recent_interactions": row.recent_interactions,
                "unique_recent_users": row.unique_recent_users,
                "recent_avg_score": float(row.recent_avg_score) if row.recent_avg_score else None,
                "trend_score": self._calculate_trend_score(
                    row.recent_interactions,
                    row.unique_recent_users,
                    float(row.recent_avg_score) if row.recent_avg_score else 0
                )
            })
        
        return {
            "time_window_days": time_window_days,
            "trending_nodes": trending_nodes,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Private helper methods
    
    async def _get_node_interaction_stats(
        self, 
        node_id: UUID, 
        activity_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get interaction statistics for a node"""
        
        query = select(
            func.count(NodeInteraction.id).label('total_interactions'),
            func.count(func.distinct(NodeInteraction.user_id)).label('unique_users'),
            func.avg(NodeInteraction.time_to_respond).label('avg_response_time'),
            func.avg(NodeInteraction.score).label('avg_score'),
            func.avg(NodeInteraction.attempts).label('avg_attempts'),
            func.sum(
                case(
                    (NodeInteraction.is_correct.is_(True), 1),
                    else_=0
                )
            ).label('correct_responses')
        ).where(NodeInteraction.node_id == node_id)
        
        if activity_id:
            query = query.where(NodeInteraction.activity_id == activity_id)
        
        result = await self.session.execute(query)
        stats = result.first()
        
        if not stats or stats.total_interactions == 0:
            return {
                "total_interactions": 0,
                "unique_users": 0,
                "avg_response_time_ms": None,
                "avg_score": None,
                "avg_attempts": None,
                "success_rate": None
            }
        
        success_rate = (stats.correct_responses / stats.total_interactions * 100) if stats.total_interactions > 0 else 0
        
        return {
            "total_interactions": stats.total_interactions,
            "unique_users": stats.unique_users,
            "avg_response_time_ms": int(stats.avg_response_time) if stats.avg_response_time else None,
            "avg_score": float(stats.avg_score) if stats.avg_score else None,
            "avg_attempts": float(stats.avg_attempts) if stats.avg_attempts else None,
            "success_rate": round(success_rate, 1)
        }
    
    async def _get_node_activity_usage(self, node_id: UUID) -> Dict[str, Any]:
        """Get statistics about which activities use this node"""
        
        usage_query = (
            select(
                ContentItem.id,
                ContentItem.title,
                ActivityNode.position,
                func.count(NodeInteraction.id).label('interactions_in_activity')
            )
            .join(ActivityNode, ContentItem.id == ActivityNode.activity_id)
            .outerjoin(NodeInteraction, and_(
                NodeInteraction.node_id == node_id,
                NodeInteraction.activity_id == ContentItem.id
            ))
            .where(ActivityNode.node_id == node_id)
            .group_by(ContentItem.id, ContentItem.title, ActivityNode.position)
        )
        
        result = await self.session.execute(usage_query)
        activities = []
        
        for row in result.all():
            activities.append({
                "activity_id": str(row.id),
                "activity_title": row.title,
                "position_in_activity": row.position,
                "interactions": row.interactions_in_activity or 0
            })
        
        total_activities = len(activities)
        total_interactions = sum(a["interactions"] for a in activities)
        
        return {
            "used_in_activities": total_activities,
            "total_interactions_across_activities": total_interactions,
            "activities": activities
        }
    
    async def _get_node_concepts(self, node_id: UUID) -> Dict[str, Any]:
        """Get learning objectives and keywords for a node"""
        
        try:
            # Get learning objectives
            objectives_query = (
                select(LearningObjective)
                .join(LearningObjective.node_relationships)
                .where(LearningObjective.node_relationships.any(node_id=node_id))
            )
            objectives_result = await self.session.execute(objectives_query)
            objectives = objectives_result.scalars().all()
            
            # Get keywords  
            keywords_query = (
                select(Keyword)
                .join(Keyword.node_relationships)
                .where(Keyword.node_relationships.any(node_id=node_id))
            )
            keywords_result = await self.session.execute(keywords_query)
            keywords = keywords_result.scalars().all()
            
            return {
                "learning_objectives": [
                    {
                        "id": str(obj.id),
                        "text": obj.objective_text,
                        "domain": obj.domain,
                        "cognitive_level": obj.cognitive_level
                    } for obj in objectives
                ],
                "keywords": [
                    {
                        "id": str(kw.id),
                        "text": kw.keyword_text,
                        "domain": kw.domain,
                        "category": kw.category
                    } for kw in keywords
                ],
                "has_concepts": len(objectives) > 0 or len(keywords) > 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get concepts for node {node_id}: {e}")
            return {"learning_objectives": [], "keywords": [], "has_concepts": False}
    
    async def _calculate_activity_node_analytics(self, nodes_data: List[Dict]) -> Dict[str, Any]:
        """Calculate aggregate analytics for nodes within an activity"""
        
        if not nodes_data:
            return {}
        
        success_rates = [n["success_rate"] for n in nodes_data if n["success_rate"] is not None]
        completion_times = [n["avg_completion_time_ms"] for n in nodes_data if n["avg_completion_time_ms"] is not None]
        total_interactions = sum(n["activity_specific_stats"]["total_interactions"] for n in nodes_data)
        
        return {
            "total_nodes": len(nodes_data),
            "avg_success_rate": sum(success_rates) / len(success_rates) if success_rates else None,
            "min_success_rate": min(success_rates) if success_rates else None,
            "max_success_rate": max(success_rates) if success_rates else None,
            "avg_completion_time_ms": sum(completion_times) / len(completion_times) if completion_times else None,
            "total_interactions": total_interactions,
            "difficulty_distribution": {
                level: len([n for n in nodes_data if n["difficulty_level"] == level])
                for level in range(1, 11)
            },
            "node_type_distribution": {}  # Could be implemented if needed
        }
    
    def _calculate_optimization_score(self, node_summary: Dict[str, Any]) -> float:
        """Calculate an optimization score (0-1) based on node performance"""
        
        performance = node_summary["performance_metrics"]
        interaction_stats = node_summary["interaction_stats"]
        
        score = 0.0
        factors = 0
        
        # Success rate factor (0-1)
        success_rate = performance.get("success_rate")
        if success_rate is not None:
            # Optimal range is 70-90%
            if 70 <= success_rate <= 90:
                score += 1.0
            elif 60 <= success_rate < 70 or 90 < success_rate <= 95:
                score += 0.7
            else:
                score += 0.3
            factors += 1
        
        # Engagement factor
        engagement_score = performance.get("engagement_score")
        if engagement_score is not None:
            score += engagement_score
            factors += 1
        
        # Usage frequency factor
        total_interactions = interaction_stats.get("total_interactions", 0)
        if total_interactions >= 50:
            score += 1.0
        elif total_interactions >= 20:
            score += 0.7
        elif total_interactions >= 10:
            score += 0.5
        else:
            score += 0.2
        factors += 1
        
        return score / factors if factors > 0 else 0.0
    
    def _calculate_trend_score(
        self, 
        recent_interactions: int, 
        unique_users: int, 
        avg_score: float
    ) -> float:
        """Calculate a trending score based on recent activity"""
        
        # Weight factors
        interaction_weight = min(recent_interactions / 100, 1.0)  # Max at 100 interactions
        user_weight = min(unique_users / 50, 1.0)  # Max at 50 users
        score_weight = avg_score / 100 if avg_score else 0  # Normalize score
        
        return (interaction_weight * 0.4 + user_weight * 0.4 + score_weight * 0.2)


# Convenience functions

async def get_node_analytics_service(
    session: Optional[AsyncSession] = None,
    elasticsearch_service: Optional[ElasticsearchService] = None
) -> NodeAnalyticsService:
    """Get a NodeAnalyticsService instance"""
    if session is None:
        session = db_manager.get_session()
    
    return NodeAnalyticsService(session, elasticsearch_service)


logger.info("Node analytics service loaded")