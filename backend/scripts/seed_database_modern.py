#!/usr/bin/env python3
"""
Modern Database Seeding Script - Clean Architecture Implementation.

This script uses the new seed service architecture to populate the database
with users, content, and training data following Clean Architecture principles.

Key Features:
- Uses ORM services for all database operations
- Loads static files systematically
- Provides comprehensive progress reporting
- Supports both RDS and direct PostgreSQL connections
- Clean transaction management and error handling

Usage:
    python scripts/seed_database_modern.py [--mode essential|demo|full] [--clear-first]
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import db_manager, create_tables
from app.services.orm_repositories.content_repository import ContentRepository
from app.services.orm_repositories.training_repository import (
    TrainingProgramRepository,
    TrainingSessionRepository,
    TrainingBookingRepository,
    AttendanceRecordRepository,
)
from app.services.orm_repositories.user_repository import UserRepository
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from app.services.seed.content_seed_service import ContentSeedService
from app.services.seed.static_loader_service import StaticLoaderService
from app.services.seed.training_seed_service import TrainingSeedService
from app.services.seed.user_seed_service import UserSeedService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


class ModernDatabaseSeeder:
    """
    Modern database seeder using Clean Architecture principles.

    Coordinates seeding operations through ORM services and seed services,
    providing comprehensive database initialization with proper error handling.
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize seeder with database session.

        Args:
            session: SQLAlchemy async session for all operations
        """
        self.session = session
        self._initialize_services()

    def _initialize_services(self):
        """Initialize all ORM services and seed services."""
        # Initialize repositories
        self.user_repository = UserRepository(self.session)
        self.content_repository = ContentRepository(self.session)
        self.training_program_repository = TrainingProgramRepository(self.session)
        self.training_session_repository = TrainingSessionRepository(self.session)
        self.training_booking_repository = TrainingBookingRepository(self.session)
        self.attendance_record_repository = AttendanceRecordRepository(self.session)

        # Initialize ORM services
        self.user_orm_service = UserOrmService(self.session, self.user_repository)
        self.content_orm_service = ContentOrmService(self.session, self.content_repository)
        self.training_orm_service = TrainingOrmService(
            self.session,
            self.training_program_repository,
            self.training_session_repository,
            self.training_booking_repository,
            self.attendance_record_repository,
        )

        # Initialize seed services
        self.user_seed_service = UserSeedService(self.session, self.user_orm_service)
        self.content_seed_service = ContentSeedService(
            self.session, self.content_orm_service, self.user_orm_service
        )
        self.training_seed_service = TrainingSeedService(
            self.session, self.training_orm_service, self.user_orm_service
        )
        self.static_loader_service = StaticLoaderService(self.session, self.content_seed_service)

        logger.info("🔧 All seed services initialized successfully")

    async def validate_environment(self) -> bool:
        """
        Validate that the seeding environment is ready.

        Returns:
            True if environment is valid, False otherwise
        """
        logger.info("🔍 Validating seeding environment...")

        validation_results = {}

        # Validate each seed service
        for service_name, service in [
            ("user", self.user_seed_service),
            ("content", self.content_seed_service),
            ("training", self.training_seed_service),
        ]:
            try:
                results = await service.validate_seeding_environment()
                validation_results[service_name] = results
                logger.info(f"✅ {service_name.title()} service validation: {results}")
            except Exception as e:
                logger.error(f"❌ {service_name.title()} service validation failed: {e}")
                validation_results[service_name] = {"error": str(e)}

        # Check overall validation status
        all_valid = all(
            result.get("database_connected") and result.get("orm_service_ready")
            for result in validation_results.values()
            if "error" not in result
        )

        if all_valid:
            logger.info("✅ Environment validation successful")
        else:
            logger.error("❌ Environment validation failed")

        return all_valid

    async def seed_essential_data(self) -> dict[str, Any]:
        """
        Seed essential data required for basic system operation.

        Returns:
            Dictionary with seeding results
        """
        logger.info("🌱 Starting essential data seeding...")

        results = {
            "users": {"status": "pending"},
            "content": {"status": "pending"},
            "training": {"status": "pending"},
        }

        try:
            # Step 1: Seed users (required first for ownership relationships)
            logger.info("👥 Seeding essential users...")
            user_result = await self.user_seed_service.seed_essential_data()
            results["users"] = user_result
            logger.info(f"✅ User seeding: {user_result['items_created']} users created")

            # Step 2: Seed essential content
            logger.info("📚 Seeding essential content...")
            content_result = await self.content_seed_service.seed_essential_data()
            results["content"] = content_result
            logger.info(f"✅ Content seeding: {content_result['items_created']} items created")

            # Step 3: Seed essential training programs
            logger.info("🎓 Seeding essential training programs...")
            training_result = await self.training_seed_service.seed_essential_data()
            results["training"] = training_result
            logger.info(f"✅ Training seeding: {training_result['items_created']} programs created")

            total_items = sum(result.get("items_created", 0) for result in results.values())
            logger.info(f"🎉 Essential seeding completed: {total_items} total items created")

            return {
                "status": "completed",
                "total_items": total_items,
                "breakdown": results,
            }

        except Exception as e:
            logger.error(f"💥 Essential seeding failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "breakdown": results,
            }

    async def seed_demo_data(self, include_static_files: bool = True) -> dict[str, Any]:
        """
        Seed comprehensive demo data including static files.

        Args:
            include_static_files: Whether to load content from static files

        Returns:
            Dictionary with seeding results
        """
        logger.info("🚀 Starting demo data seeding...")

        results = {
            "users": {"status": "pending"},
            "content": {"status": "pending"},
            "training": {"status": "pending"},
            "static_files": {"status": "pending"},
        }

        try:
            # Ensure essential data exists first
            essential_result = await self.seed_essential_data()
            if essential_result["status"] != "completed":
                logger.warning("Essential data seeding incomplete, continuing with demo seeding...")

            # Step 1: Seed demo users
            logger.info("👥 Seeding demo users...")
            user_result = await self.user_seed_service.seed_demo_data(include_samples=True)
            results["users"] = user_result
            logger.info(f"✅ Demo users: {user_result['items_created']} users created")

            # Step 2: Seed demo content
            logger.info("📚 Seeding demo content...")
            content_result = await self.content_seed_service.seed_demo_data(include_samples=True)
            results["content"] = content_result
            logger.info(f"✅ Demo content: {content_result['items_created']} items created")

            # Step 3: Seed demo training programs and sessions
            logger.info("🎓 Seeding demo training...")
            training_result = await self.training_seed_service.seed_demo_data(include_samples=True)
            results["training"] = training_result
            logger.info(f"✅ Demo training: {training_result['items_created']} programs/sessions created")

            # Step 4: Load static files comprehensively
            if include_static_files:
                logger.info("📁 Loading static content files...")
                static_result = await self.static_loader_service.load_all_static_content()
                results["static_files"] = static_result
                logger.info(f"✅ Static files: {static_result['items_loaded']} files loaded")
            else:
                results["static_files"] = {"status": "skipped", "items_loaded": 0}

            total_items = (
                sum(result.get("items_created", 0) for result in results.values())
                + results["static_files"].get("items_loaded", 0)
            )

            logger.info(f"🎉 Demo seeding completed: {total_items} total items created")

            return {
                "status": "completed",
                "total_items": total_items,
                "breakdown": results,
            }

        except Exception as e:
            logger.error(f"💥 Demo seeding failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "breakdown": results,
            }

    async def clear_seeded_data(self, confirm: bool = False) -> dict[str, Any]:
        """
        Clear all seeded data with safety confirmation.

        Args:
            confirm: Safety confirmation flag - must be True to proceed

        Returns:
            Dictionary with clearing results
        """
        if not confirm:
            logger.error("🚫 Data clearing requires explicit confirmation")
            return {"status": "refused", "reason": "Confirmation required"}

        logger.warning("🗑️ Starting data clearing operation...")

        results = {
            "content": {"status": "pending"},
            "training": {"status": "pending"},
            "users": {"status": "pending"},
        }

        try:
            # Clear in reverse dependency order (content -> training -> users)
            # Step 1: Clear content
            logger.info("📚 Clearing seeded content...")
            content_result = await self.content_seed_service.clear_existing_data(confirm=True)
            results["content"] = content_result
            logger.info(f"✅ Content cleared: {content_result['items_removed']} items")

            # Step 2: Clear training data
            logger.info("🎓 Clearing seeded training data...")
            training_result = await self.training_seed_service.clear_existing_data(confirm=True)
            results["training"] = training_result
            logger.info(f"✅ Training cleared: {training_result['items_removed']} items")

            # Step 3: Clear users (last due to foreign key dependencies)
            logger.info("👥 Clearing seeded users...")
            user_result = await self.user_seed_service.clear_existing_data(confirm=True)
            results["users"] = user_result
            logger.info(f"✅ Users cleared: {user_result['items_removed']} items")

            total_removed = sum(result.get("items_removed", 0) for result in results.values())
            logger.info(f"🎉 Data clearing completed: {total_removed} total items removed")

            return {
                "status": "completed",
                "total_removed": total_removed,
                "breakdown": results,
            }

        except Exception as e:
            logger.error(f"💥 Data clearing failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "breakdown": results,
            }

    async def get_seeding_status(self) -> dict[str, Any]:
        """
        Get comprehensive seeding status across all services.

        Returns:
            Dictionary with current status information
        """
        logger.info("📊 Gathering seeding status...")

        status_results = {}

        # Get status from each service
        services = [
            ("users", self.user_seed_service),
            ("content", self.content_seed_service),
            ("training", self.training_seed_service),
        ]

        for service_name, service in services:
            try:
                status = await service.get_seeding_status()
                status_results[service_name] = status
            except Exception as e:
                logger.error(f"Failed to get {service_name} status: {e}")
                status_results[service_name] = {"status": "error", "error": str(e)}

        # Get static file inventory
        try:
            static_status = await self.static_loader_service.get_static_content_inventory()
            status_results["static_files"] = static_status
        except Exception as e:
            logger.error(f"Failed to get static file status: {e}")
            status_results["static_files"] = {"status": "error", "error": str(e)}

        return {
            "status": "available",
            "services": status_results,
            "summary": {
                "total_users": status_results.get("users", {}).get("total_users", 0),
                "total_content": status_results.get("content", {}).get("total_content", 0),
                "total_training_programs": status_results.get("training", {}).get("total_programs", 0),
                "static_files_available": status_results.get("static_files", {}).get("inventory", {}).get("total_files", 0),
            },
        }


async def main():
    """Main seeding script entry point."""
    parser = argparse.ArgumentParser(description="Modern NLJ Platform Database Seeder")
    parser.add_argument(
        "--mode",
        choices=["essential", "demo", "full"],
        default="demo",
        help="Seeding mode: essential (users + basic content), demo (+ static files), full (comprehensive)",
    )
    parser.add_argument(
        "--clear-first",
        action="store_true",
        help="Clear existing seeded data before seeding (use with caution)",
    )
    parser.add_argument(
        "--status-only",
        action="store_true",
        help="Only show current seeding status without making changes",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only validate environment without seeding",
    )

    args = parser.parse_args()

    logger.info("🚀 Starting NLJ Platform Database Seeder")
    logger.info("🔍 Detecting database configuration...")

    try:
        # Initialize database manager (handles both RDS and direct PostgreSQL)
        await db_manager.initialize()

        # Create tables if they don't exist
        await create_tables()

        connection_info = db_manager.get_connection_info()
        logger.info(f"📊 Connected to: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")
        logger.info(f"🔗 Database: {connection_info.get('url', 'Unknown')}")

        # Create seeder instance
        async with db_manager.get_session() as session:
            seeder = ModernDatabaseSeeder(session)

            # Validate environment
            if not await seeder.validate_environment():
                logger.error("💥 Environment validation failed")
                return 1

            if args.validate_only:
                logger.info("✅ Environment validation completed successfully")
                # Explicitly close the session before returning
                await session.close()
                return 0

            # Show status if requested
            if args.status_only:
                status = await seeder.get_seeding_status()
                logger.info("📊 Current Seeding Status:")
                logger.info(f"   Users: {status['summary']['total_users']}")
                logger.info(f"   Content: {status['summary']['total_content']}")
                logger.info(f"   Training Programs: {status['summary']['total_training_programs']}")
                logger.info(f"   Static Files Available: {status['summary']['static_files_available']}")
                # Explicitly close the session before returning
                await session.close()
                return 0

            # Clear existing data if requested
            if args.clear_first:
                logger.warning("⚠️  Clearing existing seeded data...")
                clear_result = await seeder.clear_seeded_data(confirm=True)
                if clear_result["status"] != "completed":
                    logger.error(f"💥 Data clearing failed: {clear_result.get('error', 'Unknown error')}")
                    return 1

            # Perform seeding based on mode
            if args.mode == "essential":
                result = await seeder.seed_essential_data()
            elif args.mode == "demo":
                result = await seeder.seed_demo_data(include_static_files=True)
            elif args.mode == "full":
                # Full mode includes everything
                result = await seeder.seed_demo_data(include_static_files=True)
            else:
                logger.error(f"Unknown seeding mode: {args.mode}")
                return 1

            # Report results
            if result["status"] == "completed":
                logger.info("=" * 50)
                logger.info("🎉 DATABASE SEEDING COMPLETE!")
                logger.info("=" * 50)
                logger.info(f"Mode: {args.mode}")
                logger.info(f"Total items created: {result['total_items']}")
                
                if "breakdown" in result:
                    logger.info("\nBreakdown by service:")
                    for service, data in result["breakdown"].items():
                        if isinstance(data, dict) and "items_created" in data:
                            logger.info(f"  • {service}: {data['items_created']} items")
                        elif isinstance(data, dict) and "items_loaded" in data:
                            logger.info(f"  • {service}: {data['items_loaded']} items")
                
                logger.info("\n🔐 Login credentials:")
                logger.info("  Admin: admin / Admin123!")
                logger.info("  Creator: creator / Creator123!")
                logger.info("  Reviewer: reviewer / Reviewer123!")
                logger.info("  Player: player / Player123!")
                logger.info("  Learner: learner / Learner123!")

                return 0
            else:
                logger.error(f"💥 Seeding failed: {result.get('error', 'Unknown error')}")
                return 1

    except Exception as e:
        logger.error(f"💥 Seeding script failed: {e}")
        return 1
    finally:
        await db_manager.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)