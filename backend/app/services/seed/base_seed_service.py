"""
Base Seed Service - Clean Architecture Foundation for Database Seeding.

Provides common seeding operations and transaction management using ORM services.
Enforces proper Clean Architecture patterns for data initialization.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.services.orm_services.base_orm_service import BaseOrmService

logger = logging.getLogger(__name__)

# Generic type variables for type safety
OrmServiceType = TypeVar("OrmServiceType", bound=BaseOrmService)


class BaseSeedService(Generic[OrmServiceType], ABC):
    """
    Base Seed Service providing common seeding operations and transaction management.

    This service coordinates database seeding through ORM services, maintaining
    Clean Architecture principles and proper transaction boundaries.

    Key Principles:
    - Uses ORM services for all data operations
    - Manages seeding workflows and error handling
    - Provides type-safe seeding operations
    - Handles validation and schema conversion
    """

    def __init__(self, session: AsyncSession, orm_service: OrmServiceType):
        """
        Initialize seed service with session and ORM service.

        Args:
            session: SQLAlchemy async session for transaction context
            orm_service: ORM service instance for data operations
        """
        self.session = session
        self.orm_service = orm_service
        self.logger = logger.getChild(self.__class__.__name__)

    async def seed_essential_data(self) -> dict[str, Any]:
        """
        Seed essential data required for basic system operation.

        Returns:
            Dictionary with seeding results and statistics

        Raises:
            RuntimeError: If essential seeding fails
        """
        try:
            self.logger.info("Starting essential data seeding")

            # Check if data already exists
            if await self._has_essential_data():
                return {"status": "skipped", "reason": "Essential data already exists", "items_created": 0}

            # Perform essential seeding
            result = await self._seed_essential_items()

            self.logger.info(f"Essential seeding completed: {result.get('items_created', 0)} items")
            return result

        except Exception as e:
            self.logger.error(f"Essential seeding failed: {e}")
            raise RuntimeError(f"Failed to seed essential data: {e}") from e

    async def seed_demo_data(self, include_samples: bool = True) -> dict[str, Any]:
        """
        Seed comprehensive demo data for development and testing.

        Args:
            include_samples: Whether to include static sample files

        Returns:
            Dictionary with seeding results and statistics

        Raises:
            RuntimeError: If demo seeding fails
        """
        try:
            self.logger.info("Starting demo data seeding")

            # Ensure essential data exists first
            essential_result = await self.seed_essential_data()

            # Seed demo-specific data
            demo_result = await self._seed_demo_items(include_samples)

            # Combine results
            total_items = essential_result.get("items_created", 0) + demo_result.get("items_created", 0)

            result = {
                "status": "completed",
                "items_created": total_items,
                "essential": essential_result,
                "demo": demo_result,
            }

            self.logger.info(f"Demo seeding completed: {total_items} total items")
            return result

        except Exception as e:
            self.logger.error(f"Demo seeding failed: {e}")
            raise RuntimeError(f"Failed to seed demo data: {e}") from e

    async def clear_existing_data(self, confirm: bool = False) -> dict[str, Any]:
        """
        Clear existing seeded data with safety confirmation.

        Args:
            confirm: Safety confirmation flag - must be True to proceed

        Returns:
            Dictionary with clearing results

        Raises:
            RuntimeError: If clearing fails or not confirmed
        """
        if not confirm:
            raise RuntimeError("Data clearing requires explicit confirmation")

        try:
            self.logger.warning("Starting data clearing operation")

            result = await self._clear_seeded_data()

            self.logger.info(f"Data clearing completed: {result.get('items_removed', 0)} items removed")
            return result

        except Exception as e:
            self.logger.error(f"Data clearing failed: {e}")
            raise RuntimeError(f"Failed to clear data: {e}") from e

    async def get_seeding_status(self) -> dict[str, Any]:
        """
        Get current seeding status and statistics.

        Returns:
            Dictionary with current seeding status information
        """
        try:
            return await self._get_current_status()

        except Exception as e:
            self.logger.error(f"Failed to get seeding status: {e}")
            return {"status": "error", "error": str(e), "has_essential": False, "has_demo": False, "total_items": 0}

    # Validation and Utility Methods

    async def validate_seeding_environment(self) -> dict[str, bool]:
        """
        Validate that the seeding environment is ready.

        Returns:
            Dictionary with validation results for different components
        """
        validations = {}

        try:
            # Check database connection
            validations["database_connected"] = await self._check_database_connection()

            # Check ORM service availability
            validations["orm_service_ready"] = await self._check_orm_service()

            # Check schema compatibility
            validations["schema_compatible"] = await self._check_schema_compatibility()

            # Check for conflicts
            validations["no_conflicts"] = await self._check_data_conflicts()

        except Exception as e:
            self.logger.error(f"Environment validation failed: {e}")
            validations["validation_error"] = str(e)

        return validations

    async def _check_database_connection(self) -> bool:
        """Check if database connection is working."""
        try:
            from sqlalchemy import text

            result = await self.session.execute(text("SELECT 1"))
            result.fetchone()
            return True
        except SQLAlchemyError:
            return False

    async def _check_orm_service(self) -> bool:
        """Check if ORM service is properly initialized."""
        return (
            self.orm_service is not None
            and hasattr(self.orm_service, "session")
            and hasattr(self.orm_service, "repository")
        )

    async def _check_schema_compatibility(self) -> bool:
        """Check if database schema is compatible with seeding requirements."""
        # Default implementation - subclasses can override
        return True

    async def _check_data_conflicts(self) -> bool:
        """Check for potential data conflicts before seeding."""
        # Default implementation - subclasses can override
        return True

    # Abstract Methods for Subclass Implementation

    @abstractmethod
    async def _has_essential_data(self) -> bool:
        """
        Check if essential data already exists.

        Returns:
            True if essential data exists, False otherwise
        """
        pass

    @abstractmethod
    async def _seed_essential_items(self) -> dict[str, Any]:
        """
        Seed essential items specific to this service domain.

        Returns:
            Dictionary with seeding results
        """
        pass

    @abstractmethod
    async def _seed_demo_items(self, include_samples: bool) -> dict[str, Any]:
        """
        Seed demo items specific to this service domain.

        Args:
            include_samples: Whether to include static sample files

        Returns:
            Dictionary with seeding results
        """
        pass

    @abstractmethod
    async def _clear_seeded_data(self) -> dict[str, Any]:
        """
        Clear seeded data specific to this service domain.

        Returns:
            Dictionary with clearing results
        """
        pass

    @abstractmethod
    async def _get_current_status(self) -> dict[str, Any]:
        """
        Get current status for this service domain.

        Returns:
            Dictionary with current status information
        """
        pass
