"""
Base Use Case for Clean Architecture with Event-Driven Integration.

Provides common functionality for all use cases including:
- Event publishing through existing Kafka infrastructure
- Permission validation patterns
- Error handling and logging
- Transaction management coordination
"""

import logging
from abc import ABC, abstractmethod
from typing import TypeVar, Generic, Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.events import get_event_service

logger = logging.getLogger(__name__)

T = TypeVar('T')  # Request type
U = TypeVar('U')  # Response type


class BaseUseCase(ABC, Generic[T, U]):
    """
    Base class for all use cases implementing Clean Architecture patterns.
    
    Provides:
    - Event-driven architecture integration with Kafka
    - Permission validation utilities
    - Error handling and logging patterns
    - Transaction coordination helpers
    """
    
    def __init__(self, session: AsyncSession, **dependencies: Any) -> None:
        """
        Initialize use case with database session and dependencies.
        
        Args:
            session: SQLAlchemy async session for transaction management
            **dependencies: Injected ORM services and other dependencies
        """
        self.session = session
        self.dependencies = dependencies
        self._event_service = None
        
    async def _get_event_service(self) -> Any:
        """Get event service instance for publishing domain events."""
        if not self._event_service:
            self._event_service = await get_event_service()  # type: ignore
        return self._event_service
    
    @abstractmethod
    async def execute(self, request: T, user_context: Dict[str, Any]) -> U:
        """
        Execute the use case business logic.
        
        Args:
            request: Typed request object containing use case parameters
            user_context: User context with ID, role, email, name for permissions and events
            
        Returns:
            Typed response object with use case results
            
        Raises:
            PermissionError: If user lacks required permissions
            ValueError: If request validation fails
            RuntimeError: If use case execution fails
        """
        pass
        
    # Permission Validation Utilities
    
    async def _validate_user_role(
        self, 
        user_context: Dict[str, Any], 
        required_roles: List[UserRole],
        error_message: str = "Insufficient permissions"
    ) -> None:
        """
        Validate user has one of the required roles.
        
        Args:
            user_context: User context dictionary
            required_roles: List of acceptable user roles
            error_message: Custom error message
            
        Raises:
            PermissionError: If user role is not in required roles
        """
        user_role = user_context.get("user_role")
        if not user_role or user_role not in required_roles:
            logger.warning(
                f"Permission denied for user {user_context.get('user_id')}: "
                f"has role {user_role}, needs one of {[r.value for r in required_roles]}"
            )
            raise PermissionError(error_message)
    
    async def _validate_content_permissions(
        self,
        user_context: Dict[str, Any],
        content_creator_id: UUID,
        required_roles_for_others: Optional[List[UserRole]] = None,
        allow_creator: bool = True
    ) -> None:
        """
        Validate user can access/modify specific content.
        
        Args:
            user_context: User context dictionary
            content_creator_id: ID of content creator
            required_roles_for_others: Roles required for non-creators
            allow_creator: Whether content creator has automatic access
            
        Raises:
            PermissionError: If user lacks permissions for this content
        """
        user_id = UUID(user_context["user_id"])
        
        # Creator has automatic access if allowed
        if allow_creator and user_id == content_creator_id:
            return
            
        # Check role-based permissions for non-creators
        if required_roles_for_others:
            await self._validate_user_role(
                user_context, 
                required_roles_for_others,
                "Insufficient permissions to access this content"
            )
    
    # Event Publishing Utilities
    
    async def _publish_event(self, event_method: str, **event_data: Any) -> None:
        """
        Publish domain event through the event service.
        
        Args:
            event_method: Method name on the event service to call
            **event_data: Event data to publish
            
        Note:
            Event publishing failures are logged but don't fail the use case.
            This ensures business operations continue even if event infrastructure fails.
        """
        try:
            event_service = await self._get_event_service()
            
            # Get the specific event service method
            if hasattr(event_service, event_method):
                method = getattr(event_service, event_method)
                await method(**event_data)
                logger.debug(f"Published event: {event_method}")
            else:
                logger.warning(f"Event method {event_method} not found on event service")
                
        except Exception as e:
            # Log but don't fail the use case - events are non-critical
            logger.warning(f"Failed to publish event {event_method}: {e}")
    
    # User Context Utilities
    
    def _extract_user_info(self, user_context: Dict[str, Any]) -> Dict[str, str]:
        """
        Extract user information for events and logging.
        
        Args:
            user_context: User context dictionary
            
        Returns:
            Dictionary with user_id, user_name, user_email as strings
        """
        return {
            "user_id": str(user_context["user_id"]),
            "user_name": user_context.get("user_name", "Unknown User"),
            "user_email": user_context.get("user_email", "unknown@example.com")
        }
    
    # Error Handling Utilities
    
    def _handle_validation_error(self, error: Exception, context: str) -> None:
        """
        Handle validation errors with consistent logging.
        
        Args:
            error: Original validation error
            context: Context description for logging
            
        Raises:
            ValueError: Re-raised with enhanced context
        """
        error_msg = f"Validation failed in {context}: {str(error)}"
        logger.warning(error_msg)
        raise ValueError(error_msg) from error
    
    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """
        Handle service errors with consistent logging and rollback.
        
        Args:
            error: Original service error
            context: Context description for logging
            
        Raises:
            RuntimeError: Re-raised with enhanced context
        """
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg)
        
        # Ensure session rollback on service errors
        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")
            
        raise RuntimeError(error_msg) from error


class UserContext:
    """
    Typed user context for use cases.
    
    Provides type-safe access to user information needed for
    permission validation and event publishing.
    """
    
    def __init__(
        self,
        user_id: UUID,
        user_role: UserRole,
        user_name: str,
        user_email: str,
        **additional_context: Any
    ) -> None:
        self.user_id = user_id
        self.user_role = user_role
        self.user_name = user_name
        self.user_email = user_email
        self.additional_context = additional_context
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format expected by use cases."""
        return {
            "user_id": self.user_id,
            "user_role": self.user_role,
            "user_name": self.user_name,
            "user_email": self.user_email,
            **self.additional_context
        }
    
    @classmethod
    def from_user_model(cls, user_model: Any, **additional_context: Any) -> "UserContext":
        """Create UserContext from User SQLAlchemy model."""
        return cls(
            user_id=user_model.id,
            user_role=user_model.role,
            user_name=user_model.full_name or user_model.username,
            user_email=user_model.email,
            **additional_context
        )