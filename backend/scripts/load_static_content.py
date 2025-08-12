#!/usr/bin/env python3
"""
Load sample content from static directory into the LocalStack RDS database.
This populates the Activities tab with sample NLJ scenarios, connections games, and wordle games.
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Dict

# Add the backend directory to the path to import our modules
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from sqlalchemy import select

from app.core.database_manager import db_manager
from app.models.content import ContentItem, ContentState, ContentType
from app.models.user import User, UserRole


def determine_content_type_from_file(file_path: Path, data: Dict[str, Any]) -> ContentType:
    """Determine content type based on file location and content."""
    parent_dir = file_path.parent.name

    if parent_dir == "sample_connections":
        return ContentType.GAME
    elif parent_dir == "sample_wordle":
        return ContentType.GAME
    elif parent_dir == "sample_nljs":
        # Check if it's a survey or training scenario
        nodes = data.get("nodes", [])
        has_survey_questions = any(
            node.get("type") in ["likert-scale", "rating", "matrix", "slider", "text-area"] for node in nodes
        )
        return ContentType.SURVEY if has_survey_questions else ContentType.TRAINING_SCENARIO
    else:
        return ContentType.TRAINING_SCENARIO


def create_description(file_path: Path, data: Dict[str, Any]) -> str:
    """Create a description based on file content and metadata."""
    parent_dir = file_path.parent.name

    # Try to get description from metadata
    description = data.get("description", "")
    if description:
        return description

    # Try to get from activity metadata
    activity_meta = data.get("activityMetadata", {})
    if activity_meta.get("description"):
        return activity_meta["description"]

    # Create description based on content type
    if parent_dir == "sample_connections":
        return "NYT-style word puzzle game with category grouping"
    elif parent_dir == "sample_wordle":
        return "Wordle-style word guessing game with comprehensive dictionary validation"
    elif parent_dir == "sample_nljs":
        # Count nodes to describe complexity
        nodes = data.get("nodes", [])
        node_count = len(nodes)
        if node_count > 0:
            return f"Interactive training scenario with {node_count} learning elements"
        else:
            return "Interactive training scenario"

    return "Sample learning activity"


async def load_static_content():
    """Load content from static directory."""

    # Static content directory (relative to project root)
    static_dir = Path(__file__).parent.parent.parent / "static"

    if not static_dir.exists():
        print(f"❌ Static directory not found: {static_dir}")
        return

    print(f"📁 Loading content from: {static_dir}")

    # Get all JSON files from relevant subdirectories
    content_dirs = ["sample_nljs", "sample_connections", "sample_wordle"]
    all_files = []

    for dir_name in content_dirs:
        dir_path = static_dir / dir_name
        if dir_path.exists():
            json_files = list(dir_path.glob("*.json"))
            all_files.extend(json_files)
            print(f"📂 Found {len(json_files)} files in {dir_name}/")

    if not all_files:
        print("❌ No JSON files found in static content directories")
        return

    print(f"📊 Total files to load: {len(all_files)}")

    # Initialize database
    await db_manager.ensure_initialized()

    # Get admin user to assign as creator
    db = db_manager.get_session()
    try:
        # Find admin user
        admin_query = select(User).where(User.role == UserRole.ADMIN)
        result = await db.execute(admin_query)
        admin_user = result.scalar_one_or_none()

        if not admin_user:
            print("❌ No admin user found. Creating one...")
            # Create admin user if none exists
            admin_user = User(
                username="admin",
                email="admin@nlj-platform.local",
                full_name="NLJ Administrator",
                role=UserRole.ADMIN,
                is_active=True,
            )
            admin_user.set_password("admin123456")
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            print(f"✅ Created admin user: {admin_user.username}")
        else:
            print(f"👤 Using admin user: {admin_user.username}")

        # Load each content file
        loaded_count = 0
        for content_file in all_files:
            try:
                print(f"\n📋 Loading: {content_file.name}")

                # Read content JSON
                with open(content_file, "r", encoding="utf-8") as f:
                    content_data = json.load(f)

                # Extract title
                title = content_data.get("name", content_file.stem.replace("_", " ").title())

                # Determine content type
                content_type = determine_content_type_from_file(content_file, content_data)

                # Create description
                description = create_description(content_file, content_data)

                # Check if content already exists
                existing_query = select(ContentItem).where(ContentItem.title == title)
                existing_result = await db.execute(existing_query)
                existing_content = existing_result.scalar_one_or_none()

                if existing_content:
                    print(f"  ⏭️  Content already exists: {title}")
                    continue

                # Create content item
                content_item = ContentItem(
                    title=title,
                    description=description,
                    nlj_data=content_data,
                    content_type=content_type,
                    state=ContentState.PUBLISHED,  # Make content immediately available
                    created_by=admin_user.id,
                    is_template=False,
                )

                db.add(content_item)
                loaded_count += 1
                print(f"  ✅ Loaded: {title} ({content_type.value})")

            except Exception as e:
                print(f"  ❌ Failed to load {content_file.name}: {e}")
                continue

        if loaded_count > 0:
            await db.commit()
            print(f"\n🎉 Successfully loaded {loaded_count} activities into database!")

            # Verify the content is in the database
            for content_type in [ContentType.TRAINING_SCENARIO, ContentType.SURVEY, ContentType.GAME]:
                query = select(ContentItem).where(ContentItem.content_type == content_type)
                result = await db.execute(query)
                count = len(result.scalars().all())
                print(f"📊 Total {content_type.value}s in database: {count}")

        else:
            print("\n⚠️  No new content was loaded")

    except Exception as e:
        print(f"❌ Database error: {e}")
        await db.rollback()
        raise
    finally:
        await db.close()


if __name__ == "__main__":
    print("🎯 Loading Static Content into LocalStack RDS Database")
    print("=" * 60)

    try:
        asyncio.run(load_static_content())
        print("\n🏆 Content loading completed!")
    except KeyboardInterrupt:
        print("\n⏹️  Loading cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
