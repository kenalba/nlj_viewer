#!/usr/bin/env python3
"""
Test database connection (supports both PostgreSQL and RDS).
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

from app.core.database_manager import db_manager
from app.services.database_service import rds_database_service

async def test_connection():
    """Test connection to database (PostgreSQL or RDS)."""
    print("🔍 Testing database connection...")
    print("🔍 Detecting database configuration...")
    
    # Initialize database manager
    try:
        await db_manager.initialize()
        connection_info = db_manager.get_connection_info()
        
        print(f"📊 Database Type: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")
        print(f"🔗 Connection URL: {connection_info.get('url', 'Unknown')[:50]}...")
        
        # Test database manager health
        health = await db_manager.health_check()
        if health['status'] == 'healthy':
            print("✅ Database Manager: Healthy")
        else:
            print(f"❌ Database Manager: {health['status']}")
            if 'error' in health:
                print(f"   Error: {health['error']}")
        
        # If using RDS, test RDS-specific functionality
        if connection_info.get('use_rds'):
            print("\n🗄️  Testing RDS functionality...")
            
            # Test RDS service health
            rds_health = rds_database_service.health_check()
            print(f"📊 RDS Service: {rds_health['status']}")
            
            # Test RDS instance status
            try:
                rds_status = await rds_database_service.get_instance_status()
                print(f"📊 RDS Instance: {rds_status.get('status', 'Unknown')}")
                
                if rds_status.get('endpoint'):
                    endpoint = rds_status['endpoint']
                    print(f"🔗 RDS Endpoint: {endpoint.get('address')}:{endpoint.get('port')}")
            except Exception as e:
                print(f"⚠️  RDS Instance Status: {e}")
        
        # Test direct connection
        print("\n💾 Testing direct database connection...")
        
        # Get connection string
        if connection_info.get('use_rds'):
            # Use RDS connection info
            rds_connection = await rds_database_service.get_connection_info()
            if rds_connection.get('available'):
                database_url = rds_connection['connection_string'].replace("postgresql+asyncpg://", "postgresql://")
            else:
                print(f"❌ RDS not available: {rds_connection.get('error')}")
                return False
        else:
            # Use database manager URL
            database_url = connection_info.get('url', '').replace("postgresql+asyncpg://", "postgresql://")
        
        # Test connection with asyncpg
        conn = await asyncpg.connect(database_url)
        
        # Test query
        result = await conn.fetchval("SELECT version()")
        print("✅ Direct connection successful!")
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
            print("   Run: python backend/scripts/seed_database.py")
        
        await conn.close()
        
        print("\n✅ All database tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\n🔧 Troubleshooting:")
        if "RDS" in str(e) or connection_info.get('use_rds'):
            print("   • Check if LocalStack is running: docker-compose logs localstack")
            print("   • Verify RDS service: curl http://localhost:4566/_localstack/health")
            print("   • Test RDS integration: python scripts/test-rds-integration.py")
        else:
            print("   • Make sure PostgreSQL container is running: docker-compose up nlj-db -d")
            print("   • Check connection details in DATABASE_URL environment variable")
            print("   • Verify container name and port mapping")
        
        return False
    
    finally:
        await db_manager.close()

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)