"""
User management API endpoints.
Administrative endpoints for managing users.
"""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import (
    RequireAdmin, get_current_user, get_manage_profile_use_case,
    get_get_user_use_case, get_list_users_use_case
)
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserList, UserResponse, UserUpdate
from app.core.user_context import extract_user_context
from app.services.use_cases.user_management.manage_profile_use_case import (
    ManageProfileUseCase, 
    ManageProfileRequest, 
    ProfileAction
)
from app.services.use_cases.user_management.get_user_use_case import (
    GetUserUseCase,
    GetUserRequest
)
from app.services.use_cases.user_management.list_users_use_case import (
    ListUsersUseCase,
    ListUsersRequest
)

router = APIRouter()


@router.get("/", response_model=UserList)
async def list_users(
    current_user: Annotated[User, Depends(get_current_user)],
    list_users_use_case: Annotated[ListUsersUseCase, Depends(get_list_users_use_case)],
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    role: UserRole | None = Query(None, description="Filter by user role"),
    active_only: bool = Query(False, description="Show only active users"),
    search: str | None = Query(None, description="Search users by username, email, or full name"),
) -> UserList:
    """
    List users with pagination and filtering.

    Requires admin role or allows users to see limited info.
    """
    # Create use case request with inline conversion
    use_case_request = ListUsersRequest(
        page=page,
        per_page=per_page,
        role_filter=role,
        active_only=active_only,
        search=search
    )
    
    # Extract user context
    user_context = extract_user_context(current_user)
    
    try:
        # Execute use case (handles permission-based filtering internally)
        response = await list_users_use_case.execute(use_case_request, user_context)
        
        # Convert use case response to API response
        user_responses = []
        for user_schema in response.users:
            user_response = UserResponse(
                id=user_schema.id or uuid.uuid4(),
                email=user_schema.email,
                username=user_schema.username or "",
                full_name=user_schema.full_name or "",
                role=user_schema.role,
                is_active=user_schema.is_active,
                is_verified=False,  # Default - would come from user verification system
                created_at=user_schema.created_at or datetime.now(),
                updated_at=user_schema.updated_at or datetime.now(),
                last_login=None  # Would come from authentication system
            )
            user_responses.append(user_response)
        
        return UserList(
            users=user_responses,
            total=response.total,
            page=response.page,
            per_page=response.per_page,
            has_next=response.has_next,
            has_prev=response.has_prev
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/", response_model=UserResponse)
async def create_user(
    user_create: UserCreate, 
    admin_user: RequireAdmin,
    manage_profile_use_case: Annotated[ManageProfileUseCase, Depends(get_manage_profile_use_case)]
) -> UserResponse:
    """
    Create a new user (admin only).

    Allows administrators to create users with any role.
    """
    # Create use case request with inline conversion
    use_case_request = ManageProfileRequest(
        action=ProfileAction.UPDATE_INFO,
        full_name=user_create.full_name,
        email=user_create.email, 
        username=user_create.username,
        new_password=user_create.password,
        confirm_password=user_create.password  # For creation, password == confirm
    )
    
    # Extract admin user context
    admin_context = extract_user_context(admin_user)
    
    try:
        # Execute use case (this will handle validation and creation)
        response = await manage_profile_use_case.execute(use_case_request, admin_context)
        
        # Convert use case response to API response  
        return UserResponse(
            id=response.user.id or uuid.uuid4(),
            email=response.user.email,
            username=response.user.username or "",
            full_name=response.user.full_name or "",
            role=response.user.role,
            is_active=response.user.is_active,
            is_verified=False,  # Default value - would be set by email verification use case
            created_at=response.user.created_at or datetime.now(),
            updated_at=response.user.updated_at or datetime.now(),
            last_login=None  # Would be managed by authentication use case
        )
        
    except ValueError as e:
        if "already in use" in str(e) or "already taken" in str(e):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    get_user_use_case: Annotated[GetUserUseCase, Depends(get_get_user_use_case)]
) -> UserResponse:
    """
    Get user by ID.

    Users can only see their own profile, admins can see any user.
    """
    # Create use case request with inline conversion
    use_case_request = GetUserRequest(user_id=user_id)
    
    # Extract user context
    user_context = extract_user_context(current_user)
    
    try:
        # Execute use case (handles permissions internally)
        response = await get_user_use_case.execute(use_case_request, user_context)
        
        # Convert use case response to API response
        return UserResponse(
            id=response.user.id or uuid.uuid4(),
            email=response.user.email,
            username=response.user.username or "",
            full_name=response.user.full_name or "",
            role=response.user.role,
            is_active=response.user.is_active,
            is_verified=False,  # Default - would come from user verification system
            created_at=response.user.created_at or datetime.now(),
            updated_at=response.user.updated_at or datetime.now(),
            last_login=None  # Would come from authentication system
        )
        
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID, 
    user_update: UserUpdate, 
    admin_user: RequireAdmin,
    manage_profile_use_case: Annotated[ManageProfileUseCase, Depends(get_manage_profile_use_case)]
) -> UserResponse:
    """
    Update user by ID (admin only).

    Allows administrators to update any user's information.
    """
    # Create use case request with inline conversion
    use_case_request = ManageProfileRequest(
        action=ProfileAction.UPDATE_INFO,
        user_id=user_id,
        full_name=user_update.full_name,
        email=user_update.email,
        username=user_update.username,
        # Note: Password updates would be handled separately with CHANGE_PASSWORD action
    )
    
    # Extract admin user context
    admin_context = extract_user_context(admin_user)
    
    try:
        # Execute use case (this will handle validation and updates)
        response = await manage_profile_use_case.execute(use_case_request, admin_context)
        
        # Convert use case response to API response
        return UserResponse(
            id=response.user.id or uuid.uuid4(),
            email=response.user.email,
            username=response.user.username or "",
            full_name=response.user.full_name or "",
            role=response.user.role,
            is_active=response.user.is_active,
            is_verified=False,  # Default value - would be set by email verification use case
            created_at=response.user.created_at or datetime.now(),
            updated_at=response.user.updated_at or datetime.now(),
            last_login=None  # Would be managed by authentication use case
        )
        
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        if "already in use" in str(e) or "already taken" in str(e):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: uuid.UUID, 
    admin_user: RequireAdmin,
    manage_profile_use_case: Annotated[ManageProfileUseCase, Depends(get_manage_profile_use_case)]
) -> dict[str, str]:
    """
    Activate user account (admin only).
    """
    # Create use case request for account activation
    activate_request = ManageProfileRequest(
        action=ProfileAction.ACTIVATE_ACCOUNT,
        user_id=user_id,
        activation_reason="Activated by administrator"
    )
    
    # Extract admin user context
    admin_context = extract_user_context(admin_user)
    
    try:
        # Execute use case
        await manage_profile_use_case.execute(activate_request, admin_context)
        return {"message": "User activated successfully"}
        
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: uuid.UUID, 
    admin_user: RequireAdmin,
    manage_profile_use_case: Annotated[ManageProfileUseCase, Depends(get_manage_profile_use_case)]
) -> dict[str, str]:
    """
    Deactivate user account (admin only).
    """
    # Prevent admin from deactivating themselves
    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")
    
    # Create use case request for account deactivation with inline conversion
    deactivate_request = ManageProfileRequest(
        action=ProfileAction.DEACTIVATE_ACCOUNT,
        user_id=user_id,
        deactivation_reason="Deactivated by administrator",
        deactivate_immediately=True
    )
    
    # Extract admin user context
    admin_context = extract_user_context(admin_user)
    
    try:
        # Execute use case
        await manage_profile_use_case.execute(deactivate_request, admin_context)
        return {"message": "User deactivated successfully"}
        
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/roles/", response_model=list[str])
async def get_user_roles(current_user: Annotated[User, Depends(get_current_user)]) -> list[str]:
    """
    Get list of available user roles.

    Useful for frontend role selection components.
    """
    return [role.value for role in UserRole]
