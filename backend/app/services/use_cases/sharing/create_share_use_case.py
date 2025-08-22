"""
Create Share Use Case - Content Sharing Workflow.

Handles the complete content sharing workflow including:
- Permission validation for content sharing
- Share token creation with access controls
- Event publishing for analytics and audit trails
"""

import uuid
import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.models.content import ContentItem
from app.services.orm_services.shared_token_orm_service import SharedTokenOrmService
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase


@dataclass
class CreateShareRequest:
    """Request object for creating a content share."""
    content_id: uuid.UUID
    current_user_id: uuid.UUID
    expires_at: datetime | None = None
    max_views: int | None = None
    password: str | None = None
    allow_anonymous: bool = True
    metadata: dict[str, object] | None = None


@dataclass
class CreateShareResponse:
    """Response object for share creation."""
    token_id: str
    share_url: str
    expires_at: datetime | None
    max_views: int | None
    is_password_protected: bool


class CreateShareUseCase(BaseUseCase[CreateShareRequest, CreateShareResponse]):
    """
    Use case for creating content shares with access controls.
    
    Responsibilities:
    - Validate user has permission to share content
    - Create secure share tokens with specified constraints
    - Hash passwords for protected shares
    - Publish sharing events for analytics
    - Generate shareable URLs
    """
    
    def __init__(
        self,
        session: AsyncSession,
        shared_token_orm_service: SharedTokenOrmService,
        content_orm_service: ContentOrmService,
        user_orm_service: UserOrmService
    ):
        super().__init__(session)
        self.shared_token_service = shared_token_orm_service
        self.content_service = content_orm_service
        self.user_service = user_orm_service

    async def execute(self, request: CreateShareRequest, user_context: dict[str, Any]) -> CreateShareResponse:
        """Execute the create share workflow."""
        # Get current user
        current_user = await self.user_service.get_by_id(request.current_user_id)
        if not current_user:
            raise ValueError("User not found")
        
        # Validate content exists and user has access
        content = await self.content_service.get_by_id(request.content_id)
        if not content:
            raise ValueError("Content not found")
        
        # Check sharing permissions
        await self._validate_sharing_permissions(current_user.id, content)
        
        # Hash password if provided
        password_hash = None
        if request.password:
            password_hash = hashlib.pbkdf2_hmac(
                'sha256',
                request.password.encode('utf-8'),
                b'nlj_sharing_salt',
                100000
            ).hex()
        
        # Create share token (only using supported fields)
        share_token = await self.shared_token_service.create_share_token(
            content_id=request.content_id,
            created_by=current_user.id,
            expires_at=request.expires_at
        )
        
        # Generate share URL
        share_url = f"/shared/{share_token.token_id}"
        
        # Publish sharing event
        await self._publish_event(
            "content.shared",
            content_id=str(request.content_id),
            token_id=share_token.token_id,
            created_by=str(current_user.id),
            expires_at=request.expires_at.isoformat() if request.expires_at else None,
            max_views=request.max_views,
            is_password_protected=bool(request.password),
            allow_anonymous=request.allow_anonymous
        )
        
        return CreateShareResponse(
            token_id=share_token.token_id,
            share_url=share_url,
            expires_at=request.expires_at,
            max_views=request.max_views,
            is_password_protected=bool(request.password)
        )

    async def _validate_sharing_permissions(self, user_id: uuid.UUID, content: ContentItem) -> None:
        """Validate user can share the content."""
        # Content owner can always share
        if content.created_by == user_id:
            return
        
        # Get user for role check
        user = await self.user_service.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Admin and reviewers can share any content
        if user.role in [UserRole.ADMIN, UserRole.REVIEWER]:
            return
        
        # Otherwise, no permission to share
        raise PermissionError("You don't have permission to share this content")