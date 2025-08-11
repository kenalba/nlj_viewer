"""
User management API endpoints.
Administrative endpoints for managing users.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import get_db
from app.core.deps import RequireAdmin, get_current_user
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserList, UserResponse, UserUpdate
from app.services.user import UserService

router = APIRouter()


@router.get("/", response_model=UserList)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    role: UserRole | None = Query(None, description="Filter by user role"),
    active_only: bool = Query(False, description="Show only active users"),
    search: str | None = Query(None, description="Search users by username, email, or full name")
) -> UserList:
    """
    List users with pagination and filtering.
    
    Requires admin role or allows users to see limited info.
    """
    user_service = UserService(db)
    
    # Calculate skip value for pagination
    skip = (page - 1) * per_page
    
    # Admin can see all users, others see limited info
    if current_user.role != UserRole.ADMIN:
        # Non-admin users can only see basic user list
        role = None  # Remove role filter for non-admin
        active_only = True  # Only show active users
    
    # Get users and total count
    users = await user_service.get_users(
        skip=skip,
        limit=per_page,
        role_filter=role,
        active_only=active_only,
        search=search
    )
    
    total = await user_service.get_user_count(
        role_filter=role,
        active_only=active_only,
        search=search
    )
    
    return UserList(
        users=[UserResponse.model_validate(user) for user in users],
        total=total,
        page=page,
        per_page=per_page,
        has_next=skip + per_page < total,
        has_prev=page > 1
    )


@router.post("/", response_model=UserResponse)
async def create_user(
    user_create: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin_user: RequireAdmin
) -> UserResponse:
    """
    Create a new user (admin only).
    
    Allows administrators to create users with any role.
    """
    user_service = UserService(db)
    
    # Check if username already exists
    if await user_service.username_exists(user_create.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    if await user_service.email_exists(user_create.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = await user_service.create_user(user_create)
    
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> UserResponse:
    """
    Get user by ID.
    
    Users can only see their own profile, admins can see any user.
    """
    user_service = UserService(db)
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )
    
    user = await user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_update: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin_user: RequireAdmin
) -> UserResponse:
    """
    Update user by ID (admin only).
    
    Allows administrators to update any user's information.
    """
    user_service = UserService(db)
    
    # Check if user exists
    existing_user = await user_service.get_user_by_id(user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check for username conflicts (if username is being updated)
    if user_update.username and user_update.username != existing_user.username:
        if await user_service.username_exists(user_update.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
    
    # Check for email conflicts (if email is being updated)
    if user_update.email and user_update.email != existing_user.email:
        if await user_service.email_exists(user_update.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Update user
    updated_user = await user_service.update_user(user_id, user_update)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse.model_validate(updated_user)


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin_user: RequireAdmin
) -> dict[str, str]:
    """
    Activate user account (admin only).
    """
    user_service = UserService(db)
    
    success = await user_service.activate_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User activated successfully"}


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin_user: RequireAdmin
) -> dict[str, str]:
    """
    Deactivate user account (admin only).
    """
    user_service = UserService(db)
    
    # Prevent admin from deactivating themselves
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    success = await user_service.deactivate_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User deactivated successfully"}


@router.get("/roles/", response_model=list[str])
async def get_user_roles(
    current_user: Annotated[User, Depends(get_current_user)]
) -> list[str]:
    """
    Get list of available user roles.
    
    Useful for frontend role selection components.
    """
    return [role.value for role in UserRole]