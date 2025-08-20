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

# Configure pytest-asyncio to support async tests
pytestmark = pytest.mark.asyncio


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
        
        # Create user first
        user = UserFactory.create()
        
        # Create content in different states with unique titles
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        published = ContentFactory.create(
            title=f"Published-{unique_id}",
            state=ContentState.PUBLISHED,
            creator_id=user.id
        )
        draft = ContentFactory.create(
            title=f"Draft-{unique_id}", 
            state=ContentState.DRAFT,
            creator_id=user.id
        )
        
        test_session.add_all([user, published, draft])
        await test_session.commit()
        
        # Get published content
        published_items = await repo.get_published_content()
        
        # Filter to our specific published content by title
        our_published = [item for item in published_items if item.title == f"Published-{unique_id}"]
        assert len(our_published) == 1
        assert our_published[0].title == f"Published-{unique_id}"
        assert our_published[0].state == ContentState.PUBLISHED
        
    async def test_get_user_content(self, test_session: AsyncSession):
        """Test retrieving content by user."""
        repo = ContentRepository(test_session)
        
        # Create users and content with unique usernames
        user1 = UserFactory.create()  # Will get unique username from factory
        user2 = UserFactory.create()  # Will get unique username from factory
        
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
        
        # Create user first
        user = UserFactory.create()
        
        # Create content with different titles and descriptions with unique identifiers
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        content1 = ContentFactory.create(
            title=f"Python Programming-{unique_id}",
            description="Learn Python basics",
            creator_id=user.id
        )
        content2 = ContentFactory.create(
            title=f"JavaScript Guide-{unique_id}", 
            description="Advanced Python concepts",
            creator_id=user.id
        )
        content3 = ContentFactory.create(
            title=f"Database Design-{unique_id}",
            description="SQL fundamentals",
            creator_id=user.id
        )
        
        test_session.add_all([user, content1, content2, content3])
        await test_session.commit()
        
        # Search for "Python"
        python_content = await repo.search_content("Python")
        
        # Filter to our specific content items
        our_python_content = [item for item in python_content if unique_id in item.title]
        assert len(our_python_content) == 2
        titles = {item.title for item in our_python_content}
        assert f"Python Programming-{unique_id}" in titles
        assert f"JavaScript Guide-{unique_id}" in titles  # Has Python in description
        
    async def test_get_content_with_filters(self, test_session: AsyncSession):
        """Test comprehensive content filtering."""
        repo = ContentRepository(test_session)
        user = UserFactory.create()
        
        # Create diverse content with unique titles
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        content_items = [
            ContentFactory.create(
                title=f"Training Content-{unique_id}",
                content_type=ContentType.TRAINING,
                learning_style=LearningStyle.VISUAL,
                state=ContentState.PUBLISHED,
                creator_id=user.id
            ),
            ContentFactory.create(
                title=f"Survey Content-{unique_id}",
                content_type=ContentType.SURVEY,
                learning_style=LearningStyle.AUDITORY,
                state=ContentState.DRAFT,
                creator_id=user.id
            ),
            ContentFactory.create(
                title=f"Game Content-{unique_id}",
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
        
        # Should find our specific training content
        our_training = [item for item in training_published if item.title == f"Training Content-{unique_id}"]
        assert len(our_training) == 1
        assert our_training[0].title == f"Training Content-{unique_id}"
        
        # Test search filter
        search_results, search_count = await repo.get_content_with_filters(
            search="Survey"
        )
        
        # Find our specific survey content
        our_survey = [item for item in search_results if item.title == f"Survey Content-{unique_id}"]
        assert len(our_survey) == 1
        assert our_survey[0].title == f"Survey Content-{unique_id}"
        
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
        # Should include our published content among others
        our_published_content = [item for item in player_content if item.created_by == creator.id and item.state == ContentState.PUBLISHED]
        assert len(our_published_content) == 1
        
        # Creator should see own content + published
        creator_content = await repo.get_content_accessible_to_user(
            creator.id,
            creator.role
        )
        # Should see both their own draft and published content
        own_content = [item for item in creator_content if item.created_by == creator.id]
        assert len(own_content) == 2  # Own draft + published
        
        # Admin should see all content
        admin_content = await repo.get_content_accessible_to_user(
            admin.id,
            admin.role
        )
        # Should see at least our 2 content items (may see more from other tests)
        our_content = [item for item in admin_content if item.created_by == creator.id]
        assert len(our_content) == 2  # Our content
        
    async def test_get_templates(self, test_session: AsyncSession):
        """Test retrieving template content."""
        repo = ContentRepository(test_session)
        
        # Create user first
        user = UserFactory.create()
        
        # Create regular content and templates with unique titles
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        regular = ContentFactory.create(
            title=f"Regular Content-{unique_id}",
            is_template=False,
            creator_id=user.id
        )
        template1 = ContentFactory.create(
            title=f"Training Template-{unique_id}",
            is_template=True,
            template_category="training",
            creator_id=user.id
        )
        template2 = ContentFactory.create(
            title=f"Survey Template-{unique_id}",
            is_template=True,
            template_category="survey",
            creator_id=user.id
        )
        
        test_session.add_all([user, regular, template1, template2])
        await test_session.commit()
        
        # Get all templates
        all_templates = await repo.get_templates()
        our_templates = [t for t in all_templates if unique_id in t.title]
        assert len(our_templates) == 2
        
        # Get templates by category
        training_templates = await repo.get_templates(category="training")
        our_training_templates = [t for t in training_templates if unique_id in t.title]
        assert len(our_training_templates) == 1
        assert our_training_templates[0].title == f"Training Template-{unique_id}"
        
    async def test_get_popular_content(self, test_session: AsyncSession):
        """Test retrieving popular content by views."""
        repo = ContentRepository(test_session)
        
        # Create user first
        user = UserFactory.create()
        
        # Create content with different view counts and unique titles
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        content_items = [
            ContentFactory.create(
                title=f"Very Popular-{unique_id}",
                view_count=1000,  # Use higher view count to ensure it's first
                state=ContentState.PUBLISHED,
                creator_id=user.id
            ),
            ContentFactory.create(
                title=f"Somewhat Popular-{unique_id}",
                view_count=500,  # Use higher view count to ensure it's second
                state=ContentState.PUBLISHED,
                creator_id=user.id
            ),
            ContentFactory.create(
                title=f"Not Popular-{unique_id}",
                view_count=5,
                state=ContentState.PUBLISHED,
                creator_id=user.id
            ),
            ContentFactory.create(
                title=f"Draft Content-{unique_id}",
                view_count=200,
                state=ContentState.DRAFT,  # Should be excluded
                creator_id=user.id
            )
        ]
        
        test_session.add_all([user] + content_items)
        await test_session.commit()
        
        # Get popular content with a higher limit to ensure our test data is included
        # (previous test runs may have left similar data in the database)
        popular = await repo.get_popular_content(limit=50, min_view_count=400)
        
        # Filter to our content using the unique identifier
        our_popular = [item for item in popular if unique_id in item.title]
        assert len(our_popular) == 2
        assert our_popular[0].title == f"Very Popular-{unique_id}"  # Highest views first
        assert our_popular[1].title == f"Somewhat Popular-{unique_id}"
        
    async def test_get_content_statistics(self, test_session: AsyncSession):
        """Test content analytics and statistics."""
        repo = ContentRepository(test_session)
        
        # Create user first
        user = UserFactory.create()
        
        # Create diverse content for statistics
        content_items = [
            ContentFactory.create(
                state=ContentState.PUBLISHED,
                content_type=ContentType.TRAINING,
                view_count=100,
                creator_id=user.id
            ),
            ContentFactory.create(
                state=ContentState.PUBLISHED,
                content_type=ContentType.SURVEY,
                view_count=50,
                creator_id=user.id
            ),
            ContentFactory.create(
                state=ContentState.DRAFT,
                content_type=ContentType.TRAINING,
                view_count=25,
                creator_id=user.id
            )
        ]
        
        test_session.add_all([user] + content_items)
        await test_session.commit()
        
        # Get statistics
        stats = await repo.get_content_statistics()
        
        # Verify statistics include our content (may include others from previous tests)
        assert stats["total_content"] >= 3  # At least our 3 items
        assert stats["total_views"] >= 175  # At least our views: 100 + 50 + 25
        
        # Check state and type distributions exist
        assert ContentState.PUBLISHED in stats["by_state"]
        assert ContentState.DRAFT in stats["by_state"]
        assert ContentType.TRAINING in stats["by_type"]
        assert ContentType.SURVEY in stats["by_type"]
        
        # Verify our content is included in counts
        assert stats["by_state"][ContentState.PUBLISHED] >= 2
        assert stats["by_state"][ContentState.DRAFT] >= 1
        assert stats["by_type"][ContentType.TRAINING] >= 2
        assert stats["by_type"][ContentType.SURVEY] >= 1
        
    async def test_increment_view_count(self, test_session: AsyncSession):
        """Test incrementing content view count."""
        repo = ContentRepository(test_session)
        
        # Create user and content
        user = UserFactory.create()
        content = ContentFactory.create(view_count=10, creator_id=user.id)
        test_session.add_all([user, content])
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
        
        # Create user and content
        user = UserFactory.create()
        content = ContentFactory.create(completion_count=5, creator_id=user.id)
        test_session.add_all([user, content])
        await test_session.commit()
        
        # Increment completion count
        result = await repo.increment_completion_count(content.id)
        assert result is True
        
        # Verify increment
        await test_session.refresh(content)
        assert content.completion_count == 6