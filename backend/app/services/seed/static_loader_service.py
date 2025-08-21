"""
Static Loader Service - Clean Architecture Implementation for Static File Loading.

Provides centralized static file loading operations using specialized seed services.
Handles coordination between different content types and file formats.
"""

import json
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .content_seed_service import ContentSeedService
from .base_seed_service import BaseSeedService


class StaticLoaderService:
    """
    Static Loader Service for loading content from static files.

    Coordinates loading different types of static content files using appropriate
    seed services while maintaining Clean Architecture principles.

    Key Features:
    - Centralized static file discovery and loading
    - Multi-format content support (NLJ, Connections, Wordle)
    - Validation and error handling for file formats
    - Progress tracking and reporting
    """

    def __init__(
        self,
        session: AsyncSession,
        content_seed_service: ContentSeedService,
    ):
        """
        Initialize Static Loader Service.

        Args:
            session: SQLAlchemy async session
            content_seed_service: ContentSeedService for content loading
        """
        self.session = session
        self.content_seed_service = content_seed_service
        self.logger = content_seed_service.logger.getChild(self.__class__.__name__)

    async def load_all_static_content(self, base_path: str | Path | None = None) -> dict[str, Any]:
        """
        Load all static content from the default or specified base path.

        Args:
            base_path: Base directory path for static content (optional)

        Returns:
            Dictionary with loading results and statistics
        """
        try:
            self.logger.info("Starting comprehensive static content loading")

            # Discover static content directory
            static_dir = await self._discover_static_directory(base_path)
            if not static_dir:
                return {
                    "status": "skipped",
                    "reason": "Static content directory not found",
                    "items_loaded": 0,
                }

            # Load content from different directories
            results = {
                "nlj_files": 0,
                "connections_files": 0,
                "wordle_files": 0,
                "total_files": 0,
                "errors": [],
            }

            # Load NLJ files
            nlj_result = await self._load_directory_content(static_dir / "sample_nljs", "nlj")
            results["nlj_files"] = nlj_result["items_loaded"]
            results["errors"].extend(nlj_result.get("errors", []))

            # Load Connections files
            connections_result = await self._load_directory_content(static_dir / "sample_connections", "connections")
            results["connections_files"] = connections_result["items_loaded"]
            results["errors"].extend(connections_result.get("errors", []))

            # Load Wordle files
            wordle_result = await self._load_directory_content(static_dir / "sample_wordle", "wordle")
            results["wordle_files"] = wordle_result["items_loaded"]
            results["errors"].extend(wordle_result.get("errors", []))

            results["total_files"] = results["nlj_files"] + results["connections_files"] + results["wordle_files"]

            self.logger.info(f"Static content loading completed: {results['total_files']} files loaded")

            return {
                "status": "completed",
                "items_loaded": results["total_files"],
                "breakdown": {
                    "nlj_files": results["nlj_files"],
                    "connections_files": results["connections_files"],
                    "wordle_files": results["wordle_files"],
                },
                "errors": results["errors"],
                "static_directory": str(static_dir),
            }

        except Exception as e:
            self.logger.error(f"Static content loading failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "items_loaded": 0,
            }

    async def validate_static_files(self, base_path: str | Path | None = None) -> dict[str, Any]:
        """
        Validate static files without loading them.

        Args:
            base_path: Base directory path for static content (optional)

        Returns:
            Dictionary with validation results
        """
        try:
            static_dir = await self._discover_static_directory(base_path)
            if not static_dir:
                return {"status": "error", "error": "Static directory not found"}

            validation_results = {
                "valid_files": [],
                "invalid_files": [],
                "missing_directories": [],
                "total_files": 0,
            }

            # Check each directory and validate files
            directories_to_check = [
                ("sample_nljs", "NLJ files"),
                ("sample_connections", "Connections files"),
                ("sample_wordle", "Wordle files"),
            ]

            for dir_name, description in directories_to_check:
                dir_path = static_dir / dir_name
                if not dir_path.exists():
                    validation_results["missing_directories"].append(f"{dir_name} ({description})")
                    continue

                for json_file in dir_path.glob("*.json"):
                    try:
                        with open(json_file, "r", encoding="utf-8") as f:
                            data = json.load(f)

                        # Basic validation - check for required fields
                        if self._validate_file_structure(data, dir_name):
                            validation_results["valid_files"].append(str(json_file))
                        else:
                            validation_results["invalid_files"].append(
                                {"file": str(json_file), "reason": "Missing required fields"}
                            )

                    except json.JSONDecodeError as e:
                        validation_results["invalid_files"].append(
                            {"file": str(json_file), "reason": f"JSON decode error: {e}"}
                        )
                    except Exception as e:
                        validation_results["invalid_files"].append(
                            {"file": str(json_file), "reason": f"Validation error: {e}"}
                        )

            validation_results["total_files"] = len(validation_results["valid_files"]) + len(
                validation_results["invalid_files"]
            )

            return {
                "status": "completed",
                "validation_results": validation_results,
                "static_directory": str(static_dir),
            }

        except Exception as e:
            self.logger.error(f"Static file validation failed: {e}")
            return {"status": "error", "error": str(e)}

    async def get_static_content_inventory(self, base_path: str | Path | None = None) -> dict[str, Any]:
        """
        Get inventory of available static content files.

        Args:
            base_path: Base directory path for static content (optional)

        Returns:
            Dictionary with content inventory
        """
        try:
            static_dir = await self._discover_static_directory(base_path)
            if not static_dir:
                return {"status": "error", "error": "Static directory not found"}

            inventory = {
                "directories": {},
                "total_files": 0,
                "file_types": {},
            }

            content_dirs = [
                "sample_nljs",
                "sample_connections", 
                "sample_wordle",
                "wordlists",
            ]

            for dir_name in content_dirs:
                dir_path = static_dir / dir_name
                if not dir_path.exists():
                    inventory["directories"][dir_name] = {"exists": False, "files": []}
                    continue

                files = list(dir_path.glob("*.json"))
                file_info = []

                for file_path in files:
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            data = json.load(f)

                        file_info.append(
                            {
                                "name": file_path.name,
                                "title": data.get("name", file_path.stem),
                                "description": data.get("description", "No description"),
                                "size_bytes": file_path.stat().st_size,
                            }
                        )

                    except Exception as e:
                        file_info.append(
                            {"name": file_path.name, "error": str(e), "size_bytes": file_path.stat().st_size}
                        )

                inventory["directories"][dir_name] = {"exists": True, "files": file_info, "count": len(files)}

                # Update file type counts
                file_extension = "json"
                inventory["file_types"][file_extension] = inventory["file_types"].get(file_extension, 0) + len(files)
                inventory["total_files"] += len(files)

            return {"status": "completed", "inventory": inventory, "static_directory": str(static_dir)}

        except Exception as e:
            self.logger.error(f"Static content inventory failed: {e}")
            return {"status": "error", "error": str(e)}

    # Private Implementation Methods

    async def _discover_static_directory(self, base_path: str | Path | None = None) -> Path | None:
        """Discover the static content directory."""
        if base_path:
            static_dir = Path(base_path) if isinstance(base_path, str) else base_path
            if static_dir.exists() and static_dir.is_dir():
                return static_dir

        # Try common static directory locations
        possible_paths = [
            Path("/mnt/c/Users/aeroz/Documents/GitHub/nlj_viewer/static"),  # Absolute path
            Path("../../../static"),  # Relative from backend/app/services/seed/
            Path("./static"),  # From backend root
            Path("../../static"),  # From app/services/seed/
        ]

        for path in possible_paths:
            if path.exists() and path.is_dir():
                self.logger.info(f"Found static directory: {path}")
                return path.resolve()

        self.logger.warning("Static content directory not found in any expected location")
        return None

    async def _load_directory_content(self, directory: Path, content_type: str) -> dict[str, Any]:
        """Load content from a specific directory."""
        if not directory.exists():
            self.logger.warning(f"Directory {directory} does not exist")
            return {"items_loaded": 0, "errors": []}

        items_loaded = 0
        errors = []

        try:
            if content_type == "nlj":
                result = await self.content_seed_service._load_nlj_files(
                    directory, self.content_seed_service.user_orm_service.find_by_username("creator")
                )
                items_loaded = len(result) if result else 0

            elif content_type == "connections":
                creator = await self.content_seed_service.user_orm_service.find_by_username("creator")
                if creator:
                    result = await self.content_seed_service._load_connections_files(directory, creator.id)
                    items_loaded = len(result) if result else 0

            elif content_type == "wordle":
                creator = await self.content_seed_service.user_orm_service.find_by_username("creator")
                if creator:
                    result = await self.content_seed_service._load_wordle_files(directory, creator.id)
                    items_loaded = len(result) if result else 0

        except Exception as e:
            error_msg = f"Failed to load {content_type} content from {directory}: {e}"
            self.logger.error(error_msg)
            errors.append(error_msg)

        return {"items_loaded": items_loaded, "errors": errors}

    def _validate_file_structure(self, data: dict[str, Any], directory_type: str) -> bool:
        """Validate basic file structure based on directory type."""
        try:
            # Common required fields
            if not data.get("name") and not data.get("id"):
                return False

            # Directory-specific validation
            if directory_type == "sample_nljs":
                return "nodes" in data and "links" in data

            elif directory_type == "sample_connections":
                return "categories" in data or "words" in data

            elif directory_type == "sample_wordle":
                return "words" in data or "wordlist" in data

            return True  # Basic validation passed

        except Exception:
            return False