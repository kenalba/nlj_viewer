"""
Unit tests for ManagePermissionsUseCase - User Permission Management Business Workflow.

Tests comprehensive permission management including business logic, ORM integration,
and xAPI event publishing for the event-driven architecture.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.user_management.manage_permissions_use_case import (
    ManagePermissionsUseCase,
    ManagePermissionsRequest,
    ManagePermissionsResponse,
    PermissionAction
)
from app.services.orm_services.user_orm_service import UserOrmService
from app.services.orm_services.permission_orm_service import PermissionOrmService
from app.services.orm_services.role_orm_service import RoleOrmService
from app.schemas.services.permission_schemas import (
    PermissionServiceSchema,
    UserPermissionSummaryServiceSchema
)
from app.models.user import UserRole

# Configure pytest-asyncio for async tests
pytestmark = pytest.mark.asyncio


class TestManagePermissionsUseCase:
    """Test ManagePermissionsUseCase business workflow and xAPI event integration."""

    @pytest.fixture
    def mock_session(self):
        """Create mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_user_orm_service(self):
        """Create mock UserOrmService."""
        return AsyncMock(spec=UserOrmService)

    @pytest.fixture
    def mock_permission_orm_service(self):
        """Create mock PermissionOrmService."""
        return AsyncMock(spec=PermissionOrmService)

    @pytest.fixture
    def mock_role_orm_service(self):
        """Create mock RoleOrmService."""
        return AsyncMock(spec=RoleOrmService)

    @pytest.fixture
    def manage_permissions_use_case(self, mock_session, mock_user_orm_service,
                                  mock_permission_orm_service, mock_role_orm_service):
        """Create ManagePermissionsUseCase instance with mocked dependencies."""
        return ManagePermissionsUseCase(
            mock_session,
            mock_user_orm_service,
            mock_permission_orm_service,
            mock_role_orm_service
        )

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
    def approver_user_context(self):
        """Create approver user context."""
        return {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.APPROVER,
            "user_name": "Approver User",
            "user_email": "approver@example.com"
        }

    @pytest.fixture
    def target_user_id(self):
        """Create target user ID for permission operations."""
        return uuid.uuid4()

    @pytest.fixture
    def mock_target_user(self, target_user_id):
        """Create mock target user."""
        mock_user = MagicMock()
        mock_user.id = target_user_id
        mock_user.username = "targetuser"
        mock_user.email = "target@example.com"
        mock_user.full_name = "Target User"
        mock_user.role = UserRole.CREATOR
        mock_user.is_active = True
        mock_user.is_verified = True
        mock_user.created_at = datetime.now(timezone.utc)
        mock_user.updated_at = datetime.now(timezone.utc)
        return mock_user

    @pytest.fixture
    def mock_permission_change(self):
        """Create mock permission change record."""
        change_id = uuid.uuid4()
        mock_change = MagicMock()
        mock_change.id = change_id
        mock_change.user_id = uuid.uuid4()
        mock_change.changed_by = uuid.uuid4()
        mock_change.old_role = UserRole.CREATOR
        mock_change.new_role = UserRole.REVIEWER
        mock_change.change_reason = "Promotion to reviewer role"
        mock_change.changed_at = datetime.now(timezone.utc)
        return mock_change

    async def test_change_user_role_success(self, manage_permissions_use_case, admin_user_context,
                                          target_user_id, mock_user_orm_service, mock_permission_orm_service,
                                          mock_target_user, mock_permission_change):
        """Test successful user role change with xAPI event publishing."""
        # Setup
        role_change_request = ManagePermissionsRequest(
            action=PermissionAction.CHANGE_USER_ROLE,
            target_user_id=target_user_id,
            new_role=UserRole.REVIEWER,
            change_reason="Promotion to reviewer role"
        )

        # Mock user with updated role
        updated_user = MagicMock()
        updated_user.id = target_user_id
        updated_user.username = "targetuser"
        updated_user.email = "target@example.com"
        updated_user.full_name = "Target User"
        updated_user.role = UserRole.REVIEWER  # Updated role
        updated_user.is_active = True
        updated_user.is_verified = True
        updated_user.created_at = datetime.now(timezone.utc)
        updated_user.updated_at = datetime.now(timezone.utc)

        mock_user_orm_service.get_by_id.return_value = mock_target_user
        mock_user_orm_service.update_user_role.return_value = updated_user
        mock_permission_orm_service.create_role_change_record.return_value = mock_permission_change

        with patch.object(manage_permissions_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_permissions_use_case.execute(role_change_request, admin_user_context)

            # Verify ORM service calls
            mock_user_orm_service.get_by_id.assert_called_once_with(target_user_id)
            mock_user_orm_service.update_user_role.assert_called_once_with(
                target_user_id, UserRole.REVIEWER
            )
            mock_permission_orm_service.create_role_change_record.assert_called_once()

            # Verify response structure
            assert isinstance(result, ManagePermissionsResponse)
            assert result.action_taken == PermissionAction.CHANGE_USER_ROLE
            assert result.target_user_id == target_user_id
            assert result.user_data["role"] == UserRole.REVIEWER.value
            assert result.permission_change is not None

            # Verify xAPI event publishing - permission changes should publish proper xAPI events
            mock_publish.assert_called_once()
            event_call = mock_publish.call_args

            # Check for role change xAPI event
            assert event_call[0][0] == "publish_permissions_role_changed"
            event_kwargs = event_call[1]

            # Verify xAPI structure is maintained
            assert "target_user_id" in event_kwargs
            assert "changer_id" in event_kwargs
            assert "old_role" in event_kwargs
            assert "new_role" in event_kwargs
            assert "change_reason" in event_kwargs
            assert "change_timestamp" in event_kwargs
            assert event_kwargs["target_user_id"] == str(target_user_id)
            assert event_kwargs["changer_id"] == admin_user_context["user_id"]
            assert event_kwargs["old_role"] == "creator"
            assert event_kwargs["new_role"] == "reviewer"
            assert event_kwargs["change_reason"] == "Promotion to reviewer role"

    async def test_check_permissions_success(self, manage_permissions_use_case, admin_user_context,
                                           target_user_id, mock_user_orm_service, mock_permission_orm_service,
                                           mock_target_user):
        """Test successful permission checking with summary generation."""
        # Setup
        check_request = ManagePermissionsRequest(
            action=PermissionAction.CHECK_PERMISSIONS,
            target_user_id=target_user_id
        )

        # Mock permission summary
        mock_permission_summary = MagicMock()
        mock_permission_summary.user_id = target_user_id
        mock_permission_summary.role = UserRole.CREATOR
        mock_permission_summary.effective_permissions = [
            "create_content", "edit_own_content", "view_content"
        ]
        mock_permission_summary.inherited_permissions = []
        mock_permission_summary.last_role_change = datetime.now(timezone.utc)

        mock_user_orm_service.get_by_id.return_value = mock_target_user
        mock_permission_orm_service.get_user_permission_summary.return_value = mock_permission_summary

        with patch.object(manage_permissions_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_permissions_use_case.execute(check_request, admin_user_context)

            # Verify permission check
            mock_permission_orm_service.get_user_permission_summary.assert_called_once_with(target_user_id)

            # Verify response
            assert result.action_taken == PermissionAction.CHECK_PERMISSIONS
            assert result.permission_summary is not None
            assert len(result.permission_summary.effective_permissions) == 3

            # Verify monitoring event published
            mock_publish.assert_called_once()
            event_call = mock_publish.call_args
            assert event_call[0][0] == "publish_permissions_permission_checked"
            event_kwargs = event_call[1]
            assert event_kwargs["target_user_id"] == str(target_user_id)
            assert event_kwargs["checker_id"] == admin_user_context["user_id"]

    async def test_list_user_permissions_success(self, manage_permissions_use_case, admin_user_context,
                                               target_user_id, mock_user_orm_service, mock_permission_orm_service,
                                               mock_target_user):
        """Test successful user permissions listing."""
        # Setup
        list_request = ManagePermissionsRequest(
            action=PermissionAction.LIST_USER_PERMISSIONS,
            target_user_id=target_user_id
        )

        # Mock detailed permission list
        mock_permissions = [
            {
                "permission": "create_content",
                "source": "role",
                "granted_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "permission": "edit_own_content", 
                "source": "role",
                "granted_at": datetime.now(timezone.utc).isoformat()
            }
        ]

        mock_user_orm_service.get_by_id.return_value = mock_target_user
        mock_permission_orm_service.get_detailed_user_permissions.return_value = mock_permissions

        with patch.object(manage_permissions_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_permissions_use_case.execute(list_request, admin_user_context)

            # Verify permissions listing
            mock_permission_orm_service.get_detailed_user_permissions.assert_called_once_with(target_user_id)

            # Verify response contains permission details
            assert result.action_taken == PermissionAction.LIST_USER_PERMISSIONS
            assert len(result.user_data["permissions"]) == 2

            # Verify audit event published
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert "permissions_listed" in event_kwargs

    async def test_get_role_statistics_success(self, manage_permissions_use_case, admin_user_context,
                                             target_user_id, mock_role_orm_service):
        """Test successful role statistics retrieval."""
        # Setup
        stats_request = ManagePermissionsRequest(
            action=PermissionAction.GET_ROLE_STATISTICS,
            target_user_id=target_user_id  # Required but not used for org stats
        )

        # Mock role statistics
        mock_role_stats = {
            "total_users": 150,
            "role_distribution": {
                "player": 45,
                "learner": 50,
                "creator": 35,
                "reviewer": 15,
                "approver": 4,
                "admin": 1
            },
            "recent_role_changes": 8,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

        mock_role_orm_service.get_role_statistics.return_value = mock_role_stats

        with patch.object(manage_permissions_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_permissions_use_case.execute(stats_request, admin_user_context)

            # Verify statistics retrieval
            mock_role_orm_service.get_role_statistics.assert_called_once()

            # Verify response contains statistics
            assert result.action_taken == PermissionAction.GET_ROLE_STATISTICS
            assert result.role_statistics is not None
            assert result.role_statistics["total_users"] == 150
            assert len(result.role_statistics["role_distribution"]) == 6

            # Verify analytics event published
            mock_publish.assert_called_once()
            event_kwargs = mock_publish.call_args[1]
            assert "statistics_accessed" in event_kwargs

    async def test_get_assignable_roles_success(self, manage_permissions_use_case, approver_user_context,
                                              target_user_id, mock_role_orm_service):
        """Test successful retrieval of assignable roles based on user permissions."""
        # Setup
        assignable_request = ManagePermissionsRequest(
            action=PermissionAction.GET_ASSIGNABLE_ROLES,
            target_user_id=target_user_id
        )

        # Mock assignable roles for approver (can assign up to reviewer)
        mock_assignable_roles = [
            {
                "role": "player",
                "can_assign": True,
                "description": "Basic player access"
            },
            {
                "role": "learner", 
                "can_assign": True,
                "description": "Learning platform access"
            },
            {
                "role": "creator",
                "can_assign": True,
                "description": "Content creation access"
            },
            {
                "role": "reviewer",
                "can_assign": True,
                "description": "Content review access"
            },
            {
                "role": "approver",
                "can_assign": False,  # Approvers cannot assign approver role
                "description": "Content approval access"
            },
            {
                "role": "admin",
                "can_assign": False,  # Only admins can assign admin role
                "description": "Full system access"
            }
        ]

        mock_role_orm_service.get_assignable_roles.return_value = mock_assignable_roles

        with patch.object(manage_permissions_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await manage_permissions_use_case.execute(assignable_request, approver_user_context)

            # Verify assignable roles retrieval
            mock_role_orm_service.get_assignable_roles.assert_called_once_with(
                requester_role=UserRole.APPROVER
            )

            # Verify response contains assignable roles
            assert result.action_taken == PermissionAction.GET_ASSIGNABLE_ROLES
            assert result.assignable_roles is not None
            assert len(result.assignable_roles) == 6

            # Count assignable vs non-assignable
            assignable_count = sum(1 for role in result.assignable_roles if role["can_assign"])
            assert assignable_count == 4  # Approver can assign player, learner, creator, reviewer

            # Verify query event published
            mock_publish.assert_called_once()

    async def test_permission_validation_non_admin_role_change(self, manage_permissions_use_case,
                                                             target_user_id):
        """Test permission validation - non-admin cannot change roles."""
        # Setup - creator trying to change roles (should fail)
        creator_context = {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.CREATOR,
            "user_name": "Creator User",
            "user_email": "creator@example.com"
        }

        role_change_request = ManagePermissionsRequest(
            action=PermissionAction.CHANGE_USER_ROLE,
            target_user_id=target_user_id,
            new_role=UserRole.REVIEWER
        )

        # Execute & Verify - should raise permission error
        with pytest.raises(PermissionError, match="manage user roles"):
            await manage_permissions_use_case.execute(role_change_request, creator_context)

    async def test_role_change_validation_invalid_transition(self, manage_permissions_use_case,
                                                           admin_user_context, target_user_id,
                                                           mock_user_orm_service, mock_target_user):
        """Test role change validation for invalid role transitions."""
        # Setup - trying to change to same role
        same_role_request = ManagePermissionsRequest(
            action=PermissionAction.CHANGE_USER_ROLE,
            target_user_id=target_user_id,
            new_role=UserRole.CREATOR,  # Same as current role
            change_reason="No change needed"
        )

        mock_user_orm_service.get_by_id.return_value = mock_target_user

        # Execute & Verify
        with pytest.raises(ValueError, match="already has role"):
            await manage_permissions_use_case.execute(same_role_request, admin_user_context)

    async def test_user_not_found_error(self, manage_permissions_use_case, admin_user_context,
                                      mock_user_orm_service):
        """Test error handling when target user is not found."""
        non_existent_user_id = uuid.uuid4()
        
        # Setup
        request = ManagePermissionsRequest(
            action=PermissionAction.CHECK_PERMISSIONS,
            target_user_id=non_existent_user_id
        )

        mock_user_orm_service.get_by_id.return_value = None

        # Execute & Verify
        with pytest.raises(ValueError, match="User not found"):
            await manage_permissions_use_case.execute(request, admin_user_context)

    async def test_service_error_handling_with_rollback(self, manage_permissions_use_case,
                                                      admin_user_context, target_user_id,
                                                      mock_user_orm_service, mock_session):
        """Test proper error handling and transaction rollback on service failures."""
        # Setup
        request = ManagePermissionsRequest(
            action=PermissionAction.CHANGE_USER_ROLE,
            target_user_id=target_user_id,
            new_role=UserRole.REVIEWER
        )

        # Mock service to raise exception
        mock_user_orm_service.get_by_id.side_effect = Exception("Database connection error")

        # Execute & Verify
        with pytest.raises(RuntimeError, match="permission management"):
            await manage_permissions_use_case.execute(request, admin_user_context)

        # Verify rollback was called (transaction safety)
        mock_session.rollback.assert_called_once()

    async def test_event_driven_architecture_resilience(self, manage_permissions_use_case,
                                                       admin_user_context, target_user_id,
                                                       mock_user_orm_service, mock_permission_orm_service,
                                                       mock_target_user, mock_permission_change):
        """Test that business operations continue even if event publishing fails."""
        # Setup
        role_change_request = ManagePermissionsRequest(
            action=PermissionAction.CHANGE_USER_ROLE,
            target_user_id=target_user_id,
            new_role=UserRole.REVIEWER,
            change_reason="Test promotion"
        )

        updated_user = MagicMock()
        updated_user.id = target_user_id
        updated_user.role = UserRole.REVIEWER
        updated_user.username = "targetuser"
        updated_user.email = "target@example.com"

        mock_user_orm_service.get_by_id.return_value = mock_target_user
        mock_user_orm_service.update_user_role.return_value = updated_user
        mock_permission_orm_service.create_role_change_record.return_value = mock_permission_change

        # Mock event publishing to fail
        with patch.object(manage_permissions_use_case, '_publish_event',
                         side_effect=Exception("Kafka down")):
            # Execute - should still succeed despite event failure
            result = await manage_permissions_use_case.execute(role_change_request, admin_user_context)

            # Business operation should still succeed
            assert result.action_taken == PermissionAction.CHANGE_USER_ROLE
            assert result.user_data["role"] == UserRole.REVIEWER.value

            # Role change should still be processed
            mock_user_orm_service.update_user_role.assert_called_once()
            mock_permission_orm_service.create_role_change_record.assert_called_once()

    @pytest.mark.parametrize("action,expected_event", [
        (PermissionAction.CHANGE_USER_ROLE, "publish_permissions_role_changed"),
        (PermissionAction.CHECK_PERMISSIONS, "publish_permissions_permission_checked"),
        (PermissionAction.LIST_USER_PERMISSIONS, "publish_permissions_permissions_listed"),
        (PermissionAction.GET_ROLE_STATISTICS, "publish_permissions_statistics_accessed"),
    ])
    async def test_action_specific_xapi_events(self, manage_permissions_use_case, admin_user_context,
                                             target_user_id, mock_user_orm_service, mock_permission_orm_service,
                                             mock_role_orm_service, mock_target_user, mock_permission_change,
                                             action, expected_event):
        """Test that each action publishes the correct xAPI event type."""
        # Setup request based on action type
        request = ManagePermissionsRequest(
            action=action,
            target_user_id=target_user_id,
            new_role=UserRole.REVIEWER if action == PermissionAction.CHANGE_USER_ROLE else None,
            change_reason="Test reason" if action == PermissionAction.CHANGE_USER_ROLE else None
        )

        # Setup appropriate mocks for each action
        mock_user_orm_service.get_by_id.return_value = mock_target_user

        if action == PermissionAction.CHANGE_USER_ROLE:
            updated_user = MagicMock()
            updated_user.role = UserRole.REVIEWER
            mock_user_orm_service.update_user_role.return_value = updated_user
            mock_permission_orm_service.create_role_change_record.return_value = mock_permission_change
        elif action == PermissionAction.CHECK_PERMISSIONS:
            mock_summary = MagicMock()
            mock_summary.effective_permissions = ["create_content"]
            mock_permission_orm_service.get_user_permission_summary.return_value = mock_summary
        elif action == PermissionAction.LIST_USER_PERMISSIONS:
            mock_permission_orm_service.get_detailed_user_permissions.return_value = []
        elif action == PermissionAction.GET_ROLE_STATISTICS:
            mock_role_orm_service.get_role_statistics.return_value = {"total_users": 100}

        with patch.object(manage_permissions_use_case, '_publish_event') as mock_publish:
            # Execute
            await manage_permissions_use_case.execute(request, admin_user_context)

            # Verify correct xAPI event type is published
            mock_publish.assert_called()
            event_call = mock_publish.call_args
            assert expected_event in event_call[0][0]