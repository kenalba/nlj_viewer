"""
Unit tests for BaseRepository abstract class.
Tests common CRUD operations and repository patterns.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.orm_repositories.user_repository import UserRepository
from tests.fixtures.factories import UserFactory


class TestBaseRepository:
    """Test BaseRepository functionality through UserRepository implementation."""
    
    async def test_create_instance(self, test_session: AsyncSession):
        """Test creating a new instance."""
        repo = UserRepository(test_session)
        
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "hashed_password": "hashed123",
            "full_name": "Test User",
            "role": UserRole.CREATOR,
            "is_active": True,
            "is_verified": True
        }
        
        user = await repo.create(**user_data)
        
        assert user.username == "testuser"
        assert user.email == "test@example.com"
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
        
        # Create multiple users
        users = [UserFactory.create(username=f"user{i}") for i in range(5)]
        test_session.add_all(users)
        await test_session.commit()
        
        # Test pagination
        first_page = await repo.get_all(limit=3, offset=0)
        second_page = await repo.get_all(limit=3, offset=3)
        
        assert len(first_page) == 3
        assert len(second_page) == 2  # Remaining 2 users
        
        # Ensure no overlap
        first_page_ids = {user.id for user in first_page}
        second_page_ids = {user.id for user in second_page}
        assert first_page_ids.isdisjoint(second_page_ids)
        
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
        
        # Initial count should be 0
        initial_count = await repo.count_all()
        assert initial_count == 0
        
        # Add some users
        users = [UserFactory.create(username=f"user{i}") for i in range(3)]
        test_session.add_all(users)
        await test_session.commit()
        
        # Count should be 3
        count = await repo.count_all()
        assert count == 3
        
    async def test_find_by_field(self, test_session: AsyncSession):
        """Test finding instances by field value."""
        repo = UserRepository(test_session)
        
        # Create users with different roles
        creator = UserFactory.create(role=UserRole.CREATOR)
        admin = UserFactory.create(role=UserRole.ADMIN, username="admin")
        test_session.add_all([creator, admin])
        await test_session.commit()
        
        # Find by role
        creators = await repo.find_by_field("role", UserRole.CREATOR)
        
        assert len(creators) == 1
        assert creators[0].role == UserRole.CREATOR
        
    async def test_find_by_fields(self, test_session: AsyncSession):
        """Test finding instances by multiple field conditions."""
        repo = UserRepository(test_session)
        
        # Create users
        active_creator = UserFactory.create(
            role=UserRole.CREATOR, 
            is_active=True,
            username="active_creator"
        )
        inactive_creator = UserFactory.create(
            role=UserRole.CREATOR, 
            is_active=False,
            username="inactive_creator"
        )
        active_admin = UserFactory.create(
            role=UserRole.ADMIN, 
            is_active=True,
            username="active_admin"
        )
        
        test_session.add_all([active_creator, inactive_creator, active_admin])
        await test_session.commit()
        
        # Find active creators
        active_creators = await repo.find_by_fields({
            "role": UserRole.CREATOR,
            "is_active": True
        })
        
        assert len(active_creators) == 1
        assert active_creators[0].username == "active_creator"
        
    async def test_bulk_create(self, test_session: AsyncSession):
        """Test bulk creating multiple instances."""
        repo = UserRepository(test_session)
        
        users_data = [
            {
                "username": f"bulk_user_{i}",
                "email": f"bulk{i}@example.com",
                "hashed_password": "hashed123",
                "full_name": f"Bulk User {i}",
                "role": UserRole.CREATOR,
                "is_active": True,
                "is_verified": True
            }
            for i in range(3)
        ]
        
        created_users = await repo.bulk_create(users_data)
        
        assert len(created_users) == 3
        for i, user in enumerate(created_users):
            assert user.username == f"bulk_user_{i}"
            assert user.id is not None
            
    async def test_bulk_update(self, test_session: AsyncSession):
        """Test bulk updating multiple instances."""
        repo = UserRepository(test_session)
        
        # Create users
        users = [
            UserFactory.create(username=f"user{i}", is_active=True) 
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