"""
Authentication API endpoints.
Handles user registration, login, and token management.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database_manager import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import LoginRequest, PasswordChangeRequest, TokenResponse, UserCreate, UserResponse
from app.services.user import UserService

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]) -> TokenResponse:
    """
    User login endpoint.

    Authenticates user with username/email and password,
    returns JWT access token.
    """
    user_service = UserService(db)

    # Authenticate user
    user = await user_service.authenticate_user(login_data.username, login_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(subject=user.id, expires_delta=access_token_expires)

    # Refresh user to load all attributes properly
    await db.refresh(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=UserResponse)
async def register(user_create: UserCreate, db: Annotated[AsyncSession, Depends(get_db)]) -> UserResponse:
    """
    User registration endpoint.

    Creates a new user account if registration is enabled.
    """
    if not settings.ENABLE_REGISTRATION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is currently disabled")

    user_service = UserService(db)

    # Check if username already exists
    if await user_service.username_exists(user_create.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    # Check if email already exists
    if await user_service.email_exists(user_create.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Create user
    user = await user_service.create_user(user_create)

    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    """
    Get current user profile.

    Returns the authenticated user's profile information.
    """
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserCreate,  # Reuse UserCreate but ignore password
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """
    Update current user profile.

    Allows users to update their own profile information.
    """
    user_service = UserService(db)

    # Check if new username conflicts (if changed)
    if user_update.username != current_user.username and await user_service.username_exists(user_update.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    # Check if new email conflicts (if changed)
    if user_update.email != current_user.email and await user_service.email_exists(user_update.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Update user (excluding password and role for security)
    from app.schemas.user import UserUpdate

    update_data = UserUpdate(
        email=user_update.email,
        full_name=user_update.full_name,
        # Don't allow users to change their own role
    )

    updated_user = await user_service.update_user(current_user.id, update_data)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserResponse.model_validate(updated_user)


@router.post("/change-password")
async def change_password(
    password_change: PasswordChangeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """
    Change user password.

    Requires current password for verification.
    """
    user_service = UserService(db)

    success = await user_service.change_password(
        current_user.id, password_change.current_password, password_change.new_password
    )

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    return {"message": "Password changed successfully"}


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
