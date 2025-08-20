"""
Unit tests for GenerateInsightsUseCase - Analytics and Business Intelligence Workflow.

Tests comprehensive analytics generation including business logic, ORM integration,
and xAPI event publishing for the event-driven architecture.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.analytics.generate_insights_use_case import (
    GenerateInsightsUseCase,
    GenerateInsightsRequest,
    GenerateInsightsResponse,
    InsightType,
    AggregationLevel
)
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from app.models.user import UserRole

# Configure pytest-asyncio for async tests
pytestmark = pytest.mark.asyncio


class TestGenerateInsightsUseCase:
    """Test GenerateInsightsUseCase business workflow and xAPI event integration."""

    @pytest.fixture
    def mock_session(self):
        """Create mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_content_orm_service(self):
        """Create mock ContentOrmService."""
        return AsyncMock(spec=ContentOrmService)

    @pytest.fixture
    def mock_training_orm_service(self):
        """Create mock TrainingOrmService."""
        return AsyncMock(spec=TrainingOrmService)

    @pytest.fixture
    def mock_user_orm_service(self):
        """Create mock UserOrmService."""
        return AsyncMock(spec=UserOrmService)

    @pytest.fixture
    def generate_insights_use_case(self, mock_session, mock_content_orm_service,
                                 mock_training_orm_service, mock_user_orm_service):
        """Create GenerateInsightsUseCase instance with mocked dependencies."""
        return GenerateInsightsUseCase(
            mock_session,
            mock_content_orm_service,
            mock_training_orm_service,
            mock_user_orm_service
        )

    @pytest.fixture
    def admin_user_context(self):
        """Create user context for admin user."""
        return {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.ADMIN,
            "user_name": "Analytics Admin",
            "user_email": "admin@example.com"
        }

    @pytest.fixture
    def reviewer_user_context(self):
        """Create user context for reviewer user."""
        return {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.REVIEWER,
            "user_name": "Analytics Reviewer",
            "user_email": "reviewer@example.com"
        }

    @pytest.fixture
    def basic_insights_request(self):
        """Create basic insights generation request."""
        return GenerateInsightsRequest(
            insight_types=[InsightType.LEARNING_PERFORMANCE, InsightType.CONTENT_EFFECTIVENESS],
            aggregation_level=AggregationLevel.ORGANIZATION,
            time_range_start=datetime.now(timezone.utc).replace(day=1),
            time_range_end=datetime.now(timezone.utc),
            include_predictions=False
        )

    async def test_generate_insights_success_basic(self, generate_insights_use_case, basic_insights_request,
                                                 admin_user_context):
        """Test successful basic insights generation with xAPI event publishing."""
        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(basic_insights_request, admin_user_context)

            # Verify response structure
            assert isinstance(result, GenerateInsightsResponse)
            assert len(result.insights) > 0
            assert isinstance(result.summary_metrics, dict)
            assert isinstance(result.recommendations, list)
            assert result.insights_generated > 0
            assert result.processing_time_ms > 0

            # Verify insights contain expected types
            insight_types = [insight["type"] for insight in result.insights]
            assert "learning_performance" in insight_types
            assert "content_effectiveness" in insight_types

            # Verify xAPI event publishing - analytics should publish proper xAPI events
            mock_publish.assert_called_once()
            event_call = mock_publish.call_args

            # Check for analytics insights generated xAPI event
            assert event_call[0][0] == "publish_analytics_insights_generated"
            event_kwargs = event_call[1]

            # Verify xAPI structure is maintained
            assert "generator_id" in event_kwargs
            assert "generator_name" in event_kwargs
            assert "generator_email" in event_kwargs
            assert "insights_count" in event_kwargs
            assert "processing_time_ms" in event_kwargs
            assert event_kwargs["generator_id"] == admin_user_context["user_id"]
            assert event_kwargs["insights_count"] == len(result.insights)

    async def test_generate_insights_individual_aggregation(self, generate_insights_use_case,
                                                          admin_user_context):
        """Test insights generation with individual-level aggregation."""
        user_id = uuid.uuid4()
        individual_request = GenerateInsightsRequest(
            insight_types=[InsightType.LEARNER_BEHAVIOR],
            aggregation_level=AggregationLevel.INDIVIDUAL,
            user_id=user_id
        )

        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(individual_request, admin_user_context)

            # Verify response
            assert isinstance(result, GenerateInsightsResponse)
            assert len(result.insights) > 0

            # Verify learner behavior insights were generated
            insight_types = [insight["type"] for insight in result.insights]
            assert "learner_behavior" in insight_types

            # Verify event published
            mock_publish.assert_called_once()

    async def test_generate_insights_program_aggregation(self, generate_insights_use_case,
                                                       admin_user_context):
        """Test insights generation with program-level aggregation."""
        program_id = uuid.uuid4()
        program_request = GenerateInsightsRequest(
            insight_types=[InsightType.PROGRAM_SUCCESS],
            aggregation_level=AggregationLevel.PROGRAM,
            program_id=program_id
        )

        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(program_request, admin_user_context)

            # Verify response
            assert isinstance(result, GenerateInsightsResponse)
            assert len(result.insights) > 0

            # Verify program success insights were generated
            insight_types = [insight["type"] for insight in result.insights]
            assert "program_success" in insight_types

            # Verify event published with program-specific data
            mock_publish.assert_called_once()

    async def test_generate_insights_with_dashboard_config(self, generate_insights_use_case,
                                                         admin_user_context):
        """Test insights generation with dashboard data preparation."""
        dashboard_config = {
            "widgets": [
                {
                    "id": "performance_widget",
                    "type": "learning_performance",
                    "title": "Learning Performance Overview",
                    "layout": {"x": 0, "y": 0, "w": 6, "h": 4}
                }
            ]
        }

        dashboard_request = GenerateInsightsRequest(
            insight_types=[InsightType.LEARNING_PERFORMANCE],
            aggregation_level=AggregationLevel.ORGANIZATION,
            dashboard_config=dashboard_config
        )

        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(dashboard_request, admin_user_context)

            # Verify dashboard data was prepared
            assert result.dashboard_data is not None
            assert "widgets" in result.dashboard_data
            assert len(result.dashboard_data["widgets"]) > 0

            # Verify widget structure
            widget = result.dashboard_data["widgets"][0]
            assert widget["id"] == "performance_widget"
            assert widget["type"] == "learning_performance"
            assert "data" in widget

            # Verify event published
            mock_publish.assert_called_once()

    async def test_generate_insights_with_predictive_analytics(self, generate_insights_use_case,
                                                             admin_user_context):
        """Test insights generation with predictive analytics enabled."""
        predictive_request = GenerateInsightsRequest(
            insight_types=[InsightType.PREDICTIVE_ANALYTICS],
            aggregation_level=AggregationLevel.ORGANIZATION,
            include_predictions=True
        )

        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(predictive_request, admin_user_context)

            # Verify predictive insights were generated
            assert len(result.insights) > 0
            insight_types = [insight["type"] for insight in result.insights]
            assert "predictive_analytics" in insight_types

            # Verify event published with prediction data
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert "insight_types" in event_kwargs

    async def test_generate_insights_custom_metrics(self, generate_insights_use_case,
                                                   admin_user_context):
        """Test insights generation with custom metrics."""
        custom_request = GenerateInsightsRequest(
            insight_types=[InsightType.CUSTOM_METRICS],
            aggregation_level=AggregationLevel.ORGANIZATION,
            custom_metrics=["engagement_velocity", "content_effectiveness_score", "learner_satisfaction_index"]
        )

        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(custom_request, admin_user_context)

            # Verify custom metrics were generated
            assert len(result.insights) > 0
            insight_types = [insight["type"] for insight in result.insights]
            assert "custom_metrics" in insight_types

            # Verify summary metrics contain custom values
            custom_metric_keys = [key for key in result.summary_metrics.keys() if key.startswith("custom_")]
            assert len(custom_metric_keys) == 3

            # Verify event published
            mock_publish.assert_called_once()

    async def test_permission_validation_for_insights_generation(self, generate_insights_use_case,
                                                               basic_insights_request):
        """Test permission validation - only reviewers and above can generate insights."""
        # Setup - learner trying to generate insights (should fail)
        learner_context = {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.LEARNER,
            "user_name": "Test Learner",
            "user_email": "learner@example.com"
        }

        # Execute & Verify - should raise permission error
        with pytest.raises(PermissionError, match="analytics insights"):
            await generate_insights_use_case.execute(basic_insights_request, learner_context)

    async def test_validation_error_empty_insight_types(self, generate_insights_use_case,
                                                      admin_user_context):
        """Test validation error when no insight types are specified."""
        # Setup - request with empty insight types
        invalid_request = GenerateInsightsRequest(
            insight_types=[],  # Empty list should be invalid
            aggregation_level=AggregationLevel.ORGANIZATION
        )

        # Execute & Verify
        with pytest.raises(ValueError, match="At least one insight type"):
            await generate_insights_use_case.execute(invalid_request, admin_user_context)

    async def test_validation_error_individual_without_user_id(self, generate_insights_use_case,
                                                             admin_user_context):
        """Test validation error for individual aggregation without user ID."""
        # Setup - individual aggregation without user_id
        invalid_request = GenerateInsightsRequest(
            insight_types=[InsightType.LEARNER_BEHAVIOR],
            aggregation_level=AggregationLevel.INDIVIDUAL,
            user_id=None  # Missing required user_id for individual level
        )

        # Execute & Verify
        with pytest.raises(ValueError, match="User ID is required"):
            await generate_insights_use_case.execute(invalid_request, admin_user_context)

    async def test_validation_error_invalid_time_range(self, generate_insights_use_case,
                                                     admin_user_context):
        """Test validation error for invalid time range."""
        # Setup - end time before start time
        invalid_request = GenerateInsightsRequest(
            insight_types=[InsightType.COMPLETION_TRENDS],
            aggregation_level=AggregationLevel.ORGANIZATION,
            time_range_start=datetime.now(timezone.utc),
            time_range_end=datetime.now(timezone.utc).replace(month=1)  # Before start time
        )

        # Execute & Verify
        with pytest.raises(ValueError, match="Time range start must be before end"):
            await generate_insights_use_case.execute(invalid_request, admin_user_context)

    async def test_service_error_handling_with_rollback(self, generate_insights_use_case,
                                                      basic_insights_request, admin_user_context,
                                                      mock_session):
        """Test proper error handling and transaction rollback on service failures."""
        # Setup - force an error during insight generation
        with patch.object(generate_insights_use_case, '_generate_insight_by_type',
                         side_effect=Exception("Analytics service error")):
            # Execute & Verify
            with pytest.raises(RuntimeError, match="insights generation"):
                await generate_insights_use_case.execute(basic_insights_request, admin_user_context)

            # Verify rollback was called (transaction safety)
            mock_session.rollback.assert_called_once()

    async def test_event_driven_architecture_resilience(self, generate_insights_use_case,
                                                       basic_insights_request, admin_user_context):
        """Test that business operations continue even if event publishing fails."""
        # Mock event publishing to fail
        with patch.object(generate_insights_use_case, '_publish_event',
                         side_effect=Exception("Kafka down")):
            # Execute - should still succeed despite event failure
            result = await generate_insights_use_case.execute(basic_insights_request, admin_user_context)

            # Business operation should still succeed
            assert isinstance(result, GenerateInsightsResponse)
            assert len(result.insights) > 0
            assert result.insights_generated > 0

    @pytest.mark.parametrize("insight_type,expected_category", [
        (InsightType.LEARNING_PERFORMANCE, "learning_performance"),
        (InsightType.CONTENT_EFFECTIVENESS, "content_effectiveness"),
        (InsightType.PROGRAM_SUCCESS, "program_success"),
        (InsightType.LEARNER_BEHAVIOR, "learner_behavior"),
        (InsightType.ENGAGEMENT_PATTERNS, "engagement_patterns"),
        (InsightType.COMPLETION_TRENDS, "completion_trends"),
    ])
    async def test_insight_type_specific_generation(self, generate_insights_use_case, admin_user_context,
                                                   insight_type, expected_category):
        """Test that each insight type generates the correct category of insights."""
        # Setup
        request = GenerateInsightsRequest(
            insight_types=[insight_type],
            aggregation_level=AggregationLevel.ORGANIZATION
        )

        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(request, admin_user_context)

            # Verify correct insight type was generated
            assert len(result.insights) > 0
            insight_types_found = [insight["type"] for insight in result.insights]
            assert expected_category in insight_types_found

            # Verify xAPI event published with correct insight type
            mock_publish.assert_called()
            event_kwargs = mock_publish.call_args[1]
            assert expected_category in event_kwargs["insight_types"]

    async def test_processing_time_measurement(self, generate_insights_use_case,
                                             basic_insights_request, admin_user_context):
        """Test that processing time is properly measured and reported."""
        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(basic_insights_request, admin_user_context)

            # Verify processing time was measured
            assert result.processing_time_ms > 0
            assert result.processing_time_ms < 60000  # Should be less than 1 minute for tests

            # Verify processing time included in event
            event_kwargs = mock_publish.call_args[1]
            assert "processing_time_ms" in event_kwargs
            assert event_kwargs["processing_time_ms"] == result.processing_time_ms

    async def test_multiple_insight_types_aggregation(self, generate_insights_use_case,
                                                    admin_user_context):
        """Test insights generation with multiple insight types."""
        multi_request = GenerateInsightsRequest(
            insight_types=[
                InsightType.LEARNING_PERFORMANCE,
                InsightType.CONTENT_EFFECTIVENESS,
                InsightType.PROGRAM_SUCCESS,
                InsightType.ENGAGEMENT_PATTERNS
            ],
            aggregation_level=AggregationLevel.ORGANIZATION
        )

        with patch.object(generate_insights_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await generate_insights_use_case.execute(multi_request, admin_user_context)

            # Verify all insight types were generated
            assert len(result.insights) >= 4  # At least one per type
            insight_types_found = set(insight["type"] for insight in result.insights)
            expected_types = {
                "learning_performance",
                "content_effectiveness", 
                "program_success",
                "engagement_patterns"
            }
            assert expected_types.issubset(insight_types_found)

            # Verify comprehensive summary metrics
            assert len(result.summary_metrics) > 0

            # Verify event published with all insight types
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert len(event_kwargs["insight_types"]) >= 4