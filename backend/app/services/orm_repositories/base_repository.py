"""
Base repository for all ORM repositories in the system.
Provides common CRUD operations and transaction management.
"""

from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

# Generic type for model classes
ModelType = TypeVar("ModelType", bound=DeclarativeBase)


class BaseRepository(ABC, Generic[ModelType]):
    """
    Abstract base repository providing common CRUD operations.
    
    All repositories should inherit from this class and implement
    the model property to specify which SQLAlchemy model they manage.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    @property
    @abstractmethod
    def model(self) -> type[ModelType]:
        """Return the SQLAlchemy model class this repository manages."""
        raise NotImplementedError
    
    async def create(self, **data) -> ModelType:
        """Create a new instance of the model."""
        instance = self.model(**data)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance
    
    async def get_by_id(self, id: UUID) -> ModelType | None:
        """Get a single instance by ID."""
        result = await self.session.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_all(
        self, 
        limit: int | None = None, 
        offset: int | None = None
    ) -> list[ModelType]:
        """Get all instances with optional pagination."""
        query = select(self.model)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def update_by_id(self, id: UUID, **data) -> ModelType | None:
        """Update an instance by ID."""
        # First check if the instance exists
        instance = await self.get_by_id(id)
        if not instance:
            return None
            
        # Update the instance
        await self.session.execute(
            update(self.model)
            .where(self.model.id == id)
            .values(**data)
        )
        
        # Refresh to get updated values
        await self.session.refresh(instance)
        return instance
    
    async def delete_by_id(self, id: UUID) -> bool:
        """Delete an instance by ID. Returns True if deleted, False if not found."""
        result = await self.session.execute(
            delete(self.model).where(self.model.id == id)
        )
        return result.rowcount > 0
    
    async def exists_by_id(self, id: UUID) -> bool:
        """Check if an instance exists by ID."""
        result = await self.session.execute(
            select(func.count(self.model.id)).where(self.model.id == id)
        )
        return result.scalar() > 0
    
    async def count_all(self) -> int:
        """Count total number of instances."""
        result = await self.session.execute(
            select(func.count(self.model.id))
        )
        return result.scalar()
    
    async def find_by_field(
        self, 
        field_name: str, 
        value: Any,
        limit: int | None = None
    ) -> list[ModelType]:
        """Find instances by a specific field value."""
        field = getattr(self.model, field_name)
        query = select(self.model).where(field == value)
        
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def find_by_fields(
        self,
        filters: dict[str, Any],
        limit: int | None = None,
        offset: int | None = None
    ) -> list[ModelType]:
        """Find instances matching multiple field conditions."""
        query = select(self.model)
        
        # Add WHERE conditions for each filter
        for field_name, value in filters.items():
            field = getattr(self.model, field_name)
            query = query.where(field == value)
        
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
            
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def bulk_create(self, instances_data: list[dict[str, Any]]) -> list[ModelType]:
        """Create multiple instances in bulk."""
        instances = [self.model(**data) for data in instances_data]
        self.session.add_all(instances)
        await self.session.flush()
        
        # Refresh all instances to get generated IDs
        for instance in instances:
            await self.session.refresh(instance)
            
        return instances
    
    async def bulk_update(
        self, 
        updates: list[dict[str, Any]], 
        id_field: str = "id"
    ) -> int:
        """
        Bulk update multiple instances.
        Each update dict should contain the ID and fields to update.
        Returns the number of updated rows.
        """
        updated_count = 0
        
        for update_data in updates:
            if id_field not in update_data:
                continue
                
            id_value = update_data.pop(id_field)
            result = await self.session.execute(
                update(self.model)
                .where(getattr(self.model, id_field) == id_value)
                .values(**update_data)
            )
            updated_count += result.rowcount
            
        return updated_count