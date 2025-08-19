"""
Base ORM Service - Clean Architecture Foundation.

Provides common transaction management and CRUD operations for all ORM services.
Enforces proper repository usage and transaction boundaries.
"""

import uuid
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.services.orm_repositories.base_repository import BaseRepository

# Generic type variables for type safety
ModelType = TypeVar("ModelType")
RepositoryType = TypeVar("RepositoryType", bound=BaseRepository)


class BaseOrmService(Generic[ModelType, RepositoryType], ABC):
    """
    Base ORM Service providing transaction management and common CRUD operations.

    This service sits between Use Cases and Repositories, managing transactions
    and providing a clean interface for data operations.

    Key Principles:
    - Uses repository pattern for all data access
    - Manages transaction boundaries (commit/rollback)
    - Provides type-safe CRUD operations
    - Handles SQLAlchemy exceptions gracefully
    """

    def __init__(self, session: AsyncSession, repository: RepositoryType):
        """
        Initialize ORM service with session and repository.

        Args:
            session: SQLAlchemy async session for transaction management
            repository: Repository instance for data access
        """
        self.session = session
        self.repository = repository

    # Core CRUD Operations with Transaction Management

    async def get_by_id(self, id: uuid.UUID) -> ModelType | None:
        """
        Get entity by ID.

        Args:
            id: Entity UUID

        Returns:
            Entity instance or None if not found
        """
        try:
            return await self.repository.get_by_id(id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get entity by ID: {e}") from e

    async def get_all(self, limit: int = 100, offset: int = 0) -> list[ModelType]:
        """
        Get all entities with pagination.

        Args:
            limit: Maximum number of entities to return
            offset: Number of entities to skip

        Returns:
            List of entity instances
        """
        try:
            return await self.repository.get_all(limit=limit, offset=offset)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to get entities: {e}") from e

    async def create(self, **kwargs) -> ModelType:
        """
        Create new entity.

        Args:
            **kwargs: Entity creation data

        Returns:
            Created entity instance

        Raises:
            RuntimeError: If creation fails
        """
        try:
            entity = await self.repository.create(**kwargs)
            await self.session.commit()
            return entity
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to create entity: {e}") from e

    async def update_by_id(self, id: uuid.UUID, **kwargs) -> ModelType | None:
        """
        Update entity by ID.

        Args:
            id: Entity UUID
            **kwargs: Update data

        Returns:
            Updated entity instance or None if not found

        Raises:
            RuntimeError: If update fails
        """
        try:
            entity = await self.repository.update_by_id(id, **kwargs)
            if entity:
                await self.session.commit()
            return entity
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to update entity: {e}") from e

    async def delete_by_id(self, id: uuid.UUID) -> bool:
        """
        Delete entity by ID.

        Args:
            id: Entity UUID

        Returns:
            True if deleted, False if not found

        Raises:
            RuntimeError: If deletion fails
        """
        try:
            deleted = await self.repository.delete_by_id(id)
            if deleted:
                await self.session.commit()
            return deleted
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to delete entity: {e}") from e

    async def exists_by_id(self, id: uuid.UUID) -> bool:
        """
        Check if entity exists by ID.

        Args:
            id: Entity UUID

        Returns:
            True if exists, False otherwise
        """
        try:
            return await self.repository.exists_by_id(id)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to check entity existence: {e}") from e

    async def count_all(self) -> int:
        """
        Get total count of entities.

        Returns:
            Total entity count
        """
        try:
            return await self.repository.count_all()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to count entities: {e}") from e

    async def find_by_field(self, field_name: str, value: Any) -> list[ModelType]:
        """
        Find entities by field value.

        Args:
            field_name: Name of the field to search
            value: Value to search for

        Returns:
            List of matching entities
        """
        try:
            return await self.repository.find_by_field(field_name, value)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to find entities by field: {e}") from e

    async def find_by_fields(self, filters: dict[str, Any]) -> list[ModelType]:
        """
        Find entities by multiple field conditions.

        Args:
            filters: Dictionary of field names and values

        Returns:
            List of matching entities
        """
        try:
            return await self.repository.find_by_fields(filters)
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to find entities by fields: {e}") from e

    async def bulk_create(self, entities_data: list[dict[str, Any]]) -> list[ModelType]:
        """
        Create multiple entities in a single transaction.

        Args:
            entities_data: List of entity creation data

        Returns:
            List of created entities

        Raises:
            RuntimeError: If bulk creation fails
        """
        try:
            entities = await self.repository.bulk_create(entities_data)
            await self.session.commit()
            return entities
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to bulk create entities: {e}") from e

    async def bulk_update(self, updates: list[dict[str, Any]]) -> int:
        """
        Update multiple entities in a single transaction.

        Args:
            updates: List of update dictionaries with 'id' and update fields

        Returns:
            Number of updated entities

        Raises:
            RuntimeError: If bulk update fails
        """
        try:
            updated_count = await self.repository.bulk_update(updates)
            if updated_count > 0:
                await self.session.commit()
            return updated_count
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise RuntimeError(f"Failed to bulk update entities: {e}") from e

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

    # Abstract Methods for Specialized Operations

    @abstractmethod
    async def validate_entity_data(self, **kwargs) -> dict[str, Any]:
        """
        Validate entity data before persistence.

        Subclasses should implement this method to provide entity-specific
        validation logic.

        Args:
            **kwargs: Entity data to validate

        Returns:
            Validated and potentially transformed entity data

        Raises:
            ValueError: If validation fails
        """
        pass

    @abstractmethod
    async def handle_entity_relationships(self, entity: ModelType) -> ModelType:
        """
        Handle complex entity relationships after persistence.

        Subclasses should implement this method to manage entity relationships
        that need special handling after the entity is persisted.

        Args:
            entity: The persisted entity

        Returns:
            Entity with relationships properly handled
        """
        pass
