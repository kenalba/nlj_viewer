"""
Manage Program Use Case - Training Program Management Business Workflow.

Handles training program lifecycle including:
- Create training programs with content assignments
- Update program metadata and configurations  
- Assign learners to programs
- Manage program schedules and deadlines
- Track program enrollment and completion
- Handle program archival and reactivation
"""

import logging
from dataclasses import dataclass
from typing import Any
import uuid
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.schemas.services.training_schemas import TrainingProgramServiceSchema
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.events.training_events import TrainingEventService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class ProgramAction(Enum):
    """Available program management actions."""
    CREATE = "create"
    UPDATE = "update"
    ASSIGN_LEARNERS = "assign_learners"
    REMOVE_LEARNERS = "remove_learners"
    ASSIGN_CONTENT = "assign_content"
    REMOVE_CONTENT = "remove_content"
    ARCHIVE = "archive"
    REACTIVATE = "reactivate"


@dataclass
class ManageProgramRequest:
    """Request object for program management actions."""
    action: ProgramAction
    program_id: uuid.UUID | None = None
    title: str | None = None
    description: str | None = None
    content_id: uuid.UUID | None = None
    duration_minutes: int | None = None
    max_participants: int | None = None
    created_by: uuid.UUID | None = None
    learning_objectives: list[str] | None = None
    prerequisites: list[uuid.UUID] | None = None


@dataclass
class ManageProgramResponse:
    """Response object for program management actions."""
    program: Any  # Will use actual training program model
    action_taken: ProgramAction
    learners_affected: int = 0
    content_items_affected: int = 0


class ManageProgramUseCase(BaseUseCase[ManageProgramRequest, ManageProgramResponse]):
    """
    Use case for comprehensive training program management.

    Responsibilities:
    - Route program management actions to appropriate handlers
    - Validate permissions for program management operations
    - Coordinate learner enrollment and content assignment
    - Publish program lifecycle events
    - Handle program state transitions and business rules

    Events Published:
    - Program creation events (nlj.training.program_created)
    - Program update events (nlj.training.program_updated)  
    - Learner assignment events (nlj.training.learners_assigned)
    - Content assignment events (nlj.training.content_assigned)
    - Program archive/reactivate events
    """

    def __init__(
        self,
        session: AsyncSession,
        training_orm_service: TrainingOrmService,
        user_orm_service: UserOrmService,
        content_orm_service: ContentOrmService,
        training_event_service: TrainingEventService | None = None
    ):
        """
        Initialize manage program use case.

        Args:
            session: Database session for transaction management
            training_program_orm_service: Training program management
            user_orm_service: User operations for learner assignment
            content_orm_service: Content operations for assignment
        """
        super().__init__(
            session,
            training_orm_service=training_orm_service,
            user_orm_service=user_orm_service,
            content_orm_service=content_orm_service
        )
        self.training_event_service = training_event_service or TrainingEventService()

    async def execute(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> ManageProgramResponse:
        """
        Execute program management workflow.

        Args:
            request: Program management request with action and parameters
            user_context: User context for permissions and events

        Returns:
            Program management response with results

        Raises:
            PermissionError: If user lacks program management permissions
            ValueError: If request validation fails
            RuntimeError: If program management fails
        """
        try:
            # Route to specific action handler
            if request.action == ProgramAction.CREATE:
                program, learners_affected, content_affected = await self._handle_create(
                    request, user_context
                )
            elif request.action == ProgramAction.UPDATE:
                program, learners_affected, content_affected = await self._handle_update(
                    request, user_context
                )
            elif request.action == ProgramAction.ASSIGN_LEARNERS:
                program, learners_affected, content_affected = await self._handle_assign_learners(
                    request, user_context
                )
            elif request.action == ProgramAction.REMOVE_LEARNERS:
                program, learners_affected, content_affected = await self._handle_remove_learners(
                    request, user_context
                )
            elif request.action == ProgramAction.ASSIGN_CONTENT:
                program, learners_affected, content_affected = await self._handle_assign_content(
                    request, user_context
                )
            elif request.action == ProgramAction.REMOVE_CONTENT:
                program, learners_affected, content_affected = await self._handle_remove_content(
                    request, user_context
                )
            elif request.action == ProgramAction.ARCHIVE:
                program, learners_affected, content_affected = await self._handle_archive(
                    request, user_context
                )
            elif request.action == ProgramAction.REACTIVATE:
                program, learners_affected, content_affected = await self._handle_reactivate(
                    request, user_context
                )
            else:
                raise ValueError(f"Unsupported program action: {request.action}")

            # Create response with proper schema conversion
            program_schema = TrainingProgramServiceSchema.model_validate(program)
            response = ManageProgramResponse(
                program=program_schema,
                action_taken=request.action,
                learners_affected=learners_affected,
                content_items_affected=content_affected
            )

            logger.info(
                f"Program management executed: {request.action.value} on "
                f"program {program.id}, learners affected: {learners_affected}, "
                f"content items affected: {content_affected}"
            )
            return response

        except PermissionError:
            raise
        except NotImplementedError:
            raise  # Let NotImplementedError bubble up as design signal
        except ValueError as e:
            self._handle_validation_error(e, f"program management {request.action.value}")
        except Exception as e:
            await self._handle_service_error(e, f"program management {request.action.value}")
            raise  # This will never be reached but satisfies mypy

    async def _handle_create(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle program creation."""
        # Validate permissions - reviewers and above can create programs
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to create training programs"
        )

        # Validate required fields
        if not request.title:
            raise ValueError("Program title is required")

        # Create program using actual TrainingOrmService API
        training_orm_service = self.dependencies["training_orm_service"]
        user_id = uuid.UUID(user_context["user_id"])

        program = await training_orm_service.create_training_program(
            title=request.title.strip(),
            description=request.description.strip() if request.description else None,
            content_id=request.content_id or uuid.uuid4(),  # Required field in actual API
            created_by=user_id,
            max_participants=request.max_participants,
            duration_minutes=request.duration_minutes or 120
        )

        # Note: Learner and content assignment not supported in current TrainingOrmService
        # These would need to be added as separate methods or handled differently
        learners_affected = 0
        content_affected = 0

        # Publish program creation event using proper xAPI format
        user_info = self._extract_user_info(user_context)
        await self.training_event_service.publish_program_created(
            program_id=str(program.id),
            program_title=program.title,
            program_description=program.description or "",
            creator_id=user_info["user_id"],
            creator_name=user_info["user_name"],
            creator_email=user_info["user_email"],
            learning_objectives=request.learning_objectives,
            prerequisites=[str(p) for p in request.prerequisites] if request.prerequisites else None
        )

        return program, learners_affected, content_affected

    async def _handle_update(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle program updates."""
        if not request.program_id:
            raise ValueError("Program ID is required for update")

        # Get existing program using actual API
        training_orm_service = self.dependencies["training_orm_service"]
        program = await training_orm_service.get_by_id(request.program_id)
        if not program:
            raise ValueError(f"Training program not found: {request.program_id}")

        # Validate permissions - creator or admin can update
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to update training programs"
        )

        # Build update data matching actual model fields
        update_data = {}
        if request.title is not None:
            update_data["title"] = request.title.strip()
        if request.description is not None:
            update_data["description"] = request.description.strip()
        if request.duration_minutes is not None:
            update_data["duration_minutes"] = request.duration_minutes
        if request.max_participants is not None:
            update_data["max_participants"] = request.max_participants

        # Update program using actual API
        updated_program = await training_orm_service.update_by_id(
            request.program_id, **update_data
        )

        # Publish program update event - using generic event since no specific xAPI update method exists
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_training_program_updated",
            program_id=str(updated_program.id),
            program_title=updated_program.title,
            updater_id=user_info["user_id"],
            updater_name=user_info["user_name"],
            updater_email=user_info["user_email"],
            fields_updated=list(update_data.keys())
        )

        return updated_program, 0, 0

    async def _handle_assign_learners(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle learner assignment to program."""
        raise NotImplementedError("Learner assignment not yet implemented in TrainingOrmService")

    async def _handle_remove_learners(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle learner removal from program."""
        raise NotImplementedError("Learner removal not yet implemented in TrainingOrmService")

    async def _handle_assign_content(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle content assignment to program."""
        raise NotImplementedError("Content assignment not yet implemented in TrainingOrmService")

    async def _handle_remove_content(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle content removal from program."""
        raise NotImplementedError("Content removal not yet implemented in TrainingOrmService")

    async def _handle_archive(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle program archival."""
        if not request.program_id:
            raise ValueError("Program ID is required for archival")
            
        # Validate permissions - admin only
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.ADMIN],
            error_message="Insufficient permissions to archive programs"
        )

        # Archive by setting is_active=False
        training_orm_service = self.dependencies["training_orm_service"]
        archived_program = await training_orm_service.update_by_id(
            request.program_id, is_active=False
        )
        
        if not archived_program:
            raise ValueError(f"Training program not found: {request.program_id}")

        # Publish event - using generic event since no specific xAPI archive method exists
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_training_program_archived",
            program_id=str(archived_program.id),
            program_title=archived_program.title,
            archiver_id=user_info["user_id"],
            archiver_name=user_info["user_name"],
            archiver_email=user_info["user_email"]
        )

        return archived_program, 0, 0

    async def _handle_reactivate(
        self,
        request: ManageProgramRequest,
        user_context: dict[str, Any]
    ) -> tuple[Any, int, int]:
        """Handle program reactivation."""
        if not request.program_id:
            raise ValueError("Program ID is required for reactivation")
            
        # Validate permissions - admin only
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.ADMIN],
            error_message="Insufficient permissions to reactivate programs"
        )

        # Reactivate by setting is_active=True
        training_orm_service = self.dependencies["training_orm_service"]
        reactivated_program = await training_orm_service.update_by_id(
            request.program_id, is_active=True
        )
        
        if not reactivated_program:
            raise ValueError(f"Training program not found: {request.program_id}")

        # Publish event - using generic event since no specific xAPI reactivate method exists
        user_info = self._extract_user_info(user_context)
        await self._publish_event(
            "publish_training_program_reactivated",
            program_id=str(reactivated_program.id),
            program_title=reactivated_program.title,
            reactivator_id=user_info["user_id"],
            reactivator_name=user_info["user_name"],
            reactivator_email=user_info["user_email"]
        )

        return reactivated_program, 0, 0

    # Helper method removed - functionality moved to individual handlers

    # Learner assignment method removed - not implemented in current TrainingOrmService

    # Content assignment method removed - not implemented in current TrainingOrmService

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error