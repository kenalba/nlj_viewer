#!/usr/bin/env python3
"""
Load sample surveys from frontend directory into the database.
This populates the Activities tab with sample survey content.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add the backend directory to the path to import our modules
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from sqlalchemy import select

from app.core.database_manager import db_manager
from app.models.content import ContentItem, ContentState, ContentType
from app.models.user import User, UserRole


async def load_sample_surveys():
    """Load sample surveys from frontend directory."""

    # Survey files directory (relative to this script)
    surveys_dir = Path(__file__).parent.parent.parent / "frontend" / "public" / "static" / "sample_surveys"

    if not surveys_dir.exists():
        print(f"❌ Survey directory not found: {surveys_dir}")
        return

    print(f"📁 Loading surveys from: {surveys_dir}")

    # Get survey files
    survey_files = list(surveys_dir.glob("*.json"))
    if not survey_files:
        print("❌ No survey JSON files found")
        return

    print(f"📊 Found {len(survey_files)} survey files:")
    for file in survey_files:
        print(f"  • {file.name}")

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
            print("❌ No admin user found. Run seed_database.py first.")
            return

        print(f"👤 Using admin user: {admin_user.username}")

        # Load each survey
        loaded_count = 0
        for survey_file in survey_files:
            try:
                print(f"\n📋 Loading: {survey_file.name}")

                # Read survey JSON
                with open(survey_file, "r", encoding="utf-8") as f:
                    survey_data = json.load(f)

                # Extract title from survey data
                title = survey_data.get("name", survey_file.stem.replace("_", " ").title())

                # Create description from survey metadata
                survey_meta = survey_data.get("surveyMetadata", {})
                activity_meta = survey_data.get("activityMetadata", {})

                description_parts = []
                if survey_meta.get("targetAudience"):
                    description_parts.append(f"Target Audience: {survey_meta['targetAudience']}")
                if activity_meta.get("estimatedDuration"):
                    description_parts.append(f"Duration: {activity_meta['estimatedDuration']} minutes")
                if survey_meta.get("industry"):
                    description_parts.append(f"Industry: {survey_meta['industry']}")

                description = " | ".join(description_parts) if description_parts else "Sample survey for testing"

                # Check if survey already exists
                existing_query = select(ContentItem).where(ContentItem.title == title)
                existing_result = await db.execute(existing_query)
                existing_survey = existing_result.scalar_one_or_none()

                if existing_survey:
                    print(f"  ⏭️  Survey already exists: {title}")
                    continue

                # Create content item
                content_item = ContentItem(
                    title=title,
                    description=description,
                    nlj_data=survey_data,
                    content_type=ContentType.SURVEY,
                    state=ContentState.PUBLISHED,  # Make surveys immediately available
                    created_by=admin_user.id,
                    is_template=False,
                )

                db.add(content_item)
                loaded_count += 1
                print(f"  ✅ Loaded: {title}")

            except Exception as e:
                print(f"  ❌ Failed to load {survey_file.name}: {e}")
                continue

        if loaded_count > 0:
            await db.commit()
            print(f"\n🎉 Successfully loaded {loaded_count} surveys into database!")

            # Verify the surveys are in the database
            survey_query = select(ContentItem).where(ContentItem.content_type == ContentType.SURVEY)
            result = await db.execute(survey_query)
            total_surveys = len(result.scalars().all())
            print(f"📊 Total surveys in database: {total_surveys}")

        else:
            print("\n⚠️  No new surveys were loaded")

    except Exception as e:
        print(f"❌ Database error: {e}")
        await db.rollback()
    finally:
        await db.close()


if __name__ == "__main__":
    print("🎯 Loading Sample Surveys into Database")
    print("=" * 50)

    try:
        asyncio.run(load_sample_surveys())
    except KeyboardInterrupt:
        print("\n⏹️  Loading cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
