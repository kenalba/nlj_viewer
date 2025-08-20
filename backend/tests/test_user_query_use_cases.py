"""
Tests for user query use cases (GetUserUseCase and ListUsersUseCase).

Tests both the business logic and permission validation for user retrieval operations.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
from datetime import datetime

from app.models.user import UserRole
from app.schemas.services.user_schemas import UserServiceSchema
from app.services.use_cases.user_management.get_user_use_case import (
    GetUserUseCase, GetUserRequest, GetUserResponse
)
from app.services.use_cases.user_management.list_users_use_case import (
    ListUsersUseCase, ListUsersRequest, ListUsersResponse, UserListSortBy
)


@pytest.fixture
def mock_session():
    """Mock database session."""
    session = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def mock_user_orm_service():
    """Mock user ORM service."""
    service = AsyncMock()
    
    # Mock user data
    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.email = "test@example.com"
    mock_user.username = "testuser" 
    mock_user.full_name = "Test User"
    mock_user.role = UserRole.CREATOR
    mock_user.is_active = True
    mock_user.created_at = datetime.now()
    mock_user.updated_at = datetime.now()
    mock_user.last_login = None
    
    service.get_by_id.return_value = mock_user
    service.get_users.return_value = [mock_user]
    service.get_user_count.return_value = 1
    
    return service


@pytest.fixture
def get_user_use_case(mock_session, mock_user_orm_service):
    """GetUserUseCase instance with mocked dependencies."""
    use_case = GetUserUseCase(
        session=mock_session,
        user_orm_service=mock_user_orm_service
    )
    return use_case


@pytest.fixture
def list_users_use_case(mock_session, mock_user_orm_service):
    """ListUsersUseCase instance with mocked dependencies."""
    use_case = ListUsersUseCase(
        session=mock_session,
        user_orm_service=mock_user_orm_service
    )
    return use_case


@pytest.fixture
def admin_user_context():
    """Admin user context for testing."""
    return {
        "user_id": str(uuid4()),
        "user_role": UserRole.ADMIN,
        "user_name": "Admin User",
        "user_email": "admin@example.com"
    }


@pytest.fixture
def regular_user_context():
    """Regular user context for testing."""
    user_id = uuid4()
    return {
        "user_id": str(user_id),
        "user_role": UserRole.CREATOR,
        "user_name": "Regular User", 
        "user_email": "user@example.com"
    }


class TestGetUserUseCase:
    """Tests for GetUserUseCase."""

    @pytest.mark.asyncio
    async def test_get_user_success_admin(
        self, get_user_use_case, mock_user_orm_service, admin_user_context
    ):
        """Test successful user retrieval by admin."""
        target_user_id = uuid4()
        request = GetUserRequest(user_id=target_user_id)
        
        # Mock event publishing to avoid errors
        get_user_use_case._publish_event = AsyncMock()
        
        result = await get_user_use_case.execute(request, admin_user_context)
        
        assert isinstance(result, GetUserResponse)
        assert result.user.email == "test@example.com"
        assert result.can_modify is True  # Admin can modify any profile
        mock_user_orm_service.get_by_id.assert_called_once_with(target_user_id)

    @pytest.mark.asyncio
    async def test_get_user_success_self(
        self, get_user_use_case, mock_user_orm_service, regular_user_context
    ):
        """Test successful user retrieval by user accessing their own profile."""
        user_id = UUID(regular_user_context["user_id"])
        request = GetUserRequest(user_id=user_id)
        
        # Mock the returned user to have the same ID as the requesting user
        mock_user = mock_user_orm_service.get_by_id.return_value
        mock_user.id = user_id
        
        # Mock event publishing
        get_user_use_case._publish_event = AsyncMock()
        
        result = await get_user_use_case.execute(request, regular_user_context)
        
        assert isinstance(result, GetUserResponse)
        assert result.can_modify is True  # User can modify their own profile
        mock_user_orm_service.get_by_id.assert_called_once_with(user_id)

    @pytest.mark.asyncio
    async def test_get_user_permission_denied(
        self, get_user_use_case, regular_user_context
    ):
        """Test permission denied when regular user tries to access another user."""
        other_user_id = uuid4()  # Different from the user in context
        request = GetUserRequest(user_id=other_user_id)
        
        with pytest.raises(PermissionError, match="Not authorized to view this user's profile"):
            await get_user_use_case.execute(request, regular_user_context)

    @pytest.mark.asyncio
    async def test_get_user_not_found(
        self, get_user_use_case, mock_user_orm_service, admin_user_context
    ):
        """Test user not found scenario."""
        target_user_id = uuid4()
        request = GetUserRequest(user_id=target_user_id)
        
        # Mock user not found
        mock_user_orm_service.get_by_id.return_value = None
        
        with pytest.raises(ValueError, match=f"User not found: {target_user_id}"):
            await get_user_use_case.execute(request, admin_user_context)

    @pytest.mark.asyncio
    async def test_get_user_service_error(
        self, get_user_use_case, mock_user_orm_service, admin_user_context, mock_session
    ):
        """Test service error handling."""
        target_user_id = uuid4()
        request = GetUserRequest(user_id=target_user_id)
        
        # Mock service error
        mock_user_orm_service.get_by_id.side_effect = Exception("Database error")
        
        with pytest.raises(RuntimeError, match="Service error in get user"):
            await get_user_use_case.execute(request, admin_user_context)
        
        # Verify rollback was called
        mock_session.rollback.assert_called_once()


class TestListUsersUseCase:
    """Tests for ListUsersUseCase."""

    @pytest.mark.asyncio
    async def test_list_users_success_admin(
        self, list_users_use_case, mock_user_orm_service, admin_user_context
    ):
        """Test successful user listing by admin."""
        request = ListUsersRequest(page=1, per_page=10, role_filter=UserRole.CREATOR)
        
        # Mock event publishing
        list_users_use_case._publish_event = AsyncMock()
        
        result = await list_users_use_case.execute(request, admin_user_context)
        
        assert isinstance(result, ListUsersResponse)
        assert len(result.users) == 1
        assert result.total == 1
        assert result.page == 1
        assert result.per_page == 10
        assert result.has_next is False
        assert result.has_prev is False
        
        # Verify ORM service was called with admin privileges (filters preserved)
        mock_user_orm_service.get_users.assert_called_once_with(
            skip=0, limit=10, role_filter=UserRole.CREATOR, active_only=False, search=None
        )

    @pytest.mark.asyncio
    async def test_list_users_success_regular_user(
        self, list_users_use_case, mock_user_orm_service, regular_user_context
    ):
        """Test user listing by regular user with restricted access."""
        request = ListUsersRequest(
            page=1, per_page=10, 
            role_filter=UserRole.ADMIN,  # This should be ignored for non-admin
            active_only=False  # This should be forced to True for non-admin
        )
        
        # Mock event publishing
        list_users_use_case._publish_event = AsyncMock()
        
        result = await list_users_use_case.execute(request, regular_user_context)
        
        assert isinstance(result, ListUsersResponse)
        
        # Verify filters were adjusted for non-admin user
        mock_user_orm_service.get_users.assert_called_once_with(
            skip=0, limit=10, 
            role_filter=None,  # Role filter removed
            active_only=True,  # Forced to True
            search=None
        )

    @pytest.mark.asyncio
    async def test_list_users_pagination(
        self, list_users_use_case, mock_user_orm_service, admin_user_context
    ):
        """Test pagination calculations."""
        request = ListUsersRequest(page=2, per_page=5)
        
        # Mock larger result set
        mock_user_orm_service.get_user_count.return_value = 15
        
        # Mock event publishing
        list_users_use_case._publish_event = AsyncMock()
        
        result = await list_users_use_case.execute(request, admin_user_context)
        
        assert result.page == 2
        assert result.per_page == 5
        assert result.total == 15
        assert result.total_pages == 3
        assert result.has_prev is True
        assert result.has_next is True
        
        # Verify correct skip calculation (page 2, per_page 5 = skip 5)
        mock_user_orm_service.get_users.assert_called_once_with(
            skip=5, limit=5, role_filter=None, active_only=False, search=None
        )

    @pytest.mark.asyncio
    async def test_list_users_search_and_filtering(
        self, list_users_use_case, mock_user_orm_service, admin_user_context
    ):
        """Test search and filtering functionality."""
        request = ListUsersRequest(
            page=1, per_page=20,
            search="john",
            role_filter=UserRole.CREATOR,
            active_only=True
        )
        
        # Mock event publishing
        list_users_use_case._publish_event = AsyncMock()
        
        await list_users_use_case.execute(request, admin_user_context)
        
        # Verify search and filters were passed through
        mock_user_orm_service.get_users.assert_called_once_with(
            skip=0, limit=20, 
            role_filter=UserRole.CREATOR, 
            active_only=True, 
            search="john"
        )
        
        mock_user_orm_service.get_user_count.assert_called_once_with(
            role_filter=UserRole.CREATOR,
            active_only=True,
            search="john"
        )

    @pytest.mark.asyncio
    async def test_list_users_invalid_pagination(
        self, list_users_use_case, admin_user_context
    ):
        """Test validation of pagination parameters."""
        # Test invalid page number
        request = ListUsersRequest(page=0, per_page=10)
        
        with pytest.raises(ValueError, match="Page number must be positive"):
            await list_users_use_case.execute(request, admin_user_context)
        
        # Test invalid per_page
        request = ListUsersRequest(page=1, per_page=0)
        
        with pytest.raises(ValueError, match="Items per page must be between 1 and 100"):
            await list_users_use_case.execute(request, admin_user_context)
        
        # Test per_page too large
        request = ListUsersRequest(page=1, per_page=101)
        
        with pytest.raises(ValueError, match="Items per page must be between 1 and 100"):
            await list_users_use_case.execute(request, admin_user_context)

    @pytest.mark.asyncio
    async def test_list_users_service_error(
        self, list_users_use_case, mock_user_orm_service, admin_user_context, mock_session
    ):
        """Test service error handling."""
        request = ListUsersRequest(page=1, per_page=10)
        
        # Mock service error
        mock_user_orm_service.get_users.side_effect = Exception("Database error")
        
        with pytest.raises(RuntimeError, match="Service error in list users"):
            await list_users_use_case.execute(request, admin_user_context)
        
        # Verify rollback was called
        mock_session.rollback.assert_called_once()


class TestIntegration:
    """Integration tests for both use cases."""

    @pytest.mark.asyncio
    async def test_use_cases_work_together(
        self, get_user_use_case, list_users_use_case, 
        mock_user_orm_service, admin_user_context
    ):
        """Test that both use cases can work with the same data."""
        # Mock event publishing for both use cases
        get_user_use_case._publish_event = AsyncMock()
        list_users_use_case._publish_event = AsyncMock()
        
        # First, list users
        list_request = ListUsersRequest(page=1, per_page=10)
        list_result = await list_users_use_case.execute(list_request, admin_user_context)
        
        assert len(list_result.users) == 1
        first_user = list_result.users[0]
        
        # Then, get the first user by ID
        get_request = GetUserRequest(user_id=first_user.id)
        get_result = await get_user_use_case.execute(get_request, admin_user_context)
        
        # Verify the user data matches
        assert get_result.user.id == first_user.id
        assert get_result.user.email == first_user.email
        assert get_result.user.username == first_user.username