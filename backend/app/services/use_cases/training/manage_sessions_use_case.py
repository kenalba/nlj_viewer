"""
Manage Sessions Use Case - Training Session Management Business Workflow.

Handles training session lifecycle including:
- Create training sessions for programs
- Record attendance for training sessions
- Future: Schedule and reschedule sessions, manage participation, etc.
"""

import logging
from dataclasses import dataclass
from typing import Any
import uuid
from enum import Enum
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.schemas.services.training_schemas import TrainingSessionServiceSchema, AttendanceRecordServiceSchema
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from app.services.events.training_events import TrainingEventService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class SessionAction(Enum):
    """Available session management actions."""
    CREATE = "create"
    RECORD_ATTENDANCE = "record_attendance"
    # Future actions - not yet implemented in TrainingOrmService:
    # UPDATE = "update"
    # CANCEL = "cancel"


@dataclass
class ManageSessionsRequest:
    """Request object for session management actions."""
    action: SessionAction
    
    # For all actions
    session_id: uuid.UUID | None = None
    
    # For CREATE action
    program_id: uuid.UUID | None = None
    instructor_id: uuid.UUID | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    max_participants: int | None = None
    location: str | None = None
    notes: str | None = None
    
    # For RECORD_ATTENDANCE action
    user_id: uuid.UUID | None = None  # Learner ID for attendance
    attended: bool | None = None


@dataclass
class ManageSessionsResponse:
    """Response object for session management actions."""
    session: TrainingSessionServiceSchema | None
    action_taken: SessionAction
    participants_affected: int = 0
    notifications_sent: int = 0


class ManageSessionsUseCase(BaseUseCase[ManageSessionsRequest, ManageSessionsResponse]):
    """
    Use case for training session management.

    Responsibilities:
    - Create training sessions for programs
    - Record attendance for sessions
    - Validate permissions for session operations
    - Publish session lifecycle events

    Events Published:
    - Session creation events (nlj.training.session_created)
    - Attendance recording events (nlj.training.attendance_recorded)
    """

    def __init__(
        self,
        session: AsyncSession,
        training_orm_service: TrainingOrmService,
        user_orm_service: UserOrmService,
        training_event_service: TrainingEventService | None = None
    ):
        """Initialize manage sessions use case."""
        super().__init__(
            session,
            training_orm_service=training_orm_service,
            user_orm_service=user_orm_service
        )
        self.training_event_service = training_event_service or TrainingEventService()

    async def execute(
        self,
        request: ManageSessionsRequest,
        user_context: dict[str, Any]
    ) -> ManageSessionsResponse:
        """Execute session management workflow."""
        try:
            # Route to specific action handler
            if request.action == SessionAction.CREATE:
                session_obj, participants_affected, notifications = await self._handle_create(
                    request, user_context
                )
            elif request.action == SessionAction.RECORD_ATTENDANCE:
                session_obj, participants_affected, notifications = await self._handle_record_attendance(
                    request, user_context
                )
            else:
                # Other actions not yet implemented in TrainingOrmService
                raise NotImplementedError(f"Session action {request.action} not yet implemented")

            # Create response with proper schema conversion
            session_schema = TrainingSessionServiceSchema.model_validate(session_obj) if session_obj else None
            response = ManageSessionsResponse(
                session=session_schema,
                action_taken=request.action,
                participants_affected=participants_affected,
                notifications_sent=notifications
            )

            logger.info(
                f"Session management executed: {request.action.value}, "
                f"participants affected: {participants_affected}, "
                f"notifications sent: {notifications}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"session management {request.action.value}")
        except Exception as e:
            await self._handle_service_error(e, f"session management {request.action.value}")
            raise  # This will never be reached but satisfies mypy

    async def _handle_create(
        self,
        request: ManageSessionsRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle session creation."""
        # Validate permissions - reviewers and above can create sessions
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to create training sessions"
        )

        # Validate required fields
        if not request.program_id:
            raise ValueError("Program ID is required for session creation")
        if not request.scheduled_start or not request.scheduled_end:
            raise ValueError("Session start and end times are required")
        if not request.instructor_id:
            raise ValueError("Instructor ID is required for session creation")

        # Create session using actual TrainingOrmService API
        training_orm_service = self.dependencies["training_orm_service"]

        session_obj = await training_orm_service.create_training_session(
            program_id=request.program_id,
            instructor_id=request.instructor_id,
            scheduled_start=request.scheduled_start,
            scheduled_end=request.scheduled_end,
            max_participants=request.max_participants,
            location=request.location,
            notes=request.notes
        )

        # Note: Attendee assignment not supported in current TrainingOrmService
        participants_affected = 0

        # Publish session creation event using proper xAPI format
        user_info = self._extract_user_info(user_context)
        await self.training_event_service.publish_session_scheduled(
            session_id=str(session_obj.id),
            program_id=str(request.program_id),
            program_title="Training Session",  # Would need to fetch from program
            session_date=request.scheduled_start.strftime("%Y-%m-%d") if request.scheduled_start else "",
            session_time=request.scheduled_start.strftime("%H:%M") if request.scheduled_start else "",
            location=request.location or "TBD",
            max_participants=request.max_participants or 0,
            instructor_id=user_info["user_id"],
            instructor_name=user_info["user_name"],
            instructor_email=user_info["user_email"]
        )

        return session_obj, participants_affected, 0

    async def _handle_record_attendance(
        self,
        request: ManageSessionsRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle attendance recording."""
        # Validate permissions - instructors and admins can record attendance
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to record attendance"
        )

        # Validate required fields
        if not request.session_id:
            raise ValueError("Session ID is required for attendance recording")
        if not request.user_id:
            raise ValueError("User ID is required for attendance recording")
        if request.attended is None:
            raise ValueError("Attendance status is required")

        # Record attendance using actual TrainingOrmService API
        training_orm_service = self.dependencies["training_orm_service"]
        user_id = uuid.UUID(user_context["user_id"])

        attendance_record = await training_orm_service.record_attendance(
            session_id=request.session_id,
            user_id=request.user_id,
            attended=request.attended,
            attendance_notes=f"Recorded by {user_context.get('user_name', 'system')}"
        )

        # Get the session for response
        session_obj = None  # Could get from TrainingOrmService if needed
        participants_affected = 1

        # Publish attendance event using proper xAPI format
        user_info = self._extract_user_info(user_context)
        if request.attended:
            # Get learner info from user service for complete xAPI event
            user_orm_service = self.dependencies["user_orm_service"]
            learner = await user_orm_service.get_by_id(request.user_id)
            learner_name = learner.full_name if learner else "Unknown Learner"
            learner_email = learner.email if learner else "unknown@nlj.platform"
            
            await self.training_event_service.publish_attendance_checked_in(
                session_id=str(request.session_id),
                program_title="Training Session",  # Would need to fetch from session/program
                learner_id=str(request.user_id),
                learner_name=learner_name,
                learner_email=learner_email,
                check_in_time=None  # Will use current time
            )

        return session_obj, participants_affected, 0

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error