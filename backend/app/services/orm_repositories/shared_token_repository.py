"""
Shared Token Repository - Data Access Layer.

Handles database operations for shared tokens and public content access.
Focuses on token management, validation, and analytics tracking.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.shared_token import SharedToken
from app.models.content import ContentItem
from app.models.user import User
from .base_repository import BaseRepository


class SharedTokenRepository(BaseRepository[SharedToken]):
    """Repository for shared token database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session)

    @property
    def model(self) -> type[SharedToken]:
        return SharedToken

    async def create_token(
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
        """Create a new shared token with specified parameters."""
        return await self.create(
            content_id=content_id,
            created_by=created_by,
            expires_at=expires_at,
            access_count=0,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            description=f"Shared on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        )

    async def get_by_token_id(self, token_id: str) -> SharedToken | None:
        """Get shared token by token ID with content and user relationships."""
        query = (
            select(SharedToken)
            .options(
                selectinload(SharedToken.content),
                selectinload(SharedToken.creator)
            )
            .where(SharedToken.token == token_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_active_token_by_content(
        self, 
        content_id: uuid.UUID
    ) -> SharedToken | None:
        """Get most recent active shared token for specific content."""
        query = (
            select(SharedToken)
            .options(selectinload(SharedToken.content))
            .where(
                and_(
                    SharedToken.content_id == content_id,
                    SharedToken.is_active == True
                )
            )
            .order_by(SharedToken.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_user_tokens(
        self, 
        user_id: uuid.UUID,
        include_inactive: bool = False
    ) -> list[SharedToken]:
        """Get all tokens created by a specific user."""
        conditions = [SharedToken.created_by == user_id]
        if not include_inactive:
            conditions.append(SharedToken.is_active == True)
        
        query = (
            select(SharedToken)
            .options(selectinload(SharedToken.content))
            .where(and_(*conditions))
            .order_by(desc(SharedToken.created_at))
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def validate_token_access(self, token_id: str) -> SharedToken | None:
        """Validate token and check access constraints."""
        token = await self.get_by_token_id(token_id)
        if not token or not token.is_active:
            return None
        
        # Check expiration
        if token.expires_at and token.expires_at < datetime.now(timezone.utc):
            return None
        
        # Check view limit
        if token.max_views and token.view_count >= token.max_views:
            return None
        
        return token

    async def increment_view_count(self, token_id: str) -> bool:
        """Increment view count for a token."""
        token = await self.get_by_token_id(token_id)
        if not token:
            return False
        
        token.view_count += 1
        token.last_accessed_at = datetime.now(timezone.utc)
        
        # Auto-deactivate if max views reached
        if token.max_views and token.view_count >= token.max_views:
            token.is_active = False
        
        await self.session.commit()
        return True

    async def deactivate_token(self, token_id: str) -> bool:
        """Deactivate a shared token."""
        token = await self.get_by_token_id(token_id)
        if not token:
            return False
        
        token.is_active = False
        await self.session.commit()
        return True

    async def get_token_analytics(self, token_id: str) -> dict[str, object] | None:
        """Get analytics data for a shared token."""
        token = await self.get_by_token_id(token_id)
        if not token:
            return None
        
        return {
            "token_id": token.token_id,
            "content_id": str(token.content_id),
            "view_count": token.view_count,
            "max_views": token.max_views,
            "created_at": token.created_at.isoformat(),
            "last_accessed_at": token.last_accessed_at.isoformat() if token.last_accessed_at else None,
            "expires_at": token.expires_at.isoformat() if token.expires_at else None,
            "is_active": token.is_active,
            "remaining_views": token.max_views - token.view_count if token.max_views else None
        }

    async def cleanup_expired_tokens(self) -> int:
        """Clean up expired and inactive tokens. Returns count of cleaned tokens."""
        current_time = datetime.now(timezone.utc)
        
        # Find expired tokens
        query = select(SharedToken).where(
            and_(
                SharedToken.expires_at < current_time,
                SharedToken.is_active == True
            )
        )
        result = await self.session.execute(query)
        expired_tokens = result.scalars().all()
        
        # Deactivate expired tokens
        count = 0
        for token in expired_tokens:
            token.is_active = False
            count += 1
        
        await self.session.commit()
        return count