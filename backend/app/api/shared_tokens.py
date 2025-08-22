"""
API endpoints for shared token management and public activity access.
Clean Architecture implementation with Use Cases for all business logic.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import (
    get_current_user, get_create_share_use_case, get_access_shared_content_use_case
)
from app.models.user import User
from app.services.use_cases.sharing.create_share_use_case import (
    CreateShareUseCase, CreateShareRequest as CreateShareUseCaseRequest
)
from app.services.use_cases.sharing.access_shared_content_use_case import (
    AccessSharedContentUseCase, AccessSharedContentRequest as AccessSharedContentUseCaseRequest
)

# Two routers: one for authenticated sharing management, one for public access
auth_router = APIRouter(prefix="/content", tags=["sharing"])
public_router = APIRouter(prefix="/shared", tags=["public"])


# API Request/Response schemas
class CreateShareRequest(BaseModel):
    """API request schema for creating a share."""
    expires_at: datetime | None = None
    max_views: int | None = None
    password: str | None = None
    allow_anonymous: bool = True
    metadata: dict[str, object] | None = None


class CreateShareResponse(BaseModel):
    """API response schema for share creation."""
    token_id: str
    share_url: str
    expires_at: datetime | None
    max_views: int | None
    is_password_protected: bool


class AccessSharedContentRequest(BaseModel):
    """API request schema for accessing shared content."""
    password: str | None = None


class AccessSharedContentResponse(BaseModel):
    """API response schema for shared content access."""
    content_id: str
    content_title: str
    content_data: dict[str, object]
    remaining_views: int | None
    creator_name: str
    metadata: dict[str, object]


class ShareAnalytics(BaseModel):
    """API response schema for share analytics."""
    token_id: str
    view_count: int
    max_views: int | None
    remaining_views: int | None
    created_at: datetime
    last_accessed_at: datetime | None
    expires_at: datetime | None
    is_active: bool


def build_public_url(request: Request, token_id: str) -> str:
    """Build the public URL for a shared activity."""
    # Use configured frontend URL if available
    if settings.FRONTEND_URL:
        frontend_url = settings.FRONTEND_URL.rstrip("/")
        return f"{frontend_url}/shared/{token_id}"

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

    return f"{frontend_url}/shared/{token_id}"


# Authenticated endpoints for share management
@auth_router.post(
    "/{content_id}/share",
    response_model=CreateShareResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create public share",
    description="Create a public share token for content. Uses Clean Architecture patterns."
)
async def create_share(
    content_id: uuid.UUID,
    request_data: CreateShareRequest,
    request: Request,
    create_share_use_case: CreateShareUseCase = Depends(get_create_share_use_case),
    current_user: User = Depends(get_current_user)
) -> CreateShareResponse:
    """Create a public share for content using Clean Architecture Use Case."""
    try:
        # Convert API request to Use Case request
        use_case_request = CreateShareUseCaseRequest(
            content_id=content_id,
            expires_at=request_data.expires_at,
            max_views=request_data.max_views,
            password=request_data.password,
            allow_anonymous=request_data.allow_anonymous,
            metadata=request_data.metadata
        )
        
        # Execute use case
        result = await create_share_use_case.execute(use_case_request)
        
        # Build full share URL
        share_url = build_public_url(request, result.token_id)
        
        # Convert Use Case response to API response
        return CreateShareResponse(
            token_id=result.token_id,
            share_url=share_url,
            expires_at=result.expires_at,
            max_views=result.max_views,
            is_password_protected=result.is_password_protected
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@auth_router.get(
    "/{content_id}/share",
    response_model=CreateShareResponse,
    summary="Get existing share",
    description="Get existing share token for content if one exists."
)
async def get_existing_share(
    content_id: uuid.UUID,
    request: Request,
    # TODO: Add get share use case when implemented
    current_user: User = Depends(get_current_user)
) -> CreateShareResponse:
    """Get existing share for content."""
    # Placeholder - would use a GetShareUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@auth_router.delete(
    "/{content_id}/share",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke share",
    description="Revoke/deactivate the public share for content."
)
async def revoke_share(
    content_id: uuid.UUID,
    # TODO: Add revoke share use case when implemented
    current_user: User = Depends(get_current_user)
):
    """Revoke public share for content."""
    # Placeholder - would use a RevokeShareUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


# Public endpoints for accessing shared content
@public_router.get(
    "/{token_id}",
    response_model=AccessSharedContentResponse,
    summary="Access shared content",
    description="Access content via public share token. No authentication required."
)
async def access_shared_content(
    token_id: str,
    request: Request,
    access_shared_content_use_case: AccessSharedContentUseCase = Depends(get_access_shared_content_use_case),
    password: str | None = None
) -> AccessSharedContentResponse:
    """Access shared content using public token."""
    try:
        # Get request metadata
        user_agent = request.headers.get("User-Agent")
        ip_address = request.client.host if request.client else None
        
        # Convert API request to Use Case request
        use_case_request = AccessSharedContentUseCaseRequest(
            token_id=token_id,
            password=password,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        # Execute use case
        result = await access_shared_content_use_case.execute(use_case_request)
        
        # Convert Use Case response to API response
        return AccessSharedContentResponse(
            content_id=result.content_id,
            content_title=result.content_title,
            content_data=result.content_data,
            remaining_views=result.remaining_views,
            creator_name=result.creator_name,
            metadata=result.metadata
        )
        
    except ValueError as e:
        if "password" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@public_router.post(
    "/{token_id}/access",
    response_model=AccessSharedContentResponse,
    summary="Access password-protected content",
    description="Access password-protected shared content."
)
async def access_protected_content(
    token_id: str,
    request_data: AccessSharedContentRequest,
    request: Request,
    access_shared_content_use_case: AccessSharedContentUseCase = Depends(get_access_shared_content_use_case)
) -> AccessSharedContentResponse:
    """Access password-protected shared content."""
    try:
        # Get request metadata
        user_agent = request.headers.get("User-Agent")
        ip_address = request.client.host if request.client else None
        
        # Convert API request to Use Case request
        use_case_request = AccessSharedContentUseCaseRequest(
            token_id=token_id,
            password=request_data.password,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        # Execute use case
        result = await access_shared_content_use_case.execute(use_case_request)
        
        # Convert Use Case response to API response
        return AccessSharedContentResponse(
            content_id=result.content_id,
            content_title=result.content_title,
            content_data=result.content_data,
            remaining_views=result.remaining_views,
            creator_name=result.creator_name,
            metadata=result.metadata
        )
        
    except ValueError as e:
        if "password" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@auth_router.get(
    "/{content_id}/share/analytics",
    response_model=ShareAnalytics,
    summary="Get share analytics",
    description="Get analytics data for content share."
)
async def get_share_analytics(
    content_id: uuid.UUID,
    # TODO: Add analytics use case when implemented
    current_user: User = Depends(get_current_user)
) -> ShareAnalytics:
    """Get analytics for content share."""
    # Placeholder - would use a GetShareAnalyticsUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")