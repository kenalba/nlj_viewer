"""
Create Version Use Case - Content Versioning Workflow.

Handles the complete content version creation workflow including:
- Permission validation for version creation
- Version creation with proper numbering
- Workflow setup for approval process
- Event publishing for analytics
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.orm_services.workflow_orm_service import WorkflowOrmService
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase


@dataclass
class CreateVersionRequest:
    """Request object for creating a content version."""
    content_id: uuid.UUID
    title: str
    nlj_data: dict[str, object]
    description: str | None = None
    change_summary: str | None = None
    requires_approval: bool = True
    auto_publish: bool = False
    assigned_reviewer_id: uuid.UUID | None = None


@dataclass
class CreateVersionResponse:
    """Response object for version creation."""
    version_id: uuid.UUID
    version_number: int
    workflow_id: uuid.UUID | None
    requires_approval: bool
    current_state: str


class CreateVersionUseCase(BaseUseCase[CreateVersionRequest, CreateVersionResponse]):
    """
    Use case for creating content versions with approval workflows.
    
    Responsibilities:
    - Validate user has permission to create versions
    - Create new content version with incremented number
    - Set up approval workflow if required
    - Publish version creation events
    - Handle auto-publish logic for simple workflows
    """
    
    def __init__(
        self,
        session: AsyncSession,
        workflow_orm_service: WorkflowOrmService,
        content_orm_service: ContentOrmService,
        user_orm_service: UserOrmService
    ):
        super().__init__(session)
        self.workflow_service = workflow_orm_service
        self.content_service = content_orm_service
        self.user_service = user_orm_service

    async def execute(self, request: CreateVersionRequest) -> CreateVersionResponse:
        """Execute the create version workflow."""
        # Get current user from context
        current_user = await self.get_current_user()
        
        # Validate content exists and user has access
        content = await self.content_service.get_by_id(request.content_id)
        if not content:
            raise ValueError("Content not found")
        
        # Check version creation permissions
        await self._validate_version_permissions(current_user.id, content)
        
        # Create content version
        version = await self.workflow_service.create_content_version(
            content_id=request.content_id,
            created_by=current_user.id,
            title=request.title,
            nlj_data=request.nlj_data,
            description=request.description,
            change_summary=request.change_summary
        )
        
        # Create workflow if approval required
        workflow = None
        if request.requires_approval:
            workflow = await self.workflow_service.create_approval_workflow(
                content_version_id=version.id,
                requires_approval=True,
                auto_publish=request.auto_publish,
                assigned_reviewer_id=request.assigned_reviewer_id
            )
        
        # Publish version creation event
        await self.publish_event("content.version_created", {
            "content_id": str(request.content_id),
            "version_id": str(version.id),
            "version_number": version.version_number,
            "created_by": str(current_user.id),
            "requires_approval": request.requires_approval,
            "workflow_id": str(workflow.id) if workflow else None,
            "change_summary": request.change_summary
        })
        
        return CreateVersionResponse(
            version_id=version.id,
            version_number=version.version_number,
            workflow_id=workflow.id if workflow else None,
            requires_approval=request.requires_approval,
            current_state=workflow.current_state.value if workflow else "published"
        )

    async def _validate_version_permissions(self, user_id: uuid.UUID, content) -> None:
        """Validate user can create versions of the content."""
        # Content owner can always create versions
        if content.created_by == user_id:
            return
        
        # Get user for role check
        user = await self.user_service.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Admin and reviewers can create versions of any content
        if user.role in [UserRole.ADMIN, UserRole.REVIEWER]:
            return
        
        # Creators can create versions if they have general creation permissions
        if user.role == UserRole.CREATOR:
            return
        
        # Otherwise, no permission to create versions
        raise PermissionError("You don't have permission to create versions of this content")