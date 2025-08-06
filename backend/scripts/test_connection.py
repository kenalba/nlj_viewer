#!/usr/bin/env python3
"""
Test PostgreSQL database connection.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import asyncpg
except ImportError:
    print("❌ asyncpg not installed. Install with: pip install asyncpg")
    sys.exit(1)

async def test_connection():
    """Test connection to PostgreSQL database."""
    database_url = os.getenv(
        "DATABASE_URL", 
        "postgresql://nlj_user:nlj_pass@localhost:5432/nlj_platform"
    )
    
    # Extract connection details for asyncpg
    if database_url.startswith("postgresql+asyncpg://"):
        database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    
    try:
        print(f"🔗 Connecting to: {database_url.replace('nlj_pass', '***')}")
        conn = await asyncpg.connect(database_url)
        
        # Test query
        result = await conn.fetchval("SELECT version()")
        print("✅ Connection successful!")
        print(f"📊 PostgreSQL Version: {result}")
        
        # Check if our tables exist
        tables = await conn.fetch("""
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        
        if tables:
            print(f"📋 Found {len(tables)} tables:")
            for table in tables:
                print(f"   • {table['tablename']}")
        else:
            print("⚠️  No tables found - run migrations first")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\n🔧 Troubleshooting:")
        print("   • Make sure PostgreSQL container is running: docker-compose up nlj-db -d")
        print("   • Check connection details in DATABASE_URL environment variable")
        print("   • Verify container name and port mapping")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)