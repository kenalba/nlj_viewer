"""
Learning Objective ORM Service - Clean Architecture Implementation.

Provides transaction-managed operations for learning objective and keyword entities.
Handles learning objectives, keywords, and node associations for knowledge management.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.learning_objective import LearningObjective, Keyword
from app.services.orm_repositories.learning_objective_repository import (
    LearningObjectiveRepository,
    KeywordRepository,
    NodeLearningObjectiveRepository,
    NodeKeywordRepository,
)


class LearningObjectiveOrmService:
    """
    Learning Objective ORM Service managing knowledge entities with Clean Architecture.

    This service aggregates multiple knowledge-related repositories to provide
    comprehensive learning objective and keyword management operations.

    Responsibilities:
    - Learning objective lifecycle management
    - Keyword management and taxonomy
    - Node-objective and node-keyword associations
    - Knowledge domain organization
    - Learning pathway analytics

    Uses LearningObjectiveRepository, KeywordRepository,
    NodeLearningObjectiveRepository, and NodeKeywordRepository.
    """

    def __init__(
        self,
        session: AsyncSession,
        objective_repository: LearningObjectiveRepository,
        keyword_repository: KeywordRepository,
        node_objective_repository: NodeLearningObjectiveRepository,
        node_keyword_repository: NodeKeywordRepository,
    ):
        """Initialize Learning Objective ORM Service with session and repositories."""
        self.session = session
        self.objective_repo = objective_repository
        self.keyword_repo = keyword_repository
        self.node_objective_repo = node_objective_repository
        self.node_keyword_repo = node_keyword_repository

    # Transaction Management

    async def commit_transaction(self):
        """Commit the current transaction."""
        try:
            await self.session.commit()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to commit transaction: {e}") from e

    async def rollback_transaction(self):
        """Rollback the current transaction."""
        try:
            await self.session.rollback()
        except SQLAlchemyError as e:
            raise RuntimeError(f"Failed to rollback transaction: {e}") from e

    # Learning Objective Operations

    async def create_learning_objective(
        self,
        title: str,
        description: str,
        domain: str,
        bloom_level: str | None = None,
        difficulty_level: int | None = None,
    ) -> LearningObjective:
        """Create new learning objective."""
        objective_data = {
            "title": title.strip(),
            "description": description.strip(),
            "domain": domain.strip(),
            "bloom_level": bloom_level,
            "difficulty_level": difficulty_level,
        }

        try:
            objective = await self.objective_repo.create(**objective_data)
            await self.session.commit()
            return objective
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create learning objective: {e}") from e

    async def get_objectives_by_domain(self, domain: str) -> list[LearningObjective]:
        """Get learning objectives by domain."""
        try:
            return await self.objective_repo.get_by_domain(domain)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get objectives by domain: {e}") from e

    # Keyword Operations

    async def create_keyword(
        self,
        keyword_text: str,
        category: str | None = None,
        weight: float = 1.0,
    ) -> Keyword:
        """Create new keyword."""
        keyword_data = {
            "keyword_text": keyword_text.strip().lower(),
            "category": category,
            "weight": weight,
        }

        try:
            keyword = await self.keyword_repo.create(**keyword_data)
            await self.session.commit()
            return keyword
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create keyword: {e}") from e

    async def find_or_create_keyword(self, keyword_text: str) -> Keyword:
        """Find existing keyword or create new one."""
        try:
            return await self.keyword_repo.find_or_create_keyword(keyword_text)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to find or create keyword: {e}") from e

    async def get_keywords_by_category(self, category: str) -> list[Keyword]:
        """Get keywords by category."""
        try:
            return await self.keyword_repo.get_by_category(category)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get keywords by category: {e}") from e

    # Node Association Operations

    async def associate_node_with_objective(
        self,
        node_id: uuid.UUID,
        objective_id: uuid.UUID,
        relevance_score: float = 1.0,
    ) -> Any:
        """Associate a node with a learning objective."""
        try:
            association = await self.node_objective_repo.associate_node_with_objective(
                node_id, objective_id, relevance_score
            )
            await self.session.commit()
            return association
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError("Invalid node or objective ID provided") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to associate node with objective: {e}") from e

    async def associate_node_with_keyword(
        self,
        node_id: uuid.UUID,
        keyword_id: uuid.UUID,
        relevance_score: float = 1.0,
    ) -> Any:
        """Associate a node with a keyword."""
        try:
            association = await self.node_keyword_repo.associate_node_with_keyword(node_id, keyword_id, relevance_score)
            await self.session.commit()
            return association
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError("Invalid node or keyword ID provided") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to associate node with keyword: {e}") from e

    async def get_node_objectives(self, node_id: uuid.UUID) -> list[LearningObjective]:
        """Get learning objectives associated with a node."""
        try:
            return await self.node_objective_repo.get_node_objectives(node_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get node objectives: {e}") from e

    async def get_node_keywords(self, node_id: uuid.UUID) -> list[Keyword]:
        """Get keywords associated with a node."""
        try:
            return await self.node_keyword_repo.get_node_keywords(node_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get node keywords: {e}") from e
