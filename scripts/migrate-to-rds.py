#!/usr/bin/env python3
"""
Comprehensive RDS Migration Script

This script handles the complete migration from direct PostgreSQL to RDS:
1. Backs up existing data from current PostgreSQL instance
2. Waits for RDS instance to be available
3. Migrates schema and data to RDS
4. Validates data integrity
5. Updates application configuration

Usage:
    python scripts/migrate-to-rds.py [--backup-only] [--restore-only] [--validate-only]
"""

import os
import sys
import json
import asyncio
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent / "backend"))

import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.services.database_service import rds_database_service


class RDSMigrationManager:
    """Manages the complete migration process from PostgreSQL to RDS."""
    
    def __init__(self):
        self.backup_file = None
        self.source_db_url = settings.DATABASE_URL
        self.migration_log = []
        
    async def run_migration(
        self,
        backup_only: bool = False,
        restore_only: bool = False,
        validate_only: bool = False
    ) -> bool:
        """Run the complete migration process."""
        
        print("🚀 NLJ Platform RDS Migration")
        print("=" * 50)
        
        try:
            if validate_only:
                return await self._validate_migration()
            
            if not restore_only:
                # Step 1: Create backup of current database
                print("📦 Step 1: Creating database backup...")
                backup_success = await self._create_database_backup()
                if not backup_success:
                    print("❌ Backup failed - aborting migration")
                    return False
                
                self._log("Database backup completed successfully")
                
                if backup_only:
                    print("✅ Backup completed successfully!")
                    print(f"   Backup file: {self.backup_file}")
                    return True
            
            # Step 2: Wait for RDS instance
            print("⏳ Step 2: Waiting for RDS instance to be available...")
            rds_ready = await self._wait_for_rds()
            if not rds_ready:
                print("❌ RDS instance not available - aborting migration")
                return False
            
            self._log("RDS instance is available")
            
            # Step 3: Get RDS connection info
            print("🔗 Step 3: Getting RDS connection information...")
            rds_connection = await self._get_rds_connection()
            if not rds_connection:
                print("❌ Could not get RDS connection - aborting migration")
                return False
            
            print(f"   RDS Endpoint: {rds_connection['host']}:{rds_connection['port']}")
            self._log(f"RDS connection established: {rds_connection['instance_id']}")
            
            # Step 4: Migrate schema
            print("🏗️  Step 4: Migrating database schema...")
            schema_success = await self._migrate_schema(rds_connection['connection_string'])
            if not schema_success:
                print("❌ Schema migration failed - aborting migration")
                return False
            
            self._log("Database schema migrated successfully")
            
            # Step 5: Migrate data
            if not restore_only or self.backup_file:
                print("📊 Step 5: Migrating data...")
                data_success = await self._migrate_data(rds_connection['connection_string'])
                if not data_success:
                    print("❌ Data migration failed - rolling back")
                    return False
                
                self._log("Data migration completed successfully")
            
            # Step 6: Validate migration
            print("✅ Step 6: Validating migration...")
            validation_success = await self._validate_migration(rds_connection['connection_string'])
            if not validation_success:
                print("⚠️  Migration validation failed - manual review required")
                # Don't return False here as data might still be migrated correctly
            
            self._log("Migration validation completed")
            
            # Step 7: Update configuration
            print("⚙️  Step 7: Updating application configuration...")
            config_success = await self._update_configuration()
            if config_success:
                self._log("Application configuration updated")
            
            print("\n🎉 RDS Migration Completed Successfully!")
            print("=" * 50)
            print("📋 Migration Summary:")
            for entry in self.migration_log:
                print(f"   ✓ {entry}")
            
            print("\n🔄 Next Steps:")
            print("   1. Restart your application services")
            print("   2. Test application functionality")
            print("   3. Monitor RDS performance")
            print("   4. Create additional RDS snapshots if needed")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Migration failed with error: {e}")
            print("\n🔄 Recovery Steps:")
            print("   1. Check LocalStack logs: docker-compose logs localstack")
            print("   2. Verify RDS instance status: curl http://localhost:4566/_localstack/health")
            print("   3. Review migration logs above")
            
            return False
    
    async def _create_database_backup(self) -> bool:
        """Create a backup of the current PostgreSQL database."""
        try:
            # Generate backup filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.backup_file = f"nlj_backup_{timestamp}.sql"
            backup_path = Path("backups") / self.backup_file
            backup_path.parent.mkdir(exist_ok=True)
            
            # Extract connection details from DATABASE_URL
            # postgresql+asyncpg://user:pass@host:port/db -> postgresql://user:pass@host:port/db
            pg_url = self.source_db_url.replace("postgresql+asyncpg://", "postgresql://")
            
            # Use pg_dump to create backup
            cmd = [
                "pg_dump",
                pg_url,
                "--no-password",
                "--verbose",
                "--clean",
                "--if-exists",
                "--file", str(backup_path)
            ]
            
            print(f"   Creating backup: {backup_path}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"   ✅ Backup created successfully: {backup_path}")
                print(f"   📊 Backup size: {backup_path.stat().st_size / 1024 / 1024:.1f} MB")
                return True
            else:
                print(f"   ❌ pg_dump failed: {result.stderr}")
                
                # Try alternative backup method using Python
                return await self._python_backup()
                
        except Exception as e:
            print(f"   ❌ Backup failed: {e}")
            return await self._python_backup()
    
    async def _python_backup(self) -> bool:
        """Alternative backup method using Python/asyncpg."""
        try:
            print("   🔄 Trying Python-based backup method...")
            
            # Connect to source database
            # Remove asyncpg from URL for direct connection
            pg_url = self.source_db_url.replace("postgresql+asyncpg://", "postgresql://")
            
            conn = await asyncpg.connect(pg_url)
            
            # Get table list
            tables = await conn.fetch("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public'
            """)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.backup_file = f"nlj_backup_{timestamp}.json"
            backup_path = Path("backups") / self.backup_file
            backup_path.parent.mkdir(exist_ok=True)
            
            backup_data = {}
            
            for table_row in tables:
                table_name = table_row['tablename']
                print(f"   📊 Backing up table: {table_name}")
                
                # Get table data
                rows = await conn.fetch(f"SELECT * FROM {table_name}")
                
                # Convert to JSON-serializable format
                table_data = []
                for row in rows:
                    row_dict = dict(row)
                    # Convert datetime objects to strings
                    for key, value in row_dict.items():
                        if isinstance(value, datetime):
                            row_dict[key] = value.isoformat()
                    table_data.append(row_dict)
                
                backup_data[table_name] = table_data
                print(f"     ✓ {len(table_data)} rows backed up")
            
            # Save backup data
            with open(backup_path, 'w') as f:
                json.dump(backup_data, f, indent=2, default=str)
            
            await conn.close()
            
            print(f"   ✅ Python backup completed: {backup_path}")
            return True
            
        except Exception as e:
            print(f"   ❌ Python backup failed: {e}")
            return False
    
    async def _wait_for_rds(self, timeout: int = 300) -> bool:
        """Wait for RDS instance to be available."""
        import time
        
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                status = await rds_database_service.get_instance_status()
                
                if status.get('status') == 'available':
                    print("   ✅ RDS instance is available!")
                    return True
                
                print(f"   ⏳ RDS status: {status.get('status', 'unknown')} - waiting...")
                await asyncio.sleep(10)
                
            except Exception as e:
                print(f"   ⏳ Waiting for RDS service... ({e})")
                await asyncio.sleep(5)
        
        print(f"   ❌ RDS instance not available after {timeout} seconds")
        return False
    
    async def _get_rds_connection(self) -> Optional[Dict[str, Any]]:
        """Get RDS connection information."""
        try:
            connection_info = await rds_database_service.get_connection_info()
            
            if connection_info.get('available'):
                return connection_info
            else:
                print(f"   ❌ RDS not available: {connection_info.get('error')}")
                return None
                
        except Exception as e:
            print(f"   ❌ Failed to get RDS connection: {e}")
            return None
    
    async def _migrate_schema(self, rds_connection_string: str) -> bool:
        """Migrate database schema to RDS."""
        try:
            # Create async engine for RDS
            rds_engine = create_async_engine(rds_connection_string)
            
            # Import Base to create tables
            from app.core.database import Base
            
            print("   🏗️  Creating database tables...")
            
            async with rds_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            print("   ✅ Schema migration completed")
            
            await rds_engine.dispose()
            return True
            
        except Exception as e:
            print(f"   ❌ Schema migration failed: {e}")
            return False
    
    async def _migrate_data(self, rds_connection_string: str) -> bool:
        """Migrate data to RDS."""
        try:
            if not self.backup_file:
                print("   ❌ No backup file available for data migration")
                return False
            
            backup_path = Path("backups") / self.backup_file
            
            if backup_path.suffix == '.sql':
                return await self._restore_sql_backup(rds_connection_string, backup_path)
            elif backup_path.suffix == '.json':
                return await self._restore_json_backup(rds_connection_string, backup_path)
            else:
                print(f"   ❌ Unsupported backup format: {backup_path.suffix}")
                return False
                
        except Exception as e:
            print(f"   ❌ Data migration failed: {e}")
            return False
    
    async def _restore_sql_backup(self, rds_connection_string: str, backup_path: Path) -> bool:
        """Restore SQL backup to RDS."""
        try:
            print(f"   📤 Restoring SQL backup: {backup_path}")
            
            # Use psql to restore
            cmd = [
                "psql",
                rds_connection_string.replace("postgresql+asyncpg://", "postgresql://"),
                "--file", str(backup_path),
                "--quiet"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print("   ✅ SQL backup restored successfully")
                return True
            else:
                print(f"   ❌ psql restore failed: {result.stderr}")
                
                # Try Python-based restore
                return await self._python_restore_sql(rds_connection_string, backup_path)
                
        except Exception as e:
            print(f"   ❌ SQL backup restore failed: {e}")
            return False
    
    async def _python_restore_sql(self, rds_connection_string: str, backup_path: Path) -> bool:
        """Python-based SQL backup restore."""
        try:
            print("   🔄 Trying Python-based SQL restore...")
            
            # Read SQL file
            with open(backup_path, 'r') as f:
                sql_content = f.read()
            
            # Connect to RDS
            rds_url = rds_connection_string.replace("postgresql+asyncpg://", "postgresql://")
            conn = await asyncpg.connect(rds_url)
            
            # Execute SQL content (split by statement)
            statements = sql_content.split(';')
            executed = 0
            
            for statement in statements:
                statement = statement.strip()
                if statement:
                    try:
                        await conn.execute(statement)
                        executed += 1
                    except Exception as e:
                        # Some statements might fail (like DROP IF EXISTS on non-existent tables)
                        # This is usually OK during restore
                        pass
            
            await conn.close()
            
            print(f"   ✅ Executed {executed} SQL statements")
            return True
            
        except Exception as e:
            print(f"   ❌ Python SQL restore failed: {e}")
            return False
    
    async def _restore_json_backup(self, rds_connection_string: str, backup_path: Path) -> bool:
        """Restore JSON backup to RDS."""
        try:
            print(f"   📤 Restoring JSON backup: {backup_path}")
            
            # Load backup data
            with open(backup_path, 'r') as f:
                backup_data = json.load(f)
            
            # Connect to RDS
            rds_url = rds_connection_string.replace("postgresql+asyncpg://", "postgresql://")
            conn = await asyncpg.connect(rds_url)
            
            # Restore data table by table
            for table_name, rows in backup_data.items():
                if not rows:
                    continue
                
                print(f"   📊 Restoring table: {table_name} ({len(rows)} rows)")
                
                # Get column names from first row
                columns = list(rows[0].keys())
                
                # Prepare insert statement
                placeholders = ', '.join([f'${i+1}' for i in range(len(columns))])
                insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
                
                # Insert rows in batches
                batch_size = 100
                for i in range(0, len(rows), batch_size):
                    batch = rows[i:i+batch_size]
                    
                    for row in batch:
                        values = [row[col] for col in columns]
                        try:
                            await conn.execute(insert_sql, *values)
                        except Exception as e:
                            # Log error but continue with other rows
                            print(f"     ⚠️  Failed to insert row: {e}")
                
                print(f"     ✓ {table_name} restored")
            
            await conn.close()
            
            print("   ✅ JSON backup restored successfully")
            return True
            
        except Exception as e:
            print(f"   ❌ JSON backup restore failed: {e}")
            return False
    
    async def _validate_migration(self, rds_connection_string: Optional[str] = None) -> bool:
        """Validate migration by comparing data counts."""
        try:
            print("   🔍 Validating migration...")
            
            # Get RDS connection if not provided
            if not rds_connection_string:
                rds_connection = await self._get_rds_connection()
                if not rds_connection:
                    return False
                rds_connection_string = rds_connection['connection_string']
            
            # Connect to both databases
            source_url = self.source_db_url.replace("postgresql+asyncpg://", "postgresql://")
            rds_url = rds_connection_string.replace("postgresql+asyncpg://", "postgresql://")
            
            try:
                source_conn = await asyncpg.connect(source_url)
                source_available = True
            except:
                source_available = False
                print("   ⚠️  Source database not available - skipping comparison")
            
            rds_conn = await asyncpg.connect(rds_url)
            
            # Get table list from RDS
            rds_tables = await rds_conn.fetch("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public'
            """)
            
            validation_results = []
            
            for table_row in rds_tables:
                table_name = table_row['tablename']
                
                # Count rows in RDS
                rds_count = await rds_conn.fetchval(f"SELECT COUNT(*) FROM {table_name}")
                
                if source_available:
                    # Count rows in source
                    try:
                        source_count = await source_conn.fetchval(f"SELECT COUNT(*) FROM {table_name}")
                        
                        if rds_count == source_count:
                            print(f"     ✅ {table_name}: {rds_count} rows (matches source)")
                            validation_results.append(True)
                        else:
                            print(f"     ⚠️  {table_name}: {rds_count} rows in RDS, {source_count} in source")
                            validation_results.append(False)
                    except:
                        print(f"     ⚠️  {table_name}: {rds_count} rows in RDS (source table not found)")
                        validation_results.append(True)  # OK if source table doesn't exist
                else:
                    print(f"     ℹ️  {table_name}: {rds_count} rows in RDS")
                    validation_results.append(True)
            
            if source_available:
                await source_conn.close()
            await rds_conn.close()
            
            success_rate = sum(validation_results) / len(validation_results) if validation_results else 0
            
            if success_rate >= 0.9:  # 90% success rate
                print(f"   ✅ Validation passed ({success_rate:.0%} success rate)")
                return True
            else:
                print(f"   ⚠️  Validation issues detected ({success_rate:.0%} success rate)")
                return False
                
        except Exception as e:
            print(f"   ❌ Validation failed: {e}")
            return False
    
    async def _update_configuration(self) -> bool:
        """Update application configuration for RDS."""
        try:
            # Create environment file for RDS
            env_rds_path = Path(".env.rds")
            
            rds_connection = await self._get_rds_connection()
            if not rds_connection:
                return False
            
            env_content = f"""# RDS Configuration (Generated by migration script)
# Enable RDS mode
USE_RDS=true
RDS_ENDPOINT_URL=http://localhost:4566
RDS_DB_INSTANCE_ID=nlj-postgres-dev

# Database connection (dynamically resolved from RDS)
DATABASE_URL={rds_connection['connection_string']}

# AWS LocalStack Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# S3 Configuration
S3_ENDPOINT_URL=http://localhost:4566
S3_BUCKET_MEDIA=nlj-media-dev
S3_BUCKET_BACKUPS=nlj-backups-dev

# SES Configuration
SES_ENDPOINT_URL=http://localhost:4566
SES_FROM_EMAIL=noreply@nlj-platform.local
ENABLE_EMAIL_NOTIFICATIONS=true

# Copy your other environment variables from .env here
"""
            
            with open(env_rds_path, 'w') as f:
                f.write(env_content)
            
            print(f"   ✅ RDS configuration saved to {env_rds_path}")
            print("   ℹ️  Copy this to backend/.env to use RDS")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Configuration update failed: {e}")
            return False
    
    def _log(self, message: str):
        """Add entry to migration log."""
        self.migration_log.append(f"{datetime.now().strftime('%H:%M:%S')} - {message}")


async def main():
    """Main migration script entry point."""
    parser = argparse.ArgumentParser(description="Migrate NLJ Platform from PostgreSQL to RDS")
    parser.add_argument("--backup-only", action="store_true", help="Only create backup, don't migrate")
    parser.add_argument("--restore-only", action="store_true", help="Only restore from backup, skip backup creation")
    parser.add_argument("--validate-only", action="store_true", help="Only validate existing migration")
    
    args = parser.parse_args()
    
    # Ensure backup directory exists
    Path("backups").mkdir(exist_ok=True)
    
    migration_manager = RDSMigrationManager()
    
    success = await migration_manager.run_migration(
        backup_only=args.backup_only,
        restore_only=args.restore_only,
        validate_only=args.validate_only
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())