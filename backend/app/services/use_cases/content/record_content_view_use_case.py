"""
Record Content View Use Case - Content Analytics Business Workflow.

Handles content view tracking with xAPI events for learning analytics:
- Content view recording for analytics and engagement tracking
- User behavior tracking with xAPI standard compliance
- Performance metrics collection
- Learning path analytics support
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class RecordContentViewRequest:
    """Request object for content view recording operations."""
    content_id: UUID
    session_id: Optional[UUID] = None  # Learning session context
    referrer_url: Optional[str] = None  # Where user came from
    user_agent: Optional[str] = None  # Browser/device info
    duration_ms: Optional[int] = None  # How long they stayed (if known)


@dataclass
class RecordContentViewResponse:
    """Response object for content view recording operations."""
    content_id: UUID
    view_count: int  # Updated total view count
    user_view_count: int  # User's personal view count for this content
    success: bool = True


class RecordContentViewUseCase(BaseUseCase[RecordContentViewRequest, RecordContentViewResponse]):
    """
    Use case for recording content views with xAPI analytics events.

    Responsibilities:
    - Record content view in analytics database
    - Update content view counters
    - Track user engagement patterns
    - Publish xAPI events for learning analytics platforms

    Events Published:
    - Content viewed events (nlj.content.viewed) with full xAPI specification
    - User engagement events for learning path analysis
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService
    ) -> None:
        """
        Initialize record content view use case.

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
        request: RecordContentViewRequest,
        user_context: Dict[str, Any]
    ) -> RecordContentViewResponse:
        """
        Execute content view recording workflow.

        Args:
            request: Content view recording request
            user_context: Current user context for analytics

        Returns:
            Content view recording response with updated counts

        Raises:
            ValueError: If target content not found
            RuntimeError: If view recording fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get target content to validate existence
            content_orm_service = self.dependencies["content_orm_service"]
            content = await content_orm_service.get_by_id(request.content_id)

            if not content:
                raise ValueError(f"Content not found: {request.content_id}")

            # Record the view and get updated counts
            view_result = await content_orm_service.record_content_view(
                content_id=request.content_id,
                user_id=current_user_id,
                session_id=request.session_id,
                metadata={
                    "referrer_url": request.referrer_url,
                    "user_agent": request.user_agent,
                    "duration_ms": request.duration_ms,
                    "timestamp": datetime.now().isoformat()
                }
            )

            response = RecordContentViewResponse(
                content_id=request.content_id,
                view_count=view_result.get("total_view_count", 0),
                user_view_count=view_result.get("user_view_count", 0),
                success=True
            )

            # Publish content view xAPI event - wrapped for resilience
            try:
                await self._publish_content_view_event(
                    request, user_context, content, response
                )
            except Exception as e:
                # Log but don't fail the business operation
                logger.warning(f"Failed to publish content view event: {e}")

            logger.debug(
                f"Content view recorded: {request.content_id} by user {current_user_id}"
            )
            return response

        except ValueError as e:
            self._handle_validation_error(e, f"record view for content {request.content_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"record view for content {request.content_id}")
            raise

    async def _publish_content_view_event(
        self,
        request: RecordContentViewRequest,
        user_context: Dict[str, Any],
        content: Any,
        response: RecordContentViewResponse
    ) -> None:
        """Publish content view xAPI event through Kafka for learning analytics."""
        actor_info = self._extract_user_info(user_context)
        
        # Publish comprehensive xAPI event for learning analytics
        await self._publish_event(
            "publish_content_viewed",
            
            # xAPI Actor (learner who viewed the content)
            actor_user_id=actor_info["user_id"],
            actor_name=actor_info["user_name"],
            actor_email=actor_info["user_email"],
            actor_role=user_context.get("user_role", "").value if user_context.get("user_role") else "",
            
            # xAPI Verb (experienced/viewed)
            verb="experienced",
            verb_display="viewed",
            verb_description="User viewed learning content",
            
            # xAPI Object (the content that was viewed)
            object_id=str(request.content_id),
            object_type="content",
            object_name=content.title,
            object_description=content.description,
            content_type=content.content_type.value if content.content_type else None,
            content_state=content.state.value if content.state else None,
            learning_style=content.learning_style.value if content.learning_style else None,
            is_template=content.is_template,
            
            # xAPI Result (analytics data)
            view_count_total=response.view_count,
            view_count_user=response.user_view_count,
            duration_ms=request.duration_ms,
            
            # xAPI Context (session and environment info)
            timestamp=datetime.now().isoformat(),
            session_id=str(request.session_id) if request.session_id else None,
            referrer_url=request.referrer_url,
            user_agent=request.user_agent,
            
            # Learning Analytics Context
            content_creator_id=str(content.created_by) if content.created_by else None,
            content_version=content.version or 1,
            
            # Platform context for xAPI
            platform="nlj-platform",
            platform_version="1.0",
            language="en-US",
            
            # Additional metadata for analytics
            first_view=response.user_view_count == 1,
            returning_user=response.user_view_count > 1,
            analytics_timestamp=datetime.now().isoformat()
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