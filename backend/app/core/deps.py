"""
FastAPI dependencies for authentication and database access.
Uses modern FastAPI dependency injection patterns.
"""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import get_db
from app.core.security import verify_token
from app.models.user import User, UserRole
from app.services.kafka_service import kafka_service, xapi_event_service

# Use Case imports
from app.services.use_cases.content.create_content_use_case import CreateContentUseCase
from app.services.use_cases.content.update_content_use_case import UpdateContentUseCase
from app.services.use_cases.content.review_workflow_use_case import ReviewWorkflowUseCase
from app.services.use_cases.content.generate_content_use_case import GenerateContentUseCase
from app.services.use_cases.content.get_content_use_case import GetContentUseCase
from app.services.use_cases.content.list_content_use_case import ListContentUseCase
from app.services.use_cases.content.delete_content_use_case import DeleteContentUseCase
from app.services.use_cases.content.record_content_view_use_case import RecordContentViewUseCase
from app.services.use_cases.content.record_content_completion_use_case import RecordContentCompletionUseCase
from app.services.use_cases.content.list_generation_sessions_use_case import ListGenerationSessionsUseCase
from app.services.use_cases.content.get_generation_session_use_case import GetGenerationSessionUseCase
from app.services.use_cases.content.cancel_generation_use_case import CancelGenerationUseCase
from app.services.use_cases.content.generation_status_use_case import GenerationStatusUseCase
from app.services.use_cases.content.create_activity_from_generation_use_case import CreateActivityFromGenerationUseCase
from app.services.use_cases.content.start_generation_use_case import StartGenerationUseCase
from app.services.use_cases.content.retry_generation_use_case import RetryGenerationUseCase
from app.services.use_cases.content.get_generation_statistics_use_case import GetGenerationStatisticsUseCase
from app.services.use_cases.user_management.authenticate_user_use_case import AuthenticateUserUseCase
from app.services.use_cases.user_management.manage_profile_use_case import ManageProfileUseCase
from app.services.use_cases.user_management.manage_permissions_use_case import ManagePermissionsUseCase
from app.services.use_cases.user_management.get_user_use_case import GetUserUseCase
from app.services.use_cases.user_management.list_users_use_case import ListUsersUseCase
from app.services.use_cases.training.manage_program_use_case import ManageProgramUseCase
from app.services.use_cases.training.manage_sessions_use_case import ManageSessionsUseCase
from app.services.use_cases.training.track_engagement_use_case import TrackEngagementUseCase
from app.services.use_cases.analytics.generate_insights_use_case import GenerateInsightsUseCase
from app.services.use_cases.analytics.export_data_use_case import ExportDataUseCase

# ORM Service imports for dependency injection
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
from app.services.orm_services.permission_orm_service import PermissionOrmService
from app.services.orm_services.role_orm_service import RoleOrmService

# Repository imports for Clean Architecture compliance
from app.services.orm_repositories.user_repository import UserRepository
from app.services.orm_repositories.content_repository import ContentRepository
from app.services.orm_repositories.training_repository import (
    TrainingProgramRepository,
    TrainingSessionRepository, 
    TrainingBookingRepository,
    AttendanceRecordRepository
)
from app.services.orm_repositories.generation_repository import GenerationSessionRepository
from app.services.orm_repositories.source_document_repository import SourceDocumentRepository

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> User:
    """
    Get the current authenticated user from JWT token.

    Args:
        db: Database session
        credentials: HTTP Bearer credentials

    Returns:
        Current authenticated user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Verify JWT token
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    # Extract user ID from token
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception

    # Get user from database
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is disabled")

    return user


async def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """
    Get current active user (alias for backward compatibility).

    Args:
        current_user: Current authenticated user

    Returns:
        Current active user
    """
    return current_user


def require_role(required_role: UserRole):
    """
    Create a dependency that requires a specific user role.

    Args:
        required_role: Required user role

    Returns:
        FastAPI dependency function
    """

    async def check_role(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role != required_role and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"Operation requires {required_role.value} role"
            )
        return current_user

    return check_role


def require_roles(required_roles: list[UserRole]):
    """
    Create a dependency that requires one of several user roles.

    Args:
        required_roles: List of acceptable user roles

    Returns:
        FastAPI dependency function
    """

    async def check_roles(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in required_roles and current_user.role != UserRole.ADMIN:
            roles_str = ", ".join([role.value for role in required_roles])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"Operation requires one of these roles: {roles_str}"
            )
        return current_user

    return check_roles


# Common role dependencies
RequireCreator = Annotated[User, Depends(require_role(UserRole.CREATOR))]
RequireReviewer = Annotated[User, Depends(require_role(UserRole.REVIEWER))]
RequireApprover = Annotated[User, Depends(require_role(UserRole.APPROVER))]
RequireAdmin = Annotated[User, Depends(require_role(UserRole.ADMIN))]

# Mixed role dependencies
RequireContentManager = Annotated[
    User, Depends(require_roles([UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER]))
]
RequireReviewerOrApprover = Annotated[User, Depends(require_roles([UserRole.REVIEWER, UserRole.APPROVER]))]


async def get_kafka_service():
    """Get the global Kafka service instance."""
    return kafka_service


async def get_xapi_event_service():
    """Get the global xAPI event service instance."""
    return xapi_event_service


# Use Case Dependency Factories
async def get_create_content_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> CreateContentUseCase:
    """Factory for CreateContentUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return CreateContentUseCase(
        session=db,
        content_orm_service=content_orm_service,
        user_orm_service=user_orm_service,
        generation_session_orm_service=generation_session_orm_service
    )


async def get_update_content_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> UpdateContentUseCase:
    """Factory for UpdateContentUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return UpdateContentUseCase(
        session=db,
        content_orm_service=content_orm_service,
        user_orm_service=user_orm_service
    )


async def get_review_workflow_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ReviewWorkflowUseCase:
    """Factory for ReviewWorkflowUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return ReviewWorkflowUseCase(
        session=db,
        content_orm_service=content_orm_service,
        user_orm_service=user_orm_service
    )


async def get_generate_content_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> GenerateContentUseCase:
    """Factory for GenerateContentUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    source_document_repository = SourceDocumentRepository(db)
    source_document_orm_service = SourceDocumentOrmService(db, source_document_repository)
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    
    return GenerateContentUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service,
        source_document_orm_service=source_document_orm_service,
        content_orm_service=content_orm_service
    )


async def get_authenticate_user_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> AuthenticateUserUseCase:
    """Factory for AuthenticateUserUseCase."""
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return AuthenticateUserUseCase(
        session=db,
        user_orm_service=user_orm_service
    )


async def get_manage_profile_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ManageProfileUseCase:
    """Factory for ManageProfileUseCase."""
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return ManageProfileUseCase(
        session=db,
        user_orm_service=user_orm_service
    )


async def get_manage_permissions_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ManagePermissionsUseCase:
    """Factory for ManagePermissionsUseCase."""
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    permission_repository = UserRepository(db)  # PermissionOrmService uses UserRepository
    permission_orm_service = PermissionOrmService(db, permission_repository)
    role_repository = UserRepository(db)  # RoleOrmService uses UserRepository  
    role_orm_service = RoleOrmService(db, role_repository)
    
    return ManagePermissionsUseCase(
        session=db,
        user_orm_service=user_orm_service,
        permission_orm_service=permission_orm_service,
        role_orm_service=role_orm_service
    )


async def get_manage_program_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ManageProgramUseCase:
    """Factory for ManageProgramUseCase."""
    program_repository = TrainingProgramRepository(db)
    session_repository = TrainingSessionRepository(db)
    booking_repository = TrainingBookingRepository(db)
    attendance_repository = AttendanceRecordRepository(db)
    training_orm_service = TrainingOrmService(db, program_repository, session_repository, booking_repository, attendance_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return ManageProgramUseCase(
        session=db,
        training_orm_service=training_orm_service,
        user_orm_service=user_orm_service
    )


async def get_manage_sessions_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ManageSessionsUseCase:
    """Factory for ManageSessionsUseCase."""
    program_repository = TrainingProgramRepository(db)
    session_repository = TrainingSessionRepository(db)
    booking_repository = TrainingBookingRepository(db)
    attendance_repository = AttendanceRecordRepository(db)
    training_orm_service = TrainingOrmService(db, program_repository, session_repository, booking_repository, attendance_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return ManageSessionsUseCase(
        session=db,
        training_orm_service=training_orm_service,
        user_orm_service=user_orm_service
    )


async def get_track_engagement_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> TrackEngagementUseCase:
    """Factory for TrackEngagementUseCase."""
    program_repository = TrainingProgramRepository(db)
    session_repository = TrainingSessionRepository(db)
    booking_repository = TrainingBookingRepository(db)
    attendance_repository = AttendanceRecordRepository(db)
    training_orm_service = TrainingOrmService(db, program_repository, session_repository, booking_repository, attendance_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return TrackEngagementUseCase(
        session=db,
        training_orm_service=training_orm_service,
        user_orm_service=user_orm_service
    )


async def get_generate_insights_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> GenerateInsightsUseCase:
    """Factory for GenerateInsightsUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    program_repository = TrainingProgramRepository(db)
    session_repository = TrainingSessionRepository(db)
    booking_repository = TrainingBookingRepository(db)
    attendance_repository = AttendanceRecordRepository(db)
    training_orm_service = TrainingOrmService(db, program_repository, session_repository, booking_repository, attendance_repository)
    
    return GenerateInsightsUseCase(
        session=db,
        content_orm_service=content_orm_service,
        user_orm_service=user_orm_service,
        training_orm_service=training_orm_service
    )


async def get_export_data_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ExportDataUseCase:
    """Factory for ExportDataUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    program_repository = TrainingProgramRepository(db)
    session_repository = TrainingSessionRepository(db)
    booking_repository = TrainingBookingRepository(db)
    attendance_repository = AttendanceRecordRepository(db)
    training_orm_service = TrainingOrmService(db, program_repository, session_repository, booking_repository, attendance_repository)
    
    return ExportDataUseCase(
        session=db,
        content_orm_service=content_orm_service,
        user_orm_service=user_orm_service,
        training_orm_service=training_orm_service
    )


async def get_get_user_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> GetUserUseCase:
    """Factory for GetUserUseCase."""
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return GetUserUseCase(
        session=db,
        user_orm_service=user_orm_service
    )


async def get_list_users_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ListUsersUseCase:
    """Factory for ListUsersUseCase."""
    user_repository = UserRepository(db)
    user_orm_service = UserOrmService(db, user_repository)
    
    return ListUsersUseCase(
        session=db,
        user_orm_service=user_orm_service
    )


async def get_get_content_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> GetContentUseCase:
    """Factory for GetContentUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    
    return GetContentUseCase(
        session=db,
        content_orm_service=content_orm_service
    )


async def get_list_content_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ListContentUseCase:
    """Factory for ListContentUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    
    return ListContentUseCase(
        session=db,
        content_orm_service=content_orm_service
    )


async def get_delete_content_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> DeleteContentUseCase:
    """Factory for DeleteContentUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    
    return DeleteContentUseCase(
        session=db,
        content_orm_service=content_orm_service
    )


async def get_record_content_view_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> RecordContentViewUseCase:
    """Factory for RecordContentViewUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    
    return RecordContentViewUseCase(
        session=db,
        content_orm_service=content_orm_service
    )


async def get_record_content_completion_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> RecordContentCompletionUseCase:
    """Factory for RecordContentCompletionUseCase."""
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    
    return RecordContentCompletionUseCase(
        session=db,
        content_orm_service=content_orm_service
    )


async def get_list_generation_sessions_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> ListGenerationSessionsUseCase:
    """Factory for ListGenerationSessionsUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return ListGenerationSessionsUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service
    )


async def get_get_generation_session_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> GetGenerationSessionUseCase:
    """Factory for GetGenerationSessionUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return GetGenerationSessionUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service
    )


async def get_cancel_generation_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> CancelGenerationUseCase:
    """Factory for CancelGenerationUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return CancelGenerationUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service
    )


async def get_generation_status_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> GenerationStatusUseCase:
    """Factory for GenerationStatusUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return GenerationStatusUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service
    )


async def get_create_activity_from_generation_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> CreateActivityFromGenerationUseCase:
    """Factory for CreateActivityFromGenerationUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    content_repository = ContentRepository(db)
    content_orm_service = ContentOrmService(db, content_repository)
    
    return CreateActivityFromGenerationUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service,
        content_orm_service=content_orm_service
    )


async def get_start_generation_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> StartGenerationUseCase:
    """Factory for StartGenerationUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return StartGenerationUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service
    )


async def get_retry_generation_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> RetryGenerationUseCase:
    """Factory for RetryGenerationUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return RetryGenerationUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service
    )


async def get_generation_statistics_use_case(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> GetGenerationStatisticsUseCase:
    """Factory for GetGenerationStatisticsUseCase."""
    generation_repository = GenerationSessionRepository(db)
    generation_session_orm_service = GenerationSessionOrmService(db, generation_repository)
    
    return GetGenerationStatisticsUseCase(
        session=db,
        generation_session_orm_service=generation_session_orm_service
    )
