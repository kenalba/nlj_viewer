"""
Node repository for node analytics, interactions, and performance tracking.
Handles node entities, activity nodes, and interaction data.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.models.node import Node, ActivityNode, NodeInteraction
from .base_repository import BaseRepository

if TYPE_CHECKING:
    pass


class NodeRepository(BaseRepository[Node]):
    """Repository for Node entities with analytics and performance tracking."""
    
    @property
    def model(self) -> type[Node]:
        return Node
    
    async def get_by_id_with_relationships(self, node_id: UUID) -> Node | None:
        """Get node by ID with all relationships loaded."""
        result = await self.session.execute(
            select(Node)
            .options(
                selectinload(Node.learning_objectives),
                selectinload(Node.keywords),
                selectinload(Node.interactions)
            )
            .where(Node.id == node_id)
        )
        return result.scalar_one_or_none()
    
    async def get_nodes_by_content(
        self,
        content_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[Node]:
        """Get all nodes belonging to a specific content item."""
        query = select(Node).where(Node.content_id == content_id)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_nodes_by_type(
        self,
        node_type: str,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[Node]:
        """Get nodes by their type."""
        query = select(Node).where(Node.node_type == node_type)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def search_nodes(
        self,
        search_term: str,
        content_id: UUID | None = None,
        limit: int | None = None
    ) -> list[Node]:
        """Search nodes by title and description."""
        search_condition = or_(
            Node.title.ilike(f"%{search_term}%"),
            Node.description.ilike(f"%{search_term}%")
        )
        
        conditions = [search_condition]
        if content_id is not None:
            conditions.append(Node.content_id == content_id)
        
        query = select(Node).where(and_(*conditions))
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_high_performance_nodes(
        self,
        min_success_rate: float = 0.8,
        min_interactions: int = 10,
        limit: int = 20
    ) -> list[Node]:
        """Get nodes with high performance metrics."""
        query = (
            select(Node)
            .where(
                and_(
                    Node.success_rate >= min_success_rate,
                    Node.total_interactions >= min_interactions
                )
            )
            .order_by(desc(Node.success_rate), desc(Node.total_interactions))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_low_performance_nodes(
        self,
        max_success_rate: float = 0.4,
        min_interactions: int = 5,
        limit: int = 20
    ) -> list[Node]:
        """Get nodes with low performance that need attention."""
        query = (
            select(Node)
            .where(
                and_(
                    Node.success_rate <= max_success_rate,
                    Node.total_interactions >= min_interactions
                )
            )
            .order_by(Node.success_rate, desc(Node.total_interactions))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_nodes_by_difficulty(
        self,
        min_difficulty: float | None = None,
        max_difficulty: float | None = None,
        limit: int | None = None
    ) -> list[Node]:
        """Get nodes within a difficulty range."""
        conditions = []
        
        if min_difficulty is not None:
            conditions.append(Node.difficulty_score >= min_difficulty)
        if max_difficulty is not None:
            conditions.append(Node.difficulty_score <= max_difficulty)
        
        query = select(Node)
        if conditions:
            query = query.where(and_(*conditions))
            
        query = query.order_by(Node.difficulty_score)
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_nodes_with_keywords(
        self,
        keywords: list[str],
        match_all: bool = False,
        limit: int | None = None
    ) -> list[Node]:
        """Get nodes that match specified keywords."""
        from app.models.learning_objective import NodeKeyword, Keyword
        
        # Subquery to find keyword IDs
        keyword_subquery = select(Keyword.id).where(Keyword.name.in_(keywords))
        
        if match_all:
            # Must match ALL keywords
            query = (
                select(Node)
                .join(NodeKeyword, Node.id == NodeKeyword.node_id)
                .where(NodeKeyword.keyword_id.in_(keyword_subquery))
                .group_by(Node.id)
                .having(func.count(NodeKeyword.keyword_id) == len(keywords))
            )
        else:
            # Match ANY keyword
            query = (
                select(Node)
                .join(NodeKeyword, Node.id == NodeKeyword.node_id)
                .where(NodeKeyword.keyword_id.in_(keyword_subquery))
                .distinct()
            )
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_nodes_with_learning_objectives(
        self,
        objective_ids: list[UUID],
        limit: int | None = None
    ) -> list[Node]:
        """Get nodes associated with specific learning objectives."""
        from app.models.learning_objective import NodeLearningObjective
        
        query = (
            select(Node)
            .join(NodeLearningObjective, Node.id == NodeLearningObjective.node_id)
            .where(NodeLearningObjective.learning_objective_id.in_(objective_ids))
            .distinct()
        )
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_node_statistics(self, content_id: UUID | None = None) -> dict:
        """Get node statistics for analytics."""
        base_query = select(Node)
        if content_id is not None:
            base_query = base_query.where(Node.content_id == content_id)
        
        # Count by type
        type_counts = await self.session.execute(
            select(Node.node_type, func.count(Node.id))
            .select_from(base_query.subquery())
            .group_by(Node.node_type)
        )
        
        # Performance statistics
        performance_stats = await self.session.execute(
            select(
                func.avg(Node.success_rate),
                func.min(Node.success_rate),
                func.max(Node.success_rate),
                func.avg(Node.difficulty_score),
                func.sum(Node.total_interactions)
            )
            .select_from(base_query.subquery())
        )
        
        # Total count
        if content_id is not None:
            total_nodes = await self.session.execute(
                select(func.count(Node.id)).where(Node.content_id == content_id)
            )
        else:
            total_nodes = await self.count_all()
        
        perf_result = performance_stats.first()
        
        return {
            "total_nodes": total_nodes.scalar() if content_id else total_nodes,
            "by_type": dict(type_counts.all()),
            "average_success_rate": float(perf_result[0] or 0),
            "min_success_rate": float(perf_result[1] or 0),
            "max_success_rate": float(perf_result[2] or 0),
            "average_difficulty": float(perf_result[3] or 0),
            "total_interactions": perf_result[4] or 0
        }
    
    async def update_node_performance(
        self,
        node_id: UUID,
        success_rate: float,
        difficulty_score: float,
        total_interactions: int
    ) -> bool:
        """Update node performance metrics."""
        return await self.update_by_id(
            node_id,
            success_rate=success_rate,
            difficulty_score=difficulty_score,
            total_interactions=total_interactions
        ) is not None
    
    async def increment_interaction_count(self, node_id: UUID) -> bool:
        """Increment the total interaction count for a node."""
        from sqlalchemy import update
        
        result = await self.session.execute(
            update(Node)
            .where(Node.id == node_id)
            .values(total_interactions=Node.total_interactions + 1)
        )
        return result.rowcount > 0


class ActivityNodeRepository(BaseRepository[ActivityNode]):
    """Repository for ActivityNode entities with activity-specific operations."""
    
    @property
    def model(self) -> type[ActivityNode]:
        return ActivityNode
    
    async def get_by_node_id(self, node_id: UUID) -> ActivityNode | None:
        """Get activity node by its associated node ID."""
        result = await self.session.execute(
            select(ActivityNode).where(ActivityNode.node_id == node_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_activity_type(
        self,
        activity_type: str,
        limit: int | None = None
    ) -> list[ActivityNode]:
        """Get activity nodes by their activity type."""
        query = select(ActivityNode).where(ActivityNode.activity_type == activity_type)
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_activity_statistics(self) -> dict:
        """Get activity node statistics."""
        # Count by activity type
        type_counts = await self.session.execute(
            select(ActivityNode.activity_type, func.count(ActivityNode.id))
            .group_by(ActivityNode.activity_type)
        )
        
        # Performance metrics
        performance_stats = await self.session.execute(
            select(
                func.avg(ActivityNode.completion_rate),
                func.avg(ActivityNode.average_time_spent)
            )
        )
        
        total_activities = await self.count_all()
        perf_result = performance_stats.first()
        
        return {
            "total_activity_nodes": total_activities,
            "by_activity_type": dict(type_counts.all()),
            "average_completion_rate": float(perf_result[0] or 0),
            "average_time_spent": float(perf_result[1] or 0)
        }


class NodeInteractionRepository(BaseRepository[NodeInteraction]):
    """Repository for NodeInteraction entities with interaction tracking."""
    
    @property
    def model(self) -> type[NodeInteraction]:
        return NodeInteraction
    
    async def get_interactions_by_node(
        self,
        node_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[NodeInteraction]:
        """Get interactions for a specific node."""
        query = (
            select(NodeInteraction)
            .where(NodeInteraction.node_id == node_id)
            .order_by(desc(NodeInteraction.timestamp))
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_interactions_by_user(
        self,
        user_id: UUID,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[NodeInteraction]:
        """Get interactions for a specific user."""
        query = (
            select(NodeInteraction)
            .where(NodeInteraction.user_id == user_id)
            .order_by(desc(NodeInteraction.timestamp))
        )
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_recent_interactions(
        self,
        hours: int = 24,
        limit: int = 100
    ) -> list[NodeInteraction]:
        """Get recent node interactions."""
        from datetime import datetime, timedelta, timezone
        
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        query = (
            select(NodeInteraction)
            .where(NodeInteraction.timestamp >= cutoff_time)
            .order_by(desc(NodeInteraction.timestamp))
            .limit(limit)
        )
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_interaction_statistics(self, node_id: UUID | None = None) -> dict:
        """Get interaction statistics."""
        base_query = select(NodeInteraction)
        if node_id is not None:
            base_query = base_query.where(NodeInteraction.node_id == node_id)
        
        # Success/failure counts
        outcome_counts = await self.session.execute(
            select(NodeInteraction.was_successful, func.count(NodeInteraction.id))
            .select_from(base_query.subquery())
            .group_by(NodeInteraction.was_successful)
        )
        
        # Time statistics
        time_stats = await self.session.execute(
            select(
                func.avg(NodeInteraction.time_spent),
                func.min(NodeInteraction.time_spent),
                func.max(NodeInteraction.time_spent)
            )
            .select_from(base_query.subquery())
        )
        
        # Total interactions
        if node_id is not None:
            total_interactions = await self.session.execute(
                select(func.count(NodeInteraction.id)).where(NodeInteraction.node_id == node_id)
            )
        else:
            total_interactions = await self.count_all()
        
        outcome_dict = dict(outcome_counts.all())
        time_result = time_stats.first()
        
        successful = outcome_dict.get(True, 0)
        failed = outcome_dict.get(False, 0)
        total = successful + failed
        success_rate = (successful / total * 100) if total > 0 else 0
        
        return {
            "total_interactions": total_interactions.scalar() if node_id else total_interactions,
            "successful_interactions": successful,
            "failed_interactions": failed,
            "success_rate": round(success_rate, 2),
            "average_time_spent": float(time_result[0] or 0),
            "min_time_spent": float(time_result[1] or 0),
            "max_time_spent": float(time_result[2] or 0)
        }