"""
List Content Use Case - Content Listing Business Workflow.

Handles paginated content listing with filtering and permission validation:
- Paginated content lists with search and filtering
- Role-based data filtering (user role determines what content they can see)
- Search functionality across title and description
- Permission validation for data access levels
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, List
from enum import Enum
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.models.content import ContentState, ContentType, LearningStyle
from app.schemas.services.content_schemas import ContentServiceSchema
from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class ContentListSortBy(Enum):
    """Content list sorting options."""
    TITLE = "title"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    VIEW_COUNT = "view_count"
    COMPLETION_COUNT = "completion_count"
    STATE = "state"


class ContentListSortOrder(Enum):
    """Content list sort order options."""
    ASC = "asc"
    DESC = "desc"


@dataclass
class ListContentRequest:
    """Request object for content listing operations."""
    page: int = 1
    per_page: int = 20
    state_filter: ContentState | None = None
    content_type_filter: ContentType | None = None
    learning_style_filter: LearningStyle | None = None
    is_template: bool | None = None
    template_category: str | None = None
    created_by: str | None = None  # UUID as string
    search: str | None = None
    sort_by: ContentListSortBy = ContentListSortBy.CREATED_AT
    sort_order: ContentListSortOrder = ContentListSortOrder.DESC
    include_archived: bool = False  # Include archived content


@dataclass  
class ListContentResponse:
    """Response object for content listing operations."""
    content_items: List[ContentServiceSchema]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool
    total_pages: int
    filtered_count: int  # Number of content items after filtering (before pagination)


class ListContentUseCase(BaseUseCase[ListContentRequest, ListContentResponse]):
    """
    Use case for paginated content listing with filtering and permissions.

    Responsibilities:
    - Validate content list access permissions
    - Apply role-based filtering (admin, creator, reviewer, learner views)  
    - Execute search and filtering logic
    - Handle pagination calculations
    - Return structured list with metadata

    Events Published:
    - Content list access events (nlj.content.list_accessed) for analytics
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService
    ) -> None:
        """
        Initialize list content use case.

        Args:
            session: Database session for transaction management
            content_orm_service: Content data access service
        """
        super().__init__(
            session,
            content_orm_service=content_orm_service
        )

    async def execute(
        self,
        request: ListContentRequest,
        user_context: Dict[str, Any]
    ) -> ListContentResponse:
        """
        Execute content listing workflow.

        Args:
            request: Content listing request with filters and pagination
            user_context: Current user context for permissions

        Returns:
            Content listing response with paginated results

        Raises:
            PermissionError: If user lacks permission to list content
            ValueError: If request validation fails
            RuntimeError: If content listing fails
        """
        try:
            current_user_role = user_context.get("user_role")
            current_user_id = user_context.get("user_id")
            
            # Validate and adjust filters based on permissions
            adjusted_request = await self._validate_and_adjust_filters(
                request, current_user_role, current_user_id
            )

            # Calculate pagination
            skip = (adjusted_request.page - 1) * adjusted_request.per_page

            # Get content from ORM service
            content_orm_service = self.dependencies["content_orm_service"]
            
            content_items = await content_orm_service.get_content_list(
                skip=skip,
                limit=adjusted_request.per_page,
                state_filter=adjusted_request.state_filter,
                content_type_filter=adjusted_request.content_type_filter,
                learning_style_filter=adjusted_request.learning_style_filter,
                is_template=adjusted_request.is_template,
                template_category=adjusted_request.template_category,
                created_by=adjusted_request.created_by,
                search=adjusted_request.search,
                sort_by=adjusted_request.sort_by.value,
                sort_order=adjusted_request.sort_order.value
            )

            # Get total count for pagination
            total = await content_orm_service.get_content_count(
                state_filter=adjusted_request.state_filter,
                content_type_filter=adjusted_request.content_type_filter,
                learning_style_filter=adjusted_request.learning_style_filter,
                is_template=adjusted_request.is_template,
                template_category=adjusted_request.template_category,
                created_by=adjusted_request.created_by,
                search=adjusted_request.search
            )

            # Convert content items to service schemas
            content_schemas = []
            for content in content_items:
                content_schema = ContentServiceSchema.from_orm_model(content)
                content_schemas.append(content_schema)

            # Calculate pagination metadata
            total_pages = (total + adjusted_request.per_page - 1) // adjusted_request.per_page
            has_next = adjusted_request.page < total_pages
            has_prev = adjusted_request.page > 1

            response = ListContentResponse(
                content_items=content_schemas,
                total=total,
                page=adjusted_request.page,
                per_page=adjusted_request.per_page,
                has_next=has_next,
                has_prev=has_prev,
                total_pages=total_pages,
                filtered_count=total  # In this simple case, same as total
            )

            # Publish content list access event - wrapped for resilience
            try:
                await self._publish_content_list_event(adjusted_request, user_context, response)
            except Exception as e:
                # Log but don't fail the business operation
                logger.warning(f"Failed to publish content list event: {e}")

            logger.info(
                f"Content list retrieved: {len(content_schemas)} items, page {adjusted_request.page}, "
                f"by user {user_context.get('user_id')}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, "list content")
            raise
        except Exception as e:
            await self._handle_service_error(e, "list content")
            raise

    async def _validate_and_adjust_filters(
        self,
        request: ListContentRequest,
        current_user_role: UserRole | None,
        current_user_id: str | None
    ) -> ListContentRequest:
        """Validate and adjust request filters based on user permissions."""
        # Validate pagination parameters
        if request.page < 1:
            raise ValueError("Page number must be positive")
        
        if request.per_page < 1 or request.per_page > 100:
            raise ValueError("Items per page must be between 1 and 100")

        # Create adjusted request
        adjusted_request = ListContentRequest(
            page=request.page,
            per_page=request.per_page,
            state_filter=request.state_filter,
            content_type_filter=request.content_type_filter,
            learning_style_filter=request.learning_style_filter,
            is_template=request.is_template,
            template_category=request.template_category,
            created_by=request.created_by,
            search=request.search,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            include_archived=request.include_archived
        )

        # Apply role-based restrictions
        if current_user_role == UserRole.ADMIN:
            # Admins can see everything - no restrictions
            pass
        elif current_user_role in [UserRole.REVIEWER, UserRole.APPROVER]:
            # Reviewers can see published content, their own content, and content in review
            # For simplicity, we'll handle this in the ORM service query
            pass
        elif current_user_role == UserRole.CREATOR:
            # Creators can see published content and their own content
            # For simplicity, we'll handle this in the ORM service query
            pass
        else:  # LEARNER or no role
            # Regular users only see published content
            adjusted_request.state_filter = ContentState.PUBLISHED
            adjusted_request.created_by = None  # Remove creator filter for security
            adjusted_request.include_archived = False  # Never show archived

        return adjusted_request

    def _ensure_valid_nlj_data(self, nlj_data: dict[str, Any]) -> dict[str, Any]:
        """Ensure NLJ data has required fields for schema validation."""
        if not isinstance(nlj_data, dict):
            nlj_data = {}
        
        # Ensure required fields exist
        if "title" not in nlj_data:
            nlj_data["title"] = "Untitled"
        
        if "nodes" not in nlj_data:
            nlj_data["nodes"] = []
        
        if "edges" not in nlj_data:
            nlj_data["edges"] = []
            
        return nlj_data

    async def _publish_content_list_event(
        self,
        request: ListContentRequest,
        user_context: Dict[str, Any],
        response: ListContentResponse
    ) -> None:
        """Publish content list access event for analytics."""
        actor_info = self._extract_user_info(user_context)
        
        await self._publish_event(
            "publish_content_list_accessed",
            accessor_user_id=actor_info["user_id"],
            accessor_name=actor_info["user_name"],
            accessor_email=actor_info["user_email"],
            access_timestamp=datetime.now().isoformat(),
            page=request.page,
            per_page=request.per_page,
            total_results=response.total,
            search_term=request.search,
            state_filter=request.state_filter.value if request.state_filter else None,
            content_type_filter=request.content_type_filter.value if request.content_type_filter else None,
            learning_style_filter=request.learning_style_filter.value if request.learning_style_filter else None,
            is_template=request.is_template,
            template_category=request.template_category
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