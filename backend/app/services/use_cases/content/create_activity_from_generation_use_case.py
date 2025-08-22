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
        """Extract JSON content from Claude response and validate NLJ structure."""
        generated_content = session.generated_content
        validation_warnings = []

        # Basic validation of generated content
        if not isinstance(generated_content, dict):
            raise ValueError("Generated content is not in expected dictionary format")

        # Extract NLJ data using multiple extraction strategies
        nlj_data = await self._extract_json_from_claude_response(generated_content)
        
        if not nlj_data:
            raise ValueError("Could not extract valid JSON from Claude response")

        # Perform comprehensive NLJ structure validation
        validation_errors = self._validate_nlj_structure(nlj_data)
        
        if validation_errors:
            error_message = f"Generated NLJ structure validation failed: {'; '.join(validation_errors)}"
            logger.error(f"❌ {error_message}")
            logger.error(f"  - Invalid NLJ data: {nlj_data}")
            raise ValueError(error_message)

        # Quality assessment
        quality_score = self._assess_content_quality(nlj_data, validation_warnings)

        # Ensure metadata exists
        if 'metadata' not in nlj_data:
            nlj_data['metadata'] = {}
            validation_warnings.append("Added missing metadata section")

        # Add generation attribution
        nlj_data['metadata']['generated_from_session'] = str(session.id)
        nlj_data['metadata']['generation_timestamp'] = session.created_at.isoformat() if session.created_at else datetime.now().isoformat()

        return nlj_data, quality_score, validation_warnings

    async def _extract_json_from_claude_response(self, generated_content: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract NLJ JSON from the session's generated content."""
        logger.info(f"🔍 Extracting NLJ JSON from session generated content")
        logger.info(f"  - Generated content type: {type(generated_content)}")
        
        # Use the same extraction logic as GenerationStatusUseCase for consistency
        if isinstance(generated_content, dict):
            logger.info(f"  - Generated content keys: {list(generated_content.keys())}")
            
            # Check if it has the expected structure from the handler (wrapper format)
            if 'generated_json' in generated_content:
                extracted_content = generated_content['generated_json']
                logger.info(f"  - Using generated_json field")
                logger.info(f"  - Generated JSON type: {type(extracted_content)}")
                return extracted_content
            
            # Check if it looks like direct NLJ data (new handler format)
            elif self._is_valid_nlj_structure(generated_content):
                logger.info(f"✅ Generated content is direct NLJ structure")
                return generated_content
            
            else:
                logger.warning(f"⚠️ Generated content doesn't look like NLJ structure")
                # Check if it might be the old wrapper format (fallback)
                if "raw_response" in generated_content:
                    logger.info(f"🔄 Fallback: Found raw_response in wrapper, extracting JSON")
                    import json
                    try:
                        response_text = generated_content["raw_response"]
                        parsed = json.loads(response_text.strip())
                        if isinstance(parsed, dict):
                            logger.info(f"✅ Successfully parsed raw_response as fallback")
                            return parsed
                    except json.JSONDecodeError as e:
                        logger.error(f"❌ Failed to parse raw_response as fallback: {e}")
                
                # Return as-is if it contains some data
                if generated_content:
                    logger.info(f"📦 Using generated_content as-is")
                    return generated_content

        logger.error(f"❌ Cannot extract NLJ JSON from generated content")
        return None

    def _is_valid_nlj_structure(self, data: Dict[str, Any]) -> bool:
        """Quick check if data looks like a valid NLJ structure."""
        if not isinstance(data, dict):
            return False
        
        # Basic NLJ structure indicators
        has_nodes = "nodes" in data and isinstance(data["nodes"], list)
        has_links = "links" in data and isinstance(data["links"], list)
        has_name = "name" in data
        
        return has_nodes or has_links or has_name

    def _validate_nlj_structure(self, nlj_data: Dict[str, Any]) -> list[str]:
        """Validate NLJ structure and return list of validation errors."""
        validation_errors = []
        
        if not isinstance(nlj_data, dict):
            validation_errors.append("NLJ data must be a dictionary")
            return validation_errors
        
        # Required fields validation
        required_fields = ["name", "nodes", "links"]
        for field in required_fields:
            if field not in nlj_data:
                validation_errors.append(f"Missing required field: {field}")
        
        # Structure validation
        if "nodes" in nlj_data:
            if not isinstance(nlj_data["nodes"], list):
                validation_errors.append("'nodes' must be an array")
            elif len(nlj_data["nodes"]) == 0:
                validation_errors.append("'nodes' array cannot be empty")
            else:
                # Validate required node types
                node_types = [node.get("type") for node in nlj_data["nodes"] if isinstance(node, dict)]
                if "start" not in node_types:
                    validation_errors.append("NLJ must contain a 'start' node")
                if "end" not in node_types:
                    validation_errors.append("NLJ must contain an 'end' node")
        
        if "links" in nlj_data and not isinstance(nlj_data["links"], list):
            validation_errors.append("'links' must be an array")
        
        return validation_errors

    def _assess_content_quality(self, nlj_data: Dict[str, Any], warnings: list[str]) -> str:
        """Assess quality of generated content (may be raw JSON or NLJ structure)."""
        score_points = 0
        max_points = 10

        # Basic JSON validity (already checked, but counts towards score)
        score_points += 2  # Valid JSON structure

        # Check if it's NLJ-structured content
        nodes = nlj_data.get('nodes', [])
        edges = nlj_data.get('edges', [])
        
        if isinstance(nodes, list) and isinstance(edges, list):
            # NLJ-structured content assessment
            if len(nodes) >= 3:
                score_points += 2
            elif len(nodes) >= 1:
                score_points += 1
                warnings.append("Content has fewer than 3 nodes")

            if len(edges) >= len(nodes) - 1 and len(nodes) > 0:  # Minimum connected graph
                score_points += 2
            elif len(nodes) > 0:
                score_points += 1
                warnings.append("Content may not be fully connected")

            # Content richness in nodes
            node_with_content = any(
                node.get('content') and len(str(node.get('content', ''))) > 50 
                for node in nodes if isinstance(node, dict)
            )
            if node_with_content:
                score_points += 2
            elif len(nodes) == 0:
                warnings.append("Raw JSON content - no interactive nodes detected")
            else:
                warnings.append("Nodes have limited content")
        else:
            # Raw JSON content assessment
            content_size = len(str(nlj_data))
            if content_size > 500:
                score_points += 2
                warnings.append("Rich raw JSON content detected")
            elif content_size > 100:
                score_points += 1
                warnings.append("Moderate raw JSON content detected")
            else:
                warnings.append("Limited raw JSON content")

        # General metadata/structure completeness
        if len(nlj_data) > 2:  # More than just basic structure
            score_points += 2
        else:
            warnings.append("Limited content structure")

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
        content_type = request.override_content_type or "training"  # Default to training

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