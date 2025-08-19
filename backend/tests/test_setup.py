"""
Test setup verification for NLJ Platform backend refactoring.
Ensures testing infrastructure works properly before implementing new architecture.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from tests.fixtures.factories import UserFactory, ContentFactory, TestDataBuilder as DataBuilder
from tests.fixtures.test_data_helpers import seed_test_data

# Async tests have individual @pytest.mark.asyncio decorators


class TestPytestConfiguration:
    """Verify pytest configuration and fixtures work correctly."""
    
    def test_event_loop_fixture(self):
        """Test that event loop fixture is working."""
        assert True
        
    @pytest.mark.asyncio
    async def test_test_session_fixture(self, test_session: AsyncSession):
        """Test that database session fixture works."""
        from sqlalchemy import text
        
        assert test_session is not None
        
        # Test basic query
        result = await test_session.execute(text("SELECT 1"))
        assert result.scalar() == 1


class TestFactories:
    """Test data factories work correctly."""
    
    def test_user_factory_creates_valid_user(self):
        """Test UserFactory creates valid User instances."""
        user = UserFactory.create()
        
        assert isinstance(user, User)
        assert user.username.startswith("testuser_")  # Now generates unique usernames
        assert user.email.startswith("test_") and user.email.endswith("@example.com")
        assert user.role == UserRole.CREATOR
        assert user.is_active is True
        
    def test_user_factory_with_custom_values(self):
        """Test UserFactory accepts custom values."""
        user = UserFactory.create(
            username="custom",
            email="custom@example.com",
            role=UserRole.ADMIN
        )
        
        assert user.username == "custom"
        assert user.email == "custom@example.com"
        assert user.role == UserRole.ADMIN
        
    def test_content_factory_creates_valid_content(self):
        """Test ContentFactory creates valid ContentItem instances."""
        from app.models.content import ContentItem
        import uuid
        
        creator_id = uuid.uuid4()
        content = ContentFactory.create(creator_id=creator_id)
        
        assert isinstance(content, ContentItem)
        assert content.title == "Test Content"
        assert content.created_by == creator_id
        assert content.nlj_data == {"nodes": [], "edges": []}


class TestDataBuilder:
    """Test TestDataBuilder works correctly."""
    
    def test_builder_creates_users(self):
        """Test builder can create users."""
        builder = DataBuilder()
        data = builder.with_users(count=3).build()
        
        assert len(data["users"]) == 3
        assert len(data["content_items"]) == 0
        
    def test_builder_creates_content_with_users(self):
        """Test builder can create content linked to users."""
        builder = DataBuilder()
        data = (builder
                .with_users(count=2)
                .with_content(count=3, creator_index=0)
                .build())
        
        assert len(data["users"]) == 2
        assert len(data["content_items"]) == 3
        
        # Content should be linked to first user
        first_user = data["users"][0]
        for content in data["content_items"]:
            assert content.created_by == first_user.id


class TestDatabaseIntegration:
    """Test database integration works correctly."""
    
    @pytest.mark.asyncio
    async def test_user_creation_and_retrieval(self, test_session: AsyncSession):
        """Test creating and retrieving users from database."""
        from sqlalchemy import select
        
        user = UserFactory.create()
        test_session.add(user)
        await test_session.commit()
        
        # Retrieve user
        result = await test_session.execute(
            select(User).where(User.id == user.id)
        )
        retrieved_user = result.scalar_one_or_none()
        
        assert retrieved_user is not None
        assert retrieved_user.username == user.username
        assert retrieved_user.email == user.email
        
    @pytest.mark.asyncio
    async def test_seed_test_data_basic_scenario(self, test_session: AsyncSession):
        """Test basic test data seeding."""
        # Count users before seeding
        from sqlalchemy import select, text, func
        
        initial_user_count = await test_session.execute(select(func.count(User.id)))
        initial_users = initial_user_count.scalar()
        
        # Seed the data
        data = await seed_test_data(test_session, scenario="basic")
        
        assert len(data["users"]) == 2
        assert len(data["content_items"]) == 3
        
        # Verify data was actually inserted
        final_user_count = await test_session.execute(select(func.count(User.id)))
        final_users = final_user_count.scalar()
        
        content_count = await test_session.execute(text("SELECT COUNT(*) FROM content_items"))
        
        # Should have added exactly 2 users
        assert final_users == initial_users + 2
        assert content_count.scalar() >= 3  # At least 3 content items


class TestAsyncSupport:
    """Test async/await support in test environment."""
    
    @pytest.mark.asyncio
    async def test_async_test_function(self):
        """Test that async test functions work."""
        import asyncio
        
        result = await asyncio.sleep(0.1, result="test_value")
        assert result == "test_value"
        
    @pytest.mark.asyncio
    async def test_async_database_operations(self, test_session: AsyncSession):
        """Test async database operations work in tests."""
        from sqlalchemy import select
        
        # Test async query
        from sqlalchemy import text
        result = await test_session.execute(text("SELECT 1"))
        assert result.scalar() == 1
        
        # Test async transaction
        user = UserFactory.create()
        test_session.add(user)
        await test_session.commit()
        
        # Verify transaction worked
        result = await test_session.execute(
            select(User).where(User.id == user.id)
        )
        retrieved_user = result.scalar_one_or_none()
        assert retrieved_user is not None