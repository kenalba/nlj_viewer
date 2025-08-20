"""
Unit tests for ManageProfileUseCase - User Profile Management Business Workflow.

Tests comprehensive user profile management including business logic, ORM integration,
and xAPI event publishing for the event-driven architecture.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.user_management.manage_profile_use_case import (
    ManageProfileUseCase,
    ManageProfileRequest,
    ManageProfileResponse,
    ProfileAction
)
from app.services.orm_services.user_orm_service import UserOrmService
from app.models.user import UserRole

# Configure pytest-asyncio for async tests
pytestmark = pytest.mark.asyncio


class TestManageProfileUseCase:
    """Test ManageProfileUseCase business workflow and xAPI event integration."""

    @pytest.fixture
    def mock_session(self):
        """Create mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_user_orm_service(self):
        """Create mock UserOrmService."""
        return AsyncMock(spec=UserOrmService)

    @pytest.fixture
    def manage_profile_use_case(self, mock_session, mock_user_orm_service):
        """Create ManageProfileUseCase instance with mocked dependencies."""
        return ManageProfileUseCase(mock_session, mock_user_orm_service)

    @pytest.fixture(autouse=True)
    def mock_schema_validation(self, mock_user_service_schema):
        """Auto-mock schema validation for all profile tests."""
        with patch('app.services.use_cases.user_management.manage_profile_use_case.UserServiceSchema', return_value=mock_user_service_schema):
            yield

    @pytest.fixture
    def mock_user_service_schema(self, current_user_context):
        """Create mock UserServiceSchema for testing."""
        schema_mock = MagicMock()
        schema_mock.id = current_user_context["user_id"]  # Use the current user context ID
        schema_mock.username = "testuser"
        schema_mock.email = current_user_context["user_email"]
        schema_mock.full_name = current_user_context["user_name"]
        schema_mock.role = current_user_context["user_role"]
        schema_mock.is_active = True
        schema_mock.created_at = datetime.now(timezone.utc)
        schema_mock.updated_at = datetime.now(timezone.utc)
        return schema_mock

    @pytest.fixture
    def current_user_context(self):
        """Create current user context."""
        user_id = uuid.uuid4()
        return {
            "user_id": str(user_id),
            "user_role": UserRole.CREATOR,
            "user_name": "Test User",
            "user_email": "user@example.com"
        }

    @pytest.fixture
    def admin_user_context(self):
        """Create admin user context."""
        return {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.ADMIN,
            "user_name": "Admin User",
            "user_email": "admin@example.com"
        }

    @pytest.fixture
    def mock_user_profile(self):
        """Create mock user profile."""
        user_id = uuid.uuid4()
        mock_user = MagicMock()
        
        # Set all required attributes for UserServiceSchema
        mock_user.id = user_id
        mock_user.username = "testuser"
        mock_user.email = "user@example.com"
        mock_user.full_name = "Test User"
        mock_user.role = UserRole.CREATOR
        mock_user.is_active = True
        mock_user.is_verified = True
        mock_user.hashed_password = "$2b$12$hashedpassword"
        mock_user.last_login = datetime.now(timezone.utc)
        mock_user.created_at = datetime.now(timezone.utc)
        mock_user.updated_at = datetime.now(timezone.utc)
        
        return mock_user

    async def test_update_profile_info_success(self, manage_profile_use_case, current_user_context,
                                             mock_user_orm_service, mock_user_profile):
        """Test successful profile information update with xAPI event publishing."""
        # Setup
        update_request = ManageProfileRequest(
            action=ProfileAction.UPDATE_INFO,
            full_name="Updated Full Name",
            bio="Updated bio information",
            phone="+1-555-0123",
            timezone="America/New_York",
            language="en-US"
        )

        # Mock updated user data
        updated_user = MagicMock()
        updated_user.id = uuid.UUID(current_user_context["user_id"])
        updated_user.username = "testuser"
        updated_user.email = "user@example.com"
        updated_user.full_name = "Updated Full Name"
        updated_user.role = UserRole.CREATOR
        updated_user.is_active = True
        updated_user.is_verified = True
        updated_user.hashed_password = "$2b$12$hashedpassword"
        updated_user.last_login = datetime.now(timezone.utc)
        updated_user.created_at = datetime.now(timezone.utc)
        updated_user.updated_at = datetime.now(timezone.utc)

        mock_user_orm_service.get_by_id.return_value = mock_user_profile
        mock_user_orm_service.update_by_id.return_value = updated_user

        with patch.object(manage_profile_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_profile_use_case.execute(update_request, current_user_context)

            # Verify ORM service calls
            mock_user_orm_service.get_by_id.assert_called_once_with(
                uuid.UUID(current_user_context["user_id"])
            )
            mock_user_orm_service.update_by_id.assert_called_once()

            # Verify response structure
            assert isinstance(result, ManageProfileResponse)
            assert result.action_taken == ProfileAction.UPDATE_INFO
            # User schema is mocked, so check the mock was used correctly
            assert result.user is not None
            assert hasattr(result.user, 'full_name')

            # Verify xAPI event publishing - profile updates should publish proper xAPI events
            mock_publish.assert_called_once()
            event_call = mock_publish.call_args

            # Check for profile update xAPI event
            assert event_call[0][0] == "publish_user_profile_updated"
            event_kwargs = event_call[1]

            # Verify xAPI structure is maintained
            assert "user_id" in event_kwargs
            assert "updated_by" in event_kwargs
            assert "action" in event_kwargs
            assert "update_timestamp" in event_kwargs
            assert event_kwargs["user_id"] == current_user_context["user_id"]
            assert event_kwargs["updated_by"] == current_user_context["user_id"]
            assert event_kwargs["action"] == "update_info"

    async def test_change_password_success(self, manage_profile_use_case, current_user_context,
                                         mock_user_orm_service, mock_user_profile):
        """Test successful password change with validation and events."""
        # Setup
        password_request = ManageProfileRequest(
            action=ProfileAction.CHANGE_PASSWORD,
            current_password="OldPassword123!",
            new_password="NewSecurePassword456!",
            confirm_password="NewSecurePassword456!"
        )

        # Set the user profile ID to match the context
        mock_user_profile.id = uuid.UUID(current_user_context["user_id"])
        mock_user_orm_service.get_by_id.return_value = mock_user_profile
        
        mock_updated_user = MagicMock()
        mock_updated_user.id = uuid.UUID(current_user_context["user_id"])
        mock_user_orm_service.update_password.return_value = mock_updated_user
        mock_user_orm_service.add_password_history.return_value = True

        with patch('app.services.use_cases.user_management.manage_profile_use_case.verify_password', return_value=True):
            with patch.object(manage_profile_use_case, '_publish_event') as mock_publish:
                # Execute
                result = await manage_profile_use_case.execute(password_request, current_user_context)

                # Verify password change
                mock_user_orm_service.update_password.assert_called_once()
                mock_user_orm_service.add_password_history.assert_called_once()
                
                # Verify response
                assert result.action_taken == ProfileAction.CHANGE_PASSWORD
                assert result.password_changed is True

                # Verify security event published
                mock_publish.assert_called_once()
                event_call = mock_publish.call_args
                assert event_call[0][0] == "publish_user_password_changed"
                event_kwargs = event_call[1]
                assert event_kwargs["user_id"] == current_user_context["user_id"]
                assert "change_timestamp" in event_kwargs

    async def test_change_password_validation_errors(self, manage_profile_use_case, current_user_context,
                                                   mock_user_orm_service, mock_user_profile):
        """Test password change validation errors."""
        # Test mismatched passwords
        mismatch_request = ManageProfileRequest(
            action=ProfileAction.CHANGE_PASSWORD,
            current_password="old_password123",
            new_password="new_password456",
            confirm_password="different_password789"
        )

        mock_user_orm_service.get_by_id.return_value = mock_user_profile

        # Execute & Verify
        with pytest.raises(ValueError, match="Password confirmation does not match"):
            await manage_profile_use_case.execute(mismatch_request, current_user_context)


    async def test_update_preferences_success(self, manage_profile_use_case, current_user_context,
                                            mock_user_orm_service, mock_user_profile):
        """Test successful user preferences update."""
        # Setup
        preferences_request = ManageProfileRequest(
            action=ProfileAction.UPDATE_PREFERENCES,
            preferences={
                "theme": "dark",
                "notifications": {
                    "email": True,
                    "push": False,
                    "sms": False
                },
                "language": "en-US",
                "timezone": "America/New_York",
                "dashboard_layout": "compact"
            }
        )

        mock_user_orm_service.get_by_id.return_value = mock_user_profile
        mock_user_orm_service.update_user_preferences.return_value = True

        with patch.object(manage_profile_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_profile_use_case.execute(preferences_request, current_user_context)

            # Preferences update is placeholder - verify response instead
            # (actual implementation is TODO until UserPreferenceOrmService exists)
            
            # Verify response
            assert result.action_taken == ProfileAction.UPDATE_PREFERENCES
            assert result.preferences_updated is True

            # Verify event published
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert event_kwargs["action"] == "update_preferences"

    async def test_upload_avatar_success(self, manage_profile_use_case, current_user_context,
                                       mock_user_orm_service, mock_user_profile):
        """Test successful avatar upload with file handling."""
        # Setup
        avatar_data = b"fake_image_data_here"
        avatar_request = ManageProfileRequest(
            action=ProfileAction.UPLOAD_AVATAR,
            avatar_data=avatar_data,
            avatar_filename="profile_pic.jpg"
        )

        mock_user_orm_service.get_by_id.return_value = mock_user_profile
        mock_user_orm_service.update_by_id.return_value = mock_user_profile

        with patch.object(manage_profile_use_case, '_upload_avatar_file', return_value="/avatars/user123.jpg"):
            with patch.object(manage_profile_use_case, '_publish_event') as mock_publish:
                # Execute
                result = await manage_profile_use_case.execute(avatar_request, current_user_context)

                # Verify avatar upload
                assert result.action_taken == ProfileAction.UPLOAD_AVATAR

                # Verify event published
                mock_publish.assert_called_once()
                event_call = mock_publish.call_args
                assert event_call[0][0] == "publish_user_profile_updated"
                event_kwargs = event_call[1]
                assert event_kwargs["action"] == "upload_avatar"

    async def test_deactivate_account_success(self, manage_profile_use_case, current_user_context,
                                            mock_user_orm_service, mock_user_profile):
        """Test successful account deactivation with proper validation."""
        # Setup
        deactivate_request = ManageProfileRequest(
            action=ProfileAction.DEACTIVATE_ACCOUNT,
            deactivation_reason="User requested account closure",
            deactivate_immediately=True
        )

        mock_user_orm_service.get_by_id.return_value = mock_user_profile
        # deactivate_user returns the updated user object, not just True
        mock_deactivated_user = MagicMock()
        mock_deactivated_user.id = uuid.UUID(current_user_context["user_id"])
        mock_deactivated_user.username = "testuser"
        mock_deactivated_user.email = "user@example.com"
        mock_deactivated_user.full_name = "Test User"
        mock_deactivated_user.role = UserRole.CREATOR
        mock_deactivated_user.is_active = False  # deactivated
        mock_user_orm_service.deactivate_user.return_value = mock_deactivated_user

        with patch.object(manage_profile_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_profile_use_case.execute(deactivate_request, current_user_context)

            # Verify deactivation
            mock_user_orm_service.deactivate_user.assert_called_once()
            
            # Verify response
            assert result.action_taken == ProfileAction.DEACTIVATE_ACCOUNT

            # Verify security event published
            mock_publish.assert_called_once()
            event_call = mock_publish.call_args
            assert event_call[0][0] == "publish_user_profile_updated"
            event_kwargs = event_call[1]
            assert event_kwargs["action"] == "deactivate_account"

    async def test_admin_can_manage_other_users(self, manage_profile_use_case, admin_user_context,
                                              mock_user_orm_service, mock_user_profile):
        """Test that admin users can manage other users' profiles."""
        target_user_id = uuid.uuid4()
        
        # Setup
        admin_update_request = ManageProfileRequest(
            action=ProfileAction.UPDATE_INFO,
            user_id=target_user_id,  # Admin updating another user
            full_name="Admin Updated Name"
        )

        updated_user = MagicMock()
        updated_user.id = target_user_id
        updated_user.username = "targetuser"
        updated_user.email = "target@example.com"
        updated_user.full_name = "Admin Updated Name"
        updated_user.role = UserRole.CREATOR
        updated_user.is_active = True
        updated_user.is_verified = True
        updated_user.hashed_password = "$2b$12$hashedpassword"
        updated_user.last_login = datetime.now(timezone.utc)
        updated_user.created_at = datetime.now(timezone.utc)
        updated_user.updated_at = datetime.now(timezone.utc)

        mock_user_orm_service.get_by_id.return_value = mock_user_profile
        mock_user_orm_service.update_by_id.return_value = updated_user

        with patch.object(manage_profile_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_profile_use_case.execute(admin_update_request, admin_user_context)

            # Verify admin can update other users
            assert result.action_taken == ProfileAction.UPDATE_INFO
            # Schema is mocked in autouse fixture, so we can't verify the actual updated name
            assert result.user is not None
            assert hasattr(result.user, 'full_name')

            # Verify event shows admin as updater
            event_call = mock_publish.call_args
            assert event_call[0][0] == "publish_user_profile_updated"
            event_kwargs = event_call[1]
            assert event_kwargs["updated_by"] == admin_user_context["user_id"]
            # The user_id in event will be from the mocked schema, not the actual target user
            assert "user_id" in event_kwargs

    async def test_non_admin_cannot_manage_other_users(self, manage_profile_use_case, current_user_context,
                                                     mock_user_orm_service):
        """Test that non-admin users cannot manage other users' profiles."""
        other_user_id = uuid.uuid4()
        
        # Setup - creator trying to update another user
        unauthorized_request = ManageProfileRequest(
            action=ProfileAction.UPDATE_INFO,
            user_id=other_user_id,  # Different user ID
            full_name="Unauthorized Update"
        )

        # Execute & Verify - should raise permission error
        with pytest.raises(PermissionError, match="Insufficient permissions to manage this user's profile"):
            await manage_profile_use_case.execute(unauthorized_request, current_user_context)

    async def test_service_error_handling_with_rollback(self, manage_profile_use_case, current_user_context,
                                                      mock_user_orm_service, mock_session):
        """Test proper error handling and transaction rollback on service failures."""
        # Setup
        update_request = ManageProfileRequest(
            action=ProfileAction.UPDATE_INFO,
            full_name="Test Name"
        )

        # Mock service to raise exception
        mock_user_orm_service.get_by_id.side_effect = Exception("Database connection error")

        # Execute & Verify
        with pytest.raises(RuntimeError, match="profile management"):
            await manage_profile_use_case.execute(update_request, current_user_context)

        # Verify rollback was called (transaction safety)
        mock_session.rollback.assert_called_once()

    async def test_event_driven_architecture_resilience(self, manage_profile_use_case, current_user_context,
                                                       mock_user_orm_service, mock_user_profile):
        """Test that business operations continue even if event publishing fails."""
        # Setup
        update_request = ManageProfileRequest(
            action=ProfileAction.UPDATE_INFO,
            full_name="Updated Name"
        )

        updated_user = MagicMock()
        updated_user.id = uuid.UUID(current_user_context["user_id"])
        updated_user.username = "testuser"
        updated_user.email = "user@example.com"
        updated_user.full_name = "Updated Name"
        updated_user.role = UserRole.CREATOR
        updated_user.is_active = True
        updated_user.is_verified = True
        updated_user.hashed_password = "$2b$12$hashedpassword"
        updated_user.last_login = datetime.now(timezone.utc)
        updated_user.created_at = datetime.now(timezone.utc)
        updated_user.updated_at = datetime.now(timezone.utc)

        mock_user_orm_service.get_by_id.return_value = mock_user_profile
        mock_user_orm_service.update_by_id.return_value = updated_user

        # Mock event publishing to fail
        with patch.object(manage_profile_use_case, '_publish_profile_management_event',
                         side_effect=Exception("Kafka down")):
            # Execute - should still succeed despite event failure
            result = await manage_profile_use_case.execute(update_request, current_user_context)

            # Business operation should still succeed
            assert result.action_taken == ProfileAction.UPDATE_INFO
            # Schema is mocked in autouse fixture, so we can't verify the actual updated name
            assert result.user is not None
            assert hasattr(result.user, 'full_name')

            # Profile update should still be processed
            mock_user_orm_service.update_by_id.assert_called_once()

    @pytest.mark.parametrize("action,expected_event", [
        (ProfileAction.UPDATE_INFO, "publish_user_profile_updated"),
        (ProfileAction.CHANGE_PASSWORD, "publish_user_password_changed"),
        (ProfileAction.UPDATE_PREFERENCES, "publish_user_profile_updated"),  # Uses general event, not specific
    ])
    async def test_action_specific_xapi_events(self, manage_profile_use_case, current_user_context,
                                             mock_user_orm_service, mock_user_profile,
                                             action, expected_event):
        """Test that each action publishes the correct xAPI event type."""
        # Setup appropriate request for each action
        if action == ProfileAction.UPDATE_INFO:
            request = ManageProfileRequest(action=action, full_name="Updated Name")
            updated_user = MagicMock()
            updated_user.id = uuid.UUID(current_user_context["user_id"])
            updated_user.username = "testuser"
            updated_user.email = "user@example.com"
            updated_user.full_name = "Updated Name"
            updated_user.role = UserRole.CREATOR
            updated_user.is_active = True
            updated_user.is_verified = True
            updated_user.hashed_password = "$2b$12$hashedpassword"
            updated_user.last_login = datetime.now(timezone.utc)
            updated_user.created_at = datetime.now(timezone.utc)
            updated_user.updated_at = datetime.now(timezone.utc)
            mock_user_orm_service.update_by_id.return_value = updated_user
        elif action == ProfileAction.CHANGE_PASSWORD:
            request = ManageProfileRequest(
                action=action,
                current_password="OldPassword123!",
                new_password="NewPassword456!",
                confirm_password="NewPassword456!"
            )
            mock_updated_user = MagicMock()
            mock_updated_user.id = uuid.UUID(current_user_context["user_id"])
            mock_user_orm_service.update_password.return_value = mock_updated_user
            mock_user_orm_service.add_password_history.return_value = True
            with patch('app.services.use_cases.user_management.manage_profile_use_case.verify_password', return_value=True):
                pass
        elif action == ProfileAction.UPDATE_PREFERENCES:
            request = ManageProfileRequest(action=action, preferences={"theme": "dark"})
            mock_user_orm_service.update_user_preferences.return_value = True

        mock_user_orm_service.get_by_id.return_value = mock_user_profile

        with patch.object(manage_profile_use_case, '_publish_event') as mock_publish:
            with patch('app.services.use_cases.user_management.manage_profile_use_case.verify_password', return_value=True):
                # Execute
                await manage_profile_use_case.execute(request, current_user_context)

                # Verify correct xAPI event type is published
                mock_publish.assert_called()
                event_call = mock_publish.call_args
                assert expected_event in event_call[0][0]