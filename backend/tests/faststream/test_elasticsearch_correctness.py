"""
Test suite for FastStream Elasticsearch integration correctness.
Focuses on ensuring the new system works properly rather than matching broken legacy behavior.
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4
from typing import Dict, Any

from app.services.enhanced_elasticsearch_service import ElasticsearchService


class TestElasticsearchCorrectness:
    """Test Elasticsearch service for correct functionality"""

    @pytest.fixture
    async def elasticsearch_service(self):
        """Get Elasticsearch service instance for testing"""
        service = ElasticsearchService()
        
        # Ensure test index exists
        await service.create_xapi_index()
        
        yield service
        
        # Cleanup
        await service.close()

    def create_valid_xapi_statement(self, **overrides) -> Dict[str, Any]:
        """Create a valid xAPI statement for testing"""
        statement = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": {
                "objectType": "Agent",
                "name": "Test Learner",
                "mbox": "mailto:test@example.com"
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/completed",
                "display": {"en-US": "completed"}
            },
            "object": {
                "objectType": "Activity",
                "id": "http://nlj.platform/activities/test-activity",
                "definition": {
                    "name": {"en-US": "Test Activity"},
                    "type": "http://adlnet.gov/expapi/activities/course"
                }
            },
            "result": {
                "completion": True,
                "success": True,
                "score": {"scaled": 0.85, "raw": 85, "min": 0, "max": 100}
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/program_id": "test-program"
                }
            }
        }
        
        # Apply any overrides
        statement.update(overrides)
        return statement

    async def test_store_single_statement(self, elasticsearch_service):
        """Test storing a single xAPI statement"""
        statement = self.create_valid_xapi_statement()
        
        result = await elasticsearch_service.store_xapi_statement(statement)
        
        assert result["success"] is True
        assert result["statement_id"] == statement["id"]
        assert "stored_at" in result

    async def test_store_multiple_statements(self, elasticsearch_service):
        """Test bulk storing multiple xAPI statements"""
        statements = [
            self.create_valid_xapi_statement(),
            self.create_valid_xapi_statement(),
            self.create_valid_xapi_statement()
        ]
        
        result = await elasticsearch_service.store_xapi_statements(statements)
        
        assert result["success"] is True
        assert result["statement_count"] == 3
        assert len(result["statement_ids"]) == 3

    async def test_survey_analytics_correctness(self, elasticsearch_service):
        """Test survey analytics produce correct results"""
        survey_id = "test-survey-123"
        
        # Create test survey response statements
        statements = []
        for i in range(5):
            statement = self.create_valid_xapi_statement(
                verb={
                    "id": "http://adlnet.gov/expapi/verbs/answered",
                    "display": {"en-US": "answered"}
                },
                object={
                    "objectType": "Activity", 
                    "id": f"http://nlj.platform/questions/q{i:03d}"
                },
                result={
                    "response": f"Response {i}",
                    "score": {"scaled": 0.8, "raw": 4, "min": 1, "max": 5}
                },
                context={
                    "platform": "NLJ Platform",
                    "extensions": {
                        "http://nlj.platform/extensions/parent_survey": survey_id,
                        "http://nlj.platform/extensions/question_type": "likert"
                    }
                },
                actor={
                    "objectType": "Agent",
                    "name": f"Respondent {i}",
                    "mbox": f"mailto:respondent{i}@example.com"
                }
            )
            statements.append(statement)
        
        # Store statements
        await elasticsearch_service.store_xapi_statements(statements)
        
        # Get analytics
        analytics = await elasticsearch_service.get_survey_analytics(survey_id)
        
        # Verify correctness
        assert analytics["success"] is True
        assert analytics["total_responses"] == 5
        assert analytics["survey_id"] == survey_id
        assert "data" in analytics
        assert analytics["data"]["overview"]["unique_respondents"] == 5

    async def test_learner_analytics_correctness(self, elasticsearch_service):
        """Test learner analytics produce correct results"""
        learner_email = "learner@example.com"
        
        # Create test statements for learner
        statements = [
            # Completed activity
            self.create_valid_xapi_statement(
                actor={
                    "objectType": "Agent",
                    "name": "Test Learner",
                    "mbox": f"mailto:{learner_email}"
                },
                verb={
                    "id": "http://adlnet.gov/expapi/verbs/completed",
                    "display": {"en-US": "completed"}
                },
                result={"completion": True, "success": True, "score": {"scaled": 0.9}}
            ),
            # Started activity
            self.create_valid_xapi_statement(
                actor={
                    "objectType": "Agent", 
                    "name": "Test Learner",
                    "mbox": f"mailto:{learner_email}"
                },
                verb={
                    "id": "http://activitystrea.ms/schema/1.0/start",
                    "display": {"en-US": "started"}
                },
                object={
                    "objectType": "Activity",
                    "id": "http://nlj.platform/activities/different-activity"
                }
            )
        ]
        
        await elasticsearch_service.store_xapi_statements(statements)
        
        # Get learner analytics
        analytics = await elasticsearch_service.get_learner_analytics(learner_email)
        
        # Verify correctness
        assert analytics.learner_email == learner_email
        assert analytics.total_activities == 2  # Two different activities
        assert analytics.completed_activities == 1  # One completed
        assert analytics.completion_rate == 50.0  # 1/2 * 100
        assert analytics.average_score == 0.9

    async def test_platform_overview_correctness(self, elasticsearch_service):
        """Test platform overview analytics produce correct results"""
        # Create test statements across different activities and learners
        statements = []
        
        for i in range(3):
            # Completion statement
            statements.append(self.create_valid_xapi_statement(
                actor={
                    "objectType": "Agent",
                    "name": f"Learner {i}",
                    "mbox": f"mailto:learner{i}@example.com"
                },
                object={
                    "objectType": "Activity",
                    "id": f"http://nlj.platform/activities/activity-{i}"
                },
                verb={
                    "id": "http://adlnet.gov/expapi/verbs/completed",
                    "display": {"en-US": "completed"}
                },
                result={"completion": True, "success": True}
            ))
            
            # Started statement
            statements.append(self.create_valid_xapi_statement(
                actor={
                    "objectType": "Agent",
                    "name": f"Learner {i}",
                    "mbox": f"mailto:learner{i}@example.com"
                },
                object={
                    "objectType": "Activity",
                    "id": f"http://nlj.platform/activities/activity-{i}"
                },
                verb={
                    "id": "http://activitystrea.ms/schema/1.0/start",
                    "display": {"en-US": "started"}
                }
            ))
        
        await elasticsearch_service.store_xapi_statements(statements)
        
        # Get platform overview
        overview = await elasticsearch_service.get_platform_overview()
        
        # Verify correctness
        assert overview["total_statements"] == 6  # 3 completions + 3 starts
        assert overview["unique_learners"] == 3  # 3 different learners
        assert overview["unique_activities"] == 3  # 3 different activities
        assert overview["completion_rate"] == 50.0  # 3 completions out of 6 total statements

    async def test_connection_health(self, elasticsearch_service):
        """Test Elasticsearch connection health check"""
        health = await elasticsearch_service.test_connection()
        
        # Should be able to connect (assuming ES is running in test environment)
        assert "success" in health
        assert "status" in health
        assert "tested_at" in health