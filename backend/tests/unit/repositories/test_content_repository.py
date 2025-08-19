"""
Unit tests for ContentRepository.
Tests complex content queries, filtering, and analytics.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentState, ContentType, LearningStyle
from app.models.user import UserRole
from app.services.orm_repositories.content_repository import ContentRepository
from tests.fixtures.factories import ContentFactory, UserFactory


class TestContentRepository:
    """Test ContentRepository specialized functionality."""
    
    async def test_get_by_id_with_creator(self, test_session: AsyncSession):
        """Test retrieving content with creator information."""
        repo = ContentRepository(test_session)
        
        # Create user and content
        user = UserFactory.create()
        content = ContentFactory.create(creator_id=user.id)
        
        test_session.add_all([user, content])
        await test_session.commit()
        
        # Retrieve with creator
        retrieved = await repo.get_by_id_with_creator(content.id)
        
        assert retrieved is not None
        assert retrieved.id == content.id
        assert retrieved.creator is not None
        assert retrieved.creator.id == user.id
        
    async def test_get_published_content(self, test_session: AsyncSession):
        """Test retrieving only published content."""
        repo = ContentRepository(test_session)
        
        # Create content in different states
        published = ContentFactory.create(
            title="Published",
            state=ContentState.PUBLISHED
        )
        draft = ContentFactory.create(
            title="Draft", 
            state=ContentState.DRAFT
        )
        
        test_session.add_all([published, draft])
        await test_session.commit()
        
        # Get published content
        published_items = await repo.get_published_content()
        
        assert len(published_items) == 1
        assert published_items[0].title == "Published"
        assert published_items[0].state == ContentState.PUBLISHED
        
    async def test_get_user_content(self, test_session: AsyncSession):
        """Test retrieving content by user."""
        repo = ContentRepository(test_session)
        
        # Create users and content
        user1 = UserFactory.create(username="user1")
        user2 = UserFactory.create(username="user2")
        
        content1 = ContentFactory.create(title="User1 Content", creator_id=user1.id)
        content2 = ContentFactory.create(title="User2 Content", creator_id=user2.id)
        
        test_session.add_all([user1, user2, content1, content2])
        await test_session.commit()
        
        # Get user1's content
        user1_content = await repo.get_user_content(user1.id)
        
        assert len(user1_content) == 1
        assert user1_content[0].title == "User1 Content"
        assert user1_content[0].created_by == user1.id
        
    async def test_search_content(self, test_session: AsyncSession):
        """Test content search functionality."""
        repo = ContentRepository(test_session)
        
        # Create content with different titles and descriptions
        content1 = ContentFactory.create(
            title="Python Programming",
            description="Learn Python basics"
        )
        content2 = ContentFactory.create(
            title="JavaScript Guide", 
            description="Advanced Python concepts"
        )
        content3 = ContentFactory.create(
            title="Database Design",
            description="SQL fundamentals"
        )
        
        test_session.add_all([content1, content2, content3])
        await test_session.commit()
        
        # Search for "Python"
        python_content = await repo.search_content("Python")
        
        assert len(python_content) == 2
        titles = {item.title for item in python_content}
        assert "Python Programming" in titles
        assert "JavaScript Guide" in titles  # Has Python in description
        
    async def test_get_content_with_filters(self, test_session: AsyncSession):
        """Test comprehensive content filtering."""
        repo = ContentRepository(test_session)
        user = UserFactory.create()
        
        # Create diverse content
        content_items = [
            ContentFactory.create(
                title="Training Content",
                content_type=ContentType.TRAINING,
                learning_style=LearningStyle.VISUAL,
                state=ContentState.PUBLISHED,
                creator_id=user.id
            ),
            ContentFactory.create(
                title="Survey Content",
                content_type=ContentType.SURVEY,
                learning_style=LearningStyle.AUDITORY,
                state=ContentState.DRAFT,
                creator_id=user.id
            ),
            ContentFactory.create(
                title="Game Content",
                content_type=ContentType.GAME,
                learning_style=LearningStyle.KINESTHETIC,
                state=ContentState.PUBLISHED,
                creator_id=user.id
            )
        ]
        
        test_session.add_all([user] + content_items)
        await test_session.commit()
        
        # Test filtering by type and state
        training_published, count = await repo.get_content_with_filters(
            content_type=ContentType.TRAINING,
            state=ContentState.PUBLISHED
        )
        
        assert count == 1
        assert len(training_published) == 1
        assert training_published[0].title == "Training Content"
        
        # Test search filter
        search_results, search_count = await repo.get_content_with_filters(
            search="Survey"
        )
        
        assert search_count == 1
        assert search_results[0].title == "Survey Content"
        
    async def test_get_content_accessible_to_user(self, test_session: AsyncSession):
        """Test role-based content access."""
        repo = ContentRepository(test_session)
        
        # Create users with different roles
        creator = UserFactory.create(role=UserRole.CREATOR)
        player = UserFactory.create(role=UserRole.PLAYER)
        admin = UserFactory.create(role=UserRole.ADMIN)
        
        # Create content with different states
        published = ContentFactory.create(
            state=ContentState.PUBLISHED,
            creator_id=creator.id
        )
        draft = ContentFactory.create(
            state=ContentState.DRAFT,
            creator_id=creator.id
        )
        
        test_session.add_all([creator, player, admin, published, draft])
        await test_session.commit()
        
        # Player should only see published content
        player_content = await repo.get_content_accessible_to_user(
            player.id, 
            player.role
        )
        assert len(player_content) == 1
        assert player_content[0].state == ContentState.PUBLISHED
        
        # Creator should see own content + published
        creator_content = await repo.get_content_accessible_to_user(
            creator.id,
            creator.role
        )
        assert len(creator_content) == 2  # Own draft + published
        
        # Admin should see all content
        admin_content = await repo.get_content_accessible_to_user(
            admin.id,
            admin.role
        )
        assert len(admin_content) == 2  # All content
        
    async def test_get_templates(self, test_session: AsyncSession):
        """Test retrieving template content."""
        repo = ContentRepository(test_session)
        
        # Create regular content and templates
        regular = ContentFactory.create(
            title="Regular Content",
            is_template=False
        )
        template1 = ContentFactory.create(
            title="Training Template",
            is_template=True,
            template_category="training"
        )
        template2 = ContentFactory.create(
            title="Survey Template",
            is_template=True,
            template_category="survey"
        )
        
        test_session.add_all([regular, template1, template2])
        await test_session.commit()
        
        # Get all templates
        all_templates = await repo.get_templates()
        assert len(all_templates) == 2
        
        # Get templates by category
        training_templates = await repo.get_templates(category="training")
        assert len(training_templates) == 1
        assert training_templates[0].title == "Training Template"
        
    async def test_get_popular_content(self, test_session: AsyncSession):
        """Test retrieving popular content by views."""
        repo = ContentRepository(test_session)
        
        # Create content with different view counts
        content_items = [
            ContentFactory.create(
                title="Very Popular",
                view_count=100,
                state=ContentState.PUBLISHED
            ),
            ContentFactory.create(
                title="Somewhat Popular",
                view_count=50,
                state=ContentState.PUBLISHED
            ),
            ContentFactory.create(
                title="Not Popular",
                view_count=5,
                state=ContentState.PUBLISHED
            ),
            ContentFactory.create(
                title="Draft Content",
                view_count=200,
                state=ContentState.DRAFT  # Should be excluded
            )
        ]
        
        test_session.add_all(content_items)
        await test_session.commit()
        
        # Get popular content
        popular = await repo.get_popular_content(limit=2, min_view_count=10)
        
        assert len(popular) == 2
        assert popular[0].title == "Very Popular"  # Highest views first
        assert popular[1].title == "Somewhat Popular"
        
    async def test_get_content_statistics(self, test_session: AsyncSession):
        """Test content analytics and statistics."""
        repo = ContentRepository(test_session)
        
        # Create diverse content for statistics
        content_items = [
            ContentFactory.create(
                state=ContentState.PUBLISHED,
                content_type=ContentType.TRAINING,
                view_count=100
            ),
            ContentFactory.create(
                state=ContentState.PUBLISHED,
                content_type=ContentType.SURVEY,
                view_count=50
            ),
            ContentFactory.create(
                state=ContentState.DRAFT,
                content_type=ContentType.TRAINING,
                view_count=25
            )
        ]
        
        test_session.add_all(content_items)
        await test_session.commit()
        
        # Get statistics
        stats = await repo.get_content_statistics()
        
        assert stats["total_content"] == 3
        assert stats["total_views"] == 175  # 100 + 50 + 25
        assert stats["average_views"] == 175 / 3
        assert stats["max_views"] == 100
        
        # Check state distribution
        assert ContentState.PUBLISHED in stats["by_state"]
        assert ContentState.DRAFT in stats["by_state"]
        assert stats["by_state"][ContentState.PUBLISHED] == 2
        assert stats["by_state"][ContentState.DRAFT] == 1
        
        # Check type distribution
        assert ContentType.TRAINING in stats["by_type"]
        assert ContentType.SURVEY in stats["by_type"]
        assert stats["by_type"][ContentType.TRAINING] == 2
        assert stats["by_type"][ContentType.SURVEY] == 1
        
    async def test_increment_view_count(self, test_session: AsyncSession):
        """Test incrementing content view count."""
        repo = ContentRepository(test_session)
        
        # Create content
        content = ContentFactory.create(view_count=10)
        test_session.add(content)
        await test_session.commit()
        
        # Increment view count
        result = await repo.increment_view_count(content.id)
        assert result is True
        
        # Verify increment
        await test_session.refresh(content)
        assert content.view_count == 11
        
    async def test_increment_completion_count(self, test_session: AsyncSession):
        """Test incrementing content completion count."""
        repo = ContentRepository(test_session)
        
        # Create content
        content = ContentFactory.create(completion_count=5)
        test_session.add(content)
        await test_session.commit()
        
        # Increment completion count
        result = await repo.increment_completion_count(content.id)
        assert result is True
        
        # Verify increment
        await test_session.refresh(content)
        assert content.completion_count == 6