#!/usr/bin/env python3
"""
Script to run our consolidated migration manually
"""
import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine
from app.core.config import settings
from alembic.versions.consolidate_001_consolidated_schema_with_content_studio import upgrade


def run_migration():
    """Run the consolidated migration directly"""
    try:
        # Create synchronous engine for alembic operations
        engine = create_engine(settings.SYNC_DATABASE_URL)
        
        # Import alembic context and configure it
        from alembic import context
        from alembic.runtime.environment import EnvironmentContext
        
        def run_in_context(connection):
            context.configure(connection=connection)
            with context.begin_transaction():
                upgrade()
        
        with engine.connect() as connection:
            run_in_context(connection)
        
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise


if __name__ == "__main__":
    run_migration()