"""
FastAPI dependencies for authentication and database access.
Uses modern FastAPI dependency injection patterns.
"""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User, UserRole
from app.services.kafka_service import kafka_service, xapi_event_service

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> User:
    """
    Get the current authenticated user from JWT token.
    
    Args:
        db: Database session
        credentials: HTTP Bearer credentials
        
    Returns:
        Current authenticated user
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Verify JWT token
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise credentials_exception
    
    # Extract user ID from token
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception
    
    # Get user from database
    result = await db.execute(
        select(User).where(User.id == user_uuid)
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
    
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Get current active user (alias for backward compatibility).
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current active user
    """
    return current_user


def require_role(required_role: UserRole):
    """
    Create a dependency that requires a specific user role.
    
    Args:
        required_role: Required user role
        
    Returns:
        FastAPI dependency function
    """
    async def check_role(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.role != required_role and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires {required_role.value} role"
            )
        return current_user
    
    return check_role


def require_roles(required_roles: list[UserRole]):
    """
    Create a dependency that requires one of several user roles.
    
    Args:
        required_roles: List of acceptable user roles
        
    Returns:
        FastAPI dependency function
    """
    async def check_roles(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if (current_user.role not in required_roles and 
            current_user.role != UserRole.ADMIN):
            roles_str = ", ".join([role.value for role in required_roles])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of these roles: {roles_str}"
            )
        return current_user
    
    return check_roles


# Common role dependencies
RequireCreator = Annotated[User, Depends(require_role(UserRole.CREATOR))]
RequireReviewer = Annotated[User, Depends(require_role(UserRole.REVIEWER))]
RequireApprover = Annotated[User, Depends(require_role(UserRole.APPROVER))]
RequireAdmin = Annotated[User, Depends(require_role(UserRole.ADMIN))]

# Mixed role dependencies
RequireContentManager = Annotated[
    User, 
    Depends(require_roles([UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER]))
]
RequireReviewerOrApprover = Annotated[
    User,
    Depends(require_roles([UserRole.REVIEWER, UserRole.APPROVER]))
]


async def get_kafka_service():
    """Get the global Kafka service instance."""
    return kafka_service


async def get_xapi_event_service():
    """Get the global xAPI event service instance."""
    return xapi_event_service