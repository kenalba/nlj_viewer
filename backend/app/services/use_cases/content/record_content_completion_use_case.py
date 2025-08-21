"""
Record Content Completion Use Case - Learning Completion Business Workflow.

Handles content completion tracking with xAPI events for learning analytics:
- Content completion recording with learning outcomes
- Progress tracking and achievement unlocking
- Learning path progression and mastery tracking
- xAPI standard compliance for learning analytics platforms
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class CompletionResult:
    """Learning result data for completion tracking."""
    score: Optional[float] = None  # 0.0 to 1.0 for assessments
    max_score: Optional[float] = None  # Maximum possible score
    completion_time_ms: Optional[int] = None  # Time taken to complete
    attempts: int = 1  # Number of attempts
    success: bool = True  # Whether completion was successful


@dataclass
class RecordContentCompletionRequest:
    """Request object for content completion recording operations."""
    content_id: UUID
    session_id: Optional[UUID] = None  # Learning session context
    result: Optional[CompletionResult] = None  # Learning outcomes
    learning_objectives_achieved: Optional[List[str]] = None  # Achieved learning objectives
    user_feedback: Optional[str] = None  # Optional learner feedback
    completion_context: Optional[Dict[str, Any]] = None  # Additional context


@dataclass
class RecordContentCompletionResponse:
    """Response object for content completion recording operations."""
    content_id: UUID
    completion_count: int  # Updated total completion count
    user_completion_count: int  # User's personal completion count
    mastery_achieved: bool  # Whether user achieved mastery
    achievements_unlocked: List[str]  # Any new achievements
    success: bool = True


class RecordContentCompletionUseCase(BaseUseCase[RecordContentCompletionRequest, RecordContentCompletionResponse]):
    """
    Use case for recording content completions with comprehensive xAPI analytics.

    Responsibilities:
    - Record content completion with learning outcomes
    - Calculate mastery and achievement progression
    - Update learning path progress
    - Publish detailed xAPI events for learning analytics platforms

    Events Published:
    - Content completed events (nlj.content.completed) with xAPI specification
    - Learning achievement events for mastery tracking
    - Progress events for learning path advancement
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService
    ) -> None:
        """
        Initialize record content completion use case.

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
        request: RecordContentCompletionRequest,
        user_context: Dict[str, Any]
    ) -> RecordContentCompletionResponse:
        """
        Execute content completion recording workflow.

        Args:
            request: Content completion recording request
            user_context: Current user context for analytics

        Returns:
            Content completion recording response with achievements

        Raises:
            ValueError: If target content not found
            RuntimeError: If completion recording fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get target content to validate existence
            content_orm_service = self.dependencies["content_orm_service"]
            content = await content_orm_service.get_by_id(request.content_id)

            if not content:
                raise ValueError(f"Content not found: {request.content_id}")

            # Record the completion and calculate achievements
            completion_result = await content_orm_service.record_content_completion(
                content_id=request.content_id,
                user_id=current_user_id,
                session_id=request.session_id,
                result_data=request.result.__dict__ if request.result else {},
                learning_objectives=request.learning_objectives_achieved or [],
                metadata={
                    "user_feedback": request.user_feedback,
                    "completion_context": request.completion_context or {},
                    "timestamp": datetime.now().isoformat()
                }
            )

            # Determine mastery and achievements
            mastery_achieved = await self._calculate_mastery(
                completion_result, request.result
            )
            
            achievements_unlocked = await self._calculate_achievements(
                current_user_id, request.content_id, completion_result, mastery_achieved
            )

            response = RecordContentCompletionResponse(
                content_id=request.content_id,
                completion_count=completion_result.get("total_completion_count", 0),
                user_completion_count=completion_result.get("user_completion_count", 0),
                mastery_achieved=mastery_achieved,
                achievements_unlocked=achievements_unlocked,
                success=True
            )

            # Publish content completion xAPI event - wrapped for resilience
            try:
                await self._publish_content_completion_event(
                    request, user_context, content, response
                )
            except Exception as e:
                # Log but don't fail the business operation
                logger.warning(f"Failed to publish content completion event: {e}")

            logger.info(
                f"Content completion recorded: {request.content_id} by user {current_user_id}, "
                f"mastery: {mastery_achieved}, achievements: {len(achievements_unlocked)}"
            )
            return response

        except ValueError as e:
            self._handle_validation_error(e, f"record completion for content {request.content_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"record completion for content {request.content_id}")
            raise

    async def _calculate_mastery(
        self,
        completion_result: Dict[str, Any],
        result: Optional[CompletionResult]
    ) -> bool:
        """Calculate if user achieved mastery based on performance."""
        if not result or result.score is None:
            # For non-assessment content, completion = mastery
            return True
        
        # For assessments, require 80% score for mastery
        mastery_threshold = 0.8
        return result.score >= mastery_threshold

    async def _calculate_achievements(
        self,
        user_id: UUID,
        content_id: UUID,
        completion_result: Dict[str, Any],
        mastery_achieved: bool
    ) -> List[str]:
        """Calculate any new achievements unlocked."""
        achievements = []
        
        # First completion achievement
        if completion_result.get("user_completion_count", 0) == 1:
            achievements.append("first_completion")
        
        # Mastery achievement
        if mastery_achieved:
            achievements.append("content_mastery")
        
        # Speed completion (if completed quickly)
        # Additional achievement logic would go here
        
        return achievements

    async def _publish_content_completion_event(
        self,
        request: RecordContentCompletionRequest,
        user_context: Dict[str, Any],
        content: Any,
        response: RecordContentCompletionResponse
    ) -> None:
        """Publish content completion xAPI event through Kafka for learning analytics."""
        actor_info = self._extract_user_info(user_context)
        result_data = request.result.__dict__ if request.result else {}
        
        # Publish comprehensive xAPI completion event
        await self._publish_event(
            "publish_content_completed",
            
            # xAPI Actor (learner who completed the content)
            actor_user_id=actor_info["user_id"],
            actor_name=actor_info["user_name"],
            actor_email=actor_info["user_email"],
            actor_role=user_context.get("user_role", "").value if user_context.get("user_role") else "",
            
            # xAPI Verb (completed)
            verb="completed",
            verb_display="completed",
            verb_description="User completed learning content",
            
            # xAPI Object (the content that was completed)
            object_id=str(request.content_id),
            object_type="content",
            object_name=content.title,
            object_description=content.description,
            content_type=content.content_type.value if content.content_type else None,
            content_state=content.state.value if content.state else None,
            learning_style=content.learning_style.value if content.learning_style else None,
            is_template=content.is_template,
            
            # xAPI Result (learning outcomes and performance)
            completion=True,
            success=result_data.get("success", True),
            score_raw=result_data.get("score"),
            score_max=result_data.get("max_score"),
            score_scaled=result_data.get("score"),  # Assuming 0-1 scale
            duration_ms=result_data.get("completion_time_ms"),
            attempts=result_data.get("attempts", 1),
            
            # Learning outcomes
            mastery_achieved=response.mastery_achieved,
            learning_objectives_achieved=request.learning_objectives_achieved or [],
            achievements_unlocked=response.achievements_unlocked,
            
            # xAPI Context (session and environment info)
            timestamp=datetime.now().isoformat(),
            session_id=str(request.session_id) if request.session_id else None,
            completion_count_total=response.completion_count,
            completion_count_user=response.user_completion_count,
            
            # Learning Analytics Context
            content_creator_id=str(content.created_by) if content.created_by else None,
            content_version=content.version or 1,
            user_feedback=request.user_feedback,
            completion_context=request.completion_context or {},
            
            # Platform context for xAPI
            platform="nlj-platform",
            platform_version="1.0",
            language="en-US",
            
            # Additional metadata for analytics
            first_completion=response.user_completion_count == 1,
            repeat_completion=response.user_completion_count > 1,
            analytics_timestamp=datetime.now().isoformat()
        )

        # If achievements were unlocked, publish separate achievement events
        if response.achievements_unlocked:
            for achievement in response.achievements_unlocked:
                await self._publish_event(
                    "publish_achievement_unlocked",
                    actor_user_id=actor_info["user_id"],
                    actor_name=actor_info["user_name"],
                    actor_email=actor_info["user_email"],
                    verb="achieved",
                    object_id=achievement,
                    object_type="achievement",
                    object_name=achievement.replace("_", " ").title(),
                    content_id=str(request.content_id),
                    timestamp=datetime.now().isoformat(),
                    platform="nlj-platform"
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