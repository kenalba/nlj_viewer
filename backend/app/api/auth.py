"""
Authentication API endpoints.
Handles user registration, login, and token management.
"""

from datetime import datetime, timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database_manager import get_db
from app.core.deps import get_current_user, get_authenticate_user_use_case, get_manage_profile_use_case
from app.core.security import create_access_token
from app.core.user_context import extract_user_context
from app.models.user import User
from app.schemas.user import LoginRequest, PasswordChangeRequest, TokenResponse, UserCreate, UserResponse
from app.services.use_cases.user_management.authenticate_user_use_case import (
    AuthenticateUserUseCase, AuthenticateUserRequest, AuthenticationMethod
)
from app.services.use_cases.user_management.manage_profile_use_case import (
    ManageProfileUseCase, ManageProfileRequest, ProfileAction
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest, 
    authenticate_user_use_case: AuthenticateUserUseCase = Depends(get_authenticate_user_use_case)
) -> TokenResponse:
    """
    User login endpoint.

    Authenticates user with username/email and password,
    returns JWT access token using Clean Architecture.
    """
    # Convert API schema to use case request
    auth_request = AuthenticateUserRequest(
        authentication_method=AuthenticationMethod.EMAIL_PASSWORD,
        email=login_data.username,  # Can be username or email
        password=login_data.password
    )
    
    # Execute authentication use case
    try:
        auth_result = await authenticate_user_use_case.execute(
            auth_request, 
            {}  # Empty user context for login
        )
        
        # Check authentication status
        if not auth_result.access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Extract user data from authentication result
        auth_data = auth_result.authentication
        
        return TokenResponse(
            access_token=auth_result.access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse(
                id=auth_data["user_id"],
                username=auth_data.get("username", ""),
                email=auth_data.get("email", ""),
                full_name=auth_data.get("full_name"),
                role=auth_data.get("role", "PLAYER"),
                is_active=auth_data.get("is_active", True),
                is_verified=auth_data.get("is_verified", False),
                created_at=datetime.fromisoformat(auth_data["created_at"]) if auth_data.get("created_at") else datetime.now(),
                updated_at=datetime.fromisoformat(auth_data["updated_at"]) if auth_data.get("updated_at") else datetime.now(),
                last_login=datetime.fromisoformat(auth_data["last_login"]) if auth_data.get("last_login") else None
            )
        )
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


@router.post("/register", response_model=UserResponse)
async def register(
    user_create: UserCreate, 
    manage_profile_use_case: ManageProfileUseCase = Depends(get_manage_profile_use_case)
) -> UserResponse:
    """
    User registration endpoint.

    Creates a new user account if registration is enabled using Clean Architecture.
    """
    if not settings.ENABLE_REGISTRATION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is currently disabled")

    # Convert API schema to use case request
    create_request = ManageProfileRequest(
        action=ProfileAction.CREATE_USER,
        username=user_create.username,
        email=user_create.email,
        password=user_create.password,
        full_name=user_create.full_name,
        role=user_create.role
    )
    
    try:
        # Execute user creation use case
        result = await manage_profile_use_case.execute(
            create_request,
            {}  # Empty user context for registration
        )
        
        # Convert use case result to API response
        return UserResponse(
            id=result.user.id or uuid4(),  # Ensure ID is not None
            username=result.user.username,
            email=result.user.email,
            full_name=result.user.full_name,
            role=result.user.role,
            is_active=result.user.is_active,
            is_verified=result.user.is_verified,
            created_at=result.user.created_at or datetime.now(),
            updated_at=result.user.updated_at or datetime.now(),
            last_login=result.user.last_login
        )
        
    except ValueError as e:
        if "already exists" in str(e).lower():
            if "username" in str(e).lower():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
            elif "email" in str(e).lower():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration service error"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    """
    Get current user profile.

    Returns the authenticated user's profile information.
    """
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserCreate,  # Reuse UserCreate but ignore password and role
    current_user: Annotated[User, Depends(get_current_user)],
    manage_profile_use_case: ManageProfileUseCase = Depends(get_manage_profile_use_case)
) -> UserResponse:
    """
    Update current user profile.

    Allows users to update their own profile information using Clean Architecture.
    """
    # Convert API schema to use case request
    update_request = ManageProfileRequest(
        action=ProfileAction.UPDATE_INFO,
        user_id=current_user.id,
        username=user_update.username if user_update.username != current_user.username else None,
        email=user_update.email if user_update.email != current_user.email else None,
        full_name=user_update.full_name,
        # Don't allow users to change their own role for security
        role=None
    )
    
    try:
        # Execute profile update use case
        result = await manage_profile_use_case.execute(
            update_request,
            extract_user_context(current_user)
        )
        
        # Convert use case result to API response
        return UserResponse(
            id=result.user.id or uuid4(),  # Ensure ID is not None
            username=result.user.username,
            email=result.user.email,
            full_name=result.user.full_name,
            role=result.user.role,
            is_active=result.user.is_active,
            is_verified=result.user.is_verified,
            created_at=result.user.created_at or datetime.now(),
            updated_at=result.user.updated_at or datetime.now(),
            last_login=result.user.last_login
        )
        
    except ValueError as e:
        if "already exists" in str(e).lower() or "already taken" in str(e).lower():
            if "username" in str(e).lower():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
            elif "email" in str(e).lower():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update service error"
        )


@router.post("/change-password")
async def change_password(
    password_change: PasswordChangeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    manage_profile_use_case: ManageProfileUseCase = Depends(get_manage_profile_use_case)
) -> dict[str, str]:
    """
    Change user password.

    Requires current password for verification using Clean Architecture.
    """
    # Convert API request to use case request
    change_request = ManageProfileRequest(
        action=ProfileAction.CHANGE_PASSWORD,
        user_id=current_user.id,
        current_password=password_change.current_password,
        new_password=password_change.new_password
    )
    
    try:
        # Execute password change use case
        await manage_profile_use_case.execute(
            change_request,
            extract_user_context(current_user)
        )
        
        return {"message": "Password changed successfully"}
        
    except ValueError as e:
        if "incorrect" in str(e).lower() or "invalid" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change service error"
        )


@router.post("/logout")
async def logout(current_user: Annotated[User, Depends(get_current_user)]) -> dict[str, str]:
    """
    User logout endpoint.

    Note: With JWT tokens, logout is mainly handled client-side
    by removing the token. This endpoint is for compatibility
    and potential future token blacklisting.
    """
    return {"message": "Successfully logged out"}


@router.get("/verify-token")
async def verify_token(current_user: Annotated[User, Depends(get_current_user)]) -> dict[str, str]:
    """
    Verify if current token is valid.

    Useful for frontend token validation.
    """
    return {"message": "Token is valid", "user_id": str(current_user.id), "username": current_user.username}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    current_user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]
) -> TokenResponse:
    """
    Refresh access token.

    Issues a new access token for the currently authenticated user.
    This endpoint can be called when the current token is about to expire.
    """
    # Create new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(subject=current_user.id, expires_delta=access_token_expires)

    # Refresh user to load all attributes properly
    await db.refresh(current_user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(current_user),
    )