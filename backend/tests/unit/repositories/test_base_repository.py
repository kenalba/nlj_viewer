"""
Unit tests for BaseRepository abstract class.
Tests common CRUD operations and repository patterns.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.orm_repositories.user_repository import UserRepository
from tests.fixtures.factories import UserFactory

# Configure pytest-asyncio to support async tests
pytestmark = pytest.mark.asyncio


class TestBaseRepository:
    """Test BaseRepository functionality through UserRepository implementation."""
    
    async def test_create_instance(self, test_session: AsyncSession):
        """Test creating a new instance."""
        repo = UserRepository(test_session)
        
        # Create a user instance using the factory to get unique values
        user_instance = UserFactory.create(role=UserRole.CREATOR)
        user_data = {
            "username": user_instance.username,
            "email": user_instance.email,
            "hashed_password": user_instance.hashed_password,
            "full_name": user_instance.full_name,
            "role": user_instance.role,
            "is_active": user_instance.is_active,
            "is_verified": user_instance.is_verified
        }
        
        user = await repo.create(**user_data)
        await test_session.commit()
        
        assert user.username == user_instance.username
        assert user.email == user_instance.email
        assert user.role == UserRole.CREATOR
        assert user.id is not None
        
    async def test_get_by_id(self, test_session: AsyncSession):
        """Test retrieving instance by ID."""
        repo = UserRepository(test_session)
        
        # Create a user first
        user = UserFactory.create()
        test_session.add(user)
        await test_session.commit()
        
        # Retrieve by ID
        retrieved_user = await repo.get_by_id(user.id)
        
        assert retrieved_user is not None
        assert retrieved_user.id == user.id
        assert retrieved_user.username == user.username
        
    async def test_get_by_id_not_found(self, test_session: AsyncSession):
        """Test retrieving non-existent instance by ID."""
        import uuid
        repo = UserRepository(test_session)
        
        non_existent_id = uuid.uuid4()
        retrieved_user = await repo.get_by_id(non_existent_id)
        
        assert retrieved_user is None
        
    async def test_get_all_with_pagination(self, test_session: AsyncSession):
        """Test retrieving all instances with pagination."""
        repo = UserRepository(test_session)
        
        # Get initial count
        initial_count = await repo.count_all()
        
        # Create multiple users with unique usernames
        users = [UserFactory.create() for i in range(5)]
        test_session.add_all(users)
        await test_session.commit()
        
        # Test pagination - should have 5 more users now
        first_page = await repo.get_all(limit=3, offset=initial_count)
        second_page = await repo.get_all(limit=3, offset=initial_count + 3)
        
        assert len(first_page) == 3
        assert len(second_page) == 2  # Remaining 2 of our 5 users
        
        # Ensure no overlap between our pages
        first_page_ids = {user.id for user in first_page}
        second_page_ids = {user.id for user in second_page}
        assert first_page_ids.isdisjoint(second_page_ids)
        
        # Ensure our created users are in the results
        created_user_ids = {user.id for user in users}
        retrieved_ids = first_page_ids | second_page_ids
        assert created_user_ids == retrieved_ids
        
    async def test_update_by_id(self, test_session: AsyncSession):
        """Test updating instance by ID."""
        repo = UserRepository(test_session)
        
        # Create a user
        user = UserFactory.create(full_name="Original Name")
        test_session.add(user)
        await test_session.commit()
        
        # Update the user
        updated_user = await repo.update_by_id(
            user.id,
            full_name="Updated Name",
            is_active=False
        )
        
        assert updated_user is not None
        assert updated_user.full_name == "Updated Name"
        assert updated_user.is_active is False
        
    async def test_update_by_id_not_found(self, test_session: AsyncSession):
        """Test updating non-existent instance by ID."""
        import uuid
        repo = UserRepository(test_session)
        
        non_existent_id = uuid.uuid4()
        result = await repo.update_by_id(non_existent_id, full_name="New Name")
        
        assert result is None
        
    async def test_delete_by_id(self, test_session: AsyncSession):
        """Test deleting instance by ID."""
        repo = UserRepository(test_session)
        
        # Create a user
        user = UserFactory.create()
        test_session.add(user)
        await test_session.commit()
        
        # Delete the user
        deleted = await repo.delete_by_id(user.id)
        
        assert deleted is True
        
        # Verify deletion
        retrieved_user = await repo.get_by_id(user.id)
        assert retrieved_user is None
        
    async def test_delete_by_id_not_found(self, test_session: AsyncSession):
        """Test deleting non-existent instance by ID."""
        import uuid
        repo = UserRepository(test_session)
        
        non_existent_id = uuid.uuid4()
        deleted = await repo.delete_by_id(non_existent_id)
        
        assert deleted is False
        
    async def test_exists_by_id(self, test_session: AsyncSession):
        """Test checking if instance exists by ID."""
        repo = UserRepository(test_session)
        
        # Create a user
        user = UserFactory.create()
        test_session.add(user)
        await test_session.commit()
        
        # Test existence
        exists = await repo.exists_by_id(user.id)
        assert exists is True
        
        # Test non-existence
        import uuid
        non_existent_id = uuid.uuid4()
        exists = await repo.exists_by_id(non_existent_id)
        assert exists is False
        
    async def test_count_all(self, test_session: AsyncSession):
        """Test counting all instances."""
        repo = UserRepository(test_session)
        
        # Get initial count (may have existing data from other tests)
        initial_count = await repo.count_all()
        
        # Add some users with unique usernames
        users = [UserFactory.create() for i in range(3)]
        test_session.add_all(users)
        await test_session.commit()
        
        # Count should increase by 3
        final_count = await repo.count_all()
        assert final_count == initial_count + 3
        
    async def test_find_by_field(self, test_session: AsyncSession):
        """Test finding instances by field value."""
        repo = UserRepository(test_session)
        
        # Create users with different roles and unique usernames
        creator = UserFactory.create(role=UserRole.CREATOR)
        admin = UserFactory.create(role=UserRole.ADMIN)
        test_session.add_all([creator, admin])
        await test_session.commit()
        
        # Find by role - should find at least our creator (may include others from previous tests)
        creators = await repo.find_by_field("role", UserRole.CREATOR)
        creator_ids = [c.id for c in creators]
        
        # Our creator should be in the results
        assert creator.id in creator_ids
        
        # Find by admin role - should find our specific admin
        admins = await repo.find_by_field("role", UserRole.ADMIN)
        admin_ids = [a.id for a in admins]
        
        assert admin.id in admin_ids
        
    async def test_find_by_fields(self, test_session: AsyncSession):
        """Test finding instances by multiple field conditions."""
        repo = UserRepository(test_session)
        
        # Create users with unique usernames
        active_creator = UserFactory.create(
            role=UserRole.CREATOR, 
            is_active=True
        )
        inactive_creator = UserFactory.create(
            role=UserRole.CREATOR, 
            is_active=False
        )
        active_admin = UserFactory.create(
            role=UserRole.ADMIN, 
            is_active=True
        )
        
        test_session.add_all([active_creator, inactive_creator, active_admin])
        await test_session.commit()
        
        # Find active creators
        active_creators = await repo.find_by_fields({
            "role": UserRole.CREATOR,
            "is_active": True
        })
        
        # Should find at least our active creator (may include others from previous tests)
        active_creator_ids = [c.id for c in active_creators]
        assert active_creator.id in active_creator_ids
        
    async def test_bulk_create(self, test_session: AsyncSession):
        """Test bulk creating multiple instances."""
        repo = UserRepository(test_session)
        
        # Create user instances with unique data
        users_instances = [UserFactory.create() for i in range(3)]
        users_data = [
            {
                "username": user.username,
                "email": user.email,
                "hashed_password": user.hashed_password,
                "full_name": user.full_name,
                "role": user.role,
                "is_active": user.is_active,
                "is_verified": user.is_verified
            }
            for user in users_instances
        ]
        
        created_users = await repo.bulk_create(users_data)
        
        assert len(created_users) == 3
        for created_user in created_users:
            assert created_user.id is not None
            assert created_user.role == UserRole.CREATOR
            
    async def test_bulk_update(self, test_session: AsyncSession):
        """Test bulk updating multiple instances."""
        repo = UserRepository(test_session)
        
        # Create users with unique usernames
        users = [
            UserFactory.create(is_active=True) 
            for i in range(3)
        ]
        test_session.add_all(users)
        await test_session.commit()
        
        # Prepare bulk update data
        updates = [
            {"id": user.id, "is_active": False}
            for user in users
        ]
        
        updated_count = await repo.bulk_update(updates)
        
        assert updated_count == 3
        
        # Verify updates
        for user in users:
            updated_user = await repo.get_by_id(user.id)
            assert updated_user.is_active is False