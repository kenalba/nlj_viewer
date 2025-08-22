"""
Access Shared Content Use Case - Public Content Access Workflow.

Handles public access to shared content including:
- Token validation and access control
- Password verification for protected shares
- View count tracking and limits
- Event publishing for analytics
"""

import hashlib
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.orm_services.shared_token_orm_service import SharedTokenOrmService
from app.services.orm_services.content_orm_service import ContentOrmService
from ..base_use_case import BaseUseCase


@dataclass
class AccessSharedContentRequest:
    """Request object for accessing shared content."""
    token_id: str
    password: str | None = None
    user_agent: str | None = None
    ip_address: str | None = None


@dataclass
class AccessSharedContentResponse:
    """Response object for shared content access."""
    content_id: str
    content_title: str
    content_data: dict[str, object]
    remaining_views: int | None
    creator_name: str
    metadata: dict[str, object]


class AccessSharedContentUseCase(BaseUseCase[AccessSharedContentRequest, AccessSharedContentResponse]):
    """
    Use case for accessing shared content with validation.
    
    Responsibilities:
    - Validate share token and access constraints
    - Verify password for protected shares
    - Track view counts and enforce limits
    - Publish access events for analytics
    - Return content data for public viewing
    """
    
    def __init__(
        self,
        session: AsyncSession,
        shared_token_orm_service: SharedTokenOrmService,
        content_orm_service: ContentOrmService
    ):
        super().__init__(session)
        self.shared_token_service = shared_token_orm_service
        self.content_service = content_orm_service

    async def execute(self, request: AccessSharedContentRequest) -> AccessSharedContentResponse:
        """Execute the shared content access workflow."""
        # Validate token access
        token = await self.shared_token_service.validate_token_access(request.token_id)
        if not token:
            raise ValueError("Invalid or expired share link")
        
        # Verify password if required
        if token.is_password_protected:
            if not request.password:
                raise ValueError("Password required")
            
            password_hash = hashlib.pbkdf2_hmac(
                'sha256',
                request.password.encode('utf-8'),
                b'nlj_sharing_salt',
                100000
            ).hex()
            
            if password_hash != token.password_hash:
                raise ValueError("Invalid password")
        
        # Get content data
        content = await self.content_service.get_by_id(token.content_id)
        if not content:
            raise ValueError("Content not found")
        
        # Record the view
        await self.shared_token_service.record_token_view(request.token_id)
        
        # Calculate remaining views
        remaining_views = None
        if token.max_views:
            remaining_views = token.max_views - (token.view_count + 1)
        
        # Publish access event
        await self.publish_event("content.shared_accessed", {
            "token_id": request.token_id,
            "content_id": str(token.content_id),
            "user_agent": request.user_agent,
            "ip_address": request.ip_address,
            "remaining_views": remaining_views,
            "is_password_protected": token.is_password_protected
        })
        
        return AccessSharedContentResponse(
            content_id=str(content.id),
            content_title=content.title,
            content_data=content.nlj_data or {},
            remaining_views=remaining_views,
            creator_name=token.creator.full_name if token.creator else "Unknown",
            metadata=token.metadata or {}
        )