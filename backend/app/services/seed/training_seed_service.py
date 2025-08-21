"""
Training Seed Service - Clean Architecture Implementation for Training Seeding.

Provides training program and session creation operations for database seeding using TrainingOrmService.
Handles essential training scenarios and demo training programs.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from .base_seed_service import BaseSeedService


class TrainingSeedService(BaseSeedService[TrainingOrmService]):
    """
    Training Seed Service for creating and managing training data during database seeding.

    Uses TrainingOrmService for all training operations, maintaining Clean Architecture
    principles and proper transaction management.

    Key Features:
    - Essential training program creation
    - Demo training sessions and scenarios
    - Training schedule management
    - Integration with user management for instructors/learners
    """

    def __init__(
        self,
        session: AsyncSession,
        training_orm_service: TrainingOrmService,
        user_orm_service: UserOrmService,
    ):
        """
        Initialize Training Seed Service.

        Args:
            session: SQLAlchemy async session
            training_orm_service: TrainingOrmService for training operations
            user_orm_service: UserOrmService for user lookups
        """
        super().__init__(session, training_orm_service)
        self.user_orm_service = user_orm_service

    # Essential Data Implementation

    async def _has_essential_data(self) -> bool:
        """Check if essential training programs already exist."""
        try:
            # Check for any training programs as indicator of essential data
            program_count = await self.orm_service.count_all()
            return program_count > 0

        except Exception as e:
            self.logger.error(f"Failed to check essential training data: {e}")
            return False

    async def _seed_essential_items(self) -> dict[str, Any]:
        """
        Create essential training programs for basic system operation.

        Creates foundational training programs to demonstrate training capabilities.

        Returns:
            Dictionary with seeding results
        """
        # Get users for ownership and instruction
        creator = await self.user_orm_service.get_user_by_username("creator")
        admin = await self.user_orm_service.get_user_by_username("admin")

        if not creator or not admin:
            raise RuntimeError("Essential users not found - seed users first")

        essential_programs = [
            {
                "title": "NLJ Platform Orientation",
                "description": "Introduction to using the NLJ Platform for creating and delivering interactive content",
                "duration_minutes": 60,
                "prerequisites": [],
                "learning_objectives": [
                    "Navigate the NLJ Platform interface",
                    "Create basic interactive content",
                    "Understand content publishing workflow",
                ],
                "instructor_requirements": {
                    "certifications": ["Platform Trainer"],
                    "experience_years": 1,
                    "specialties": ["Platform Training", "User Onboarding"],
                },
                "requires_approval": False,
                "auto_approve": True,
                "created_by_id": admin.id,
            },
            {
                "title": "Interactive Content Creation Fundamentals",
                "description": "Comprehensive training on creating engaging interactive learning experiences using NLJ",
                "duration_minutes": 120,
                "prerequisites": ["NLJ Platform Orientation"],
                "learning_objectives": [
                    "Design effective learning flows",
                    "Create various question types and interactions",
                    "Implement branching scenarios",
                    "Apply learning design principles",
                ],
                "instructor_requirements": {
                    "certifications": ["Instructional Design", "NLJ Certified Trainer"],
                    "experience_years": 3,
                    "specialties": ["Learning Design", "Interactive Content"],
                },
                "requires_approval": True,
                "auto_approve": False,
                "created_by_id": creator.id,
            },
        ]

        created_programs = []

        for program_data in essential_programs:
            try:
                # Check if program already exists
                existing = await self.orm_service.find_by_field("title", program_data["title"])
                if existing:
                    self.logger.info(f"Training program '{program_data['title']}' already exists")
                    continue

                # Skip training program creation - requires content_id integration
                # Training system not fully implemented yet
                self.logger.info(f"Skipping training program '{program_data['title']}' - requires content integration")
                continue

            except Exception as e:
                self.logger.error(f"Failed to create program '{program_data['title']}': {e}")
                continue

        return {
            "status": "completed",
            "items_created": len(created_programs),
            "program_titles": [program.title for program in created_programs],
            "total_duration": sum(program.duration_minutes for program in created_programs),
        }

    async def _seed_demo_items(self, include_samples: bool) -> dict[str, Any]:
        """
        Create demo training programs and sessions.

        Args:
            include_samples: Whether to create comprehensive demo scenarios

        Returns:
            Dictionary with demo seeding results
        """
        if not include_samples:
            return {"status": "skipped", "items_created": 0}

        results = {"programs": 0, "sessions": 0}

        # Create demo programs
        program_result = await self._create_demo_programs()
        results["programs"] = program_result["items_created"]

        # Create demo sessions for existing programs
        session_result = await self._create_demo_sessions()
        results["sessions"] = session_result["items_created"]

        total_created = results["programs"] + results["sessions"]

        return {
            "status": "completed",
            "items_created": total_created,
            "programs_created": results["programs"],
            "sessions_created": results["sessions"],
        }

    async def _create_demo_programs(self) -> dict[str, Any]:
        """Create additional demo training programs."""
        creator = await self.user_orm_service.get_user_by_username("creator")
        if not creator:
            raise RuntimeError("Creator user not found")

        demo_programs = [
            {
                "title": "Advanced Assessment Design",
                "description": "Deep dive into creating sophisticated assessments with branching logic and adaptive feedback",
                "duration_minutes": 180,
                "prerequisites": ["Interactive Content Creation Fundamentals"],
                "learning_objectives": [
                    "Design complex assessment flows",
                    "Implement adaptive scoring systems",
                    "Create detailed feedback mechanisms",
                ],
                "instructor_requirements": {
                    "certifications": ["Assessment Design Specialist"],
                    "experience_years": 5,
                    "specialties": ["Assessment Design", "Psychometrics"],
                },
                "requires_approval": True,
                "auto_approve": False,
            },
            {
                "title": "Gamification in Learning",
                "description": "Learn to incorporate game elements and mechanics into educational content for enhanced engagement",
                "duration_minutes": 90,
                "prerequisites": [],
                "learning_objectives": [
                    "Understand gamification principles",
                    "Apply game mechanics to learning",
                    "Design engaging interactive experiences",
                ],
                "instructor_requirements": {
                    "certifications": ["Gamification Design"],
                    "experience_years": 2,
                    "specialties": ["Game Design", "User Experience"],
                },
                "requires_approval": False,
                "auto_approve": True,
            },
        ]

        created_programs = []

        for program_data in demo_programs:
            try:
                # Check if already exists
                existing = await self.orm_service.find_by_field("title", program_data["title"])
                if existing:
                    continue

                # Skip training program creation - requires content_id integration  
                # Training system not fully implemented yet
                self.logger.info(f"Skipping demo program '{program_data['title']}' - requires content integration")
                continue

            except Exception as e:
                self.logger.error(f"Failed to create demo program '{program_data['title']}': {e}")
                continue

        return {
            "status": "completed",
            "items_created": len(created_programs),
            "program_titles": [program.title for program in created_programs],
        }

    async def _create_demo_sessions(self) -> dict[str, Any]:
        """Create demo training sessions for existing programs."""
        # Session creation not implemented yet - skip for now
        self.logger.info("Session creation not yet implemented - skipping demo sessions")
        return {"status": "skipped", "items_created": 0, "reason": "Sessions not implemented yet"}

    async def _clear_seeded_data(self) -> dict[str, Any]:
        """
        Clear seeded training data with safety checks.

        Only removes training programs and sessions that appear to be seeded.

        Returns:
            Dictionary with clearing results
        """
        removed_items = {"programs": [], "sessions": []}

        try:
            # Define seeded program indicators
            seeded_titles = [
                "NLJ Platform Orientation",
                "Interactive Content Creation Fundamentals",
                "Advanced Assessment Design",
                "Gamification in Learning",
            ]

            # Remove programs (sessions not implemented yet)
            for title in seeded_titles:
                programs = await self.orm_service.find_by_field("title", title)
                for program in programs:
                    await self.orm_service.delete_by_id(program.id)
                    removed_items["programs"].append(program.title)
                    self.logger.info(f"Removed seeded program: {program.title}")

        except Exception as e:
            self.logger.error(f"Failed to clear seeded training data: {e}")

        total_removed = len(removed_items["programs"]) + len(removed_items["sessions"])

        return {
            "status": "completed",
            "items_removed": total_removed,
            "programs_removed": removed_items["programs"],
            "sessions_removed": len(removed_items["sessions"]),
        }

    async def _get_current_status(self) -> dict[str, Any]:
        """
        Get current training seeding status and statistics.

        Returns:
            Dictionary with current status information
        """
        try:
            # Get program and session counts
            total_programs = await self.orm_service.count_all()
            # Sessions count placeholder - TrainingOrmService doesn't have direct method
            total_sessions = 0

            # Get programs with statistics
            all_programs = await self.orm_service.get_all()
            program_info = []

            for program in all_programs:
                # Simplified program info without session details for now
                program_info.append(
                    {
                        "title": program.title,
                        "duration_minutes": program.duration_minutes,
                        "requires_approval": program.requires_approval,
                        "session_count": 0,  # Placeholder - sessions not easily accessible
                    }
                )

            # Check for essential programs
            essential_titles = ["NLJ Platform Orientation", "Interactive Content Creation Fundamentals"]
            essential_status = {}

            for title in essential_titles:
                programs = await self.orm_service.find_by_field("title", title)
                essential_status[title] = len(programs) > 0

            # Check for demo programs
            demo_titles = ["Advanced Assessment Design", "Gamification in Learning"]
            demo_programs = []
            for title in demo_titles:
                programs = await self.orm_service.find_by_field("title", title)
                if programs:
                    demo_programs.append(title)

            return {
                "status": "available",
                "total_programs": total_programs,
                "total_sessions": total_sessions,
                "has_essential": all(essential_status.values()),
                "essential_programs": essential_status,
                "has_demo": len(demo_programs) > 0,
                "demo_programs": demo_programs,
                "program_details": program_info,
                "upcoming_sessions": 0,  # Placeholder - session access not implemented yet
            }

        except Exception as e:
            self.logger.error(f"Failed to get training status: {e}")
            return {
                "status": "error",
                "error": str(e),
                "total_programs": 0,
                "total_sessions": 0,
                "has_essential": False,
                "has_demo": False,
            }
