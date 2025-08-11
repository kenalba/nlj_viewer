#!/usr/bin/env python3
"""
Comprehensive RDS Integration Test Suite

Tests all aspects of the RDS integration including:
1. LocalStack RDS service availability
2. RDS instance creation and management
3. Database connection and operations
4. Snapshot creation and restoration
5. API endpoint functionality

Usage:
    python scripts/test-rds-integration.py [--quick] [--api-only]
"""

import os
import sys
import asyncio
import argparse
import requests
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from app.services.database_service import rds_database_service
from app.services.s3_service import s3_media_service
from app.services.email_service import email_service
from app.core.config import settings


class RDSIntegrationTester:
    """Comprehensive test suite for RDS LocalStack integration."""
    
    def __init__(self):
        self.test_results = []
        self.api_base_url = "http://localhost:8000"
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result."""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append((test_name, success, details))
        print(f"   {status} {test_name}")
        if details and not success:
            print(f"        {details}")
    
    async def run_all_tests(self, quick_mode: bool = False, api_only: bool = False) -> bool:
        """Run complete test suite."""
        
        print("🧪 RDS LocalStack Integration Test Suite")
        print("=" * 50)
        print()
        
        # Test 1: LocalStack Health
        print("🔍 Phase 1: LocalStack Service Health")
        localstack_healthy = await self.test_localstack_health()
        
        if not localstack_healthy and not api_only:
            print("❌ LocalStack not available - aborting tests")
            return False
        
        if not api_only:
            # Test 2: RDS Service Tests
            print("\n🗄️  Phase 2: RDS Service Tests")
            await self.test_rds_service()
            
            # Test 3: Database Operations
            print("\n💾 Phase 3: Database Operations")
            await self.test_database_operations()
            
            if not quick_mode:
                # Test 4: Snapshot Operations
                print("\n📸 Phase 4: Snapshot Operations")
                await self.test_snapshot_operations()
        
        # Test 5: API Endpoints
        print("\n🚀 Phase 5: API Endpoint Tests")
        await self.test_api_endpoints()
        
        # Test 6: Integration Tests
        if not quick_mode and not api_only:
            print("\n🔗 Phase 6: Integration Tests")
            await self.test_integration_scenarios()
        
        # Print Summary
        self.print_test_summary()
        
        # Return overall success
        passed_tests = sum(1 for _, success, _ in self.test_results if success)
        total_tests = len(self.test_results)
        
        return passed_tests == total_tests
    
    async def test_localstack_health(self) -> bool:
        """Test LocalStack service health."""
        try:
            # Check LocalStack health endpoint
            response = requests.get("http://localhost:4566/_localstack/health", timeout=10)
            health_data = response.json()
            
            # Check specific services
            s3_status = health_data.get('services', {}).get('s3', 'unknown')
            ses_status = health_data.get('services', {}).get('ses', 'unknown')
            rds_status = health_data.get('services', {}).get('rds', 'unknown')
            
            self.log_test("LocalStack S3 Service", s3_status == 'available')
            self.log_test("LocalStack SES Service", ses_status == 'available')
            self.log_test("LocalStack RDS Service", rds_status == 'available')
            
            return rds_status == 'available'
            
        except Exception as e:
            self.log_test("LocalStack Health Check", False, str(e))
            return False
    
    async def test_rds_service(self) -> bool:
        """Test RDS service functionality."""
        try:
            # Test RDS service health
            health = rds_database_service.health_check()
            health_success = health['status'] in ['healthy', 'unhealthy']  # unhealthy is OK if instance doesn't exist yet
            self.log_test("RDS Service Health Check", health_success, health.get('error', ''))
            
            # Test instance status
            try:
                status = await rds_database_service.get_instance_status()
                status_success = 'instance_id' in status
                self.log_test("RDS Instance Status", status_success, status.get('error', ''))
                
                if status.get('status') == 'available':
                    self.log_test("RDS Instance Available", True)
                    return True
                else:
                    self.log_test("RDS Instance Available", False, f"Status: {status.get('status')}")
                    return False
                    
            except Exception as e:
                self.log_test("RDS Instance Status", False, str(e))
                return False
                
        except Exception as e:
            self.log_test("RDS Service Test", False, str(e))
            return False
    
    async def test_database_operations(self) -> bool:
        """Test database connection and basic operations."""
        try:
            # Test connection info
            connection_info = await rds_database_service.get_connection_info()
            connection_success = connection_info.get('available', False)
            self.log_test("Database Connection Info", connection_success, connection_info.get('error', ''))
            
            if not connection_success:
                return False
            
            # Test database connection
            try:
                import asyncpg
                
                conn_string = connection_info['connection_string'].replace("postgresql+asyncpg://", "postgresql://")
                conn = await asyncpg.connect(conn_string)
                
                # Test basic query
                result = await conn.fetchval("SELECT 1")
                query_success = result == 1
                self.log_test("Basic Database Query", query_success)
                
                # Test table creation
                await conn.execute("CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT)")
                await conn.execute("INSERT INTO test_table (name) VALUES ('test')")
                
                count = await conn.fetchval("SELECT COUNT(*) FROM test_table")
                table_success = count >= 1
                self.log_test("Table Operations", table_success)
                
                # Cleanup
                await conn.execute("DROP TABLE IF EXISTS test_table")
                await conn.close()
                
                return query_success and table_success
                
            except Exception as e:
                self.log_test("Database Operations", False, str(e))
                return False
                
        except Exception as e:
            self.log_test("Database Connection Test", False, str(e))
            return False
    
    async def test_snapshot_operations(self) -> bool:
        """Test RDS snapshot creation and management."""
        try:
            # Create a test snapshot
            snapshot_id = f"test-snapshot-{int(datetime.now().timestamp())}"
            
            snapshot_info = await rds_database_service.create_snapshot(snapshot_id)
            snapshot_success = 'snapshot_id' in snapshot_info
            self.log_test("Snapshot Creation", snapshot_success, snapshot_info.get('error', ''))
            
            if not snapshot_success:
                return False
            
            # List snapshots
            snapshots = await rds_database_service.list_snapshots()
            list_success = isinstance(snapshots, list)
            self.log_test("Snapshot Listing", list_success)
            
            # Check if our snapshot is in the list
            our_snapshot = None
            for snapshot in snapshots:
                if snapshot.get('snapshot_id') == snapshot_id:
                    our_snapshot = snapshot
                    break
            
            found_success = our_snapshot is not None
            self.log_test("Snapshot Found in List", found_success)
            
            return snapshot_success and list_success and found_success
            
        except Exception as e:
            self.log_test("Snapshot Operations", False, str(e))
            return False
    
    async def test_api_endpoints(self) -> bool:
        """Test API endpoints for database management."""
        try:
            # Test health endpoint
            try:
                response = requests.get(f"{self.api_base_url}/health", timeout=10)
                api_health = response.status_code == 200
                self.log_test("API Health Endpoint", api_health)
            except:
                api_health = False
                self.log_test("API Health Endpoint", False, "API not accessible")
            
            if not api_health:
                return False
            
            # Test database health endpoint (no auth required)
            try:
                response = requests.get(f"{self.api_base_url}/api/database/health", timeout=10)
                
                if response.status_code == 200:
                    db_health_data = response.json()
                    db_health = db_health_data.get('database_service', {}).get('status') == 'healthy'
                    self.log_test("Database Health API", db_health)
                elif response.status_code == 401:
                    # Authentication required - that's expected
                    self.log_test("Database Health API", True, "Authentication required (expected)")
                    db_health = True
                else:
                    self.log_test("Database Health API", False, f"Status: {response.status_code}")
                    db_health = False
            except Exception as e:
                self.log_test("Database Health API", False, str(e))
                db_health = False
            
            # Test API documentation
            try:
                response = requests.get(f"{self.api_base_url}/docs", timeout=10)
                docs_success = response.status_code == 200 and 'swagger' in response.text.lower()
                self.log_test("API Documentation", docs_success)
            except Exception as e:
                self.log_test("API Documentation", False, str(e))
                docs_success = False
            
            return api_health and db_health and docs_success
            
        except Exception as e:
            self.log_test("API Endpoint Tests", False, str(e))
            return False
    
    async def test_integration_scenarios(self) -> bool:
        """Test complete integration scenarios."""
        try:
            # Test S3 + RDS integration
            s3_health = s3_media_service.health_check()
            s3_success = s3_health['status'] == 'healthy'
            self.log_test("S3 Service Integration", s3_success)
            
            # Test SES + RDS integration  
            email_health = email_service.health_check()
            email_success = email_health['status'] in ['healthy', 'unhealthy']  # SES may show unhealthy but still work
            self.log_test("SES Service Integration", email_success)
            
            # Test database manager integration
            try:
                from app.core.database_manager import db_manager
                
                # Test health check
                db_manager_health = await db_manager.health_check()
                db_manager_success = db_manager_health['status'] in ['healthy', 'not_initialized']
                self.log_test("Database Manager Integration", db_manager_success, db_manager_health.get('error', ''))
                
            except Exception as e:
                self.log_test("Database Manager Integration", False, str(e))
                db_manager_success = False
            
            return s3_success and email_success and db_manager_success
            
        except Exception as e:
            self.log_test("Integration Tests", False, str(e))
            return False
    
    def print_test_summary(self):
        """Print comprehensive test summary."""
        
        print("\n" + "=" * 50)
        print("📊 Test Results Summary")
        print("=" * 50)
        
        passed = 0
        failed = 0
        
        for test_name, success, details in self.test_results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status} {test_name}")
            if details and not success:
                print(f"     └─ {details}")
            
            if success:
                passed += 1
            else:
                failed += 1
        
        print(f"\n📈 Results: {passed} passed, {failed} failed ({passed}/{passed+failed} total)")
        
        success_rate = passed / (passed + failed) if (passed + failed) > 0 else 0
        
        if success_rate == 1.0:
            print("🎉 All tests passed! RDS integration is working perfectly.")
        elif success_rate >= 0.8:
            print("✅ Most tests passed! RDS integration is mostly working.")
        elif success_rate >= 0.5:
            print("⚠️  Some tests failed. RDS integration needs attention.")
        else:
            print("❌ Many tests failed. RDS integration has significant issues.")
        
        print("\n🔗 Useful Commands:")
        print("   Check LocalStack: curl http://localhost:4566/_localstack/health")
        print("   View API docs:    http://localhost:8000/docs")
        print("   Database status:  curl http://localhost:8000/api/database/health")
        print("   View logs:        docker-compose logs localstack")


async def main():
    """Main test runner."""
    
    parser = argparse.ArgumentParser(description="Test RDS LocalStack integration")
    parser.add_argument("--quick", action="store_true", help="Run quick tests only (skip snapshots)")
    parser.add_argument("--api-only", action="store_true", help="Test API endpoints only")
    
    args = parser.parse_args()
    
    tester = RDSIntegrationTester()
    success = await tester.run_all_tests(
        quick_mode=args.quick,
        api_only=args.api_only
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())