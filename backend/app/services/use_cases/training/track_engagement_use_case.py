"""
Track Engagement Use Case - Training Engagement Analytics Business Workflow.

Handles basic training engagement tracking including:
- Session attendance tracking 
- Training program completion status
- Basic analytics using existing services
- Future: xAPI statement processing, advanced metrics, etc.
"""

import logging
from dataclasses import dataclass
from typing import Any
import uuid
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.schemas.services.training_schemas import AttendanceRecordServiceSchema
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class EngagementAction(Enum):
    """Available engagement tracking actions."""
    GET_SESSION_ATTENDANCE = "get_session_attendance"
    GET_UPCOMING_SESSIONS = "get_upcoming_sessions"
    # Future actions - not yet implemented:
    # RECORD_ACTIVITY = "record_activity"
    # CALCULATE_METRICS = "calculate_metrics"


@dataclass
class TrackEngagementRequest:
    """Request object for engagement tracking actions."""
    action: EngagementAction
    
    # For session-related actions
    session_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    program_id: uuid.UUID | None = None
    
    # For analytics
    limit: int = 50


@dataclass  
class TrackEngagementResponse:
    """Response object for engagement tracking actions."""
    action_taken: EngagementAction
    
    # Session attendance data
    attendance_records: list[AttendanceRecordServiceSchema] | None = None
    
    # Session data
    sessions: list[Any] | None = None  # Will be TrainingSession models
    
    # Summary stats
    total_records: int = 0
    activities_processed: int = 0


class TrackEngagementUseCase(BaseUseCase[TrackEngagementRequest, TrackEngagementResponse]):
    """
    Use case for basic training engagement tracking.

    Responsibilities:
    - Retrieve session attendance records
    - Get upcoming training sessions
    - Basic engagement analytics using existing services
    - Validate permissions for engagement data access
    - Publish engagement events

    Events Published:
    - Engagement query events (nlj.engagement.data_accessed)
    """

    def __init__(
        self,
        session: AsyncSession,
        training_orm_service: TrainingOrmService,
        user_orm_service: UserOrmService
    ):
        """Initialize track engagement use case."""
        super().__init__(
            session,
            training_orm_service=training_orm_service,
            user_orm_service=user_orm_service
        )

    async def execute(
        self,
        request: TrackEngagementRequest,
        user_context: dict[str, Any]
    ) -> TrackEngagementResponse:
        """Execute engagement tracking workflow."""
        try:
            # Route to specific action handler
            if request.action == EngagementAction.GET_SESSION_ATTENDANCE:
                attendance_records, total = await self._handle_get_session_attendance(
                    request, user_context
                )
                response = TrackEngagementResponse(
                    action_taken=request.action,
                    attendance_records=attendance_records,
                    total_records=total
                )
            elif request.action == EngagementAction.GET_UPCOMING_SESSIONS:
                sessions, total = await self._handle_get_upcoming_sessions(
                    request, user_context
                )
                response = TrackEngagementResponse(
                    action_taken=request.action,
                    sessions=sessions,
                    total_records=total
                )
            else:
                # Other actions not yet implemented
                raise NotImplementedError(f"Engagement action {request.action} not yet implemented")

            logger.info(
                f"Engagement tracking executed: {request.action.value}, "
                f"records returned: {response.total_records}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"engagement tracking {request.action.value}")
        except Exception as e:
            await self._handle_service_error(e, f"engagement tracking {request.action.value}")
            raise  # This will never be reached but satisfies mypy

    async def _handle_get_session_attendance(
        self,
        request: TrackEngagementRequest,
        user_context: dict[str, Any]
    ) -> tuple[list[AttendanceRecordServiceSchema], int]:
        """Handle getting session attendance records."""
        # Validate permissions - reviewers and above can view attendance
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to view attendance records"
        )

        # Validate required fields
        if not request.session_id:
            raise ValueError("Session ID is required for attendance lookup")

        # Get attendance using actual TrainingOrmService API
        training_orm_service = self.dependencies["training_orm_service"]
        
        attendance_records = await training_orm_service.get_session_attendance(request.session_id)
        
        # Convert to service schemas
        attendance_schemas = []
        for record in attendance_records:
            schema = AttendanceRecordServiceSchema.model_validate(record)
            attendance_schemas.append(schema)

        # Publish access event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_engagement_data_accessed",
            action="get_session_attendance",
            session_id=str(request.session_id),
            accessor_id=user_info["user_id"],
            accessor_name=user_info["user_name"],
            records_count=len(attendance_schemas)
        )

        return attendance_schemas, len(attendance_schemas)

    async def _handle_get_upcoming_sessions(
        self,
        request: TrackEngagementRequest,
        user_context: dict[str, Any]
    ) -> tuple[list[Any], int]:
        """Handle getting upcoming training sessions."""
        # Validate permissions - creators and above can view sessions
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to view training sessions"
        )

        # Get upcoming sessions using actual TrainingOrmService API
        training_orm_service = self.dependencies["training_orm_service"]
        
        sessions = await training_orm_service.get_upcoming_sessions(limit=request.limit)

        # Publish access event
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_engagement_data_accessed",
            action="get_upcoming_sessions",
            accessor_id=user_info["user_id"],
            accessor_name=user_info["user_name"],
            sessions_count=len(sessions)
        )

        return sessions, len(sessions)

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error