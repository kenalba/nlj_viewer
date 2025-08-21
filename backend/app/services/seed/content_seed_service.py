"""
Content Seed Service - Clean Architecture Implementation for Content Seeding.

Provides content creation and management operations for database seeding using ContentOrmService.
Handles NLJ content loading from static files and demo content scenarios.
"""

import json
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentState, ContentType, LearningStyle
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from .base_seed_service import BaseSeedService


class ContentSeedService(BaseSeedService[ContentOrmService]):
    """
    Content Seed Service for creating and managing content during database seeding.

    Uses ContentOrmService for all content operations, maintaining Clean Architecture
    principles and proper transaction management.

    Key Features:
    - Static NLJ file loading from /static directory
    - Demo content scenarios with varied types
    - Content validation and conflict resolution
    - Integration with user management for ownership
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService,
        user_orm_service: UserOrmService,
    ):
        """
        Initialize Content Seed Service.

        Args:
            session: SQLAlchemy async session
            content_orm_service: ContentOrmService for content operations
            user_orm_service: UserOrmService for user lookups
        """
        super().__init__(session, content_orm_service)
        self.user_orm_service = user_orm_service

    # Essential Data Implementation

    async def _has_essential_data(self) -> bool:
        """Check if essential content already exists."""
        try:
            # Check for any published content as indicator of essential data
            content_count = await self.orm_service.count_all()
            return content_count > 0

        except Exception as e:
            self.logger.error(f"Failed to check essential content data: {e}")
            return False

    async def _seed_essential_items(self) -> dict[str, Any]:
        """
        Create essential content items using static sample files.

        Loads sample NLJs, Connections games, and Wordle games from static files
        to provide rich demo content for the platform.

        Returns:
            Dictionary with seeding results
        """
        # Get creator user for ownership
        creator = await self.user_orm_service.get_user_by_username("creator")
        if not creator:
            raise RuntimeError("Creator user not found - seed users first")

        # Use StaticLoaderService to load all sample content
        from .static_loader_service import StaticLoaderService
        static_loader = StaticLoaderService(self.session, self)
        
        try:
            result = await static_loader.load_all_static_content()
            
            if result["status"] == "completed":
                self.logger.info(f"Essential seeding completed: {result['items_loaded']} items from static files")
                return {
                    "status": "completed",
                    "items_created": result["items_loaded"],
                    "breakdown": result.get("breakdown", {}),
                    "static_directory": result.get("static_directory"),
                    "errors": result.get("errors", [])
                }
            else:
                self.logger.warning(f"Static loading {result['status']}: {result.get('reason', 'Unknown error')}")
                # Fall back to minimal hardcoded content if static loading fails
                return await self._seed_minimal_fallback_content(creator)
                
        except Exception as e:
            self.logger.error(f"Static content loading failed: {e}")
            # Fall back to minimal hardcoded content
            return await self._seed_minimal_fallback_content(creator)

    async def _seed_minimal_fallback_content(self, creator) -> dict[str, Any]:
        """
        Fallback method to create minimal content when static files aren't available.
        """
        self.logger.info("Using minimal fallback content")

        essential_content = [
            {
                "title": "Welcome to NLJ Platform",
                "description": "Introduction to Non-Linear Journey platform features",
                "content_type": ContentType.TRAINING,
                "learning_style": LearningStyle.READING_WRITING,
                "nlj_data": {
                    "id": "welcome-intro",
                    "name": "Welcome to NLJ Platform",
                    "nodes": [
                        {
                            "id": "start",
                            "type": "start",
                            "title": "Welcome!",
                            "text": "Welcome to the NLJ Platform. This is your first activity.",
                            "position": {"x": 100, "y": 100},
                        },
                        {
                            "id": "end",
                            "type": "end",
                            "title": "Complete",
                            "text": "You've completed your first NLJ activity!",
                            "position": {"x": 300, "y": 100},
                        },
                    ],
                    "links": [
                        {
                            "id": "start-to-end",
                            "source": "start",
                            "target": "end",
                            "type": "navigation",
                        }
                    ],
                },
                "tags": ["welcome", "introduction", "essential"],
            },
            {
                "title": "Basic Assessment Template",
                "description": "Template for creating basic assessments with multiple choice questions",
                "content_type": ContentType.ASSESSMENT,
                "learning_style": LearningStyle.KINESTHETIC,
                "is_template": True,
                "template_category": "Assessment Templates",
                "nlj_data": {
                    "id": "basic-assessment-template",
                    "name": "Basic Assessment Template",
                    "nodes": [
                        {
                            "id": "start",
                            "type": "start",
                            "title": "Assessment Start",
                            "text": "This is a template for creating assessments.",
                            "position": {"x": 100, "y": 100},
                        },
                        {
                            "id": "question1",
                            "type": "multipleChoice",
                            "title": "Sample Question",
                            "text": "This is a sample multiple choice question.",
                            "choices": [
                                {"id": "a", "text": "Option A", "isCorrect": True},
                                {"id": "b", "text": "Option B", "isCorrect": False},
                                {"id": "c", "text": "Option C", "isCorrect": False},
                            ],
                            "position": {"x": 300, "y": 100},
                        },
                        {
                            "id": "end",
                            "type": "end",
                            "title": "Assessment Complete",
                            "text": "Assessment completed successfully.",
                            "position": {"x": 500, "y": 100},
                        },
                    ],
                    "links": [
                        {
                            "id": "start-to-q1",
                            "source": "start",
                            "target": "question1",
                            "type": "navigation",
                        },
                        {
                            "id": "q1-to-end",
                            "source": "question1",
                            "target": "end",
                            "type": "navigation",
                        },
                    ],
                },
                "tags": ["template", "assessment", "multiple-choice"],
            },
        ]

        created_items = []

        for content_data in essential_content:
            try:
                # Check if content already exists by title
                existing = await self.orm_service.find_by_field("title", content_data["title"])
                if existing:
                    self.logger.info(f"Content '{content_data['title']}' already exists")
                    continue

                # Create content using ORM service
                content = await self.orm_service.create_content(
                    title=content_data["title"],
                    description=content_data["description"],
                    nlj_data=content_data["nlj_data"],
                    creator_id=creator.id,
                    content_type=content_data["content_type"],
                    learning_style=content_data["learning_style"],
                    is_template=content_data.get("is_template", False),
                    template_category=content_data.get("template_category"),
                )

                # Update content state to published (tags not implemented yet)
                await self.orm_service.update_content_state(
                    content_id=content.id,
                    new_state=ContentState.PUBLISHED
                )

                created_items.append(content)
                self.logger.info(f"Created essential content: {content.title}")

            except Exception as e:
                self.logger.error(f"Failed to create content '{content_data['title']}': {e}")
                continue

        return {
            "status": "completed",
            "items_created": len(created_items),
            "content_types": [item.content_type for item in created_items],
            "titles": [item.title for item in created_items],
        }

    async def _seed_demo_items(self, include_samples: bool) -> dict[str, Any]:
        """
        Create demo content from static files and additional scenarios.

        Args:
            include_samples: Whether to load content from static files

        Returns:
            Dictionary with demo seeding results
        """
        results = {"static_files": 0, "demo_items": 0}

        if include_samples:
            # Load from static files
            static_result = await self._load_static_files()
            results["static_files"] = static_result["items_created"]

        # Create additional demo scenarios
        demo_result = await self._create_demo_scenarios()
        results["demo_items"] = demo_result["items_created"]

        total_created = results["static_files"] + results["demo_items"]

        return {
            "status": "completed",
            "items_created": total_created,
            "static_files_loaded": results["static_files"],
            "demo_scenarios_created": results["demo_items"],
        }

    async def _load_static_files(self) -> dict[str, Any]:
        """Load content from static sample files."""
        # Define possible static file locations
        static_paths = [
            Path("/mnt/c/Users/aeroz/Documents/GitHub/nlj_viewer/static"),
            Path("../../../static"),  # Relative from backend/app/services/seed/
            Path("./static"),  # From root
        ]

        static_dir = None
        for path in static_paths:
            if path.exists():
                static_dir = path
                break

        if not static_dir:
            self.logger.warning("Static content directory not found")
            return {"status": "skipped", "items_created": 0, "reason": "No static directory"}

        creator = await self.user_orm_service.get_user_by_username("creator")
        if not creator:
            raise RuntimeError("Creator user not found")

        created_items = []

        # Load from sample_nljs directory
        nlj_dir = static_dir / "sample_nljs"
        if nlj_dir.exists():
            created_items.extend(await self._load_nlj_files(nlj_dir, creator.id))

        # Load from sample_connections directory
        connections_dir = static_dir / "sample_connections"
        if connections_dir.exists():
            created_items.extend(await self._load_connections_files(connections_dir, creator.id))

        # Load from sample_wordle directory
        wordle_dir = static_dir / "sample_wordle"
        if wordle_dir.exists():
            created_items.extend(await self._load_wordle_files(wordle_dir, creator.id))

        return {
            "status": "completed",
            "items_created": len(created_items),
            "files_processed": [item.title for item in created_items],
        }

    async def _load_nlj_files(self, nlj_dir: Path, creator_id: uuid.UUID) -> list[Any]:
        """Load NLJ files from directory."""
        created_items = []

        for json_file in nlj_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    nlj_data = json.load(f)

                title = nlj_data.get("name", json_file.stem)

                # Check if already exists
                existing = await self.orm_service.find_by_field("title", title)
                if existing:
                    self.logger.info(f"NLJ content '{title}' already exists")
                    continue

                content = await self.orm_service.create_content(
                    title=title,
                    description=nlj_data.get("description", f"Loaded from {json_file.name}"),
                    nlj_data=nlj_data,
                    creator_id=creator_id,
                    content_type=ContentType.TRAINING,
                    learning_style=LearningStyle.KINESTHETIC,
                )

                # Update content state to published (tags not implemented yet)
                await self.orm_service.update_content_state(
                    content_id=content.id,
                    new_state=ContentState.PUBLISHED
                )

                created_items.append(content)
                self.logger.info(f"Loaded NLJ file: {title}")

            except Exception as e:
                self.logger.error(f"Failed to load NLJ file {json_file.name}: {e}")
                continue

        return created_items

    async def _load_connections_files(self, connections_dir: Path, creator_id: uuid.UUID) -> list[Any]:
        """Load Connections game files from directory."""
        created_items = []

        for json_file in connections_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    connections_data = json.load(f)

                title = connections_data.get("name", f"Connections: {json_file.stem}")

                # Check if already exists
                existing = await self.orm_service.find_by_field("title", title)
                if existing:
                    continue

                content = await self.orm_service.create_content(
                    title=title,
                    description=connections_data.get("description", "NYT-style connections word puzzle game"),
                    nlj_data=connections_data,
                    creator_id=creator_id,
                    content_type=ContentType.GAME,
                    learning_style=LearningStyle.KINESTHETIC,
                )

                # Update content state to published (tags not implemented yet)
                await self.orm_service.update_content_state(
                    content_id=content.id,
                    new_state=ContentState.PUBLISHED
                )

                created_items.append(content)
                self.logger.info(f"Loaded Connections game: {title}")

            except Exception as e:
                self.logger.error(f"Failed to load Connections file {json_file.name}: {e}")
                continue

        return created_items

    async def _load_wordle_files(self, wordle_dir: Path, creator_id: uuid.UUID) -> list[Any]:
        """Load Wordle game files from directory."""
        created_items = []

        for json_file in wordle_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    wordle_data = json.load(f)

                title = wordle_data.get("name", f"Wordle: {json_file.stem}")

                # Check if already exists
                existing = await self.orm_service.find_by_field("title", title)
                if existing:
                    continue

                content = await self.orm_service.create_content(
                    title=title,
                    description=wordle_data.get("description", "Word guessing puzzle game"),
                    nlj_data=wordle_data,
                    creator_id=creator_id,
                    content_type=ContentType.GAME,
                    learning_style=LearningStyle.KINESTHETIC,
                )

                # Update content state to published (tags not implemented yet)
                await self.orm_service.update_content_state(
                    content_id=content.id,
                    new_state=ContentState.PUBLISHED
                )

                created_items.append(content)
                self.logger.info(f"Loaded Wordle game: {title}")

            except Exception as e:
                self.logger.error(f"Failed to load Wordle file {json_file.name}: {e}")
                continue

        return created_items

    async def _create_demo_scenarios(self) -> dict[str, Any]:
        """Create additional demo content scenarios."""
        creator = await self.user_orm_service.get_user_by_username("creator")
        if not creator:
            raise RuntimeError("Creator user not found")

        # This would create additional hardcoded demo scenarios
        # For now, returning empty result to avoid duplication with static files
        return {"status": "completed", "items_created": 0}

    async def _load_survey_files(self, survey_dir: Path, creator_id: uuid.UUID) -> list[Any]:
        """Load survey files from directory."""
        if not survey_dir.exists():
            self.logger.warning(f"Survey directory {survey_dir} does not exist")
            return []

        created_items = []
        for json_file in survey_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # Create Survey content
                content = await self.orm_service.create_content(
                    title=data.get("name", json_file.stem.replace("_", " ").title()),
                    description=data.get("description", f"Survey from {json_file.name}"),
                    nlj_data=data,
                    creator_id=creator_id,
                    content_type=ContentType.SURVEY,
                    learning_style=LearningStyle.READING_WRITING,
                )

                await self.orm_service.update_content_state(
                    content_id=content.id, new_state=ContentState.PUBLISHED
                )

                created_items.append(content)
                self.logger.info(f"Loaded survey: {content.title}")

            except Exception as e:
                self.logger.error(f"Failed to load survey file {json_file}: {e}")

        return created_items

    async def _clear_seeded_data(self) -> dict[str, Any]:
        """
        Clear seeded content with safety checks.

        Only removes content that appears to be seeded (with specific tags).

        Returns:
            Dictionary with clearing results
        """
        seeded_tags = ["sample", "static-content", "essential", "template", "demo"]
        removed_items = []

        try:
            # Find content with seeded tags
            all_content = await self.orm_service.get_all()

            for content in all_content:
                if content.tags and any(tag in seeded_tags for tag in content.tags):
                    await self.orm_service.delete_by_id(content.id)
                    removed_items.append(content.title)
                    self.logger.info(f"Removed seeded content: {content.title}")

        except Exception as e:
            self.logger.error(f"Failed to clear seeded content: {e}")

        return {
            "status": "completed",
            "items_removed": len(removed_items),
            "removed_titles": removed_items,
        }

    async def _get_current_status(self) -> dict[str, Any]:
        """
        Get current content seeding status and statistics.

        Returns:
            Dictionary with current status information
        """
        try:
            # Get content counts by type
            type_counts = {}
            for content_type in ContentType:
                contents = await self.orm_service.find_by_content_type(content_type)
                type_counts[content_type.value] = len(contents)

            # Get total content count
            total_content = await self.orm_service.count_all()

            # Get content by state
            state_counts = {}
            for state in ContentState:
                contents = await self.orm_service.find_by_state(state)
                state_counts[state.value] = len(contents)

            # Check for seeded content
            all_content = await self.orm_service.get_all()
            seeded_tags = ["sample", "static-content", "essential", "template"]
            seeded_content = [c.title for c in all_content if c.tags and any(tag in seeded_tags for tag in c.tags)]

            return {
                "status": "available",
                "total_content": total_content,
                "type_counts": type_counts,
                "state_counts": state_counts,
                "has_essential": len([c for c in all_content if c.tags and "essential" in c.tags]) > 0,
                "has_samples": len(seeded_content) > 0,
                "seeded_content": seeded_content,
                "templates": len([c for c in all_content if c.is_template]),
            }

        except Exception as e:
            self.logger.error(f"Failed to get content status: {e}")
            return {
                "status": "error",
                "error": str(e),
                "total_content": 0,
                "has_essential": False,
                "has_samples": False,
            }
