"""
Generate Insights Use Case - Analytics and Business Intelligence Workflow.

Handles comprehensive analytics and insight generation including:
- Learning analytics and performance metrics
- Content effectiveness analysis
- Program success measurement
- Learner behavior pattern analysis
- Predictive analytics and recommendations
- Custom dashboard data preparation
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from uuid import UUID
from enum import Enum
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class InsightType(Enum):
    """Types of analytics insights."""
    LEARNING_PERFORMANCE = "learning_performance"
    CONTENT_EFFECTIVENESS = "content_effectiveness"
    PROGRAM_SUCCESS = "program_success"
    LEARNER_BEHAVIOR = "learner_behavior"
    ENGAGEMENT_PATTERNS = "engagement_patterns"
    COMPLETION_TRENDS = "completion_trends"
    PREDICTIVE_ANALYTICS = "predictive_analytics"
    CUSTOM_METRICS = "custom_metrics"


class AggregationLevel(Enum):
    """Levels of data aggregation."""
    INDIVIDUAL = "individual"
    PROGRAM = "program"
    ORGANIZATION = "organization"
    CONTENT = "content"
    TIME_SERIES = "time_series"


@dataclass
class GenerateInsightsRequest:
    """Request object for insights generation."""
    insight_types: List[InsightType]
    aggregation_level: AggregationLevel
    user_id: Optional[UUID] = None
    program_id: Optional[UUID] = None
    content_id: Optional[UUID] = None
    time_range_start: Optional[datetime] = None
    time_range_end: Optional[datetime] = None
    custom_metrics: Optional[List[str]] = None
    dashboard_config: Optional[Dict[str, Any]] = None
    include_predictions: bool = False
    benchmark_against: Optional[str] = None  # 'organization', 'industry', 'historical'


@dataclass
class GenerateInsightsResponse:
    """Response object for insights generation."""
    insights: List[Dict[str, Any]]  # Simplified until AnalyticsInsightServiceSchema exists
    summary_metrics: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    dashboard_data: Optional[Dict[str, Any]] = None
    insights_generated: int = 0
    processing_time_ms: float = 0.0


class GenerateInsightsUseCase(BaseUseCase[GenerateInsightsRequest, GenerateInsightsResponse]):
    """
    Use case for comprehensive analytics and insights generation.

    Responsibilities:
    - Generate learning analytics and performance insights
    - Analyze content effectiveness and engagement patterns
    - Calculate program success metrics and completion trends
    - Create predictive analytics and recommendations
    - Prepare dashboard data and custom visualizations
    - Benchmark performance against standards

    Events Published:
    - Insights generation events (nlj.analytics.insights_generated)
    - Report creation events (nlj.analytics.report_created)
    - Dashboard update events (nlj.analytics.dashboard_updated)
    - Benchmark analysis events (nlj.analytics.benchmark_completed)
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService,
        training_orm_service: TrainingOrmService,
        user_orm_service: UserOrmService
    ):
        """
        Initialize generate insights use case.

        Args:
            session: Database session for transaction management
            content_orm_service: Content data access
            training_orm_service: Training data access
            user_orm_service: User data access
        """
        super().__init__(
            session,
            content_orm_service=content_orm_service,
            training_orm_service=training_orm_service,
            user_orm_service=user_orm_service
        )

    async def execute(
        self,
        request: GenerateInsightsRequest,
        user_context: Dict[str, Any]
    ) -> GenerateInsightsResponse:
        """
        Execute insights generation workflow.

        Args:
            request: Insights generation request with parameters
            user_context: User context for permissions and events

        Returns:
            Insights generation response with analytics results

        Raises:
            PermissionError: If user lacks analytics permissions
            ValueError: If request validation fails
            RuntimeError: If insights generation fails
        """
        start_time = datetime.now()
        
        try:
            # Validate permissions - reviewers and above can generate insights
            await self._validate_insights_permissions(user_context)

            # Validate request parameters
            await self._validate_insights_request(request)

            # Generate requested insights
            insights = []
            summary_metrics = {}
            recommendations = []

            for insight_type in request.insight_types:
                insight_data, metrics, recs = await self._generate_insight_by_type(
                    insight_type, request, user_context
                )
                insights.extend(insight_data)
                summary_metrics.update(metrics)
                recommendations.extend(recs)

            # Prepare dashboard data if requested
            dashboard_data = None
            if request.dashboard_config:
                dashboard_data = await self._prepare_dashboard_data(
                    insights, request.dashboard_config
                )

            # Store generated insights
            await self._store_insights(insights, request, user_context)

            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            # Create response
            response = GenerateInsightsResponse(
                insights=insights,  # Simplified until schema exists
                summary_metrics=summary_metrics,
                recommendations=recommendations,
                dashboard_data=dashboard_data,
                insights_generated=len(insights),
                processing_time_ms=processing_time
            )

            # Publish insights generation event
            await self._publish_insights_generation_event(
                insights, summary_metrics, user_context, processing_time
            )

            logger.info(
                f"Insights generated successfully: {len(insights)} insights, "
                f"processing time: {processing_time:.2f}ms"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, "insights generation")
        except Exception as e:
            await self._handle_service_error(e, "insights generation")
            raise  # This should never be reached but satisfies mypy

    async def _validate_insights_permissions(self, user_context: Dict[str, Any]) -> None:
        """Validate user has permissions to generate insights."""
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to generate analytics insights"
        )

    async def _validate_insights_request(self, request: GenerateInsightsRequest) -> None:
        """Validate insights request parameters."""
        if not request.insight_types:
            raise ValueError("At least one insight type must be specified")

        # Validate time range
        if request.time_range_start and request.time_range_end:
            if request.time_range_start >= request.time_range_end:
                raise ValueError("Time range start must be before end")

        # Validate aggregation requirements
        if request.aggregation_level == AggregationLevel.INDIVIDUAL and not request.user_id:
            raise ValueError("User ID is required for individual-level insights")

        if request.aggregation_level == AggregationLevel.PROGRAM and not request.program_id:
            raise ValueError("Program ID is required for program-level insights")

        if request.aggregation_level == AggregationLevel.CONTENT and not request.content_id:
            raise ValueError("Content ID is required for content-level insights")

    async def _generate_insight_by_type(
        self,
        insight_type: InsightType,
        request: GenerateInsightsRequest,
        user_context: Dict[str, Any]
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate insights for specific type."""
        if insight_type == InsightType.LEARNING_PERFORMANCE:
            return await self._generate_learning_performance_insights(request)
        elif insight_type == InsightType.CONTENT_EFFECTIVENESS:
            return await self._generate_content_effectiveness_insights(request)
        elif insight_type == InsightType.PROGRAM_SUCCESS:
            return await self._generate_program_success_insights(request)
        elif insight_type == InsightType.LEARNER_BEHAVIOR:
            return await self._generate_learner_behavior_insights(request)
        elif insight_type == InsightType.ENGAGEMENT_PATTERNS:
            return await self._generate_engagement_pattern_insights(request)
        elif insight_type == InsightType.COMPLETION_TRENDS:
            return await self._generate_completion_trend_insights(request)
        elif insight_type == InsightType.PREDICTIVE_ANALYTICS:
            return await self._generate_predictive_analytics_insights(request)
        elif insight_type == InsightType.CUSTOM_METRICS:
            return await self._generate_custom_metrics_insights(request)
        else:
            raise ValueError(f"Unsupported insight type: {insight_type}")

    async def _generate_learning_performance_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate learning performance insights (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        # For now, return placeholder data based on available services
        
        # Use training service to get basic data
        training_orm_service = self.dependencies["training_orm_service"]
        
        # Generate placeholder performance data
        performance_data = {
            "average_score": 0.75,  # 75% average
            "completion_rate": 0.68,  # 68% completion
            "average_time_to_complete": 45  # 45 minutes
        }

        insights = []
        recommendations: List[Dict[str, Any]] = []

        # Generate performance insights
        avg_score = performance_data.get("average_score", 0)
        completion_rate = performance_data.get("completion_rate", 0)
        time_to_complete = performance_data.get("average_time_to_complete", 0)

        # Performance level insight
        if avg_score >= 0.8:
            performance_level = "High"
            insight_message = f"Learners demonstrate strong performance with {avg_score:.1%} average score"
        elif avg_score >= 0.6:
            performance_level = "Moderate"
            insight_message = f"Learners show moderate performance with {avg_score:.1%} average score"
            recommendations.append({
                "type": "improvement",
                "message": "Consider additional support materials to improve performance",
                "priority": "medium"
            })
        else:
            performance_level = "Low"
            insight_message = f"Learners need improvement with {avg_score:.1%} average score"
            recommendations.append({
                "type": "intervention",
                "message": "Immediate intervention needed - review content difficulty and support",
                "priority": "high"
            })

        insights.append({
            "type": "learning_performance",
            "category": "performance_level",
            "title": f"{performance_level} Learning Performance",
            "message": insight_message,
            "data": {
                "average_score": avg_score,
                "performance_level": performance_level,
                "completion_rate": completion_rate,
                "time_to_complete_hours": time_to_complete
            },
            "timestamp": datetime.now().isoformat()
        })

        # Completion rate insight
        if completion_rate < 0.7:
            insights.append({
                "type": "learning_performance",
                "category": "completion_concern",
                "title": "Low Completion Rate Detected",
                "message": f"Only {completion_rate:.1%} of learners are completing the program",
                "data": {"completion_rate": completion_rate},
                "timestamp": datetime.now().isoformat()
            })
            recommendations.append({
                "type": "retention",
                "message": "Review content engagement and consider breaking into smaller modules",
                "priority": "high"
            })

        summary_metrics = {
            "average_performance_score": avg_score,
            "completion_rate": completion_rate,
            "average_time_to_complete": time_to_complete,
            "performance_level": performance_level
        }

        return insights, summary_metrics, recommendations

    async def _generate_content_effectiveness_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate content effectiveness insights (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        
        # Use content service to get basic data
        content_orm_service = self.dependencies["content_orm_service"]
        
        # Generate placeholder effectiveness data
        effectiveness_data = {
            "engagement_score": 0.72,
            "learning_outcome_score": 0.68,
            "user_satisfaction": 0.78
        }

        insights = []
        recommendations = []

        engagement_score = effectiveness_data.get("engagement_score", 0)
        learning_outcome_score = effectiveness_data.get("learning_outcome_score", 0)
        user_satisfaction = effectiveness_data.get("user_satisfaction", 0)

        # Content effectiveness insight
        overall_effectiveness = (engagement_score + learning_outcome_score + user_satisfaction) / 3

        if overall_effectiveness >= 0.8:
            effectiveness_level = "High"
            insight_message = "Content is highly effective with strong engagement and outcomes"
        elif overall_effectiveness >= 0.6:
            effectiveness_level = "Moderate"
            insight_message = "Content shows moderate effectiveness with room for improvement"
            recommendations.append({
                "type": "optimization",
                "message": "Consider updating content to improve engagement and learning outcomes",
                "priority": "medium"
            })
        else:
            effectiveness_level = "Low"
            insight_message = "Content effectiveness is low and requires significant improvement"
            recommendations.append({
                "type": "content_review",
                "message": "Content needs major revision - review structure, interactivity, and relevance",
                "priority": "high"
            })

        insights.append({
            "type": "content_effectiveness",
            "category": "overall_effectiveness",
            "title": f"{effectiveness_level} Content Effectiveness",
            "message": insight_message,
            "data": {
                "overall_effectiveness": overall_effectiveness,
                "engagement_score": engagement_score,
                "learning_outcome_score": learning_outcome_score,
                "user_satisfaction": user_satisfaction
            },
            "timestamp": datetime.now().isoformat()
        })

        summary_metrics = {
            "content_effectiveness_score": overall_effectiveness,
            "engagement_score": engagement_score,
            "learning_outcome_score": learning_outcome_score,
            "user_satisfaction_score": user_satisfaction
        }

        return insights, summary_metrics, recommendations

    async def _generate_program_success_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate program success insights (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        
        # Generate placeholder success metrics
        success_data = {
            "enrollment_rate": 0.85,
            "completion_rate": 0.72,
            "satisfaction_score": 0.79,
            "roi_score": 0.65
        }

        insights = []
        recommendations = []

        enrollment_rate = success_data.get("enrollment_rate", 0)
        completion_rate = success_data.get("completion_rate", 0)
        satisfaction_score = success_data.get("satisfaction_score", 0)
        roi_score = success_data.get("roi_score", 0)

        # Program success level
        success_score = (enrollment_rate + completion_rate + satisfaction_score + roi_score) / 4

        if success_score >= 0.8:
            success_level = "High"
            insight_message = "Program demonstrates high success across all metrics"
        elif success_score >= 0.6:
            success_level = "Moderate"
            insight_message = "Program shows moderate success with opportunities for improvement"
        else:
            success_level = "Low"
            insight_message = "Program success is low and requires strategic intervention"
            recommendations.append({
                "type": "program_redesign",
                "message": "Consider comprehensive program redesign to improve outcomes",
                "priority": "high"
            })

        insights.append({
            "type": "program_success",
            "category": "overall_success",
            "title": f"{success_level} Program Success",
            "message": insight_message,
            "data": {
                "success_score": success_score,
                "enrollment_rate": enrollment_rate,
                "completion_rate": completion_rate,
                "satisfaction_score": satisfaction_score,
                "roi_score": roi_score
            },
            "timestamp": datetime.now().isoformat()
        })

        summary_metrics = {
            "program_success_score": success_score,
            "enrollment_rate": enrollment_rate,
            "completion_rate": completion_rate,
            "satisfaction_score": satisfaction_score,
            "roi_score": roi_score
        }

        return insights, summary_metrics, recommendations

    async def _generate_learner_behavior_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate learner behavior pattern insights (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        
        # Generate placeholder behavior data
        behavior_data = {
            "peak_learning_times": ["9:00-11:00", "14:00-16:00"],
            "average_session_duration": 22.5,
            "common_drop_off_points": ["Module 3", "Final Assessment"],
            "learning_velocity": 0.75
        }

        insights = []
        recommendations: List[Dict[str, Any]] = []

        # Analyze behavior patterns
        peak_learning_times = behavior_data.get("peak_learning_times", [])
        session_duration_avg = behavior_data.get("average_session_duration", 0)
        drop_off_points = behavior_data.get("common_drop_off_points", [])
        learning_velocity = behavior_data.get("learning_velocity", 0)

        # Peak learning times insight
        if peak_learning_times:
            insights.append({
                "type": "learner_behavior",
                "category": "learning_patterns",
                "title": "Peak Learning Time Identified",
                "message": f"Learners are most active during {', '.join(peak_learning_times)}",
                "data": {"peak_times": peak_learning_times},
                "timestamp": datetime.now().isoformat()
            })

        # Session duration insight
        if session_duration_avg < 15:  # Less than 15 minutes
            insights.append({
                "type": "learner_behavior",
                "category": "engagement_duration",
                "title": "Short Session Duration",
                "message": f"Average session duration is {session_duration_avg:.1f} minutes",
                "data": {"average_duration": session_duration_avg},
                "timestamp": datetime.now().isoformat()
            })
            recommendations.append({
                "type": "content_chunking",
                "message": "Consider breaking content into smaller, focused segments",
                "priority": "medium"
            })

        summary_metrics = {
            "average_session_duration": session_duration_avg,
            "learning_velocity": learning_velocity,
            "peak_learning_times_count": len(peak_learning_times),
            "drop_off_points_count": len(drop_off_points)
        }

        return insights, summary_metrics, recommendations

    async def _generate_engagement_pattern_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate engagement pattern insights (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        
        # Generate placeholder engagement data
        engagement_data = {
            "trend": "stable",
            "interaction_frequency": 3.2,
            "content_completion_rate": 0.73
        }

        insights = []
        recommendations = []

        # Analyze engagement trends
        engagement_trend = engagement_data.get("trend", "stable")  # increasing, decreasing, stable
        interaction_frequency = engagement_data.get("interaction_frequency", 0)
        content_completion_rate = engagement_data.get("content_completion_rate", 0)

        # Engagement trend insight
        if engagement_trend == "decreasing":
            insights.append({
                "type": "engagement_patterns",
                "category": "declining_engagement",
                "title": "Declining Engagement Detected",
                "message": "Learner engagement is decreasing over time",
                "data": {"trend": engagement_trend, "frequency": interaction_frequency},
                "timestamp": datetime.now().isoformat()
            })
            recommendations.append({
                "type": "re_engagement",
                "message": "Implement re-engagement strategies or content refresh",
                "priority": "high"
            })

        summary_metrics = {
            "engagement_trend": engagement_trend,
            "interaction_frequency": interaction_frequency,
            "content_completion_rate": content_completion_rate
        }

        return insights, summary_metrics, recommendations

    async def _generate_completion_trend_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate completion trend insights (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        
        # Generate placeholder trend data
        trend_data = {
            "trend_direction": "increasing",
            "completion_velocity": 1.2,
            "projected_completion_rate": 0.78
        }

        insights = []
        recommendations = []

        completion_trend = trend_data.get("trend_direction", "stable")
        completion_velocity = trend_data.get("completion_velocity", 0)
        projected_completion_rate = trend_data.get("projected_completion_rate", 0)

        # Completion trend insight
        insights.append({
            "type": "completion_trends",
            "category": "trend_analysis",
            "title": f"Completion Trend: {completion_trend.title()}",
            "message": f"Completion rates are {completion_trend} with {completion_velocity:.2f} velocity",
            "data": {
                "trend": completion_trend,
                "velocity": completion_velocity,
                "projected_rate": projected_completion_rate
            },
            "timestamp": datetime.now().isoformat()
        })

        summary_metrics = {
            "completion_trend": completion_trend,
            "completion_velocity": completion_velocity,
            "projected_completion_rate": projected_completion_rate
        }

        return insights, summary_metrics, recommendations

    async def _generate_predictive_analytics_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate predictive analytics insights (placeholder implementation)."""
        # TODO: Implement with actual ML/analytics service when available
        
        # Generate placeholder prediction data
        predictions = {
            "dropout_risk_probability": 0.25,
            "predicted_completion_time": 14,
            "success_probability": 0.82
        }

        insights = []
        recommendations = []

        # At-risk learner prediction
        at_risk_probability = predictions.get("dropout_risk_probability", 0)
        if at_risk_probability > 0.7:
            insights.append({
                "type": "predictive_analytics",
                "category": "at_risk_prediction",
                "title": "High Dropout Risk Detected",
                "message": f"Learner has {at_risk_probability:.1%} probability of dropping out",
                "data": {"risk_probability": at_risk_probability},
                "timestamp": datetime.now().isoformat()
            })
            recommendations.append({
                "type": "intervention",
                "message": "Proactive intervention recommended to prevent dropout",
                "priority": "high"
            })

        summary_metrics = {
            "dropout_risk_probability": at_risk_probability,
            "predicted_completion_time": predictions.get("predicted_completion_time", 0),
            "success_probability": predictions.get("success_probability", 0)
        }

        return insights, summary_metrics, recommendations

    async def _generate_custom_metrics_insights(
        self,
        request: GenerateInsightsRequest
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
        """Generate custom metrics insights (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        
        if not request.custom_metrics:
            return [], {}, []

        insights = []
        recommendations = []
        summary_metrics = {}

        # Generate placeholder custom metrics
        for metric_name in request.custom_metrics:
            # Return placeholder value based on metric name
            metric_value = hash(metric_name) % 100 / 100.0  # Simple deterministic placeholder

            insights.append({
                "type": "custom_metrics",
                "category": "custom_calculation",
                "title": f"Custom Metric: {metric_name}",
                "message": f"{metric_name} calculated: {metric_value}",
                "data": {"metric_name": metric_name, "value": metric_value},
                "timestamp": datetime.now().isoformat()
            })

            summary_metrics[f"custom_{metric_name}"] = metric_value

        return insights, summary_metrics, recommendations

    async def _prepare_dashboard_data(
        self,
        insights: List[Dict[str, Any]],
        dashboard_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Prepare data for dashboard visualization."""
        dashboard_data: Dict[str, Any] = {
            "widgets": [],
            "charts": [],
            "metrics": [],
            "alerts": []
        }

        # Group insights by type for dashboard widgets
        insights_by_type: Dict[str, List[Dict[str, Any]]] = {}
        for insight in insights:
            insight_type = insight.get("type", "general")
            if insight_type not in insights_by_type:
                insights_by_type[insight_type] = []
            insights_by_type[insight_type].append(insight)

        # Create dashboard widgets based on config
        for widget_config in dashboard_config.get("widgets", []):
            widget_type = widget_config.get("type")
            if widget_type in insights_by_type:
                dashboard_data["widgets"].append({
                    "id": widget_config.get("id"),
                    "type": widget_type,
                    "title": widget_config.get("title"),
                    "data": insights_by_type[widget_type],
                    "layout": widget_config.get("layout", {})
                })

        return dashboard_data

    async def _store_insights(
        self,
        insights: List[Dict[str, Any]],
        request: GenerateInsightsRequest,
        user_context: Dict[str, Any]
    ) -> None:
        """Store generated insights for future reference (placeholder implementation)."""
        # TODO: Implement with actual analytics storage service when available
        # For now, just log that insights were generated
        logger.info(f"Generated {len(insights)} insights for user {user_context.get('user_id')}")
        # Insights would be stored in database when analytics service is implemented

    async def _publish_insights_generation_event(
        self,
        insights: List[Dict[str, Any]],
        summary_metrics: Dict[str, Any],
        user_context: Dict[str, Any],
        processing_time: float
    ) -> None:
        """Publish insights generation event."""
        generator_info = self._extract_user_info(user_context)

        await self._publish_event(
            "publish_analytics_insights_generated",
            generator_id=generator_info["user_id"],
            generator_name=generator_info["user_name"],
            generator_email=generator_info["user_email"],
            insights_count=len(insights),
            insight_types=[i.get("type") for i in insights],
            processing_time_ms=processing_time,
            summary_metrics=summary_metrics,
            generation_timestamp=datetime.now().isoformat()
        )

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error