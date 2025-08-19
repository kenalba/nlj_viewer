"""
Learning objective and keyword repository for knowledge management.
Handles learning objectives, keywords, and their associations with nodes.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.models.learning_objective import (
    LearningObjective,
    Keyword,
    NodeLearningObjective,
    NodeKeyword,
    ObjectivePrerequisite
)
from .base_repository import BaseRepository

if TYPE_CHECKING:
    pass


class LearningObjectiveRepository(BaseRepository[LearningObjective]):
    """Repository for LearningObjective entities with knowledge management."""
    
    @property
    def model(self) -> type[LearningObjective]:
        return LearningObjective
    
    async def get_by_id_with_relationships(self, objective_id: UUID) -> LearningObjective | None:
        """Get learning objective by ID with all relationships loaded."""
        result = await self.session.execute(
            select(LearningObjective)
            .options(
                selectinload(LearningObjective.prerequisites),
                selectinload(LearningObjective.dependent_objectives),
                selectinload(LearningObjective.nodes)
            )
            .where(LearningObjective.id == objective_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_domain(
        self,
        domain: str,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[LearningObjective]:
        """Get learning objectives by domain."""
        query = select(LearningObjective).where(LearningObjective.domain == domain)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_cognitive_level(
        self,
        cognitive_level: str,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[LearningObjective]:
        """Get learning objectives by cognitive level."""
        query = select(LearningObjective).where(LearningObjective.cognitive_level == cognitive_level)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def search_objectives(
        self,
        search_term: str,
        domain: str | None = None,
        limit: int | None = None
    ) -> list[LearningObjective]:
        """Search learning objectives by title and description."""
        search_condition = or_(
            LearningObjective.title.ilike(f"%{search_term}%"),
            LearningObjective.description.ilike(f"%{search_term}%")
        )
        
        conditions = [search_condition]
        if domain is not None:
            conditions.append(LearningObjective.domain == domain)
        
        query = select(LearningObjective).where(and_(*conditions))
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_root_objectives(
        self,
        domain: str | None = None,
        limit: int | None = None
    ) -> list[LearningObjective]:
        """Get learning objectives with no prerequisites (root objectives)."""
        # Subquery for objectives that have prerequisites
        has_prerequisites_subquery = select(ObjectivePrerequisite.objective_id).distinct()
        
        query = select(LearningObjective).where(
            LearningObjective.id.not_in(has_prerequisites_subquery)
        )
        
        if domain is not None:
            query = query.where(LearningObjective.domain == domain)
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_objectives_by_difficulty(
        self,
        min_difficulty: float | None = None,
        max_difficulty: float | None = None,
        limit: int | None = None
    ) -> list[LearningObjective]:
        """Get objectives within a difficulty range."""
        conditions = []
        
        if min_difficulty is not None:
            conditions.append(LearningObjective.difficulty_score >= min_difficulty)
        if max_difficulty is not None:
            conditions.append(LearningObjective.difficulty_score <= max_difficulty)
        
        query = select(LearningObjective)
        if conditions:
            query = query.where(and_(*conditions))
            
        query = query.order_by(LearningObjective.difficulty_score)
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_prerequisites_for_objective(self, objective_id: UUID) -> list[LearningObjective]:
        """Get direct prerequisites for a learning objective."""
        result = await self.session.execute(
            select(LearningObjective)
            .join(ObjectivePrerequisite, LearningObjective.id == ObjectivePrerequisite.prerequisite_id)
            .where(ObjectivePrerequisite.objective_id == objective_id)
        )
        return list(result.scalars().all())
    
    async def get_dependent_objectives(self, objective_id: UUID) -> list[LearningObjective]:
        """Get objectives that depend on this objective."""
        result = await self.session.execute(
            select(LearningObjective)
            .join(ObjectivePrerequisite, LearningObjective.id == ObjectivePrerequisite.objective_id)
            .where(ObjectivePrerequisite.prerequisite_id == objective_id)
        )
        return list(result.scalars().all())
    
    async def get_objective_statistics(self) -> dict:
        """Get learning objective statistics."""
        # Count by domain
        domain_counts = await self.session.execute(
            select(LearningObjective.domain, func.count(LearningObjective.id))
            .group_by(LearningObjective.domain)
        )
        
        # Count by cognitive level
        cognitive_counts = await self.session.execute(
            select(LearningObjective.cognitive_level, func.count(LearningObjective.id))
            .group_by(LearningObjective.cognitive_level)
        )
        
        # Total objectives
        total_objectives = await self.count_all()
        
        # Difficulty statistics
        difficulty_stats = await self.session.execute(
            select(
                func.avg(LearningObjective.difficulty_score),
                func.min(LearningObjective.difficulty_score),
                func.max(LearningObjective.difficulty_score)
            )
        )
        
        # Prerequisites statistics
        prerequisite_counts = await self.session.execute(
            select(func.count(ObjectivePrerequisite.id))
        )
        
        difficulty_result = difficulty_stats.first()
        
        return {
            "total_objectives": total_objectives,
            "by_domain": dict(domain_counts.all()),
            "by_cognitive_level": dict(cognitive_counts.all()),
            "average_difficulty": float(difficulty_result[0] or 0),
            "min_difficulty": float(difficulty_result[1] or 0),
            "max_difficulty": float(difficulty_result[2] or 0),
            "total_prerequisites": prerequisite_counts.scalar()
        }


class KeywordRepository(BaseRepository[Keyword]):
    """Repository for Keyword entities with keyword management."""
    
    @property
    def model(self) -> type[Keyword]:
        return Keyword
    
    async def get_by_name(self, name: str) -> Keyword | None:
        """Get keyword by exact name."""
        result = await self.session.execute(
            select(Keyword).where(Keyword.name == name)
        )
        return result.scalar_one_or_none()
    
    async def search_keywords(
        self,
        search_term: str,
        category: str | None = None,
        limit: int | None = None
    ) -> list[Keyword]:
        """Search keywords by name and description."""
        search_condition = or_(
            Keyword.name.ilike(f"%{search_term}%"),
            Keyword.description.ilike(f"%{search_term}%")
        )
        
        conditions = [search_condition]
        if category is not None:
            conditions.append(Keyword.category == category)
        
        query = select(Keyword).where(and_(*conditions))
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_category(
        self,
        category: str,
        limit: int | None = None,
        offset: int | None = None
    ) -> list[Keyword]:
        """Get keywords by category."""
        query = select(Keyword).where(Keyword.category == category)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_popular_keywords(
        self,
        limit: int = 20
    ) -> list[tuple[Keyword, int]]:
        """Get most frequently used keywords."""
        result = await self.session.execute(
            select(Keyword, func.count(NodeKeyword.id).label('usage_count'))
            .outerjoin(NodeKeyword, Keyword.id == NodeKeyword.keyword_id)
            .group_by(Keyword.id)
            .order_by(desc('usage_count'))
            .limit(limit)
        )
        
        return [(row[0], row[1]) for row in result.all()]
    
    async def get_keywords_for_node(self, node_id: UUID) -> list[Keyword]:
        """Get all keywords associated with a node."""
        result = await self.session.execute(
            select(Keyword)
            .join(NodeKeyword, Keyword.id == NodeKeyword.keyword_id)
            .where(NodeKeyword.node_id == node_id)
        )
        return list(result.scalars().all())
    
    async def get_keyword_statistics(self) -> dict:
        """Get keyword statistics."""
        # Count by category
        category_counts = await self.session.execute(
            select(Keyword.category, func.count(Keyword.id))
            .group_by(Keyword.category)
        )
        
        # Total keywords
        total_keywords = await self.count_all()
        
        # Usage statistics
        usage_stats = await self.session.execute(
            select(
                func.count(NodeKeyword.id),
                func.count(func.distinct(NodeKeyword.keyword_id))
            )
        )
        
        usage_result = usage_stats.first()
        total_associations = usage_result[0] or 0
        used_keywords = usage_result[1] or 0
        unused_keywords = total_keywords - used_keywords
        
        return {
            "total_keywords": total_keywords,
            "by_category": dict(category_counts.all()),
            "used_keywords": used_keywords,
            "unused_keywords": unused_keywords,
            "total_associations": total_associations
        }
    
    async def find_or_create_keyword(
        self,
        name: str,
        category: str | None = None,
        description: str | None = None
    ) -> Keyword:
        """Find existing keyword or create new one."""
        existing = await self.get_by_name(name)
        if existing:
            return existing
        
        return await self.create(
            name=name,
            category=category,
            description=description
        )


class NodeLearningObjectiveRepository(BaseRepository[NodeLearningObjective]):
    """Repository for NodeLearningObjective associations."""
    
    @property
    def model(self) -> type[NodeLearningObjective]:
        return NodeLearningObjective
    
    async def get_objectives_for_node(self, node_id: UUID) -> list[LearningObjective]:
        """Get learning objectives for a specific node."""
        result = await self.session.execute(
            select(LearningObjective)
            .join(NodeLearningObjective, LearningObjective.id == NodeLearningObjective.learning_objective_id)
            .where(NodeLearningObjective.node_id == node_id)
        )
        return list(result.scalars().all())
    
    async def get_nodes_for_objective(self, objective_id: UUID) -> list:
        """Get nodes associated with a learning objective."""
        from app.models.node import Node
        
        result = await self.session.execute(
            select(Node)
            .join(NodeLearningObjective, Node.id == NodeLearningObjective.node_id)
            .where(NodeLearningObjective.learning_objective_id == objective_id)
        )
        return list(result.scalars().all())
    
    async def associate_node_with_objective(
        self,
        node_id: UUID,
        objective_id: UUID,
        relevance_score: float = 1.0
    ) -> NodeLearningObjective:
        """Create association between node and learning objective."""
        return await self.create(
            node_id=node_id,
            learning_objective_id=objective_id,
            relevance_score=relevance_score
        )


class NodeKeywordRepository(BaseRepository[NodeKeyword]):
    """Repository for NodeKeyword associations."""
    
    @property
    def model(self) -> type[NodeKeyword]:
        return NodeKeyword
    
    async def get_keywords_for_node(self, node_id: UUID) -> list[Keyword]:
        """Get keywords for a specific node."""
        result = await self.session.execute(
            select(Keyword)
            .join(NodeKeyword, Keyword.id == NodeKeyword.keyword_id)
            .where(NodeKeyword.node_id == node_id)
        )
        return list(result.scalars().all())
    
    async def get_nodes_for_keyword(self, keyword_id: UUID) -> list:
        """Get nodes associated with a keyword."""
        from app.models.node import Node
        
        result = await self.session.execute(
            select(Node)
            .join(NodeKeyword, Node.id == NodeKeyword.node_id)
            .where(NodeKeyword.keyword_id == keyword_id)
        )
        return list(result.scalars().all())
    
    async def associate_node_with_keyword(
        self,
        node_id: UUID,
        keyword_id: UUID,
        relevance_score: float = 1.0
    ) -> NodeKeyword:
        """Create association between node and keyword."""
        return await self.create(
            node_id=node_id,
            keyword_id=keyword_id,
            relevance_score=relevance_score
        )
    
    async def bulk_associate_keywords(
        self,
        node_id: UUID,
        keyword_data: list[dict]
    ) -> list[NodeKeyword]:
        """Bulk create keyword associations for a node."""
        associations_data = [
            {
                "node_id": node_id,
                "keyword_id": kw["keyword_id"],
                "relevance_score": kw.get("relevance_score", 1.0)
            }
            for kw in keyword_data
        ]
        
        return await self.bulk_create(associations_data)