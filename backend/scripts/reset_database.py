#!/usr/bin/env python3
"""
Complete database reset script - drops all tables and recreates from scratch.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.database import Base
from app.models import *  # Import all models

# Database URL from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://nlj_user:nlj_pass@localhost:5432/nlj_platform"
)

async def reset_database():
    """Completely reset the database."""
    print("🔄 Resetting database...")
    
    # Create engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with engine.begin() as conn:
            print("🗑️  Dropping all tables...")
            
            # Drop all tables
            await conn.run_sync(Base.metadata.drop_all)
            
            print("🔧 Creating all tables...")
            
            # Recreate all tables
            await conn.run_sync(Base.metadata.create_all)
            
            print("✅ Database reset complete!")
            
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reset_database())