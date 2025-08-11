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

from app.core.database_manager import db_manager
from app.core.database import Base
from app.models import *  # Import all models

async def reset_database():
    """Completely reset the database."""
    print("🔄 Resetting database...")
    print("🔍 Detecting database configuration...")
    
    # Initialize database manager (handles both RDS and direct PostgreSQL)
    await db_manager.initialize()
    
    connection_info = db_manager.get_connection_info()
    print(f"📊 Connected to: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")
    print(f"🔗 Database: {connection_info.get('url', 'Unknown')}")
    
    try:
        # Use the database manager's engine
        async with db_manager.engine.begin() as conn:
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
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(reset_database())