"""
Generate Content Use Case - AI Content Generation Business Workflow.

Handles AI-powered content generation including:
- Source document selection and validation
- Prompt configuration and validation
- Generation session creation and management
- Progress tracking and status updates
- Generated content creation from AI results
- Integration with existing Content Studio workflow
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generation_session import GenerationStatus
from app.models.user import UserRole
from app.schemas.services.content_schemas import ContentServiceSchema
from app.schemas.services.generation_schemas import GenerationSessionServiceSchema
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class GenerateContentRequest:
    """Request object for AI content generation."""
    source_document_ids: List[UUID]
    prompt_config: Dict[str, Any]
    generation_type: str = "scenario"
    activity_name: Optional[str] = None
    activity_description: Optional[str] = None
    auto_create_content: bool = True


@dataclass
class GenerateContentResponse:
    """Response object for AI content generation."""
    generation_session: GenerationSessionServiceSchema
    content: Optional[ContentServiceSchema] = None
    generation_started: bool = False


class GenerateContentUseCase(BaseUseCase[GenerateContentRequest, GenerateContentResponse]):
    """
    Use case for AI-powered content generation with comprehensive workflow management.

    Responsibilities:
    - Validate user has content generation permissions
    - Validate source documents exist and are accessible
    - Create generation session with proper configuration
    - Start generation process with progress tracking
    - Create content from successful generation results
    - Handle generation failures and error recovery
    - Publish generation lifecycle events

    Events Published:
    - Generation requested events
    - Generation started events
    - Generation progress events
    - Generation completed events
    - Generation failed events
    - Content creation events (if auto-create enabled)
    """

    def __init__(
        self,
        session: AsyncSession,
        generation_session_orm_service: GenerationSessionOrmService,
        source_document_orm_service: SourceDocumentOrmService,
        content_orm_service: ContentOrmService
    ):
        """
        Initialize generate content use case.

        Args:
            session: Database session for transaction management
            generation_session_orm_service: Generation session management
            source_document_orm_service: Source document operations
            content_orm_service: Content creation for generated results
        """
        super().__init__(
            session,
            generation_session_orm_service=generation_session_orm_service,
            source_document_orm_service=source_document_orm_service,
            content_orm_service=content_orm_service
        )

    async def execute(
        self,
        request: GenerateContentRequest,
        user_context: Dict[str, Any]
    ) -> GenerateContentResponse:
        """
        Execute AI content generation workflow.

        Args:
            request: Generation request with source docs and config
            user_context: User context for permissions and events

        Returns:
            Generation response with session info and optional content

        Raises:
            PermissionError: If user lacks generation permissions
            ValueError: If generation request validation fails
            RuntimeError: If generation workflow fails
        """
        try:
            # 1. Validate permissions
            await self._validate_generation_permissions(user_context)

            # 2. Validate source documents
            await self._validate_source_documents(
                request.source_document_ids, user_context
            )

            # 3. Validate and process prompt configuration
            validated_config = await self._validate_prompt_config(request.prompt_config)

            # 4. Create generation session
            generation_session = await self._create_generation_session(
                request, validated_config, user_context
            )

            # 5. Publish generation requested event
            await self._publish_generation_requested_event(
                generation_session, request, user_context
            )

            # 6. Start generation process (this would typically be async)
            generation_started = await self._start_generation_process(
                generation_session, user_context
            )

            # 7. Create content if generation completed immediately (rare)
            content = None
            if (generation_session.status == GenerationStatus.COMPLETED and 
                request.auto_create_content):
                content = await self._create_content_from_generation(
                    generation_session, request, user_context
                )

            # 8. Create response
            response = GenerateContentResponse(
                generation_session=GenerationSessionServiceSchema.from_orm_model(
                    generation_session
                ),
                content=ContentServiceSchema.from_orm_model(content) if content else None,
                generation_started=generation_started
            )

            logger.info(
                f"Content generation initiated: session {generation_session.id}, "
                f"started: {generation_started}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, "content generation")
        except Exception as e:
            await self._handle_service_error(e, "content generation")

    async def _validate_generation_permissions(self, user_context: Dict[str, Any]) -> None:
        """Validate user has permissions to generate content."""
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to generate content"
        )

    async def _validate_source_documents(
        self, source_document_ids: List[UUID], user_context: Dict[str, Any]
    ) -> None:
        """Validate source documents exist and are accessible."""
        if not source_document_ids:
            raise ValueError("At least one source document is required for generation")

        try:
            document_orm_service = self.dependencies["source_document_orm_service"]
            
            # Check each document exists and user has access
            for doc_id in source_document_ids:
                document = await document_orm_service.get_by_id(doc_id)
                if not document:
                    raise ValueError(f"Source document not found: {doc_id}")
                
                # Validate document access permissions
                await self._validate_document_access(document, user_context)

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to validate source documents: {e}")
            raise RuntimeError(f"Source document validation failed: {str(e)}") from e

    async def _validate_document_access(self, document, user_context: Dict[str, Any]) -> None:
        """Validate user can access specific document."""
        user_id = UUID(user_context["user_id"])
        user_role = user_context.get("user_role")

        # Document owner has access
        if hasattr(document, 'user_id') and document.user_id == user_id:
            return

        # Reviewers and above can access any document
        if user_role in [UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]:
            return

        raise PermissionError(f"Insufficient permissions to access document {document.id}")

    async def _validate_prompt_config(self, prompt_config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and enhance prompt configuration."""
        if not prompt_config:
            raise ValueError("Prompt configuration is required")

        # Required fields validation
        required_fields = ["generated_prompt_text", "generation_type"]
        for field in required_fields:
            if field not in prompt_config:
                raise ValueError(f"Missing required prompt config field: {field}")

        # Default configuration enhancements
        validated_config = {
            **prompt_config,
            "model": prompt_config.get("model", "claude-3-haiku"),
            "max_tokens": prompt_config.get("max_tokens", 4000),
            "temperature": prompt_config.get("temperature", 0.7)
        }

        return validated_config

    async def _create_generation_session(
        self,
        request: GenerateContentRequest,
        validated_config: Dict[str, Any],
        user_context: Dict[str, Any]
    ):
        """Create generation session through ORM service."""
        try:
            generation_orm_service = self.dependencies["generation_session_orm_service"]
            user_id = UUID(user_context["user_id"])

            return await generation_orm_service.create_generation_session(
                user_id=user_id,
                session_type=request.generation_type,
                config=validated_config,
                source_document_ids=request.source_document_ids
            )

        except Exception as e:
            logger.error(f"Failed to create generation session: {e}")
            raise RuntimeError(f"Generation session creation failed: {str(e)}") from e

    async def _start_generation_process(
        self, generation_session, user_context: Dict[str, Any]
    ) -> bool:
        """
        Start the actual AI generation process.

        Note: In a real implementation, this would:
        1. Update session status to PROCESSING
        2. Queue background generation job
        3. Return immediately
        4. Background job would update progress and complete

        For now, we'll simulate the start process.
        """
        try:
            logger.info(f"🔄 Starting generation process for session {generation_session.id}")
            generation_orm_service = self.dependencies["generation_session_orm_service"]

            # Update session to processing status
            logger.info(f"📝 Updating session {generation_session.id} status to PROCESSING")
            updated_session = await generation_orm_service.update_session_status(
                generation_session.id, GenerationStatus.PROCESSING
            )
            logger.info(f"✅ Session status updated successfully")

            # Publish generation started event
            user_info = self._extract_user_info(user_context)
            logger.info(f"📡 Publishing generation started event:")
            logger.info(f"  - Session ID: {updated_session.id}")
            logger.info(f"  - User: {user_info['user_email']}")
            logger.info(f"  - Content type: {generation_session.prompt_config.get('generation_type', 'scenario')}")
            
            await self._publish_event(
                "publish_content_generation_started",
                session_id=str(updated_session.id),
                user_id=user_info["user_id"],
                user_email=user_info["user_email"],
                user_name=user_info["user_name"],
                content_type=generation_session.prompt_config.get("generation_type", "scenario"),
                session_title=f"Generation Session {updated_session.id}"
            )
            
            logger.info(f"✅ Generation started event published successfully")
            logger.info(f"🎯 FastStream consumer should now pick up this event and start Claude API generation")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to start generation process for session {generation_session.id}: {e}")
            logger.error(f"  - Error type: {type(e).__name__}")
            logger.error(f"  - Error details: {str(e)}")
            
            # Update session to failed status
            try:
                logger.info(f"🔄 Updating session {generation_session.id} to FAILED status due to start error")
                await generation_orm_service.update_session_status(
                    generation_session.id, GenerationStatus.FAILED
                )
                logger.info(f"✅ Session status updated to FAILED")
            except Exception as update_error:
                logger.error(f"❌ Failed to update session status to failed: {update_error}")

            return False

    async def _create_content_from_generation(
        self,
        generation_session,
        request: GenerateContentRequest,
        user_context: Dict[str, Any]
    ):
        """Create content from completed generation session."""
        try:
            # This would typically extract the generated NLJ data from the session
            # For now, we'll create a placeholder
            content_orm_service = self.dependencies["content_orm_service"]
            user_id = UUID(user_context["user_id"])

            # Extract generated data (would come from session results)
            generated_nlj_data = getattr(generation_session, 'generated_data', {
                "nodes": [],
                "edges": [],
                "metadata": {"generated": True}
            })

            return await content_orm_service.create_content(
                title=request.activity_name or f"Generated Content {generation_session.id}",
                description=request.activity_description or "AI-generated content",
                content_type="TRAINING",  # Default type
                creator_id=user_id,
                nlj_data=generated_nlj_data
            )

        except Exception as e:
            logger.error(f"Failed to create content from generation: {e}")
            raise RuntimeError(f"Content creation from generation failed: {str(e)}") from e

    async def _publish_generation_requested_event(
        self,
        generation_session,
        request: GenerateContentRequest,
        user_context: Dict[str, Any]
    ) -> None:
        """Publish generation requested event."""
        user_info = self._extract_user_info(user_context)

        logger.info(f"📡 Publishing generation requested event:")
        logger.info(f"  - Session ID: {generation_session.id}")
        logger.info(f"  - User: {user_info['user_email']} ({user_info['user_id']})")
        logger.info(f"  - Content type: {request.generation_type}")
        logger.info(f"  - Source documents: {len(request.source_document_ids)}")

        await self._publish_event(
            "publish_content_generation_requested",
            session_id=str(generation_session.id),
            user_id=user_info["user_id"],
            user_email=user_info["user_email"],
            user_name=user_info["user_name"],
            source_document_ids=[str(doc_id) for doc_id in request.source_document_ids],
            prompt_config=request.prompt_config,
            content_type=request.generation_type,
            session_title=request.activity_name or f"Generation Session {generation_session.id}"
        )
        
        logger.info(f"✅ Generation requested event published successfully")

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with generation-specific cleanup."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error