"""
API endpoints for shared token management and public activity access.
Provides both authenticated endpoints for managing shares and public endpoints for accessing shared content.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database_manager import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.shared_token import (
    CreateShareRequest,
    CreateShareResponse,
    PublicActivityResponse,
    ShareAnalytics,
    SharedTokenCreate,
    SharedTokenResponse,
    SharedTokenUpdate,
)
from app.services.shared_token_service import SharedTokenService

# Two routers: one for authenticated sharing management, one for public access
auth_router = APIRouter(prefix="/content", tags=["sharing"])
public_router = APIRouter(prefix="/shared", tags=["public"])


def build_public_url(request: Request, token: str) -> str:
    """Build the public URL for a shared activity."""
    # Use configured frontend URL if available
    if settings.FRONTEND_URL:
        frontend_url = settings.FRONTEND_URL.rstrip("/")
        return f"{frontend_url}/shared/{token}"

    # Otherwise, derive from request
    base_url = str(request.base_url).rstrip("/")

    # In development, redirect to frontend port
    if "localhost:8000" in base_url:
        frontend_url = base_url.replace(":8000", ":5173")
    elif "127.0.0.1:8000" in base_url:
        frontend_url = base_url.replace(":8000", ":5173")
    else:
        # In production, assume frontend is served from same domain
        frontend_url = base_url

    return f"{frontend_url}/shared/{token}"


def token_to_response(token, request: Request) -> SharedTokenResponse:
    """Convert SharedToken model to response schema."""
    return SharedTokenResponse(
        id=token.id,
        content_id=token.content_id,
        token=token.token,
        created_by=token.created_by,
        created_at=token.created_at,
        expires_at=token.expires_at,
        is_active=token.is_active,
        access_count=token.access_count,
        last_accessed_at=token.last_accessed_at,
        description=token.description,
        is_expired=token.is_expired,
        is_valid=token.is_valid,
        public_url=build_public_url(request, token.token),
    )


# Authenticated endpoints for share management
@auth_router.post(
    "/{content_id}/share",
    response_model=CreateShareResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create public share",
    description="Create a public share token for published content. Only content creators and admins can create shares.",
)
async def create_share(
    content_id: uuid.UUID,
    share_request: CreateShareRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreateShareResponse:
    """Create a new public share for content."""

    service = SharedTokenService(db)

    try:
        token_data = SharedTokenCreate(description=share_request.description, expires_at=share_request.expires_at)

        token = await service.create_share_token(content_id=content_id, user_id=current_user.id, token_data=token_data)

        public_url = build_public_url(request, token.token)

        return CreateShareResponse(
            success=True,
            token=token_to_response(token, request),
            public_url=public_url,
            message="Share created successfully",
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create share")


@auth_router.get(
    "/{content_id}/shares",
    response_model=List[SharedTokenResponse],
    summary="Get content shares",
    description="Get all share tokens for a content item. Only accessible by content creators and admins.",
)
async def get_content_shares(
    content_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[SharedTokenResponse]:
    """Get all shares for a content item."""

    service = SharedTokenService(db)
    tokens = await service.get_content_shares(content_id)

    return [token_to_response(token, request) for token in tokens]


@auth_router.get(
    "/{content_id}/share-analytics",
    response_model=ShareAnalytics,
    summary="Get share analytics",
    description="Get analytics data for content sharing.",
)
async def get_share_analytics(
    content_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ShareAnalytics:
    """Get sharing analytics for content."""

    service = SharedTokenService(db)
    return await service.get_share_analytics(content_id)


@auth_router.put(
    "/shares/{token_id}",
    response_model=SharedTokenResponse,
    summary="Update share token",
    description="Update a share token. Only the creator can update their shares.",
)
async def update_share_token(
    token_id: uuid.UUID,
    update_data: SharedTokenUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SharedTokenResponse:
    """Update an existing share token."""

    service = SharedTokenService(db)
    token = await service.update_share_token(token_id, current_user.id, update_data)

    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found or access denied")

    return token_to_response(token, request)


@auth_router.delete(
    "/shares/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke share token",
    description="Revoke a share token. Only the creator can revoke their shares.",
)
async def revoke_share_token(
    token_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Revoke a share token."""

    service = SharedTokenService(db)
    success = await service.revoke_share_token(token_id, current_user.id)

    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found or access denied")


@auth_router.get(
    "/my-shares",
    response_model=List[SharedTokenResponse],
    summary="Get user's shares",
    description="Get all share tokens created by the current user.",
)
async def get_user_shares(
    request: Request, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> List[SharedTokenResponse]:
    """Get all shares created by the current user."""

    service = SharedTokenService(db)
    tokens = await service.get_user_shares(current_user.id)

    return [token_to_response(token, request) for token in tokens]


# Public endpoints (no authentication required)
# Note: More specific routes MUST come before catch-all routes in FastAPI


# Health check endpoint for public access - MUST be before /{token}
@public_router.get("/health", summary="Health check", description="Public health check endpoint")
async def public_health_check():
    """Public health check for the sharing system."""
    return {"status": "healthy", "service": "public_sharing"}


@public_router.get(
    "/{token}",
    response_model=PublicActivityResponse,
    summary="Get shared activity",
    description="Get activity data via public share token. No authentication required.",
)
async def get_shared_activity(token: str, db: AsyncSession = Depends(get_db)) -> PublicActivityResponse:
    """Get activity data for public access via share token."""

    service = SharedTokenService(db)
    activity = await service.get_public_activity(token)

    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared activity not found or access expired")

    return activity


@public_router.post(
    "/{token}/complete",
    status_code=status.HTTP_200_OK,
    summary="Record completion",
    description="Record completion of a publicly accessed activity.",
)
async def record_public_completion(token: str, db: AsyncSession = Depends(get_db)):
    """Record completion for a publicly accessed activity."""

    service = SharedTokenService(db)
    success = await service.record_completion(token)

    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared activity not found or access expired")

    return {"message": "Completion recorded successfully"}
