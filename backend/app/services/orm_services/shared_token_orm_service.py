"""
Shared Token ORM Service - Clean Architecture Implementation.

Provides transaction-managed operations for shared token management.
Handles public content sharing, token validation, and analytics tracking.
"""

import uuid
from datetime import datetime, timezone

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
        max_views: int | None = None,
        is_password_protected: bool = False,
        password_hash: str | None = None,
        allow_anonymous: bool = True,
        metadata: dict[str, object] | None = None
    ) -> SharedToken:
        """Create a new shared token for content."""
        try:
            token = await self.repo.create_token(
                content_id=content_id,
                created_by=created_by,
                expires_at=expires_at,
                max_views=max_views,
                is_password_protected=is_password_protected,
                password_hash=password_hash,
                allow_anonymous=allow_anonymous,
                metadata=metadata
            )
            await self.commit()
            return token
        except Exception:
            await self.rollback()
            raise

    async def get_token_by_id(self, token_id: str) -> SharedToken | None:
        """Get shared token by token ID with relationships."""
        return await self.repo.get_by_token_id(token_id)

    async def validate_token_access(self, token_id: str) -> SharedToken | None:
        """Validate token and check all access constraints."""
        return await self.repo.validate_token_access(token_id)

    async def record_token_view(self, token_id: str) -> bool:
        """Record a view/access to the shared token."""
        try:
            success = await self.repo.increment_view_count(token_id)
            if success:
                await self.commit()
            return success
        except Exception:
            await self.rollback()
            return False

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
        try:
            success = await self.repo.deactivate_token(token_id)
            if success:
                await self.commit()
            return success
        except Exception:
            await self.rollback()
            return False

    async def get_token_analytics(self, token_id: str) -> dict[str, object] | None:
        """Get comprehensive analytics for a shared token."""
        return await self.repo.get_token_analytics(token_id)

    async def cleanup_expired_tokens(self) -> int:
        """Clean up expired tokens and return count of cleaned tokens."""
        try:
            count = await self.repo.cleanup_expired_tokens()
            await self.commit()
            return count
        except Exception:
            await self.rollback()
            return 0

    async def update_token_settings(
        self,
        token_id: str,
        expires_at: datetime | None = None,
        max_views: int | None = None,
        is_password_protected: bool | None = None,
        password_hash: str | None = None,
        allow_anonymous: bool | None = None,
        metadata: dict[str, object] | None = None
    ) -> SharedToken | None:
        """Update token settings."""
        try:
            token = await self.repo.get_by_token_id(token_id)
            if not token:
                return None
            
            # Update provided fields
            if expires_at is not None:
                token.expires_at = expires_at
            if max_views is not None:
                token.max_views = max_views
            if is_password_protected is not None:
                token.is_password_protected = is_password_protected
            if password_hash is not None:
                token.password_hash = password_hash
            if allow_anonymous is not None:
                token.allow_anonymous = allow_anonymous
            if metadata is not None:
                token.metadata = metadata
            
            token.updated_at = datetime.now(timezone.utc)
            await self.commit()
            return token
        except Exception:
            await self.rollback()
            raise