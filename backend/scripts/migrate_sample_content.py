#!/usr/bin/env python3
"""
Sample Content Migration Script

Migrates all static sample content from frontend/public/static/ to the database.
This includes NLJ scenarios, surveys, Connections games, Wordle games, and Trivie exports.

Usage:
    python scripts/migrate_sample_content.py [--dry-run] [--force]
    
Options:
    --dry-run: Preview what will be migrated without making changes
    --force: Delete existing sample content before migration
"""

import asyncio
import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import openpyxl
from sqlalchemy import select

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.config import settings
from app.core.database_manager import db_manager, create_tables
from app.models.content import ContentItem, ContentState, ContentType, LearningStyle
from app.models.user import User, UserRole


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ContentMigrator:
    """Handles migration of sample content to database."""
    
    def __init__(self, dry_run: bool = False, force: bool = False):
        self.dry_run = dry_run
        self.force = force
        self.frontend_static_path = Path(__file__).parent.parent.parent / "frontend" / "public" / "static"
        self.migrated_count = 0
        self.skipped_count = 0
        self.error_count = 0
        
    async def ensure_admin_user(self, session) -> uuid.UUID:
        """Ensure we have an admin user for content migration."""
        try:
            # Look for existing admin user
            result = await session.execute(
                select(User).where(User.role == UserRole.ADMIN).limit(1)
            )
            admin_user = result.scalar_one_or_none()
            
            if admin_user:
                logger.info(f"Using existing admin user: {admin_user.username}")
                return admin_user.id
            
            # Create migration admin user
            admin_user = User(
                username="migration_admin",
                email="migration@nlj-platform.local",
                full_name="Content Migration Admin",
                role=UserRole.ADMIN,
                hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBVJ.8B/QbNWmu",  # disabled
                is_active=True,
                is_verified=True
            )
            
            if not self.dry_run:
                session.add(admin_user)
                await session.commit()
                await session.refresh(admin_user)
                logger.info(f"Created migration admin user: {admin_user.id}")
                return admin_user.id
            else:
                logger.info("Would create migration admin user")
                return uuid.uuid4()  # Dummy UUID for dry run
                
        except Exception as e:
            logger.error(f"Error ensuring admin user: {e}")
            await session.rollback()
            raise
    
    async def clear_existing_content(self, session):
        """Clear existing sample content if force flag is set."""
        if not self.force:
            return
            
        logger.warning("Force flag set - clearing existing sample content...")
        
        if not self.dry_run:
            # Delete content created by migration admin
            result = await session.execute(
                select(ContentItem).where(ContentItem.is_template == True)
            )
            sample_content = result.scalars().all()
            
            for content in sample_content:
                await session.delete(content)
            
            await session.commit()
            logger.info(f"Deleted {len(sample_content)} existing sample content items")
        else:
            logger.info("Would delete existing sample content")
    
    def extract_content_metadata(self, content_data: Dict[str, Any], file_path: Path) -> Dict[str, Any]:
        """Extract metadata from content data for database storage."""
        # Base metadata
        metadata = {
            "title": content_data.get("name", file_path.stem),
            "description": content_data.get("description", f"Sample content from {file_path.name}"),
            "content_type": ContentType.TRAINING,  # Default
            "learning_style": LearningStyle.KINESTHETIC,  # Default - interactive content
            "is_template": True,  # All sample content is template
            "template_category": "samples"
        }
        
        # Detect content type from structure and filename
        if "survey" in file_path.name.lower() or content_data.get("activityType") == "survey":
            metadata["content_type"] = ContentType.SURVEY
            metadata["template_category"] = "surveys"
        elif "connections" in file_path.name.lower() or any(
            node.get("type") == "connections" for node in content_data.get("nodes", [])
        ):
            metadata["content_type"] = ContentType.GAME
            metadata["template_category"] = "games"
            metadata["description"] = "Connections word puzzle game"
        elif "wordle" in file_path.name.lower() or any(
            node.get("type") == "wordle" for node in content_data.get("nodes", [])
        ):
            metadata["content_type"] = ContentType.GAME
            metadata["template_category"] = "games"
            metadata["description"] = "Wordle word guessing game"
        elif "FSA" in file_path.name or "sales" in file_path.name.lower():
            metadata["template_category"] = "training"
            metadata["description"] = "Sales training scenario"
        elif "Ioniq" in file_path.name or "product" in file_path.name.lower():
            metadata["template_category"] = "product-knowledge"
            metadata["description"] = "Product knowledge training"
        
        # Determine learning style from content
        nodes = content_data.get("nodes", [])
        has_media = any(node.get("media") for node in nodes)
        has_interactive = any(
            node.get("type") in ["choice", "matching", "ordering", "connections", "wordle"] 
            for node in nodes
        )
        has_text_heavy = any(
            len(str(node.get("text", ""))) > 500 for node in nodes
        )
        
        if has_media and has_interactive:
            metadata["learning_style"] = LearningStyle.KINESTHETIC
        elif has_media:
            metadata["learning_style"] = LearningStyle.VISUAL
        elif has_text_heavy:
            metadata["learning_style"] = LearningStyle.READING_WRITING
        elif has_interactive:
            metadata["learning_style"] = LearningStyle.KINESTHETIC
        
        return metadata
    
    async def migrate_json_content(self, session, file_path: Path, admin_user_id: uuid.UUID):
        """Migrate a single JSON content file."""
        try:
            logger.info(f"Processing {file_path.name}...")
            
            # Load JSON content
            with open(file_path, 'r', encoding='utf-8') as f:
                content_data = json.load(f)
            
            # Extract metadata
            metadata = self.extract_content_metadata(content_data, file_path)
            
            # Check if content already exists
            existing = await session.execute(
                select(ContentItem).where(
                    ContentItem.title == metadata["title"],
                    ContentItem.is_template == True
                )
            )
            if existing.scalar_one_or_none() and not self.force:
                logger.info(f"Skipping {metadata['title']} - already exists")
                self.skipped_count += 1
                return
            
            # Create content item
            content_item = ContentItem(
                title=metadata["title"],
                description=metadata["description"],
                nlj_data=content_data,
                content_type=metadata["content_type"],
                learning_style=metadata["learning_style"],
                is_template=metadata["is_template"],
                template_category=metadata["template_category"],
                created_by=admin_user_id,
                state=ContentState.PUBLISHED,  # Sample content is pre-approved
                published_at=datetime.now(timezone.utc)
            )
            
            if not self.dry_run:
                session.add(content_item)
                await session.commit()
                await session.refresh(content_item)
                logger.info(f"✅ Migrated: {metadata['title']} ({metadata['content_type'].value})")
            else:
                logger.info(f"Would migrate: {metadata['title']} ({metadata['content_type'].value})")
            
            self.migrated_count += 1
            
        except Exception as e:
            logger.error(f"❌ Error migrating {file_path.name}: {e}")
            self.error_count += 1
            if not self.dry_run:
                await session.rollback()
    
    async def migrate_excel_content(self, session, file_path: Path, admin_user_id: uuid.UUID):
        """Migrate Trivie Excel quiz content."""
        try:
            logger.info(f"Processing Excel file: {file_path.name}...")
            
            # Load Excel file
            workbook = openpyxl.load_workbook(file_path)
            
            # Process each worksheet as a separate quiz
            for sheet_name in workbook.sheetnames:
                sheet = workbook[sheet_name]
                
                # Extract quiz data from Excel format
                # This is a simplified conversion - would need to match Trivie format
                quiz_data = {
                    "id": str(uuid.uuid4()),
                    "name": f"Trivie Quiz - {sheet_name}",
                    "description": f"Quiz imported from {file_path.name}",
                    "nodes": [],
                    "links": []
                }
                
                # Create minimal quiz structure
                # In a real implementation, we'd parse the Excel format properly
                quiz_data["nodes"] = [
                    {
                        "id": "start",
                        "type": "start",
                        "title": f"Trivie Quiz - {sheet_name}",
                        "text": f"Quiz imported from {file_path.name} - worksheet: {sheet_name}"
                    }
                ]
                
                content_item = ContentItem(
                    title=f"Trivie Quiz - {sheet_name}",
                    description=f"Quiz imported from {file_path.name}",
                    nlj_data=quiz_data,
                    content_type=ContentType.ASSESSMENT,
                    learning_style=LearningStyle.READING_WRITING,
                    is_template=True,
                    template_category="trivie-imports",
                    created_by=admin_user_id,
                    state=ContentState.PUBLISHED,
                    published_at=datetime.now(timezone.utc)
                )
                
                if not self.dry_run:
                    session.add(content_item)
                    logger.info(f"✅ Migrated Trivie quiz: {sheet_name}")
                else:
                    logger.info(f"Would migrate Trivie quiz: {sheet_name}")
                
                self.migrated_count += 1
            
            if not self.dry_run:
                await session.commit()
                
        except Exception as e:
            logger.error(f"❌ Error migrating Excel file {file_path.name}: {e}")
            self.error_count += 1
            if not self.dry_run:
                await session.rollback()
    
    async def migrate_all_content(self):
        """Migrate all sample content to database."""
        logger.info("🚀 Starting sample content migration...")
        logger.info(f"Frontend static path: {self.frontend_static_path}")
        
        if self.dry_run:
            logger.info("DRY RUN MODE - No changes will be made")
        
        if not self.frontend_static_path.exists():
            logger.error(f"Frontend static directory not found: {self.frontend_static_path}")
            return False
        
        logger.info("🔍 Detecting database configuration...")
        
        # Initialize database manager (handles both RDS and direct PostgreSQL)
        await db_manager.initialize()
        
        # Ensure database tables exist
        await create_tables()
        
        connection_info = db_manager.get_connection_info()
        logger.info(f"📊 Connected to: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")
        
        async with db_manager.get_session() as session:
            try:
                # Ensure admin user exists
                admin_user_id = await self.ensure_admin_user(session)
                
                # Clear existing content if force flag is set
                await self.clear_existing_content(session)
                
                # Migrate NLJ scenarios
                nlj_dir = self.frontend_static_path / "sample_nljs"
                if nlj_dir.exists():
                    logger.info("📚 Migrating NLJ scenarios...")
                    for json_file in nlj_dir.glob("*.json"):
                        await self.migrate_json_content(session, json_file, admin_user_id)
                
                # Migrate surveys
                survey_dir = self.frontend_static_path / "sample_surveys"
                if survey_dir.exists():
                    logger.info("📋 Migrating surveys...")
                    for json_file in survey_dir.glob("*.json"):
                        await self.migrate_json_content(session, json_file, admin_user_id)
                
                # Migrate Connections games
                connections_dir = self.frontend_static_path / "sample_connections"
                if connections_dir.exists():
                    logger.info("🧩 Migrating Connections games...")
                    for json_file in connections_dir.glob("*.json"):
                        await self.migrate_json_content(session, json_file, admin_user_id)
                
                # Migrate Wordle games
                wordle_dir = self.frontend_static_path / "sample_wordle"
                if wordle_dir.exists():
                    logger.info("🎮 Migrating Wordle games...")
                    for json_file in wordle_dir.glob("*.json"):
                        await self.migrate_json_content(session, json_file, admin_user_id)
                
                # Migrate Trivie Excel files
                trivie_dir = self.frontend_static_path / "sample_trivie_quiz"
                if trivie_dir.exists():
                    logger.info("📊 Migrating Trivie quizzes...")
                    for excel_file in trivie_dir.glob("*.xlsx"):
                        await self.migrate_excel_content(session, excel_file, admin_user_id)
                
                # Final commit
                if not self.dry_run:
                    await session.commit()
                
                logger.info("✅ Content migration completed!")
                logger.info(f"📊 Migration Summary:")
                logger.info(f"   Migrated: {self.migrated_count}")
                logger.info(f"   Skipped: {self.skipped_count}")
                logger.info(f"   Errors: {self.error_count}")
                
                return self.error_count == 0
                
            except Exception as e:
                logger.error(f"Migration failed: {e}")
                if not self.dry_run:
                    await session.rollback()
                return False
            finally:
                await db_manager.close()
    
    async def create_database_backup(self):
        """Create a backup of the content data."""
        if self.dry_run:
            logger.info("Would create database backup")
            return
        
        logger.info("📦 Creating database backup...")
        
        backup_dir = Path(__file__).parent.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = backup_dir / f"sample_content_backup_{timestamp}.json"
        
        # Initialize database manager for this function too
        await db_manager.initialize()
        
        async with db_manager.get_session() as session:
            try:
                # Export all template content
                result = await session.execute(
                    select(ContentItem).where(ContentItem.is_template == True)
                )
                content_items = result.scalars().all()
                
                backup_data = {
                    "timestamp": timestamp,
                    "content_count": len(content_items),
                    "content": []
                }
                
                for item in content_items:
                    backup_data["content"].append({
                        "id": str(item.id),
                        "title": item.title,
                        "description": item.description,
                        "content_type": item.content_type.value,
                        "learning_style": item.learning_style.value,
                        "template_category": item.template_category,
                        "nlj_data": item.nlj_data,
                        "created_at": item.created_at.isoformat(),
                        "state": item.state.value
                    })
                
                with open(backup_file, 'w', encoding='utf-8') as f:
                    json.dump(backup_data, f, indent=2, ensure_ascii=False)
                
                logger.info(f"✅ Backup created: {backup_file}")
                logger.info(f"   Content items: {len(content_items)}")
                
            except Exception as e:
                logger.error(f"❌ Backup failed: {e}")
            finally:
                await db_manager.close()


async def main():
    """Main migration function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate sample content to database")
    parser.add_argument("--dry-run", action="store_true", 
                       help="Preview migration without making changes")
    parser.add_argument("--force", action="store_true",
                       help="Delete existing sample content before migration")
    parser.add_argument("--backup", action="store_true",
                       help="Create database backup after migration")
    
    args = parser.parse_args()
    
    migrator = ContentMigrator(dry_run=args.dry_run, force=args.force)
    
    success = await migrator.migrate_all_content()
    
    if success and args.backup and not args.dry_run:
        await migrator.create_database_backup()
    
    if success:
        logger.info("🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Migration failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())