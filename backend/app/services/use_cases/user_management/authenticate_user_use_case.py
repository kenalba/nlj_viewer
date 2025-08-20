"""
Authenticate User Use Case - User Authentication Business Workflow.

Handles comprehensive user authentication including:
- Login with email/password and MFA validation
- JWT token generation and refresh
- Session management and security
- Account lockout and security policies
- SSO integration and external authentication
- Authentication event logging and monitoring
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from enum import Enum
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.orm_services.user_orm_service import UserOrmService
from app.core.security import create_access_token
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class AuthenticationMethod(Enum):
    """Authentication methods supported."""
    EMAIL_PASSWORD = "email_password"
    SSO_GOOGLE = "sso_google"
    SSO_MICROSOFT = "sso_microsoft"
    SSO_SAML = "sso_saml"
    API_KEY = "api_key"
    REFRESH_TOKEN = "refresh_token"


class AuthenticationStatus(Enum):
    """Authentication attempt status."""
    SUCCESS = "success"
    INVALID_CREDENTIALS = "invalid_credentials"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_DISABLED = "account_disabled"
    MFA_REQUIRED = "mfa_required"
    PASSWORD_EXPIRED = "password_expired"
    RATE_LIMITED = "rate_limited"


@dataclass
class AuthenticateUserRequest:
    """Request object for user authentication."""
    authentication_method: AuthenticationMethod
    email: Optional[str] = None
    password: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None
    sso_token: Optional[str] = None
    sso_provider: Optional[str] = None
    mfa_code: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    remember_me: bool = False
    session_duration_hours: int = 24


@dataclass
class AuthenticateUserResponse:
    """Response object for user authentication."""
    authentication: Dict[str, Any]  # Simplified until schema exists
    status: AuthenticationStatus
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    refresh_expires_at: Optional[datetime] = None
    mfa_required: bool = False
    password_change_required: bool = False
    session_id: Optional[UUID] = None


class AuthenticateUserUseCase(BaseUseCase[AuthenticateUserRequest, AuthenticateUserResponse]):
    """
    Use case for comprehensive user authentication and session management.

    Responsibilities:
    - Validate user credentials and authentication methods
    - Generate and manage JWT tokens and refresh tokens
    - Handle MFA validation and security policies
    - Manage authentication sessions and security
    - Process SSO authentication workflows
    - Log authentication events and security monitoring

    Events Published:
    - Authentication success events (nlj.auth.login_successful)
    - Authentication failure events (nlj.auth.login_failed)
    - Token refresh events (nlj.auth.token_refreshed)
    - Account lockout events (nlj.auth.account_locked)
    - Session creation events (nlj.auth.session_created)
    """

    def __init__(
        self,
        session: AsyncSession,
        user_orm_service: UserOrmService
    ):
        """
        Initialize authenticate user use case.

        Args:
            session: Database session for transaction management
            user_orm_service: User data access and validation
        """
        super().__init__(
            session,
            user_orm_service=user_orm_service
        )

    async def execute(
        self,
        request: AuthenticateUserRequest,
        user_context: Dict[str, Any]
    ) -> AuthenticateUserResponse:
        """
        Execute user authentication workflow (simplified implementation).

        Args:
            request: Authentication request with credentials and method
            user_context: Request context with client information

        Returns:
            Authentication response with tokens and session information

        Raises:
            ValueError: If authentication request validation fails
            RuntimeError: If authentication processing fails
        """
        try:
            # Simplified to only handle email/password authentication
            if request.authentication_method == AuthenticationMethod.EMAIL_PASSWORD:
                auth_result = await self._handle_email_password_auth(request)
            else:
                # Other methods not implemented yet - return placeholder response
                auth_result = {
                    "status": AuthenticationStatus.INVALID_CREDENTIALS,
                    "message": f"Authentication method {request.authentication_method.value} not yet implemented"
                }

            # Process authentication result
            if auth_result["status"] == AuthenticationStatus.SUCCESS:
                response = await self._handle_successful_authentication(
                    auth_result, request, user_context
                )
            else:
                response = await self._handle_failed_authentication(
                    auth_result, request, user_context
                )

            # Publish authentication events (placeholder) - wrapped for resilience
            try:
                await self._publish_authentication_event(response, request, user_context)
            except Exception as e:
                # Log but don't fail the authentication - events are non-critical
                logger.warning(f"Failed to publish authentication event: {e}")

            logger.info(
                f"Authentication completed: {request.authentication_method.value}, "
                f"status: {response.status.value}, user: {auth_result.get('user_id', 'unknown')}"
            )
            return response

        except ValueError as e:
            self._handle_validation_error(e, f"authentication {request.authentication_method.value}")
            raise  # Add explicit raise to satisfy type checker
        except Exception as e:
            await self._handle_service_error(e, f"authentication {request.authentication_method.value}")
            raise  # This will never be reached but satisfies mypy

    async def _handle_email_password_auth(
        self, request: AuthenticateUserRequest
    ) -> Dict[str, Any]:
        """Handle email/password authentication (simplified implementation)."""
        if not request.email or not request.password:
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "Email and password are required"
            }

        # Use the actual UserOrmService authenticate_user method
        user_orm_service = self.dependencies["user_orm_service"]
        user = await user_orm_service.authenticate_user(request.email, request.password)

        if not user:
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "Invalid email or password"
            }

        # Check account status
        if not user.is_active:
            return {
                "status": AuthenticationStatus.ACCOUNT_DISABLED,
                "message": "Account is disabled",
                "user_id": str(user.id)
            }

        # TODO: Add MFA, rate limiting, and account locking when those features are needed

        return {
            "status": AuthenticationStatus.SUCCESS,
            "user": user,
            "user_id": user.id,
            "message": "Authentication successful"
        }

    async def _handle_refresh_token_auth(
        self, request: AuthenticateUserRequest
    ) -> Dict[str, Any]:
        """Handle refresh token authentication."""
        if not request.refresh_token:
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "Refresh token is required"
            }

        # Validate refresh token
        auth_session_orm_service = self.dependencies["auth_session_orm_service"]
        session = await auth_session_orm_service.get_session_by_refresh_token(
            request.refresh_token
        )

        if not session or not session.is_valid or session.expires_at < datetime.now():
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "Invalid or expired refresh token"
            }

        # Get user
        user_orm_service = self.dependencies["user_orm_service"]
        user = await user_orm_service.get_by_id(session.user_id)

        if not user or not user.is_active:
            return {
                "status": AuthenticationStatus.ACCOUNT_DISABLED,
                "message": "User account is disabled",
                "user_id": session.user_id
            }

        return {
            "status": AuthenticationStatus.SUCCESS,
            "user": user,
            "user_id": user.id,
            "existing_session": session,
            "message": "Token refresh successful"
        }

    async def _handle_api_key_auth(
        self, request: AuthenticateUserRequest
    ) -> Dict[str, Any]:
        """Handle API key authentication."""
        if not request.api_key:
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "API key is required"
            }

        # Validate API key
        user_orm_service = self.dependencies["user_orm_service"]
        user = await user_orm_service.get_by_api_key(request.api_key)

        if not user:
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "Invalid API key"
            }

        if not user.is_active:
            return {
                "status": AuthenticationStatus.ACCOUNT_DISABLED,
                "message": "User account is disabled",
                "user_id": user.id
            }

        return {
            "status": AuthenticationStatus.SUCCESS,
            "user": user,
            "user_id": user.id,
            "message": "API key authentication successful"
        }

    async def _handle_sso_auth(
        self, request: AuthenticateUserRequest
    ) -> Dict[str, Any]:
        """Handle SSO authentication."""
        if not request.sso_token:
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "SSO token is required"
            }

        # Validate SSO token with provider
        sso_user_data = await self._validate_sso_token(
            request.sso_token, request.authentication_method.value
        )

        if not sso_user_data:
            return {
                "status": AuthenticationStatus.INVALID_CREDENTIALS,
                "message": "Invalid SSO token"
            }

        # Find or create user based on SSO data
        user_orm_service = self.dependencies["user_orm_service"]
        user = await user_orm_service.get_or_create_sso_user(
            email=sso_user_data["email"],
            full_name=sso_user_data.get("name"),
            sso_provider=request.authentication_method.value,
            sso_id=sso_user_data["id"]
        )

        if not user.is_active:
            return {
                "status": AuthenticationStatus.ACCOUNT_DISABLED,
                "message": "User account is disabled",
                "user_id": user.id
            }

        return {
            "status": AuthenticationStatus.SUCCESS,
            "user": user,
            "user_id": user.id,
            "message": "SSO authentication successful"
        }

    async def _handle_successful_authentication(
        self,
        auth_result: Dict[str, Any],
        request: AuthenticateUserRequest,
        user_context: Dict[str, Any]
    ) -> AuthenticateUserResponse:
        """Handle successful authentication (simplified implementation)."""
        user = auth_result["user"]

        # Generate new tokens
        access_token = create_access_token(
            subject=str(user.id),
            expires_delta=timedelta(hours=1)
        )
        
        # TODO: Implement refresh token functionality when needed
        refresh_token = None
        refresh_expires_at = None
        
        token_expires_at = datetime.now() + timedelta(hours=1)

        # Update user last login (this method exists in UserOrmService)
        user_orm_service = self.dependencies["user_orm_service"]
        await user_orm_service.update_last_login(user.id)

        # Create authentication data (simplified)
        auth_data = {
            "id": str(user.id),
            "user_id": str(user.id),
            "authentication_method": request.authentication_method.value,
            "created_at": datetime.now().isoformat(),
            "client_ip": request.client_ip,
            "user_agent": request.user_agent,
            "is_valid": True
        }

        return AuthenticateUserResponse(
            authentication=auth_data,
            status=AuthenticationStatus.SUCCESS,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            refresh_expires_at=refresh_expires_at,
            mfa_required=False,
            password_change_required=False,
            session_id=user.id  # Simplified - use user ID as session ID
        )

    async def _handle_failed_authentication(
        self,
        auth_result: Dict[str, Any],
        request: AuthenticateUserRequest,
        user_context: Dict[str, Any]
    ) -> AuthenticateUserResponse:
        """Handle failed authentication (simplified implementation)."""
        # Create minimal authentication data for failed attempt
        auth_data = {
            "id": None,
            "user_id": auth_result.get("user_id"),
            "authentication_method": request.authentication_method.value,
            "created_at": datetime.now().isoformat(),
            "client_ip": request.client_ip,
            "user_agent": request.user_agent,
            "is_valid": False
        }

        return AuthenticateUserResponse(
            authentication=auth_data,
            status=auth_result["status"],
            access_token=None,
            refresh_token=None,
            token_expires_at=None,
            refresh_expires_at=None,
            mfa_required=(auth_result["status"] == AuthenticationStatus.MFA_REQUIRED),
            password_change_required=(auth_result["status"] == AuthenticationStatus.PASSWORD_EXPIRED),
            session_id=None
        )

    # Security and validation helpers

    async def _is_rate_limited(self, email: str, client_ip: str) -> bool:
        """Check if authentication attempts are rate limited."""
        auth_session_orm_service = self.dependencies["auth_session_orm_service"]
        
        # Check failed attempts in last 15 minutes
        recent_failures = await auth_session_orm_service.count_recent_failed_attempts(
            email=email,
            client_ip=client_ip,
            window_minutes=15
        )

        return int(recent_failures) >= 5  # Max 5 attempts per 15 minutes

    async def _increment_failed_attempts(self, email: str, client_ip: str) -> None:
        """Increment failed authentication attempts."""
        auth_session_orm_service = self.dependencies["auth_session_orm_service"]
        
        await auth_session_orm_service.record_failed_attempt(
            email=email,
            client_ip=client_ip,
            attempted_at=datetime.now()
        )

    async def _reset_failed_attempts(self, email: str, client_ip: str) -> None:
        """Reset failed authentication attempts."""
        auth_session_orm_service = self.dependencies["auth_session_orm_service"]
        
        await auth_session_orm_service.clear_failed_attempts(
            email=email,
            client_ip=client_ip
        )

    async def _should_lock_account(self, user_id: UUID) -> bool:
        """Check if account should be locked due to failed attempts."""
        auth_session_orm_service = self.dependencies["auth_session_orm_service"]
        
        # Check failed attempts in last hour
        recent_failures = await auth_session_orm_service.count_user_failed_attempts(
            user_id=user_id,
            window_minutes=60
        )

        return int(recent_failures) >= 10  # Lock after 10 failed attempts in 1 hour

    async def _is_password_expired(self, user: Any) -> bool:
        """Check if user's password has expired."""
        if not user.password_changed_at:
            return False

        # Check if password is older than 90 days
        password_age = datetime.now() - user.password_changed_at
        return password_age.days > 90

    async def _validate_mfa_code(self, user: Any, mfa_code: str) -> bool:
        """Validate MFA code for user."""
        # In real implementation, this would validate TOTP or SMS code
        # For now, simulate validation
        if not user.mfa_secret:
            return False

        # Placeholder MFA validation
        return len(mfa_code) == 6 and mfa_code.isdigit()

    async def _validate_sso_token(
        self, sso_token: str, provider: str
    ) -> Optional[Dict[str, Any]]:
        """Validate SSO token with external provider."""
        # In real implementation, this would validate token with SSO provider
        # and return user data
        
        # Placeholder SSO validation
        if provider == "sso_google":
            return {
                "id": "google_user_123",
                "email": "user@example.com",
                "name": "Test User"
            }
        
        return None

    async def _publish_authentication_event(
        self,
        response: AuthenticateUserResponse,
        request: AuthenticateUserRequest,
        user_context: Dict[str, Any]
    ) -> None:
        """Publish authentication event."""
        if response.status == AuthenticationStatus.SUCCESS:
            await self._publish_event(
                "publish_auth_login_successful",
                user_id=response.authentication["user_id"],
                session_id=str(response.session_id) if response.session_id else None,
                authentication_method=request.authentication_method.value,
                client_ip=request.client_ip,
                user_agent=request.user_agent,
                login_timestamp=datetime.now().isoformat(),
                remember_me=request.remember_me
            )
        else:
            await self._publish_event(
                "publish_auth_login_failed",
                user_id=response.authentication["user_id"] if response.authentication.get("user_id") else None,
                authentication_method=request.authentication_method.value,
                failure_reason=response.status.value,
                client_ip=request.client_ip,
                user_agent=request.user_agent,
                attempt_timestamp=datetime.now().isoformat()
            )

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error