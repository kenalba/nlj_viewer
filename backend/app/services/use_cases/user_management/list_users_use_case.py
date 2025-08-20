"""
List Users Use Case - User Listing Business Workflow.

Handles paginated user listing with filtering and permission validation:
- Paginated user lists with search and filtering
- Role-based data filtering (admin vs non-admin views)
- Search functionality across username, email, and full name
- Permission validation for data access levels
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, List
from enum import Enum
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.schemas.services.user_schemas import UserServiceSchema
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class UserListSortBy(Enum):
    """User list sorting options."""
    USERNAME = "username"
    EMAIL = "email"
    CREATED_AT = "created_at"
    LAST_LOGIN = "last_login"
    FULL_NAME = "full_name"


class UserListSortOrder(Enum):
    """User list sort order options."""
    ASC = "asc"
    DESC = "desc"


@dataclass
class ListUsersRequest:
    """Request object for user listing operations."""
    page: int = 1
    per_page: int = 20
    role_filter: UserRole | None = None
    active_only: bool = False
    search: str | None = None
    sort_by: UserListSortBy = UserListSortBy.USERNAME
    sort_order: UserListSortOrder = UserListSortOrder.ASC
    include_system_users: bool = False  # Include system/service accounts


@dataclass  
class ListUsersResponse:
    """Response object for user listing operations."""
    users: List[UserServiceSchema]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool
    total_pages: int
    filtered_count: int  # Number of users after filtering (before pagination)


class ListUsersUseCase(BaseUseCase[ListUsersRequest, ListUsersResponse]):
    """
    Use case for paginated user listing with filtering and permissions.

    Responsibilities:
    - Validate user list access permissions
    - Apply role-based filtering (admin vs regular user views)  
    - Execute search and filtering logic
    - Handle pagination calculations
    - Return structured list with metadata

    Events Published:
    - User list access events (nlj.user.list_accessed) for audit trails
    """

    def __init__(
        self,
        session: AsyncSession,
        user_orm_service: UserOrmService
    ) -> None:
        """
        Initialize list users use case.

        Args:
            session: Database session for transaction management
            user_orm_service: User data access service
        """
        super().__init__(
            session,
            user_orm_service=user_orm_service
        )

    async def execute(
        self,
        request: ListUsersRequest,
        user_context: Dict[str, Any]
    ) -> ListUsersResponse:
        """
        Execute user listing workflow.

        Args:
            request: User listing request with filters and pagination
            user_context: Current user context for permissions

        Returns:
            User listing response with paginated results

        Raises:
            PermissionError: If user lacks permission to list users
            ValueError: If request validation fails
            RuntimeError: If user listing fails
        """
        try:
            current_user_role = user_context.get("user_role")
            
            # Validate and adjust filters based on permissions
            adjusted_request = await self._validate_and_adjust_filters(
                request, current_user_role
            )

            # Calculate pagination
            skip = (adjusted_request.page - 1) * adjusted_request.per_page

            # Get users from ORM service
            user_orm_service = self.dependencies["user_orm_service"]
            
            users = await user_orm_service.get_users(
                skip=skip,
                limit=adjusted_request.per_page,
                role_filter=adjusted_request.role_filter,
                active_only=adjusted_request.active_only,
                search=adjusted_request.search
            )

            # Get total count for pagination
            total = await user_orm_service.get_user_count(
                role_filter=adjusted_request.role_filter,
                active_only=adjusted_request.active_only,
                search=adjusted_request.search
            )

            # Convert users to service schemas
            user_schemas = []
            for user in users:
                user_schema = UserServiceSchema(
                    id=user.id,
                    email=user.email,
                    username=getattr(user, 'username', ''),
                    full_name=getattr(user, 'full_name', ''),
                    role=getattr(user, 'role', UserRole.LEARNER),
                    is_active=getattr(user, 'is_active', True),
                    created_at=getattr(user, 'created_at', None),
                    updated_at=getattr(user, 'updated_at', None)
                )
                user_schemas.append(user_schema)

            # Calculate pagination metadata
            total_pages = (total + adjusted_request.per_page - 1) // adjusted_request.per_page
            has_next = adjusted_request.page < total_pages
            has_prev = adjusted_request.page > 1

            response = ListUsersResponse(
                users=user_schemas,
                total=total,
                page=adjusted_request.page,
                per_page=adjusted_request.per_page,
                has_next=has_next,
                has_prev=has_prev,
                total_pages=total_pages,
                filtered_count=total  # In this simple case, same as total
            )

            # Publish user list access event - wrapped for resilience
            try:
                await self._publish_user_list_event(adjusted_request, user_context, response)
            except Exception as e:
                # Log but don't fail the business operation
                logger.warning(f"Failed to publish user list event: {e}")

            logger.info(
                f"User list retrieved: {len(user_schemas)} users, page {adjusted_request.page}, "
                f"by user {user_context.get('user_id')}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, "list users")
            raise
        except Exception as e:
            await self._handle_service_error(e, "list users")
            raise

    async def _validate_and_adjust_filters(
        self,
        request: ListUsersRequest,
        current_user_role: UserRole | None
    ) -> ListUsersRequest:
        """Validate and adjust request filters based on user permissions."""
        # Validate pagination parameters
        if request.page < 1:
            raise ValueError("Page number must be positive")
        
        if request.per_page < 1 or request.per_page > 100:
            raise ValueError("Items per page must be between 1 and 100")

        # Create adjusted request
        adjusted_request = ListUsersRequest(
            page=request.page,
            per_page=request.per_page,
            role_filter=request.role_filter,
            active_only=request.active_only,
            search=request.search,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            include_system_users=request.include_system_users
        )

        # Apply role-based restrictions
        if current_user_role != UserRole.ADMIN:
            # Non-admin users have restricted access
            adjusted_request.role_filter = None  # Remove role filter
            adjusted_request.active_only = True  # Only show active users
            adjusted_request.include_system_users = False  # Hide system users
            
            # Limit search capabilities for non-admins if needed
            # For now, we allow basic search for all users

        return adjusted_request

    async def _publish_user_list_event(
        self,
        request: ListUsersRequest,
        user_context: Dict[str, Any],
        response: ListUsersResponse
    ) -> None:
        """Publish user list access event for audit trail."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_user_list_accessed",
            accessor_user_id=actor_info["user_id"],
            accessor_name=actor_info["user_name"],
            accessor_email=actor_info["user_email"],
            access_timestamp=datetime.now().isoformat(),
            page=request.page,
            per_page=request.per_page,
            total_results=response.total,
            search_term=request.search,
            role_filter=request.role_filter.value if request.role_filter else None,
            active_only=request.active_only
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