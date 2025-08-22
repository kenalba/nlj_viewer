"""
Shared Token ORM Service - Clean Architecture Implementation.

Provides transaction-managed operations for shared token management.
Handles public content sharing, token validation, and analytics tracking.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shared_token import SharedToken
from app.services.orm_repositories.shared_token_repository import SharedTokenRepository
from .base_orm_service import BaseOrmService


class SharedTokenOrmService(BaseOrmService[SharedToken, SharedTokenRepository]):
    """ORM service for shared token operations with transaction management."""

    def __init__(self, session: AsyncSession):
        repository = SharedTokenRepository(session)
        super().__init__(session, repository)
        self.repo = repository

    async def create_share_token(
        self,
        content_id: uuid.UUID,
        created_by: uuid.UUID,
        expires_at: datetime | None = None,
        description: str | None = None
    ) -> SharedToken:
        """Create a new shared token for content."""
        if description is None:
            description = f"Shared on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
            
        return await self.create(
            content_id=content_id,
            created_by=created_by,
            expires_at=expires_at,
            access_count=0,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            description=description
        )

    async def get_token_by_id(self, token_id: str) -> SharedToken | None:
        """Get shared token by token ID with relationships."""
        return await self.repo.get_by_token_id(token_id)

    async def validate_token_access(self, token_id: str) -> SharedToken | None:
        """Validate token and check all access constraints."""
        return await self.repo.validate_token_access(token_id)

    async def record_token_view(self, token_id: str) -> bool:
        """Record a view/access to the shared token."""
        return await self.repo.increment_view_count(token_id)

    async def get_user_tokens(
        self, 
        user_id: uuid.UUID,
        include_inactive: bool = False
    ) -> list[SharedToken]:
        """Get all tokens created by a specific user."""
        return await self.repo.get_user_tokens(user_id, include_inactive)

    async def get_content_token(self, content_id: uuid.UUID) -> SharedToken | None:
        """Get active shared token for specific content."""
        return await self.repo.get_active_token_by_content(content_id)

    async def deactivate_token(self, token_id: str) -> bool:
        """Deactivate a shared token."""
        return await self.repo.deactivate_token(token_id)

    async def get_token_analytics(self, token_id: str) -> dict[str, object] | None:
        """Get comprehensive analytics for a shared token."""
        return await self.repo.get_token_analytics(token_id)

    async def cleanup_expired_tokens(self) -> int:
        """Clean up expired tokens and return count of cleaned tokens."""
        return await self.repo.cleanup_expired_tokens()

    # Implementation of abstract methods from BaseOrmService
    async def validate_entity_data(self, **kwargs: Any) -> dict[str, Any]:
        """Validate shared token data before persistence."""
        # Basic validation for shared tokens
        validated_data = {}
        
        # Content or media ID is required
        if 'content_id' in kwargs and kwargs['content_id']:
            validated_data['content_id'] = kwargs['content_id']
        elif 'media_id' in kwargs and kwargs['media_id']:
            validated_data['media_id'] = kwargs['media_id']
        else:
            raise ValueError("Either content_id or media_id is required for shared token")
        
        # Creator is required
        if 'created_by' not in kwargs or not kwargs['created_by']:
            raise ValueError("created_by is required for shared token")
        validated_data['created_by'] = kwargs['created_by']
        
        # Optional fields that actually exist in the model
        for field in ['expires_at', 'is_active', 'access_count', 'created_at', 'description']:
            if field in kwargs:
                validated_data[field] = kwargs[field]
        
        return validated_data

    async def handle_entity_relationships(self, entity: SharedToken) -> SharedToken:
        """Handle shared token relationships after persistence."""
        # For shared tokens, we don't need complex relationship handling
        # The relationships (content, media, creator) are already handled by SQLAlchemy
        return entity

    async def update_token_settings(
        self,
        token_id: str,
        expires_at: datetime | None = None,
        description: str | None = None
    ) -> SharedToken | None:
        """Update token settings (only fields that exist in the model)."""
        token = await self.repo.get_by_token_id(token_id)
        if not token:
            return None
        
        # Build update data
        update_data: dict[str, Any] = {}
        if expires_at is not None:
            update_data['expires_at'] = expires_at
        if description is not None:
            update_data['description'] = description
        
        if update_data:
            # token.id is the actual UUID value, not the Column
            return await self.update_by_id(cast(uuid.UUID, token.id), **update_data)
        
        return token