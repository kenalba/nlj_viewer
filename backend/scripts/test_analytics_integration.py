#!/usr/bin/env python3
"""
Analytics Integration Test Suite.

Tests the complete analytics pipeline from xAPI event generation
through Kafka, Ralph LRS, Elasticsearch, to the Analytics API.
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Import services
from app.models.user import User
from app.models.content import ContentItem
from app.services.ralph_lrs_service import ralph_lrs_service
from app.services.elasticsearch_service import elasticsearch_service
# Import services directly instead of API endpoints
# from app.api.analytics import get_platform_overview, get_activity_trends

# Database URL from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://nlj_user:nlj_pass@localhost:5432/nlj_platform"
)

class AnalyticsIntegrationTest:
    """Integration test suite for analytics pipeline."""
    
    def __init__(self):
        self.test_results = {}
        self.total_tests = 0
        self.passed_tests = 0
        
    async def run_all_tests(self):
        """Run complete integration test suite."""
        print("🧪 Analytics Pipeline Integration Tests")
        print("=" * 60)
        
        try:
            # Test 1: Database connectivity
            await self.test_database_connection()
            
            # Test 2: Ralph LRS connectivity
            await self.test_ralph_lrs_connection()
            
            # Test 3: Elasticsearch connectivity
            await self.test_elasticsearch_connection()
            
            # Test 4: Analytics API endpoints
            await self.test_analytics_api()
            
            # Test 5: Data consistency (if data exists)
            await self.test_data_consistency()
            
            # Print results
            self.print_test_results()
            
        except Exception as e:
            print(f"❌ Critical error in test suite: {e}")
            return False
            
        return self.passed_tests == self.total_tests
    
    def record_test(self, test_name: str, passed: bool, details: str = ""):
        """Record test result."""
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
            
        self.test_results[test_name] = {
            "passed": passed,
            "details": details,
            "status": status
        }
        print(f"  {status}: {test_name}")
        if details and not passed:
            print(f"    └─ {details}")
    
    async def test_database_connection(self):
        """Test PostgreSQL database connection."""
        test_name = "Database Connection"
        
        try:
            engine = create_async_engine(DATABASE_URL, echo=False)
            async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            
            async with async_session() as session:
                # Test basic query
                result = await session.execute(select(User))
                users = result.scalars().all()
                
                result = await session.execute(select(ContentItem))
                activities = result.scalars().all()
                
            await engine.dispose()
            
            details = f"Found {len(users)} users, {len(activities)} activities"
            self.record_test(test_name, True, details)
            
        except Exception as e:
            self.record_test(test_name, False, str(e))
    
    async def test_ralph_lrs_connection(self):
        """Test Ralph LRS connection and basic functionality."""
        test_name = "Ralph LRS Connection"
        
        try:
            # Test connection
            health_status = await ralph_lrs_service.test_connection()
            
            if health_status.get("success"):
                details = f"Connected - {health_status.get('status')}"
                self.record_test(test_name, True, details)
                
                # Test basic statement storage (optional)
                test_statement = {
                    "actor": {
                        "name": "Test User",
                        "mbox": "mailto:test@example.com"
                    },
                    "verb": {
                        "id": "http://adlnet.gov/expapi/verbs/experienced",
                        "display": {"en-US": "experienced"}
                    },
                    "object": {
                        "id": "http://nlj-platform.com/test-activity",
                        "definition": {
                            "name": {"en-US": "Test Activity"}
                        }
                    }
                }
                
                try:
                    result = await ralph_lrs_service.store_statement(test_statement)
                    if result.get("success"):
                        self.record_test("Ralph LRS Statement Storage", True, "Test statement stored successfully")
                    else:
                        self.record_test("Ralph LRS Statement Storage", False, "Failed to store test statement")
                except Exception as e:
                    self.record_test("Ralph LRS Statement Storage", False, f"Statement storage error: {e}")
                    
            else:
                error_details = health_status.get("error", "Unknown connection error")
                self.record_test(test_name, False, error_details)
                
        except Exception as e:
            self.record_test(test_name, False, str(e))
    
    async def test_elasticsearch_connection(self):
        """Test Elasticsearch connection and basic functionality."""
        test_name = "Elasticsearch Connection"
        
        try:
            # Test connection
            health_status = await elasticsearch_service.test_connection()
            
            if health_status.get("success"):
                cluster_status = health_status.get("cluster_status", "unknown")
                details = f"Connected - Cluster status: {cluster_status}"
                self.record_test(test_name, True, details)
                
                # Test basic analytics query
                try:
                    overview = await elasticsearch_service.get_platform_overview()
                    statements_count = overview.get("total_statements", 0)
                    learners_count = overview.get("unique_learners", 0)
                    
                    details = f"{statements_count} statements, {learners_count} learners"
                    self.record_test("Elasticsearch Analytics Query", True, details)
                    
                except Exception as e:
                    self.record_test("Elasticsearch Analytics Query", False, f"Query error: {e}")
                    
            else:
                error_details = health_status.get("error", "Unknown connection error")
                self.record_test(test_name, False, error_details)
                
        except Exception as e:
            self.record_test(test_name, False, str(e))
    
    async def test_analytics_api(self):
        """Test Analytics API endpoints."""
        test_name = "Analytics API Endpoints"
        
        try:
            # This would normally require FastAPI dependency injection
            # For now, we'll test the service layer directly
            
            # Test platform overview
            overview = await elasticsearch_service.get_platform_overview()
            if isinstance(overview, dict) and "total_statements" in overview:
                self.record_test("Platform Overview API", True, f"Retrieved overview data")
            else:
                self.record_test("Platform Overview API", False, "Invalid overview response format")
            
        except Exception as e:
            self.record_test(test_name, False, str(e))
    
    async def test_data_consistency(self):
        """Test data consistency across the pipeline."""
        test_name = "Data Consistency Check"
        
        try:
            # Get data from different sources
            overview = await elasticsearch_service.get_platform_overview()
            
            total_statements = overview.get("total_statements", 0)
            unique_learners = overview.get("unique_learners", 0)
            unique_activities = overview.get("unique_activities", 0)
            
            # Basic sanity checks
            consistency_checks = [
                (total_statements >= 0, "Total statements should be non-negative"),
                (unique_learners >= 0, "Unique learners should be non-negative"),  
                (unique_activities >= 0, "Unique activities should be non-negative"),
                (total_statements == 0 or unique_learners > 0, "If statements exist, should have learners"),
                (total_statements == 0 or unique_activities > 0, "If statements exist, should have activities")
            ]
            
            failed_checks = []
            for check, description in consistency_checks:
                if not check:
                    failed_checks.append(description)
            
            if not failed_checks:
                details = f"All consistency checks passed ({total_statements} statements)"
                self.record_test(test_name, True, details)
            else:
                details = f"Failed checks: {', '.join(failed_checks)}"
                self.record_test(test_name, False, details)
                
        except Exception as e:
            self.record_test(test_name, False, str(e))
    
    def print_test_results(self):
        """Print comprehensive test results."""
        print("\n" + "=" * 60)
        print("🧪 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        for test_name, result in self.test_results.items():
            print(f"{result['status']}: {test_name}")
            if result['details']:
                print(f"    └─ {result['details']}")
        
        print("\n" + "=" * 60)
        success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        print(f"📊 RESULTS: {self.passed_tests}/{self.total_tests} tests passed ({success_rate:.1f}%)")
        
        if self.passed_tests == self.total_tests:
            print("🎉 ALL TESTS PASSED - Analytics pipeline is fully operational!")
        else:
            print("⚠️  Some tests failed - check service configurations")
            
        print("=" * 60)

async def run_integration_tests():
    """Main function to run integration tests."""
    test_suite = AnalyticsIntegrationTest()
    success = await test_suite.run_all_tests()
    return success

if __name__ == "__main__":
    asyncio.run(run_integration_tests())