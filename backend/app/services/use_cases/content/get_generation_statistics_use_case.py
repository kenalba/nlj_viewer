"""
Get Generation Statistics Use Case - User Generation Analytics Workflow.

Handles retrieval of user's generation session statistics and usage metrics:
- Comprehensive session analytics and success rates
- Token usage and performance metrics
- Activity creation statistics
- Error analysis and debugging metrics
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class GetGenerationStatisticsRequest:
    """Request object for generation statistics retrieval operations."""
    user_id: Optional[UUID] = None  # None = current user, UUID = specific user (admin only)
    include_global_stats: bool = False  # Include system-wide statistics (admin only)
    time_period_days: Optional[int] = None  # Limit stats to recent days


@dataclass
class GetGenerationStatisticsResponse:
    """Response object for generation statistics retrieval operations."""
    total_sessions: int
    completed_sessions: int
    failed_sessions: int
    cancelled_sessions: int
    pending_sessions: int
    processing_sessions: int
    success_rate: float
    total_tokens_used: int
    average_generation_time_seconds: Optional[float]
    activities_created: int
    recent_sessions_count: int
    fastest_generation_time: Optional[float]
    slowest_generation_time: Optional[float]
    most_common_failure_reason: Optional[str]
    global_statistics: Optional[Dict[str, Any]] = None  # Only for admins


class GetGenerationStatisticsUseCase(BaseUseCase[GetGenerationStatisticsRequest, GetGenerationStatisticsResponse]):
    """
    Use case for retrieving comprehensive generation session statistics and analytics.

    Responsibilities:
    - Validate user permissions for statistics access (own stats vs system stats)
    - Calculate comprehensive session metrics and performance statistics
    - Analyze success rates, error patterns, and usage trends
    - Return structured analytics data for dashboard and reporting
    - Support admin access to system-wide statistics

    Events Published:
    - Statistics access events for audit trails
    - Usage analytics events for system monitoring
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService
    ) -> None:
        """
        Initialize get generation statistics use case.

        Args:
            session: Database session for transaction management
            generation_session_orm_service: Generation session data access service
        """
        super().__init__(
            session,
            generation_session_orm_service=generation_session_orm_service
        )

    async def execute(
        self,
        request: GetGenerationStatisticsRequest,
        user_context: Dict[str, Any]
    ) -> GetGenerationStatisticsResponse:
        """
        Execute generation statistics retrieval workflow.

        Args:
            request: Statistics request with user ID and filters
            user_context: Current user context for permissions

        Returns:
            Generation statistics response with comprehensive metrics

        Raises:
            PermissionError: If user lacks permission to access requested statistics
            ValueError: If request validation fails
            RuntimeError: If statistics retrieval fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")
            
            # Determine target user ID with permission validation
            target_user_id = await self._validate_and_get_target_user(
                request, current_user_id, current_user_role
            )

            # Get user-specific statistics
            user_stats = await self._get_user_statistics(target_user_id, request.time_period_days)

            # Get global statistics if requested and authorized
            global_stats = None
            if request.include_global_stats and current_user_role == UserRole.ADMIN:
                global_stats = await self._get_global_statistics()

            # Build comprehensive response
            response = GetGenerationStatisticsResponse(
                total_sessions=user_stats["total_sessions"],
                completed_sessions=user_stats["completed_sessions"],
                failed_sessions=user_stats["failed_sessions"],
                cancelled_sessions=user_stats["cancelled_sessions"],
                pending_sessions=user_stats["pending_sessions"],
                processing_sessions=user_stats["processing_sessions"],
                success_rate=user_stats["success_rate"],
                total_tokens_used=user_stats["total_tokens_used"],
                average_generation_time_seconds=user_stats["average_generation_time_seconds"],
                activities_created=user_stats["activities_created"],
                recent_sessions_count=user_stats["recent_sessions_count"],
                fastest_generation_time=user_stats["fastest_generation_time"],
                slowest_generation_time=user_stats["slowest_generation_time"],
                most_common_failure_reason=user_stats["most_common_failure_reason"],
                global_statistics=global_stats
            )

            # Publish statistics access event
            try:
                await self._publish_statistics_access_event(request, user_context, response)
            except Exception as e:
                logger.warning(f"Failed to publish statistics access event: {e}")

            logger.info(
                f"Generation statistics retrieved: user {target_user_id}, "
                f"total sessions: {response.total_sessions}, by user {current_user_id}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, "retrieve generation statistics")
            raise
        except Exception as e:
            await self._handle_service_error(e, "retrieve generation statistics")
            raise

    async def _validate_and_get_target_user(
        self,
        request: GetGenerationStatisticsRequest,
        current_user_id: UUID,
        current_user_role: Optional[UserRole]
    ) -> UUID:
        """Validate permissions and determine target user ID."""
        target_user_id = request.user_id or current_user_id
        
        # Users can access their own statistics
        if target_user_id == current_user_id:
            return target_user_id
            
        # Admins can access any user's statistics
        if current_user_role == UserRole.ADMIN:
            return target_user_id
            
        raise PermissionError("Not authorized to access other users' generation statistics")

    async def _get_user_statistics(self, user_id: UUID, time_period_days: Optional[int]) -> Dict[str, Any]:
        """Get comprehensive statistics for a specific user."""
        generation_orm_service = self.dependencies["generation_session_orm_service"]
        
        try:
            # Get user sessions (all sessions for comprehensive stats)
            user_sessions = await generation_orm_service.get_user_sessions(
                user_id=user_id,
                limit=1000  # Get a large number for comprehensive stats
            )

            # Filter by time period if specified
            if time_period_days:
                from datetime import datetime, timedelta, timezone
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=time_period_days)
                user_sessions = [s for s in user_sessions if s.created_at and s.created_at >= cutoff_date]

            # Calculate basic counts
            total_sessions = len(user_sessions)
            completed_sessions = len([s for s in user_sessions if hasattr(s, 'status') and s.status.name == 'COMPLETED'])
            failed_sessions = len([s for s in user_sessions if hasattr(s, 'status') and s.status.name == 'FAILED'])
            cancelled_sessions = len([s for s in user_sessions if hasattr(s, 'status') and s.status.name == 'CANCELLED'])
            pending_sessions = len([s for s in user_sessions if hasattr(s, 'status') and s.status.name == 'PENDING'])
            processing_sessions = len([s for s in user_sessions if hasattr(s, 'status') and s.status.name == 'PROCESSING'])

            # Calculate success rate
            finished_sessions = completed_sessions + failed_sessions
            success_rate = (completed_sessions / finished_sessions * 100) if finished_sessions > 0 else 0.0

            # Token usage statistics
            total_tokens_used = sum(
                getattr(s, 'total_tokens_used', 0) or 0 for s in user_sessions
            )

            # Generation time statistics
            generation_times = [
                getattr(s, 'generation_time_seconds', None) 
                for s in user_sessions 
                if getattr(s, 'generation_time_seconds', None) is not None
            ]

            average_generation_time = None
            fastest_generation_time = None
            slowest_generation_time = None

            if generation_times:
                # Filter out None values and convert to float
                valid_times = [float(t) for t in generation_times if t is not None]
                if valid_times:
                    average_generation_time = sum(valid_times) / len(valid_times)
                    fastest_generation_time = min(valid_times)
                    slowest_generation_time = max(valid_times)

            # Activity creation count
            activities_created = len([
                s for s in user_sessions 
                if hasattr(s, 'created_activities') and s.created_activities
            ])

            # Recent sessions (last 7 days)
            from datetime import datetime, timedelta, timezone
            recent_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            recent_sessions_count = len([
                s for s in user_sessions 
                if s.created_at and s.created_at >= recent_cutoff
            ])

            # Most common failure reason
            failure_reasons = [
                getattr(s, 'error_message', None) 
                for s in user_sessions 
                if hasattr(s, 'status') and s.status.name == 'FAILED' and getattr(s, 'error_message', None)
            ]

            most_common_failure_reason = None
            if failure_reasons:
                # Simple analysis - get first few words of most common error
                error_prefixes = [reason.split()[:5] for reason in failure_reasons if reason]
                if error_prefixes:
                    from collections import Counter
                    most_common = Counter([' '.join(prefix) for prefix in error_prefixes]).most_common(1)
                    if most_common:
                        most_common_failure_reason = most_common[0][0]

            return {
                "total_sessions": total_sessions,
                "completed_sessions": completed_sessions,
                "failed_sessions": failed_sessions,
                "cancelled_sessions": cancelled_sessions,
                "pending_sessions": pending_sessions,
                "processing_sessions": processing_sessions,
                "success_rate": round(success_rate, 2),
                "total_tokens_used": total_tokens_used,
                "average_generation_time_seconds": average_generation_time,
                "activities_created": activities_created,
                "recent_sessions_count": recent_sessions_count,
                "fastest_generation_time": fastest_generation_time,
                "slowest_generation_time": slowest_generation_time,
                "most_common_failure_reason": most_common_failure_reason
            }

        except Exception as e:
            logger.error(f"Failed to calculate user statistics for {user_id}: {e}")
            raise RuntimeError(f"Failed to calculate statistics: {str(e)}") from e

    async def _get_global_statistics(self) -> Dict[str, Any]:
        """Get system-wide generation statistics (admin only)."""
        generation_orm_service = self.dependencies["generation_session_orm_service"]
        
        try:
            # Get global statistics from repository
            global_stats = await generation_orm_service.get_session_statistics()
            # Ensure it's a dict
            if not isinstance(global_stats, dict):
                raise RuntimeError("Invalid statistics format returned from ORM service")
            
            # Add additional system metrics
            active_sessions = await generation_orm_service.get_active_sessions()
            pending_sessions = await generation_orm_service.get_pending_sessions()
            
            global_stats["active_sessions_count"] = len(active_sessions)
            global_stats["pending_sessions_count"] = len(pending_sessions)
            global_stats["system_load"] = len(active_sessions) / 10.0  # Simple load metric
            
            return global_stats
            
        except Exception as e:
            logger.error(f"Failed to calculate global statistics: {e}")
            raise RuntimeError(f"Failed to calculate global statistics: {str(e)}") from e

    async def _publish_statistics_access_event(
        self,
        request: GetGenerationStatisticsRequest,
        user_context: Dict[str, Any],
        response: GetGenerationStatisticsResponse
    ) -> None:
        """Publish statistics access event for audit trail."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_generation_statistics_accessed",
            accessor_user_id=actor_info["user_id"],
            accessor_name=actor_info["user_name"],
            accessor_email=actor_info["user_email"],
            access_timestamp=datetime.now().isoformat(),
            target_user_id=str(request.user_id) if request.user_id else actor_info["user_id"],
            include_global_stats=request.include_global_stats,
            time_period_days=request.time_period_days,
            total_sessions_found=response.total_sessions,
            success_rate=response.success_rate
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