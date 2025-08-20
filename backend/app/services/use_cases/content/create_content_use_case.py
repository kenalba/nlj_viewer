"""
Create Content Use Case - Content Creation Business Workflow.

Handles the complete content creation workflow including:
- Permission validation for content creation
- Business rule validation and data transformation
- Content creation via ORM service with transaction management
- Event publishing for analytics and audit trails
- Template management and categorization
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentType, LearningStyle
from app.models.user import UserRole
from app.schemas.services.content_schemas import (
    ContentCreateServiceSchema, 
    ContentServiceSchema
)
from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


@dataclass
class CreateContentRequest:
    """Request object for content creation use case."""
    title: str
    description: str
    content_type: ContentType
    learning_style: Optional[LearningStyle]
    nlj_data: Dict[str, Any]
    is_template: bool = False
    template_category: Optional[str] = None
    import_source: Optional[str] = None
    import_filename: Optional[str] = None


@dataclass 
class CreateContentResponse:
    """Response object for content creation use case."""
    content: ContentServiceSchema
    is_new_template: bool = False


class CreateContentUseCase(BaseUseCase[CreateContentRequest, CreateContentResponse]):
    """
    Use case for creating new content with comprehensive business workflow.
    
    Responsibilities:
    - Validate user has content creation permissions
    - Apply business validation rules for content data
    - Create content through ORM service with proper transaction management
    - Handle template creation and categorization logic
    - Publish content creation events for analytics
    - Manage import source tracking and metadata
    
    Events Published:
    - Content creation event with creator information
    - Import event if content was imported from external source
    - Template creation event if content is marked as template
    """
    
    def __init__(self, session: AsyncSession, content_orm_service: ContentOrmService):
        """
        Initialize create content use case.
        
        Args:
            session: Database session for transaction management
            content_orm_service: Content ORM service for data persistence
        """
        super().__init__(session, content_orm_service=content_orm_service)
    
    async def execute(
        self, 
        request: CreateContentRequest, 
        user_context: Dict[str, Any]
    ) -> CreateContentResponse:
        """
        Execute content creation workflow.
        
        Args:
            request: Content creation request with all necessary data
            user_context: User context for permissions and event publishing
            
        Returns:
            Content creation response with created content and metadata
            
        Raises:
            PermissionError: If user lacks content creation permissions
            ValueError: If content data validation fails
            RuntimeError: If content creation fails
        """
        try:
            # 1. Validate permissions
            await self._validate_create_permissions(user_context)
            
            # 2. Extract user information
            user_info = self._extract_user_info(user_context)
            user_id = UUID(user_info["user_id"])
            
            # 3. Apply business validation and create service schema
            service_data = await self._create_service_schema(request, user_id)
            
            # 4. Create content via ORM service
            content = await self._create_content(service_data)
            
            # 5. Convert to service response schema
            content_schema = ContentServiceSchema.from_orm_model(content)
            
            # 6. Publish events
            await self._publish_creation_events(request, content, user_info)
            
            # 7. Return response
            response = CreateContentResponse(
                content=content_schema,
                is_new_template=request.is_template
            )
            
            logger.info(f"Content created successfully: {content.id} by user {user_id}")
            return response
            
        except PermissionError:
            # Re-raise permission errors as-is
            raise
        except ValueError as e:
            # Handle validation errors
            self._handle_validation_error(e, "content creation")
        except Exception as e:
            # Handle service errors
            await self._handle_service_error(e, "content creation")
    
    async def _validate_create_permissions(self, user_context: Dict[str, Any]) -> None:
        """Validate user has permissions to create content."""
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to create content"
        )
    
    async def _create_service_schema(
        self, 
        request: CreateContentRequest, 
        user_id: UUID
    ) -> ContentCreateServiceSchema:
        """
        Create and validate service schema from request data.
        
        Args:
            request: Content creation request
            user_id: Creating user ID
            
        Returns:
            Validated content creation service schema
            
        Raises:
            ValueError: If validation fails
        """
        try:
            # Apply business rules for template categorization
            template_category = request.template_category
            if request.is_template and not template_category:
                # Auto-categorize based on content type if not specified
                template_category = self._auto_categorize_template(request.content_type)
            
            # Create service schema with validation
            return ContentCreateServiceSchema(
                title=request.title.strip(),
                description=request.description.strip() if request.description else None,
                content_type=request.content_type,
                learning_style=request.learning_style,
                nlj_data=request.nlj_data,
                is_template=request.is_template,
                template_category=template_category,
                created_by=user_id
            )
        except Exception as e:
            raise ValueError(f"Content data validation failed: {str(e)}") from e
    
    def _auto_categorize_template(self, content_type: ContentType) -> str:
        """Auto-categorize template based on content type."""
        category_mapping = {
            ContentType.TRAINING: "Training Templates",
            ContentType.SURVEY: "Survey Templates", 
            ContentType.ASSESSMENT: "Assessment Templates",
            ContentType.GAME: "Interactive Game Templates",
            ContentType.MIXED: "Multi-Purpose Templates"
        }
        return category_mapping.get(content_type, "General Templates")
    
    async def _create_content(self, service_data: ContentCreateServiceSchema):
        """Create content through ORM service with error handling."""
        try:
            content_orm_service = self.dependencies["content_orm_service"]
            return await content_orm_service.create_content(
                title=service_data.title,
                description=service_data.description,
                content_type=service_data.content_type,
                learning_style=service_data.learning_style,
                creator_id=service_data.created_by,
                nlj_data=service_data.nlj_data,
                is_template=service_data.is_template,
                template_category=service_data.template_category
            )
        except Exception as e:
            logger.error(f"Failed to create content through ORM service: {e}")
            raise RuntimeError(f"Content creation failed: {str(e)}") from e
    
    async def _publish_creation_events(
        self,
        request: CreateContentRequest,
        content,
        user_info: Dict[str, str]
    ) -> None:
        """Publish events for content creation, imports, and templates."""
        
        # 1. Publish basic content creation event
        await self._publish_event(
            "publish_content_created",
            content_id=str(content.id),
            content_title=content.title,
            content_type=request.content_type.value,
            creator_id=user_info["user_id"],
            creator_name=user_info["user_name"],
            creator_email=user_info["user_email"],
            is_template=request.is_template,
            template_category=request.template_category
        )
        
        # 2. Publish import event if content was imported
        if request.import_source:
            await self._publish_event(
                "publish_content_generation_imported",
                session_id=str(content.id),  # Use content ID as session ID for imports
                user_id=user_info["user_id"],
                user_email=user_info["user_email"],
                user_name=user_info["user_name"],
                import_source=request.import_source,
                import_description=f"Imported content from {request.import_source}",
                original_filename=request.import_filename,
                session_title=content.title
            )
        
        # 3. Publish template creation event if this is a new template
        if request.is_template:
            await self._publish_event(
                "publish_template_created",
                template_id=str(content.id),
                template_title=content.title,
                template_category=request.template_category or "General Templates",
                content_type=request.content_type.value,
                creator_id=user_info["user_id"],
                creator_name=user_info["user_name"],
                creator_email=user_info["user_email"]
            )
    
    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback and enhanced logging."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)
        
        # Ensure transaction rollback
        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")
            
        raise RuntimeError(error_msg) from error