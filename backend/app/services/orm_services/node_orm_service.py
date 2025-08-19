"""
Node ORM Service - Clean Architecture Implementation.

Provides transaction-managed CRUD operations for Node-related entities using repository pattern.
Handles nodes, activity nodes, interactions, and analytics.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.node import Node, ActivityNode, NodeInteraction
from app.services.orm_repositories.node_repository import (
    NodeRepository,
    ActivityNodeRepository,
    NodeInteractionRepository,
)
from .base_orm_service import BaseOrmService


class NodeOrmService:
    """
    Node ORM Service managing Node-related entities with Clean Architecture.

    This service aggregates multiple node-related repositories to provide
    comprehensive node management operations.

    Responsibilities:
    - Node CRUD operations with transaction management
    - Activity node management and relationships
    - Node interaction tracking and analytics
    - Node performance analysis and optimization
    - Learning objective and keyword associations

    Uses NodeRepository, ActivityNodeRepository, and NodeInteractionRepository.
    """

    def __init__(
        self,
        session: AsyncSession,
        node_repository: NodeRepository,
        activity_node_repository: ActivityNodeRepository,
        node_interaction_repository: NodeInteractionRepository,
    ):
        """Initialize Node ORM Service with session and repositories."""
        self.session = session
        self.node_repo = node_repository
        self.activity_node_repo = activity_node_repository
        self.interaction_repo = node_interaction_repository

    # Transaction Management

    async def begin_transaction(self):
        """Begin a new transaction if not already in one."""
        if not self.session.in_transaction():
            await self.session.begin()

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

    # Node Operations

    async def create_node(
        self,
        content_id: uuid.UUID,
        node_type: str,
        title: str,
        content: dict[str, Any],
        position_x: float = 0.0,
        position_y: float = 0.0,
        metadata: dict[str, Any] | None = None,
    ) -> Node:
        """
        Create new node with validation.

        Args:
            content_id: Associated content ID
            node_type: Type of node (question, information, etc.)
            title: Node title
            content: Node content data
            position_x: X position in editor
            position_y: Y position in editor
            metadata: Additional node metadata

        Returns:
            Created Node

        Raises:
            RuntimeError: If creation fails
            ValueError: If validation fails
        """
        node_data = await self.validate_node_data(
            content_id=content_id,
            node_type=node_type,
            title=title,
            content=content,
            position_x=position_x,
            position_y=position_y,
            metadata=metadata or {},
        )

        try:
            node = await self.node_repo.create(**node_data)
            await self.session.commit()
            return node

        except IntegrityError as e:
            await self.session.rollback()
            if "content" in str(e):
                raise ValueError("Invalid content ID provided") from e
            else:
                raise RuntimeError(f"Node creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create node: {e}") from e

    async def get_node_by_id(self, node_id: uuid.UUID) -> Node | None:
        """Get node by ID."""
        try:
            return await self.node_repo.get_by_id(node_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get node: {e}") from e

    async def get_node_with_relationships(self, node_id: uuid.UUID) -> Node | None:
        """Get node by ID with all relationships loaded."""
        try:
            return await self.node_repo.get_by_id_with_relationships(node_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get node with relationships: {e}") from e

    async def get_nodes_by_content(self, content_id: uuid.UUID, limit: int = 100, offset: int = 0) -> list[Node]:
        """Get all nodes belonging to a specific content item."""
        try:
            return await self.node_repo.get_nodes_by_content(content_id=content_id, limit=limit, offset=offset)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get nodes by content: {e}") from e

    async def search_nodes(
        self,
        search_term: str,
        content_id: uuid.UUID | None = None,
        node_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Node]:
        """Search nodes by title and content."""
        try:
            return await self.node_repo.search_nodes(
                search_term=search_term,
                content_id=content_id,
                node_type=node_type,
                limit=limit,
                offset=offset,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to search nodes: {e}") from e

    async def update_node(self, node_id: uuid.UUID, **update_data: Any) -> Node | None:
        """Update node with validation."""
        try:
            validated_data = await self.validate_node_data(**update_data)
            updated_node = await self.node_repo.update_by_id(node_id, **validated_data)
            if updated_node:
                await self.session.commit()
            return updated_node
        except ValueError:
            raise
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update node: {e}") from e

    async def delete_node(self, node_id: uuid.UUID) -> bool:
        """Delete node."""
        try:
            deleted = await self.node_repo.delete_by_id(node_id)
            if deleted:
                await self.session.commit()
            return deleted
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to delete node: {e}") from e

    # Activity Node Operations

    async def create_activity_node(
        self,
        node_id: uuid.UUID,
        activity_data: dict[str, Any],
    ) -> ActivityNode:
        """Create activity node associated with a node."""
        try:
            activity_node_data = await self.validate_activity_node_data(
                node_id=node_id,
                activity_data=activity_data,
            )
            activity_node = await self.activity_node_repo.create(**activity_node_data)
            await self.session.commit()
            return activity_node
        except IntegrityError as e:
            await self.session.rollback()
            if "node" in str(e):
                raise ValueError("Invalid node ID provided") from e
            else:
                raise RuntimeError(f"Activity node creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create activity node: {e}") from e

    async def get_activity_nodes_by_node(self, node_id: uuid.UUID) -> list[ActivityNode]:
        """Get activity nodes for a specific node."""
        try:
            return await self.activity_node_repo.get_by_node_id(node_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get activity nodes: {e}") from e

    # Node Interaction Operations

    async def create_interaction(
        self,
        node_id: uuid.UUID,
        user_id: uuid.UUID,
        interaction_type: str,
        data: dict[str, Any],
        response_time_ms: int | None = None,
    ) -> NodeInteraction:
        """Create node interaction record."""
        try:
            interaction_data = await self.validate_interaction_data(
                node_id=node_id,
                user_id=user_id,
                interaction_type=interaction_type,
                data=data,
                response_time_ms=response_time_ms,
            )
            interaction = await self.interaction_repo.create(**interaction_data)
            await self.session.commit()
            return interaction
        except IntegrityError as e:
            await self.session.rollback()
            if "node" in str(e):
                raise ValueError("Invalid node ID provided") from e
            elif "user" in str(e):
                raise ValueError("Invalid user ID provided") from e
            else:
                raise RuntimeError(f"Interaction creation failed: {e}") from e
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create interaction: {e}") from e

    async def get_node_interactions(
        self,
        node_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[NodeInteraction]:
        """Get interactions for a specific node."""
        try:
            return await self.interaction_repo.get_by_node_id(node_id=node_id, limit=limit, offset=offset)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get node interactions: {e}") from e

    async def get_user_interactions(
        self,
        user_id: uuid.UUID,
        node_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[NodeInteraction]:
        """Get interactions for a specific user."""
        try:
            return await self.interaction_repo.get_by_user_id(
                user_id=user_id, node_id=node_id, limit=limit, offset=offset
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get user interactions: {e}") from e

    # Analytics Operations

    async def get_node_analytics(self, node_id: uuid.UUID) -> dict[str, Any]:
        """Get analytics for a specific node."""
        try:
            return await self.node_repo.get_node_analytics(node_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get node analytics: {e}") from e

    async def get_content_node_analytics(self, content_id: uuid.UUID) -> dict[str, Any]:
        """Get analytics for all nodes in content."""
        try:
            return await self.node_repo.get_content_analytics(content_id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get content analytics: {e}") from e

    # Validation Methods

    async def validate_node_data(self, **kwargs) -> dict[str, Any]:
        """Validate node data before persistence."""
        validated = {}

        # UUID validations
        if "content_id" in kwargs:
            if not isinstance(kwargs["content_id"], uuid.UUID):
                raise ValueError("Content ID must be a valid UUID")
            validated["content_id"] = kwargs["content_id"]

        # String validations
        if "node_type" in kwargs:
            node_type = kwargs["node_type"]
            if not isinstance(node_type, str) or not node_type.strip():
                raise ValueError("Node type must be a non-empty string")
            validated["node_type"] = node_type.strip()

        if "title" in kwargs:
            title = kwargs["title"]
            if not isinstance(title, str) or not title.strip():
                raise ValueError("Title must be a non-empty string")
            validated["title"] = title.strip()

        # Dictionary validation
        if "content" in kwargs:
            content = kwargs["content"]
            if not isinstance(content, dict):
                raise ValueError("Content must be a dictionary")
            validated["content"] = content

        if "metadata" in kwargs:
            metadata = kwargs["metadata"]
            if not isinstance(metadata, dict):
                raise ValueError("Metadata must be a dictionary")
            validated["metadata"] = metadata

        # Numeric validations
        for field in ["position_x", "position_y"]:
            if field in kwargs:
                value = kwargs[field]
                if not isinstance(value, (int, float)):
                    raise ValueError(f"{field} must be a number")
                validated[field] = float(value)

        return validated

    async def validate_activity_node_data(self, **kwargs) -> dict[str, Any]:
        """Validate activity node data."""
        validated = {}

        if "node_id" in kwargs:
            if not isinstance(kwargs["node_id"], uuid.UUID):
                raise ValueError("Node ID must be a valid UUID")
            validated["node_id"] = kwargs["node_id"]

        if "activity_data" in kwargs:
            data = kwargs["activity_data"]
            if not isinstance(data, dict):
                raise ValueError("Activity data must be a dictionary")
            validated["activity_data"] = data

        return validated

    async def validate_interaction_data(self, **kwargs) -> dict[str, Any]:
        """Validate interaction data."""
        validated = {}

        # UUID validations
        for field in ["node_id", "user_id"]:
            if field in kwargs:
                if not isinstance(kwargs[field], uuid.UUID):
                    raise ValueError(f"{field} must be a valid UUID")
                validated[field] = kwargs[field]

        # String validations
        if "interaction_type" in kwargs:
            interaction_type = kwargs["interaction_type"]
            if not isinstance(interaction_type, str) or not interaction_type.strip():
                raise ValueError("Interaction type must be a non-empty string")
            validated["interaction_type"] = interaction_type.strip()

        # Dictionary validation
        if "data" in kwargs:
            data = kwargs["data"]
            if not isinstance(data, dict):
                raise ValueError("Data must be a dictionary")
            validated["data"] = data

        # Numeric validation
        if "response_time_ms" in kwargs and kwargs["response_time_ms"] is not None:
            response_time = kwargs["response_time_ms"]
            if not isinstance(response_time, int) or response_time < 0:
                raise ValueError("Response time must be a non-negative integer")
            validated["response_time_ms"] = response_time

        return validated
