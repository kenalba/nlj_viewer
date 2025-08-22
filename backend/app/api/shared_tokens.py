"""
API endpoints for shared token management and public activity access.
Clean Architecture implementation with Use Cases for all business logic.
"""

import uuid
from datetime import datetime
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import (
    get_current_user, get_create_share_use_case, get_access_shared_content_use_case
)
from app.core.user_context import extract_user_context
from app.core.database_manager import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.shared_token import SharedToken
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
            current_user_id=current_user.id,
            expires_at=request_data.expires_at,
            max_views=request_data.max_views,
            password=request_data.password,
            allow_anonymous=request_data.allow_anonymous,
            metadata=request_data.metadata
        )
        
        # Execute use case
        result = await create_share_use_case.execute(use_case_request, extract_user_context(current_user))
        
        # Build full share URL
        share_url = build_public_url(request, result.token_id)
        
        # Convert Use Case response to API response
        response = CreateShareResponse(
            token_id=result.token_id,
            share_url=share_url,
            expires_at=result.expires_at,
            max_views=result.max_views,
            is_password_protected=result.is_password_protected
        )
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Successfully created share: {response.token_id}")
        
        return response
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error in create_share: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {str(e)}")


def _token_to_share_response(token: SharedToken, request: Request) -> CreateShareResponse:
    """Convert SharedToken model to API response, auto-pulling model fields."""
    share_url = build_public_url(request, token.token_id)
    
    return CreateShareResponse(
        token_id=token.token_id,
        share_url=share_url,
        expires_at=cast(datetime | None, token.expires_at),
        max_views=getattr(token, 'max_views', None),
        is_password_protected=getattr(token, 'is_password_protected', False)
    )


@auth_router.get(
    "/{content_id}/shares",
    response_model=list[CreateShareResponse],
    summary="Get content shares",
    description="Get all share tokens for content."
)
async def get_content_shares(
    content_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[CreateShareResponse]:
    """Get all shares for content using existing ORM service with modern typing."""
    from app.services.orm_services.shared_token_orm_service import SharedTokenOrmService
    
    try:
        shared_token_service = SharedTokenOrmService(db)
        
        # Get user tokens for this content (using modern typing)
        user_tokens = await shared_token_service.get_user_tokens(current_user.id, include_inactive=False)
        content_tokens = [token for token in user_tokens if token.content_id == content_id]
        
        # Convert to response format using helper function
        return [_token_to_share_response(token, request) for token in content_tokens]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to get shares: {str(e)}"
        )


@auth_router.get(
    "/{content_id}/share",
    response_model=CreateShareResponse,
    summary="Get existing share",
    description="Get existing share token for content if one exists."
)
async def get_existing_share(
    content_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CreateShareResponse:
    """Get existing share for content with modern typing and auto-pulled model fields."""
    from app.services.orm_services.shared_token_orm_service import SharedTokenOrmService
    
    try:
        shared_token_service = SharedTokenOrmService(db)
        
        # Get active token for this content
        token = await shared_token_service.get_content_token(content_id)
        
        if not token:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="No share found for this content"
            )
        
        # Use helper function to convert model to response
        return _token_to_share_response(token, request)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to get share: {str(e)}"
        )


@auth_router.delete(
    "/shares/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke share",
    description="Revoke/deactivate a specific share token."
)
async def revoke_share(
    token_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> None:
    """Revoke public share token using existing ORM service."""
    from app.services.orm_services.shared_token_orm_service import SharedTokenOrmService
    
    try:
        shared_token_service = SharedTokenOrmService(db)
        
        # Deactivate the token
        success = await shared_token_service.deactivate_token(token_id)
        
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to revoke share: {str(e)}")


@auth_router.delete(
    "/{content_id}/share", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke content share",
    description="Revoke/deactivate the public share for content."
)
async def revoke_content_share(
    content_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> None:
    """Revoke public share for content."""
    from app.services.orm_services.shared_token_orm_service import SharedTokenOrmService
    
    try:
        shared_token_service = SharedTokenOrmService(db)
        
        # Get active token for this content
        token = await shared_token_service.get_content_token(content_id)
        
        if not token:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No share found for this content")
        
        # Deactivate the token
        success = await shared_token_service.deactivate_token(token.token_id)
        
        if not success:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to revoke share")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to revoke share: {str(e)}")


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
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Accessing shared content with token_id: {token_id}")
    
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
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error in public access endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {str(e)}")


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
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error in public access endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {str(e)}")


def _token_to_analytics(token: SharedToken | None) -> ShareAnalytics:
    """Convert SharedToken model to analytics response, auto-pulling model fields."""
    if not token:
        # Return empty analytics if no share exists
        return ShareAnalytics(
            token_id="",
            view_count=0,
            max_views=None,
            remaining_views=None,
            created_at=datetime.now(),
            last_accessed_at=None,
            expires_at=None,
            is_active=False
        )
    
    # Calculate remaining views using model fields directly
    remaining_views: int | None = None
    if hasattr(token, 'max_views') and token.max_views:
        remaining_views = max(0, token.max_views - token.access_count)
    
    return ShareAnalytics(
        token_id=token.token_id,
        view_count=cast(int, token.access_count),
        max_views=getattr(token, 'max_views', None),
        remaining_views=remaining_views,
        created_at=cast(datetime, token.created_at),
        last_accessed_at=cast(datetime | None, token.last_accessed_at),
        expires_at=cast(datetime | None, token.expires_at),
        is_active=cast(bool, token.is_active)
    )


@auth_router.get(
    "/{content_id}/share-analytics",
    response_model=ShareAnalytics,
    summary="Get share analytics",
    description="Get analytics data for content share."
)
async def get_share_analytics(
    content_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ShareAnalytics:
    """Get analytics for content share with modern typing and auto-pulled model fields."""
    from app.services.orm_services.shared_token_orm_service import SharedTokenOrmService
    
    try:
        shared_token_service = SharedTokenOrmService(db)
        
        # Get active token for this content
        token = await shared_token_service.get_content_token(content_id)
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Retrieved token for analytics: {token.token_id if token else 'None'}")
        
        # Use helper function to convert model to analytics response
        analytics_response = _token_to_analytics(token)
        logger.info(f"Analytics response: {analytics_response}")
        
        return analytics_response
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error in get_share_analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to get analytics: {str(e)}"
        )