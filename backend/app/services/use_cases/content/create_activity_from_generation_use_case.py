"""
Create Activity From Generation Use Case - Generation to Activity Conversion Workflow.

Handles conversion of completed generation sessions into content activities:
- Validation of generation session completion and content quality
- Creation of content activities from generated NLJ data
- Proper metadata transfer and attribution
- Workflow integration with content management system
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generation_session import GenerationStatus
from app.models.user import UserRole
from app.schemas.services.content_schemas import ContentServiceSchema
from app.schemas.services.generation_schemas import GenerationSessionServiceSchema
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class CreateActivityFromGenerationRequest:
    """Request object for activity creation from generation operations."""
    session_id: UUID
    activity_title: str
    activity_description: Optional[str] = None
    override_content_type: Optional[str] = None  # Override default content type
    add_generation_metadata: bool = True  # Include generation info in activity metadata


@dataclass
class CreateActivityFromGenerationResponse:
    """Response object for activity creation from generation operations."""
    activity: ContentServiceSchema
    source_session: GenerationSessionServiceSchema
    creation_successful: bool
    generation_data_quality: str  # "excellent", "good", "acceptable", "poor"
    validation_warnings: list[str] = None


class CreateActivityFromGenerationUseCase(BaseUseCase[CreateActivityFromGenerationRequest, CreateActivityFromGenerationResponse]):
    """
    Use case for creating content activities from completed generation sessions.

    Responsibilities:
    - Validate generation session completion and content quality
    - Extract and validate generated NLJ data
    - Create content activity with proper metadata and attribution
    - Link activity back to source generation session
    - Publish activity creation and generation conversion events

    Events Published:
    - Activity created from generation events
    - Generation converted to activity events
    - Content quality validation events
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService,
        content_orm_service: ContentOrmService
    ) -> None:
        """
        Initialize create activity from generation use case.

        Args:
            session: Database session for transaction management
            generation_session_orm_service: Generation session data access
            content_orm_service: Content creation and management
        """
        super().__init__(
            session,
            generation_session_orm_service=generation_session_orm_service,
            content_orm_service=content_orm_service
        )

    async def execute(
        self,
        request: CreateActivityFromGenerationRequest,
        user_context: Dict[str, Any]
    ) -> CreateActivityFromGenerationResponse:
        """
        Execute activity creation from generation workflow.

        Args:
            request: Activity creation request with generation session ID and metadata
            user_context: Current user context for permissions

        Returns:
            Activity creation response with created activity and source session info

        Raises:
            PermissionError: If user lacks permission to create activity from session
            ValueError: If session not found, not completed, or has invalid content
            RuntimeError: If activity creation fails
        """
        try:
            current_user_id = UUID(user_context["user_id"])
            current_user_role = user_context.get("user_role")

            # Get and validate generation session
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            session = await generation_orm_service.get_by_id(request.session_id)

            if not session:
                raise ValueError(f"Generation session not found: {request.session_id}")

            # Validate permissions and session state
            await self._validate_activity_creation_permissions(
                current_user_id, current_user_role, session
            )
            await self._validate_session_for_activity_creation(session)

            # Validate and extract generated content
            nlj_data, quality_score, validation_warnings = await self._extract_and_validate_nlj_data(session)

            # Create content activity
            activity = await self._create_content_activity(
                request, session, nlj_data, current_user_id, user_context
            )

            # Update generation session with activity link
            await self._link_session_to_activity(session.id, activity.id)

            # Create response
            session_schema = GenerationSessionServiceSchema.from_orm_model(session)
            
            response = CreateActivityFromGenerationResponse(
                activity=activity,
                source_session=session_schema,
                creation_successful=True,
                generation_data_quality=quality_score,
                validation_warnings=validation_warnings or []
            )

            # Publish activity creation events
            try:
                await self._publish_activity_creation_events(request, user_context, response)
            except Exception as e:
                logger.warning(f"Failed to publish activity creation events: {e}")

            logger.info(
                f"Activity created from generation: session {request.session_id} -> activity {activity.id}, "
                f"quality: {quality_score}, by user {current_user_id}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"create activity from generation {request.session_id}")
            raise
        except Exception as e:
            await self._handle_service_error(e, f"create activity from generation {request.session_id}")
            raise

    async def _validate_activity_creation_permissions(
        self,
        current_user_id: UUID,
        current_user_role: Optional[UserRole],
        session
    ) -> None:
        """Validate user has permission to create activity from this session."""
        # Users can create activities from their own sessions
        if hasattr(session, 'user_id') and session.user_id == current_user_id:
            return

        # Admins can create activities from any session
        if current_user_role == UserRole.ADMIN:
            return

        raise PermissionError("Not authorized to create activity from this generation session")

    async def _validate_session_for_activity_creation(self, session) -> None:
        """Validate session is in a state suitable for activity creation."""
        if session.status != GenerationStatus.COMPLETED:
            status_str = session.status.value if hasattr(session.status, 'value') else str(session.status)
            raise ValueError(f"Cannot create activity from session with status '{status_str}'. Only completed sessions are supported.")

        if not hasattr(session, 'generated_content') or not session.generated_content:
            raise ValueError("Generation session has no generated content available for activity creation")

    async def _extract_and_validate_nlj_data(self, session) -> tuple[Dict[str, Any], str, list[str]]:
        """Extract and validate NLJ data from generation session."""
        generated_content = session.generated_content
        validation_warnings = []

        # Basic validation of NLJ structure
        if not isinstance(generated_content, dict):
            raise ValueError("Generated content is not in expected dictionary format")

        # Check for required NLJ components
        required_fields = ['nodes', 'edges']
        for field in required_fields:
            if field not in generated_content:
                raise ValueError(f"Generated content missing required field: {field}")

        # Validate nodes structure
        nodes = generated_content.get('nodes', [])
        if not isinstance(nodes, list) or len(nodes) == 0:
            raise ValueError("Generated content has no valid nodes")

        # Quality assessment
        quality_score = self._assess_content_quality(generated_content, validation_warnings)

        # Ensure metadata exists
        if 'metadata' not in generated_content:
            generated_content['metadata'] = {}
            validation_warnings.append("Added missing metadata section")

        # Add generation attribution
        generated_content['metadata']['generated_from_session'] = str(session.id)
        generated_content['metadata']['generation_timestamp'] = session.created_at.isoformat() if session.created_at else datetime.now().isoformat()

        return generated_content, quality_score, validation_warnings

    def _assess_content_quality(self, nlj_data: Dict[str, Any], warnings: list[str]) -> str:
        """Assess quality of generated NLJ content."""
        score_points = 0
        max_points = 10

        nodes = nlj_data.get('nodes', [])
        edges = nlj_data.get('edges', [])

        # Node quality checks
        if len(nodes) >= 3:
            score_points += 2
        elif len(nodes) >= 1:
            score_points += 1
            warnings.append("Content has fewer than 3 nodes")

        # Edge quality checks
        if len(edges) >= len(nodes) - 1:  # Minimum connected graph
            score_points += 2
        else:
            score_points += 1
            warnings.append("Content may not be fully connected")

        # Content richness checks
        node_with_content = any(
            node.get('content') and len(str(node.get('content', ''))) > 50 
            for node in nodes if isinstance(node, dict)
        )
        if node_with_content:
            score_points += 2
        else:
            warnings.append("Nodes have limited content")

        # Metadata completeness
        metadata = nlj_data.get('metadata', {})
        if isinstance(metadata, dict) and len(metadata) > 1:
            score_points += 2
        else:
            warnings.append("Limited metadata available")

        # Structure validation
        valid_structure = all(
            isinstance(node, dict) and 'id' in node 
            for node in nodes
        )
        if valid_structure:
            score_points += 2
        else:
            warnings.append("Some nodes have invalid structure")

        # Quality scoring
        if score_points >= 9:
            return "excellent"
        elif score_points >= 7:
            return "good"
        elif score_points >= 5:
            return "acceptable"
        else:
            return "poor"

    async def _create_content_activity(
        self,
        request: CreateActivityFromGenerationRequest,
        session,
        nlj_data: Dict[str, Any],
        creator_id: UUID,
        user_context: Dict[str, Any]
    ) -> ContentServiceSchema:
        """Create the content activity from validated NLJ data."""
        content_orm_service = self.dependencies["content_orm_service"]

        # Determine content type
        content_type = request.override_content_type or "TRAINING"  # Default to training

        # Enhanced metadata if requested
        enhanced_metadata = {}
        if request.add_generation_metadata:
            enhanced_metadata = {
                'generation_session_id': str(session.id),
                'generated_at': datetime.now().isoformat(),
                'generation_model': getattr(session, 'model', 'unknown'),
                'generation_config': getattr(session, 'prompt_config', {}),
                'ai_generated': True
            }

        # Merge metadata
        if 'metadata' not in nlj_data:
            nlj_data['metadata'] = {}
        nlj_data['metadata'].update(enhanced_metadata)

        # Create activity through content ORM service
        activity = await content_orm_service.create_content(
            title=request.activity_title,
            description=request.activity_description or f"Generated from session {session.id}",
            content_type=content_type,
            creator_id=creator_id,
            nlj_data=nlj_data
        )

        await self.session.commit()
        return ContentServiceSchema.from_orm_model(activity)

    async def _link_session_to_activity(self, session_id: UUID, activity_id: UUID) -> None:
        """Update generation session with link to created activity."""
        try:
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            await generation_orm_service.update_session_metadata(
                session_id,
                {'created_activity_id': str(activity_id)}
            )
        except Exception as e:
            logger.warning(f"Failed to link session {session_id} to activity {activity_id}: {e}")

    async def _publish_activity_creation_events(
        self,
        request: CreateActivityFromGenerationRequest,
        user_context: Dict[str, Any],
        response: CreateActivityFromGenerationResponse
    ) -> None:
        """Publish activity creation and generation conversion events."""
        actor_info = self._extract_user_info(user_context)

        # Activity created from generation event
        await self._publish_event(
            "publish_activity_created_from_generation",
            activity_id=str(response.activity.id),
            source_session_id=str(request.session_id),
            creator_user_id=actor_info["user_id"],
            creator_name=actor_info["user_name"],
            creator_email=actor_info["user_email"],
            creation_timestamp=datetime.now().isoformat(),
            activity_title=request.activity_title,
            content_type=response.activity.content_type,
            data_quality=response.generation_data_quality,
            validation_warnings_count=len(response.validation_warnings),
            has_generation_metadata=request.add_generation_metadata
        )

        # Generation conversion event
        await self._publish_event(
            "publish_generation_converted_to_activity",
            session_id=str(request.session_id),
            activity_id=str(response.activity.id),
            converter_user_id=actor_info["user_id"],
            converter_name=actor_info["user_name"],
            conversion_timestamp=datetime.now().isoformat(),
            conversion_quality=response.generation_data_quality,
            content_nodes_count=len(response.source_session.generated_content.get('nodes', [])) if response.source_session.generated_content else 0
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