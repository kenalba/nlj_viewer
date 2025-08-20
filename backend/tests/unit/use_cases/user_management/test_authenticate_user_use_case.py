"""
Unit tests for AuthenticateUserUseCase - User Authentication Business Workflow.

Tests comprehensive user authentication including business logic, ORM integration,
and xAPI event publishing for the event-driven architecture.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.user_management.authenticate_user_use_case import (
    AuthenticateUserUseCase,
    AuthenticateUserRequest,
    AuthenticateUserResponse,
    AuthenticationMethod,
    AuthenticationStatus
)
from app.services.orm_services.user_orm_service import UserOrmService
from app.models.user import UserRole

# Configure pytest-asyncio for async tests
pytestmark = pytest.mark.asyncio


class TestAuthenticateUserUseCase:
    """Test AuthenticateUserUseCase business workflow and xAPI event integration."""

    @pytest.fixture
    def mock_session(self):
        """Create mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_user_orm_service(self):
        """Create mock UserOrmService."""
        return AsyncMock(spec=UserOrmService)

    @pytest.fixture
    def authenticate_user_use_case(self, mock_session, mock_user_orm_service):
        """Create AuthenticateUserUseCase instance with mocked dependencies."""
        return AuthenticateUserUseCase(mock_session, mock_user_orm_service)

    @pytest.fixture
    def valid_auth_request(self):
        """Create valid authentication request."""
        return AuthenticateUserRequest(
            authentication_method=AuthenticationMethod.EMAIL_PASSWORD,
            email="user@example.com",
            password="secure_password123",
            client_ip="192.168.1.100",
            user_agent="Mozilla/5.0 Test Browser",
            remember_me=False,
            session_duration_hours=24
        )

    @pytest.fixture
    def mock_authenticated_user(self):
        """Create mock authenticated user."""
        user_id = uuid.uuid4()
        mock_user = MagicMock()
        
        # Set all required attributes for user authentication
        mock_user.id = user_id
        mock_user.email = "user@example.com"
        mock_user.username = "testuser"
        mock_user.full_name = "Test User"
        mock_user.role = UserRole.CREATOR
        mock_user.is_active = True
        mock_user.is_verified = True
        mock_user.hashed_password = "$2b$12$hashedpassword"
        mock_user.last_login = datetime.now(timezone.utc)
        mock_user.created_at = datetime.now(timezone.utc)
        
        return mock_user

    @pytest.fixture
    def request_user_context(self):
        """Create request user context."""
        return {
            "client_ip": "192.168.1.100",
            "user_agent": "Mozilla/5.0 Test Browser"
        }

    async def test_authenticate_user_success_email_password(self, authenticate_user_use_case, 
                                                          valid_auth_request, mock_user_orm_service,
                                                          mock_authenticated_user, request_user_context):
        """Test successful email/password authentication with xAPI event publishing."""
        # Setup - Mock successful authentication
        mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user
        mock_user_orm_service.update_last_login.return_value = True

        with patch('app.core.security.create_access_token', return_value="jwt_token_123") as mock_create_token:
            with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
                # Execute
                result = await authenticate_user_use_case.execute(valid_auth_request, request_user_context)

                # Verify ORM service calls
                mock_user_orm_service.authenticate_user.assert_called_once_with(
                    "user@example.com", "secure_password123"
                )
                mock_user_orm_service.update_last_login.assert_called_once_with(mock_authenticated_user.id)

                # Verify response structure
                assert isinstance(result, AuthenticateUserResponse)
                assert result.status == AuthenticationStatus.SUCCESS
                assert result.access_token == "jwt_token_123"
                assert result.token_expires_at is not None
                assert result.session_id == mock_authenticated_user.id
                assert result.mfa_required is False
                assert result.password_change_required is False

                # Verify authentication data structure
                assert result.authentication["user_id"] == str(mock_authenticated_user.id)
                assert result.authentication["authentication_method"] == "email_password"
                assert result.authentication["is_valid"] is True
                assert result.authentication["client_ip"] == "192.168.1.100"

                # Verify xAPI event publishing - authentication should publish proper xAPI events
                mock_publish.assert_called_once()
                event_call = mock_publish.call_args

                # Check for successful login xAPI event
                assert event_call[0][0] == "publish_auth_login_successful"
                event_kwargs = event_call[1]

                # Verify xAPI structure is maintained
                assert "user_id" in event_kwargs
                assert "session_id" in event_kwargs
                assert "authentication_method" in event_kwargs
                assert "client_ip" in event_kwargs
                assert "login_timestamp" in event_kwargs
                assert event_kwargs["user_id"] == str(mock_authenticated_user.id)
                assert event_kwargs["authentication_method"] == "email_password"
                assert event_kwargs["client_ip"] == "192.168.1.100"
                assert event_kwargs["remember_me"] is False

    async def test_authenticate_user_invalid_credentials(self, authenticate_user_use_case,
                                                       valid_auth_request, mock_user_orm_service,
                                                       request_user_context):
        """Test authentication with invalid credentials and failure event."""
        # Setup - Mock failed authentication
        mock_user_orm_service.authenticate_user.return_value = None

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await authenticate_user_use_case.execute(valid_auth_request, request_user_context)

            # Verify response structure for failed authentication
            assert isinstance(result, AuthenticateUserResponse)
            assert result.status == AuthenticationStatus.INVALID_CREDENTIALS
            assert result.access_token is None
            assert result.refresh_token is None
            assert result.session_id is None
            assert result.mfa_required is False

            # Verify authentication data for failed attempt
            assert result.authentication["user_id"] is None
            assert result.authentication["is_valid"] is False

            # Verify xAPI event publishing for failed login
            mock_publish.assert_called_once()
            event_call = mock_publish.call_args

            # Check for failed login xAPI event
            assert event_call[0][0] == "publish_auth_login_failed"
            event_kwargs = event_call[1]

            # Verify failure event structure
            assert event_kwargs["user_id"] is None
            assert event_kwargs["authentication_method"] == "email_password"
            assert event_kwargs["failure_reason"] == "invalid_credentials"
            assert "attempt_timestamp" in event_kwargs

    async def test_authenticate_user_account_disabled(self, authenticate_user_use_case,
                                                    valid_auth_request, mock_user_orm_service,
                                                    mock_authenticated_user, request_user_context):
        """Test authentication with disabled account."""
        # Setup - Mock disabled user account
        mock_authenticated_user.is_active = False
        mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await authenticate_user_use_case.execute(valid_auth_request, request_user_context)

            # Verify disabled account response
            assert result.status == AuthenticationStatus.ACCOUNT_DISABLED
            assert result.access_token is None

            # Verify failure event published with user ID
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert event_kwargs["user_id"] == str(mock_authenticated_user.id)
            assert event_kwargs["failure_reason"] == "account_disabled"

    async def test_authenticate_user_missing_credentials(self, authenticate_user_use_case,
                                                       request_user_context):
        """Test authentication with missing email or password."""
        # Setup - request with missing password
        invalid_request = AuthenticateUserRequest(
            authentication_method=AuthenticationMethod.EMAIL_PASSWORD,
            email="user@example.com",
            password=None  # Missing password
        )

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await authenticate_user_use_case.execute(invalid_request, request_user_context)

            # Verify validation failure
            assert result.status == AuthenticationStatus.INVALID_CREDENTIALS
            assert result.access_token is None

            # Verify failure event published
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert event_kwargs["failure_reason"] == "invalid_credentials"

    async def test_authenticate_user_unsupported_method(self, authenticate_user_use_case,
                                                      request_user_context):
        """Test authentication with unsupported authentication method."""
        # Setup - SSO authentication (not implemented)
        sso_request = AuthenticateUserRequest(
            authentication_method=AuthenticationMethod.SSO_GOOGLE,
            sso_token="google_token_123"
        )

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await authenticate_user_use_case.execute(sso_request, request_user_context)

            # Verify unsupported method response
            assert result.status == AuthenticationStatus.INVALID_CREDENTIALS
            assert result.access_token is None

            # Verify failure event published
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert event_kwargs["authentication_method"] == "sso_google"
            assert event_kwargs["failure_reason"] == "invalid_credentials"

    async def test_authenticate_user_with_remember_me(self, authenticate_user_use_case,
                                                    mock_user_orm_service, mock_authenticated_user,
                                                    request_user_context):
        """Test authentication with remember me option."""
        # Setup
        remember_me_request = AuthenticateUserRequest(
            authentication_method=AuthenticationMethod.EMAIL_PASSWORD,
            email="user@example.com",
            password="secure_password123",
            remember_me=True,
            session_duration_hours=168  # 1 week
        )

        mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user
        mock_user_orm_service.update_last_login.return_value = True

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await authenticate_user_use_case.execute(remember_me_request, request_user_context)

            # Verify successful authentication
            assert result.status == AuthenticationStatus.SUCCESS
            assert result.access_token is not None

            # Verify remember me is included in event
            event_kwargs = mock_publish.call_args[1]
            assert event_kwargs["remember_me"] is True

    async def test_service_error_handling_with_rollback(self, authenticate_user_use_case,
                                                      valid_auth_request, mock_user_orm_service,
                                                      request_user_context, mock_session):
        """Test proper error handling and transaction rollback on service failures."""
        # Setup - mock service to raise exception
        mock_user_orm_service.authenticate_user.side_effect = Exception("Database connection error")

        # Execute & Verify
        with pytest.raises(RuntimeError, match="authentication email_password"):
            await authenticate_user_use_case.execute(valid_auth_request, request_user_context)

        # Verify rollback was called (transaction safety)
        mock_session.rollback.assert_called_once()

    async def test_event_driven_architecture_resilience(self, authenticate_user_use_case,
                                                       valid_auth_request, mock_user_orm_service,
                                                       mock_authenticated_user, request_user_context):
        """Test that business operations continue even if event publishing fails."""
        # Setup
        mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user
        mock_user_orm_service.update_last_login.return_value = True

        # Mock event publishing to fail
        with patch.object(authenticate_user_use_case, '_publish_event',
                         side_effect=Exception("Kafka down")):
            # Execute - should still succeed despite event failure
            result = await authenticate_user_use_case.execute(valid_auth_request, request_user_context)

            # Business operation should still succeed
            assert result.status == AuthenticationStatus.SUCCESS
            assert result.access_token is not None
            assert result.session_id is not None

            # User authentication should still be processed
            mock_user_orm_service.authenticate_user.assert_called_once()
            mock_user_orm_service.update_last_login.assert_called_once()

    async def test_token_generation_with_user_context(self, authenticate_user_use_case,
                                                    valid_auth_request, mock_user_orm_service,
                                                    mock_authenticated_user, request_user_context):
        """Test proper token generation with user context information."""
        # Setup
        mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user
        mock_user_orm_service.update_last_login.return_value = True

        with patch('app.core.security.create_access_token') as mock_create_token:
            mock_create_token.return_value = "jwt_access_token_123"

            # Execute
            result = await authenticate_user_use_case.execute(valid_auth_request, request_user_context)

            # Verify token creation was called with correct data
            mock_create_token.assert_called_once()
            token_call_args = mock_create_token.call_args[1]
            assert "sub" in token_call_args["data"]
            assert "email" in token_call_args["data"]
            assert "role" in token_call_args["data"]
            assert token_call_args["data"]["sub"] == str(mock_authenticated_user.id)
            assert token_call_args["data"]["email"] == mock_authenticated_user.email
            assert token_call_args["data"]["role"] == mock_authenticated_user.role.value

            # Verify token is included in response
            assert result.access_token == "jwt_access_token_123"

    async def test_user_context_extraction_for_events(self, authenticate_user_use_case,
                                                     valid_auth_request, mock_user_orm_service,
                                                     mock_authenticated_user, request_user_context):
        """Test proper extraction and usage of request context for events."""
        # Setup
        mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user
        mock_user_orm_service.update_last_login.return_value = True

        # Add additional context
        enhanced_context = {
            **request_user_context,
            "forwarded_for": "10.0.0.1",
            "request_id": "req_123456"
        }

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            await authenticate_user_use_case.execute(valid_auth_request, enhanced_context)

            # Verify context information is included in event
            event_kwargs = mock_publish.call_args[1]
            assert event_kwargs["client_ip"] == "192.168.1.100"  # From request
            assert event_kwargs["user_agent"] == "Mozilla/5.0 Test Browser"  # From request

    async def test_authentication_timing_and_session_management(self, authenticate_user_use_case,
                                                              valid_auth_request, mock_user_orm_service,
                                                              mock_authenticated_user, request_user_context):
        """Test authentication timing and session management."""
        # Setup
        mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user
        mock_user_orm_service.update_last_login.return_value = True

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await authenticate_user_use_case.execute(valid_auth_request, request_user_context)

            # Verify session and timing information
            assert result.session_id is not None
            assert result.token_expires_at is not None
            assert result.token_expires_at > datetime.now()

            # Verify timing information in event
            event_kwargs = mock_publish.call_args[1]
            assert "login_timestamp" in event_kwargs
            # Should be recent timestamp
            login_time = datetime.fromisoformat(event_kwargs["login_timestamp"])
            time_diff = abs((datetime.now() - login_time).total_seconds())
            assert time_diff < 5  # Should be within 5 seconds

    @pytest.mark.parametrize("method,expected_status", [
        (AuthenticationMethod.EMAIL_PASSWORD, AuthenticationStatus.SUCCESS),
        (AuthenticationMethod.SSO_GOOGLE, AuthenticationStatus.INVALID_CREDENTIALS),
        (AuthenticationMethod.SSO_MICROSOFT, AuthenticationStatus.INVALID_CREDENTIALS),
        (AuthenticationMethod.API_KEY, AuthenticationStatus.INVALID_CREDENTIALS),
    ])
    async def test_authentication_method_handling(self, authenticate_user_use_case,
                                                 mock_user_orm_service, mock_authenticated_user,
                                                 request_user_context, method, expected_status):
        """Test different authentication methods and their handling."""
        # Setup
        request = AuthenticateUserRequest(authentication_method=method)
        
        if method == AuthenticationMethod.EMAIL_PASSWORD:
            request.email = "user@example.com"
            request.password = "password123"
            mock_user_orm_service.authenticate_user.return_value = mock_authenticated_user
            mock_user_orm_service.update_last_login.return_value = True
        elif method == AuthenticationMethod.API_KEY:
            request.api_key = "api_key_123"
        elif method in [AuthenticationMethod.SSO_GOOGLE, AuthenticationMethod.SSO_MICROSOFT]:
            request.sso_token = "sso_token_123"

        with patch.object(authenticate_user_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await authenticate_user_use_case.execute(request, request_user_context)

            # Verify correct status for each method
            assert result.status == expected_status

            # Verify event published with correct method
            event_kwargs = mock_publish.call_args[1]
            assert event_kwargs["authentication_method"] == method.value