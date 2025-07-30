#!/usr/bin/env python3
"""
Database cleanup script for fresh content migration.

Handles cascade deletions properly by deleting in the correct order.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import create_tables, AsyncSessionLocal
from app.models.content import ContentItem
from app.models.workflow import ContentVersion, ApprovalWorkflow
from sqlalchemy import delete

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def clean_database():
    """Clean all content-related data from database."""
    logger.info("🧹 Starting database cleanup...")
    
    # Ensure database tables exist
    await create_tables()
    
    async with AsyncSessionLocal() as session:
        try:
            # Delete in proper order to avoid foreign key constraints
            
            # 1. Delete approval workflows first
            await session.execute(delete(ApprovalWorkflow))
            logger.info("Deleted approval workflows")
            
            # 2. Delete content versions
            await session.execute(delete(ContentVersion))
            logger.info("Deleted content versions")
            
            # 3. Delete content items
            await session.execute(delete(ContentItem))
            logger.info("Deleted content items")
            
            # Commit all deletions
            await session.commit()
            
            logger.info("✅ Database cleanup completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Database cleanup failed: {e}")
            await session.rollback()
            return False


async def main():
    """Main cleanup function."""
    success = await clean_database()
    
    if success:
        logger.info("🎉 Database cleanup completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Database cleanup failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())