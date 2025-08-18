"""
Content Recommendation Service

Provides intelligent content recommendations based on:
- Learning objective and keyword overlap
- Node performance metrics
- User learning patterns and concept mastery
- Content difficulty and success rates
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content_item import ContentItem
from app.models.keywords import Keyword
from app.models.learning_objectives import LearningObjective  
from app.models.node import Node, ActivityNode
from app.models.node_keywords import NodeKeyword
from app.models.node_learning_objectives import NodeLearningObjective
from app.services.elasticsearch_service import ElasticsearchService
from app.services.node_analytics_service import NodeAnalyticsService

logger = logging.getLogger(__name__)


class ContentRecommendationService:
    """
    Service for generating intelligent content recommendations.
    
    Uses hybrid approach combining PostgreSQL relationship data
    with Elasticsearch performance analytics for optimal suggestions.
    """
    
    def __init__(self, db_session: AsyncSession, es_service: ElasticsearchService):
        self.db = db_session
        self.es_service = es_service
        self.analytics_service = NodeAnalyticsService(es_service)
        
    async def get_related_content(
        self,
        content_id: UUID,
        limit: int = 10,
        include_performance: bool = True,
        min_similarity_score: float = 0.3
    ) -> List[Dict[str, Any]]:
        """
        Get content related to a specific activity based on concept overlap.
        
        Args:
            content_id: Source activity ID
            limit: Maximum recommendations to return
            include_performance: Include performance metrics in results
            min_similarity_score: Minimum similarity threshold (0.0-1.0)
            
        Returns:
            List of related content recommendations with similarity scores
        """
        try:
            # Get source activity and its concepts
            source_activity = await self._get_activity_with_concepts(content_id)
            if not source_activity:
                return []
                
            source_concepts = await self._extract_activity_concepts(source_activity)
            if not source_concepts:
                return []
                
            # Find related activities based on concept overlap
            related_activities = await self._find_related_activities(
                source_concepts=source_concepts,
                exclude_id=content_id,
                limit=limit * 3  # Get more to filter and rank
            )
            
            # Score and rank recommendations
            recommendations = []
            for activity in related_activities:
                activity_concepts = await self._extract_activity_concepts(activity)
                similarity_score = self._calculate_concept_similarity(
                    source_concepts, activity_concepts
                )
                
                if similarity_score >= min_similarity_score:
                    rec = await self._build_recommendation(
                        activity=activity,
                        similarity_score=similarity_score,
                        include_performance=include_performance
                    )
                    recommendations.append(rec)
            
            # Sort by combined score (similarity + performance)
            recommendations.sort(key=lambda x: x['combined_score'], reverse=True)
            
            logger.info(f"Generated {len(recommendations)} recommendations for activity {content_id}")
            return recommendations[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get related content for {content_id}: {e}")
            return []
    
    async def get_node_recommendations(
        self,
        node_id: UUID,
        limit: int = 8,
        include_different_types: bool = True,
        performance_weight: float = 0.4
    ) -> List[Dict[str, Any]]:
        """
        Get node-level recommendations for Flow Editor integration.
        
        Args:
            node_id: Source node ID
            limit: Maximum recommendations to return
            include_different_types: Include nodes of different types
            performance_weight: Weight for performance vs similarity (0.0-1.0)
            
        Returns:
            List of recommended nodes with performance insights
        """
        try:
            # Get source node and its concepts
            source_node = await self._get_node_with_concepts(node_id)
            if not source_node:
                return []
                
            source_concepts = await self._extract_node_concepts(source_node)
            if not source_concepts:
                return []
                
            # Find related nodes
            query = (
                select(Node)
                .options(
                    selectinload(Node.keywords),
                    selectinload(Node.learning_objectives)
                )
                .where(Node.id != node_id)
                .order_by(desc(Node.success_rate), desc(Node.created_at))
                .limit(limit * 4)  # Get more for better filtering
            )
            
            # Apply type filtering if requested
            if not include_different_types:
                query = query.where(Node.node_type == source_node.node_type)
                
            result = await self.db.execute(query)
            candidate_nodes = result.scalars().all()
            
            # Score and rank node recommendations
            recommendations = []
            for node in candidate_nodes:
                node_concepts = await self._extract_node_concepts(node)
                similarity_score = self._calculate_concept_similarity(
                    source_concepts, node_concepts
                )
                
                if similarity_score > 0.1:  # Lower threshold for nodes
                    rec = await self._build_node_recommendation(
                        node=node,
                        similarity_score=similarity_score,
                        performance_weight=performance_weight
                    )
                    recommendations.append(rec)
            
            # Sort by combined score
            recommendations.sort(key=lambda x: x['combined_score'], reverse=True)
            
            logger.info(f"Generated {len(recommendations)} node recommendations for {node_id}")
            return recommendations[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get node recommendations for {node_id}: {e}")
            return []
    
    async def get_concept_based_suggestions(
        self,
        keywords: List[str],
        objectives: List[str],
        limit: int = 15,
        difficulty_range: Optional[Tuple[int, int]] = None,
        performance_threshold: float = 0.6
    ) -> List[Dict[str, Any]]:
        """
        Get content suggestions based on specific concepts.
        Used for content creation assistance.
        
        Args:
            keywords: Target keywords
            objectives: Target learning objectives  
            limit: Maximum suggestions to return
            difficulty_range: Optional difficulty range (min, max) 1-10
            performance_threshold: Minimum success rate threshold
            
        Returns:
            List of content suggestions matching concepts
        """
        try:
            # Find matching concepts in database
            keyword_ids = await self._find_keyword_ids(keywords)
            objective_ids = await self._find_objective_ids(objectives)
            
            if not keyword_ids and not objective_ids:
                return []
            
            # Build query for matching content
            subqueries = []
            
            if keyword_ids:
                keyword_subquery = (
                    select(Node.id)
                    .join(NodeKeyword)
                    .where(NodeKeyword.keyword_id.in_(keyword_ids))
                    .group_by(Node.id)
                    .having(func.count(NodeKeyword.keyword_id) >= min(len(keyword_ids), 2))
                )
                subqueries.append(keyword_subquery)
            
            if objective_ids:
                objective_subquery = (
                    select(Node.id)
                    .join(NodeLearningObjective)
                    .where(NodeLearningObjective.objective_id.in_(objective_ids))
                    .group_by(Node.id)
                    .having(func.count(NodeLearningObjective.objective_id) >= 1)
                )
                subqueries.append(objective_subquery)
            
            # Combine subqueries
            if len(subqueries) > 1:
                matching_node_ids = subqueries[0].union(*subqueries[1:])
            else:
                matching_node_ids = subqueries[0]
            
            # Get matching nodes with performance filtering
            query = (
                select(Node)
                .options(
                    selectinload(Node.keywords),
                    selectinload(Node.learning_objectives)
                )
                .where(Node.id.in_(matching_node_ids))
            )
            
            # Apply performance threshold
            if performance_threshold > 0:
                query = query.where(
                    or_(
                        Node.success_rate.is_(None),  # Include unrated content
                        Node.success_rate >= performance_threshold
                    )
                )
            
            # Apply difficulty range
            if difficulty_range:
                min_diff, max_diff = difficulty_range
                query = query.where(
                    and_(
                        Node.difficulty_level >= min_diff,
                        Node.difficulty_level <= max_diff
                    )
                )
            
            query = query.order_by(desc(Node.success_rate), desc(Node.created_at)).limit(limit)
            
            result = await self.db.execute(query)
            matching_nodes = result.scalars().all()
            
            # Build suggestions with concept matching scores
            suggestions = []
            for node in matching_nodes:
                node_concepts = await self._extract_node_concepts(node)
                concept_match_score = self._calculate_concept_match_score(
                    target_keywords=keywords,
                    target_objectives=objectives,
                    node_concepts=node_concepts
                )
                
                suggestion = await self._build_concept_suggestion(
                    node=node,
                    concept_match_score=concept_match_score
                )
                suggestions.append(suggestion)
            
            # Sort by concept match score
            suggestions.sort(key=lambda x: x['concept_match_score'], reverse=True)
            
            logger.info(f"Generated {len(suggestions)} concept-based suggestions")
            return suggestions
            
        except Exception as e:
            logger.error(f"Failed to get concept-based suggestions: {e}")
            return []
    
    async def _get_activity_with_concepts(self, activity_id: UUID) -> Optional[ContentItem]:
        """Get activity with loaded concept relationships."""
        query = (
            select(ContentItem)
            .options(
                selectinload(ContentItem.activity_nodes).selectinload(ActivityNode.node)
                .selectinload(Node.keywords),
                selectinload(ContentItem.activity_nodes).selectinload(ActivityNode.node)
                .selectinload(Node.learning_objectives)
            )
            .where(ContentItem.id == activity_id)
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_node_with_concepts(self, node_id: UUID) -> Optional[Node]:
        """Get node with loaded concept relationships."""
        query = (
            select(Node)
            .options(
                selectinload(Node.keywords),
                selectinload(Node.learning_objectives)
            )
            .where(Node.id == node_id)
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def _extract_activity_concepts(self, activity: ContentItem) -> Dict[str, Set[str]]:
        """Extract all concepts from an activity's nodes."""
        concepts = {"keywords": set(), "objectives": set()}
        
        for activity_node in activity.activity_nodes:
            node = activity_node.node
            node_concepts = await self._extract_node_concepts(node)
            concepts["keywords"].update(node_concepts["keywords"])
            concepts["objectives"].update(node_concepts["objectives"])
        
        return concepts
    
    async def _extract_node_concepts(self, node: Node) -> Dict[str, Set[str]]:
        """Extract concepts from a single node."""
        concepts = {"keywords": set(), "objectives": set()}
        
        # Extract keywords
        for keyword_rel in node.keywords:
            concepts["keywords"].add(keyword_rel.keyword.keyword_text.lower())
        
        # Extract objectives
        for objective_rel in node.learning_objectives:
            concepts["objectives"].add(objective_rel.objective.objective_text.lower())
        
        return concepts
    
    async def _find_related_activities(
        self, 
        source_concepts: Dict[str, Set[str]], 
        exclude_id: UUID,
        limit: int
    ) -> List[ContentItem]:
        """Find activities that share concepts with the source."""
        # Get keyword and objective IDs
        keyword_ids = await self._find_keyword_ids(list(source_concepts["keywords"]))
        objective_ids = await self._find_objective_ids(list(source_concepts["objectives"]))
        
        if not keyword_ids and not objective_ids:
            return []
        
        # Build query to find activities with shared concepts
        subqueries = []
        
        if keyword_ids:
            keyword_activities = (
                select(ContentItem.id)
                .join(ActivityNode)
                .join(Node)
                .join(NodeKeyword)
                .where(NodeKeyword.keyword_id.in_(keyword_ids))
                .where(ContentItem.id != exclude_id)
            )
            subqueries.append(keyword_activities)
        
        if objective_ids:
            objective_activities = (
                select(ContentItem.id)
                .join(ActivityNode)
                .join(Node)
                .join(NodeLearningObjective)
                .where(NodeLearningObjective.objective_id.in_(objective_ids))
                .where(ContentItem.id != exclude_id)
            )
            subqueries.append(objective_activities)
        
        # Union the subqueries
        if len(subqueries) > 1:
            related_activity_ids = subqueries[0].union(*subqueries[1:])
        else:
            related_activity_ids = subqueries[0]
        
        # Get the activities
        query = (
            select(ContentItem)
            .options(
                selectinload(ContentItem.activity_nodes).selectinload(ActivityNode.node)
                .selectinload(Node.keywords),
                selectinload(ContentItem.activity_nodes).selectinload(ActivityNode.node)
                .selectinload(Node.learning_objectives)
            )
            .where(ContentItem.id.in_(related_activity_ids))
            .order_by(desc(ContentItem.created_at))
            .limit(limit)
        )
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def _find_keyword_ids(self, keywords: List[str]) -> List[UUID]:
        """Find database IDs for keywords."""
        if not keywords:
            return []
        
        query = select(Keyword.id).where(
            Keyword.keyword_text.in_([kw.lower() for kw in keywords])
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def _find_objective_ids(self, objectives: List[str]) -> List[UUID]:
        """Find database IDs for learning objectives."""
        if not objectives:
            return []
        
        query = select(LearningObjective.id).where(
            LearningObjective.objective_text.in_([obj.lower() for obj in objectives])
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    def _calculate_concept_similarity(
        self, 
        concepts1: Dict[str, Set[str]], 
        concepts2: Dict[str, Set[str]]
    ) -> float:
        """Calculate similarity between two concept sets using Jaccard similarity."""
        total_similarity = 0.0
        weight_sum = 0.0
        
        # Weight objectives more heavily than keywords
        weights = {"keywords": 0.4, "objectives": 0.6}
        
        for concept_type, weight in weights.items():
            set1 = concepts1.get(concept_type, set())
            set2 = concepts2.get(concept_type, set())
            
            if set1 or set2:
                intersection = len(set1.intersection(set2))
                union = len(set1.union(set2))
                jaccard = intersection / union if union > 0 else 0.0
                
                total_similarity += jaccard * weight
                weight_sum += weight
        
        return total_similarity / weight_sum if weight_sum > 0 else 0.0
    
    def _calculate_concept_match_score(
        self,
        target_keywords: List[str],
        target_objectives: List[str], 
        node_concepts: Dict[str, Set[str]]
    ) -> float:
        """Calculate how well node concepts match target concepts."""
        target_kw_set = set(kw.lower() for kw in target_keywords)
        target_obj_set = set(obj.lower() for obj in target_objectives)
        
        node_kw_set = node_concepts.get("keywords", set())
        node_obj_set = node_concepts.get("objectives", set())
        
        # Calculate match percentages
        kw_matches = len(target_kw_set.intersection(node_kw_set))
        kw_score = kw_matches / len(target_kw_set) if target_kw_set else 0.0
        
        obj_matches = len(target_obj_set.intersection(node_obj_set))
        obj_score = obj_matches / len(target_obj_set) if target_obj_set else 0.0
        
        # Weight objectives more heavily
        return (kw_score * 0.3) + (obj_score * 0.7)
    
    async def _build_recommendation(
        self, 
        activity: ContentItem,
        similarity_score: float,
        include_performance: bool
    ) -> Dict[str, Any]:
        """Build a recommendation object for an activity."""
        rec = {
            "id": str(activity.id),
            "title": activity.title,
            "description": activity.description,
            "similarity_score": similarity_score,
            "created_at": activity.created_at.isoformat(),
            "node_count": len(activity.activity_nodes),
        }
        
        if include_performance:
            # Get aggregated performance from nodes
            performance_data = await self._get_activity_performance_summary(activity)
            rec.update(performance_data)
        
        # Calculate combined score (similarity + performance)
        performance_score = rec.get("avg_success_rate", 0.5)  # Default to neutral
        rec["combined_score"] = (similarity_score * 0.6) + (performance_score * 0.4)
        
        return rec
    
    async def _build_node_recommendation(
        self,
        node: Node,
        similarity_score: float,
        performance_weight: float
    ) -> Dict[str, Any]:
        """Build a recommendation object for a node."""
        rec = {
            "id": str(node.id),
            "title": node.title or f"{node.node_type.title()} Node",
            "node_type": node.node_type,
            "similarity_score": similarity_score,
            "difficulty_level": node.difficulty_level,
            "success_rate": float(node.success_rate or 0.5),
            "avg_completion_time": node.avg_completion_time,
            "created_at": node.created_at.isoformat(),
        }
        
        # Calculate combined score
        performance_score = rec["success_rate"]
        rec["combined_score"] = (
            similarity_score * (1 - performance_weight) + 
            performance_score * performance_weight
        )
        
        return rec
    
    async def _build_concept_suggestion(
        self,
        node: Node, 
        concept_match_score: float
    ) -> Dict[str, Any]:
        """Build a concept-based suggestion object."""
        node_concepts = await self._extract_node_concepts(node)
        
        return {
            "id": str(node.id),
            "title": node.title or f"{node.node_type.title()} Node",
            "node_type": node.node_type,
            "concept_match_score": concept_match_score,
            "difficulty_level": node.difficulty_level,
            "success_rate": float(node.success_rate or 0.5),
            "keywords": list(node_concepts["keywords"]),
            "objectives": list(node_concepts["objectives"]),
            "usage_count": len(node.activity_nodes),
            "created_at": node.created_at.isoformat(),
        }
    
    async def _get_activity_performance_summary(self, activity: ContentItem) -> Dict[str, Any]:
        """Get performance summary for an activity based on its nodes."""
        if not activity.activity_nodes:
            return {
                "avg_success_rate": 0.5,
                "avg_completion_time": None,
                "avg_difficulty_score": None
            }
        
        success_rates = []
        completion_times = []
        difficulty_scores = []
        
        for activity_node in activity.activity_nodes:
            node = activity_node.node
            
            if node.success_rate is not None:
                success_rates.append(float(node.success_rate))
            
            if node.avg_completion_time is not None:
                completion_times.append(node.avg_completion_time)
            
            if node.difficulty_score is not None:
                difficulty_scores.append(float(node.difficulty_score))
        
        return {
            "avg_success_rate": sum(success_rates) / len(success_rates) if success_rates else 0.5,
            "avg_completion_time": int(sum(completion_times) / len(completion_times)) if completion_times else None,
            "avg_difficulty_score": sum(difficulty_scores) / len(difficulty_scores) if difficulty_scores else None,
        }


# Convenience functions for common recommendation scenarios

async def get_content_recommendations(
    db_session: AsyncSession,
    es_service: ElasticsearchService,
    content_id: UUID,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """Get recommendations for a specific piece of content."""
    service = ContentRecommendationService(db_session, es_service)
    return await service.get_related_content(content_id, limit=limit)


async def get_flow_editor_node_suggestions(
    db_session: AsyncSession, 
    es_service: ElasticsearchService,
    node_id: UUID,
    limit: int = 8
) -> List[Dict[str, Any]]:
    """Get node recommendations for Flow Editor palette."""
    service = ContentRecommendationService(db_session, es_service)
    return await service.get_node_recommendations(node_id, limit=limit)


async def get_concept_content_suggestions(
    db_session: AsyncSession,
    es_service: ElasticsearchService, 
    keywords: List[str],
    objectives: List[str],
    limit: int = 15
) -> List[Dict[str, Any]]:
    """Get content suggestions based on specific concepts."""
    service = ContentRecommendationService(db_session, es_service)
    return await service.get_concept_based_suggestions(
        keywords=keywords,
        objectives=objectives, 
        limit=limit
    )