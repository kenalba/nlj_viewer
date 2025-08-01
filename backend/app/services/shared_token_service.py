"""
Service layer for shared token management.
Handles creating, retrieving, and managing public activity shares.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.shared_token import SharedToken
from app.models.content import ContentItem, ContentState
from app.models.user import User
from app.schemas.shared_token import (
    SharedTokenCreate, 
    SharedTokenUpdate, 
    PublicActivityResponse,
    ShareAnalytics
)


class SharedTokenService:
    """Service for managing shared tokens and public activity access."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_share_token(
        self, 
        content_id: uuid.UUID, 
        user_id: uuid.UUID,
        token_data: SharedTokenCreate
    ) -> SharedToken:
        """Create a new share token for content."""
        
        # Verify content exists and can be shared
        result = await self.db.execute(
            select(ContentItem).where(ContentItem.id == content_id)
        )
        content = result.scalar_one_or_none()
        
        if not content:
            raise ValueError("Content not found")
        
        if not content.can_be_shared():
            raise ValueError("Content cannot be shared publicly")
        
        # Check if active share already exists
        existing_token = content.get_active_share_token()
        if existing_token:
            raise ValueError("Content already has an active share token")
        
        # Create new token
        token = SharedToken(
            content_id=content_id,
            created_by=user_id,
            description=token_data.description,
            expires_at=token_data.expires_at
        )
        
        self.db.add(token)
        await self.db.commit()
        await self.db.refresh(token)
        
        return token
    
    async def get_share_token(self, token_string: str) -> Optional[SharedToken]:
        """Get a share token by token string."""
        result = await self.db.execute(
            select(SharedToken)
            .options(selectinload(SharedToken.content))
            .where(SharedToken.token == token_string)
        )
        return result.scalar_one_or_none()
    
    async def get_public_activity(self, token_string: str) -> Optional[PublicActivityResponse]:
        """Get activity data for public access via share token."""
        
        # Get and validate token
        token = await self.get_share_token(token_string)
        if not token or not token.is_valid:
            return None
        
        # Get content with full data
        result = await self.db.execute(
            select(ContentItem)
            .where(ContentItem.id == token.content_id)
        )
        content = result.scalar_one_or_none()
        
        if not content or not content.can_be_shared():
            return None
        
        # Increment access count
        token.increment_access_count()
        content.increment_view_count()
        await self.db.commit()
        
        # Return sanitized public data
        return PublicActivityResponse(
            id=content.id,
            title=content.title,
            description=content.description,
            content_type=content.content_type if isinstance(content.content_type, str) else content.content_type.value,
            nlj_data=content.nlj_data,
            created_at=content.created_at,
            view_count=content.view_count,
            completion_count=content.completion_count
        )
    
    async def update_share_token(
        self, 
        token_id: uuid.UUID, 
        user_id: uuid.UUID,
        update_data: SharedTokenUpdate
    ) -> Optional[SharedToken]:
        """Update an existing share token."""
        
        result = await self.db.execute(
            select(SharedToken).where(
                and_(
                    SharedToken.id == token_id,
                    SharedToken.created_by == user_id
                )
            )
        )
        token = result.scalar_one_or_none()
        
        if not token:
            return None
        
        # Update fields
        if update_data.description is not None:
            token.description = update_data.description
        if update_data.expires_at is not None:
            token.expires_at = update_data.expires_at
        if update_data.is_active is not None:
            token.is_active = update_data.is_active
        
        await self.db.commit()
        await self.db.refresh(token)
        
        return token
    
    async def revoke_share_token(self, token_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Revoke a share token."""
        
        result = await self.db.execute(
            select(SharedToken).where(
                and_(
                    SharedToken.id == token_id,
                    SharedToken.created_by == user_id
                )
            )
        )
        token = result.scalar_one_or_none()
        
        if not token:
            return False
        
        token.revoke()
        await self.db.commit()
        
        return True
    
    async def get_content_shares(self, content_id: uuid.UUID) -> List[SharedToken]:
        """Get all share tokens for a content item."""
        
        result = await self.db.execute(
            select(SharedToken)
            .where(SharedToken.content_id == content_id)
            .order_by(SharedToken.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_user_shares(self, user_id: uuid.UUID) -> List[SharedToken]:
        """Get all share tokens created by a user."""
        
        result = await self.db.execute(
            select(SharedToken)
            .options(selectinload(SharedToken.content))
            .where(SharedToken.created_by == user_id)
            .order_by(SharedToken.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_share_analytics(self, content_id: uuid.UUID) -> ShareAnalytics:
        """Get analytics for content sharing."""
        
        # Count total shares
        shares_result = await self.db.execute(
            select(func.count(SharedToken.id))
            .where(SharedToken.content_id == content_id)
        )
        total_shares = shares_result.scalar() or 0
        
        # Sum public views (access_count from tokens)
        views_result = await self.db.execute(
            select(func.sum(SharedToken.access_count))
            .where(SharedToken.content_id == content_id)
        )
        total_public_views = views_result.scalar() or 0
        
        # Get most recent share and access times
        recent_share_result = await self.db.execute(
            select(SharedToken.created_at)
            .where(SharedToken.content_id == content_id)
            .order_by(SharedToken.created_at.desc())
            .limit(1)
        )
        last_shared_at = recent_share_result.scalar_one_or_none()
        
        recent_access_result = await self.db.execute(
            select(SharedToken.last_accessed_at)
            .where(
                and_(
                    SharedToken.content_id == content_id,
                    SharedToken.last_accessed_at.isnot(None)
                )
            )
            .order_by(SharedToken.last_accessed_at.desc())
            .limit(1)
        )
        most_recent_access = recent_access_result.scalar_one_or_none()
        
        return ShareAnalytics(
            total_shares=total_shares,
            total_public_views=total_public_views,
            total_public_completions=0,  # TODO: Add completion tracking
            last_shared_at=last_shared_at,
            most_recent_access=most_recent_access
        )
    
    async def record_completion(self, token_string: str) -> bool:
        """Record a completion for a publicly accessed activity."""
        
        token = await self.get_share_token(token_string)
        if not token or not token.is_valid:
            return False
        
        # Get content and increment completion count
        result = await self.db.execute(
            select(ContentItem)
            .where(ContentItem.id == token.content_id)
        )
        content = result.scalar_one_or_none()
        
        if content:
            content.increment_completion_count()
            await self.db.commit()
            return True
        
        return False
    
    async def cleanup_expired_tokens(self) -> int:
        """Clean up expired tokens (maintenance task)."""
        
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(SharedToken).where(
                and_(
                    SharedToken.expires_at < now,
                    SharedToken.is_active == True
                )
            )
        )
        expired_tokens = result.scalars().all()
        
        for token in expired_tokens:
            token.is_active = False
        
        if expired_tokens:
            await self.db.commit()
        
        return len(expired_tokens)