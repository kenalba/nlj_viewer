"""
Simplified unit tests for ORM repositories focusing on core functionality.
Uses simple mock objects instead of complex SQLAlchemy model instantiation.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

# Repository imports
from app.services.orm_repositories.base_repository import BaseRepository
from app.services.orm_repositories.content_repository import ContentRepository
from app.services.orm_repositories.user_repository import UserRepository
from app.services.orm_repositories.media_repository import MediaRepository
from app.services.orm_repositories.generation_repository import GenerationSessionRepository

# Model imports for type checking
from app.models.content import ContentItem, ContentState, ContentType
from app.models.user import User, UserRole
from app.models.media import MediaItem, MediaState, MediaType
from app.models.generation_session import GenerationSession, GenerationStatus

# Configure pytest-asyncio to support async tests
pytestmark = pytest.mark.asyncio


class TestBaseRepositoryCore:
    """Test the abstract BaseRepository core functionality with simple mocks."""
    
    @pytest.fixture
    def mock_session(self):
        """Create a mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def concrete_repo(self, mock_session):
        """Create a concrete repository for testing BaseRepository."""
        
        class ConcreteRepository(BaseRepository[User]):
            @property
            def model(self):
                return User
        
        return ConcreteRepository(mock_session)
    
    async def test_get_by_id_success(self, concrete_repo, mock_session):
        """Test successful get_by_id operation."""
        test_id = uuid4()
        
        # Create a simple mock object instead of real SQLAlchemy model
        mock_user = MagicMock()
        mock_user.id = test_id
        mock_user.username = "testuser"
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session.execute.return_value = mock_result
        
        result = await concrete_repo.get_by_id(test_id)
        
        assert result.id == test_id
        assert result.username == "testuser"
        mock_session.execute.assert_called_once()
    
    async def test_get_by_id_not_found(self, concrete_repo, mock_session):
        """Test get_by_id when record not found."""
        test_id = uuid4()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result
        
        result = await concrete_repo.get_by_id(test_id)
        
        assert result is None
        mock_session.execute.assert_called_once()
    
    async def test_get_all_with_pagination(self, concrete_repo, mock_session):
        """Test get_all with pagination parameters."""
        mock_users = []
        for i in range(3):
            mock_user = MagicMock()
            mock_user.id = uuid4()
            mock_user.username = f"user{i}"
            mock_users.append(mock_user)
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_users
        mock_session.execute.return_value = mock_result
        
        result = await concrete_repo.get_all(limit=10, offset=0)
        
        assert len(result) == 3
        assert result[0].username == "user0"
        mock_session.execute.assert_called_once()
    
    async def test_delete_by_id_success(self, concrete_repo, mock_session):
        """Test successful delete operation."""
        test_id = uuid4()
        
        mock_result = MagicMock()
        mock_result.rowcount = 1  # One row affected
        mock_session.execute.return_value = mock_result
        
        result = await concrete_repo.delete_by_id(test_id)
        
        assert result is True
        mock_session.execute.assert_called_once()
        # Note: delete_by_id doesn't call commit - that's handled at service level
    
    async def test_delete_by_id_not_found(self, concrete_repo, mock_session):
        """Test delete when record not found."""
        test_id = uuid4()
        
        mock_result = MagicMock()
        mock_result.rowcount = 0  # No rows affected
        mock_session.execute.return_value = mock_result
        
        result = await concrete_repo.delete_by_id(test_id)
        
        assert result is False
        mock_session.execute.assert_called_once()
        # Note: delete_by_id doesn't call commit - that's handled at service level
    
    async def test_count_all(self, concrete_repo, mock_session):
        """Test count_all method."""
        expected_count = 42
        
        mock_result = MagicMock()
        mock_result.scalar.return_value = expected_count
        mock_session.execute.return_value = mock_result
        
        result = await concrete_repo.count_all()
        
        assert result == expected_count
        mock_session.execute.assert_called_once()


class TestContentRepositoryCore:
    """Test ContentRepository core functionality."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def content_repo(self, mock_session):
        return ContentRepository(mock_session)
    
    async def test_get_published_content(self, content_repo, mock_session):
        """Test getting published content."""
        mock_content_items = []
        for i in range(2):
            mock_content = MagicMock()
            mock_content.id = uuid4()
            mock_content.title = f"Content {i}"
            mock_content.state = ContentState.PUBLISHED
            mock_content_items.append(mock_content)
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_content_items
        mock_session.execute.return_value = mock_result
        
        result = await content_repo.get_published_content(limit=10)
        
        assert len(result) == 2
        assert result[0].state == ContentState.PUBLISHED
        mock_session.execute.assert_called_once()
    
    async def test_search_content(self, content_repo, mock_session):
        """Test content search functionality."""
        search_term = "test"
        
        mock_content = MagicMock()
        mock_content.id = uuid4()
        mock_content.title = "Test Content"
        mock_content.content_type = ContentType.SURVEY
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_content]
        mock_session.execute.return_value = mock_result
        
        result = await content_repo.search_content(
            search_term=search_term, 
            content_type=ContentType.SURVEY, 
            limit=5
        )
        
        assert len(result) == 1
        assert result[0].title == "Test Content"
        mock_session.execute.assert_called_once()
    
    async def test_increment_view_count(self, content_repo, mock_session):
        """Test incrementing view count."""
        content_id = uuid4()
        
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute.return_value = mock_result
        
        result = await content_repo.increment_view_count(content_id)
        
        assert result is True
        mock_session.execute.assert_called_once()


class TestUserRepositoryCore:
    """Test UserRepository core functionality."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def user_repo(self, mock_session):
        return UserRepository(mock_session)
    
    async def test_get_by_username(self, user_repo, mock_session):
        """Test getting user by username."""
        username = "testuser"
        
        mock_user = MagicMock()
        mock_user.id = uuid4()
        mock_user.username = username
        mock_user.email = "test@example.com"
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session.execute.return_value = mock_result
        
        result = await user_repo.get_by_username(username)
        
        assert result.username == username
        assert result.email == "test@example.com"
        mock_session.execute.assert_called_once()
    
    async def test_username_exists_true(self, user_repo, mock_session):
        """Test checking if username exists (returns True)."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_session.execute.return_value = mock_result
        
        result = await user_repo.username_exists("existing_user")
        
        assert result is True
        mock_session.execute.assert_called_once()
    
    async def test_username_exists_false(self, user_repo, mock_session):
        """Test checking if username exists (returns False)."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        mock_session.execute.return_value = mock_result
        
        result = await user_repo.username_exists("nonexistent_user")
        
        assert result is False
        mock_session.execute.assert_called_once()
    
    async def test_get_users_by_role(self, user_repo, mock_session):
        """Test getting users by role."""
        mock_users = []
        for i in range(2):
            mock_user = MagicMock()
            mock_user.id = uuid4()
            mock_user.username = f"creator{i}"
            mock_user.role = UserRole.CREATOR
            mock_users.append(mock_user)
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_users
        mock_session.execute.return_value = mock_result
        
        result = await user_repo.get_users_by_role(UserRole.CREATOR)
        
        assert len(result) == 2
        assert all(u.role == UserRole.CREATOR for u in result)
        mock_session.execute.assert_called_once()


class TestMediaRepositoryCore:
    """Test MediaRepository core functionality."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def media_repo(self, mock_session):
        return MediaRepository(mock_session)
    
    async def test_get_by_type(self, media_repo, mock_session):
        """Test getting media by type."""
        mock_media_items = []
        for i in range(2):
            mock_media = MagicMock()
            mock_media.id = uuid4()
            mock_media.title = f"Podcast {i}"
            mock_media.media_type = MediaType.PODCAST
            mock_media_items.append(mock_media)
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_media_items
        mock_session.execute.return_value = mock_result
        
        result = await media_repo.get_by_type(MediaType.PODCAST)
        
        assert len(result) == 2
        assert all(m.media_type == MediaType.PODCAST for m in result)
        mock_session.execute.assert_called_once()
    
    async def test_mark_as_failed(self, media_repo, mock_session):
        """Test marking media as failed."""
        media_id = uuid4()
        error_message = "Processing failed"
        
        # Mock the update_by_id method to return a successful result
        with patch.object(media_repo, 'update_by_id') as mock_update:
            mock_updated_media = MagicMock()
            mock_updated_media.id = media_id
            mock_updated_media.state = MediaState.FAILED
            mock_update.return_value = mock_updated_media
            
            result = await media_repo.mark_as_failed(media_id, error_message)
            
            assert result is True
            mock_update.assert_called_once_with(
                media_id, 
                media_state=MediaState.FAILED, 
                generation_error=error_message
            )


class TestGenerationSessionRepositoryCore:
    """Test GenerationSessionRepository core functionality."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def generation_repo(self, mock_session):
        return GenerationSessionRepository(mock_session)
    
    async def test_get_by_status(self, generation_repo, mock_session):
        """Test getting generation sessions by status."""
        mock_sessions = []
        for i in range(2):
            mock_session_obj = MagicMock()
            mock_session_obj.id = uuid4()
            mock_session_obj.status = GenerationStatus.PENDING
            mock_session_obj.prompt = f"Test prompt {i}"
            mock_sessions.append(mock_session_obj)
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_sessions
        mock_session.execute.return_value = mock_result
        
        result = await generation_repo.get_by_status(GenerationStatus.PENDING)
        
        assert len(result) == 2
        assert all(s.status == GenerationStatus.PENDING for s in result)
        mock_session.execute.assert_called_once()


class TestRepositoryIntegration:
    """Integration tests to verify repository setup."""
    
    def test_all_repositories_can_be_imported(self):
        """Test that all repositories can be imported successfully."""
        from app.services.orm_repositories import (
            BaseRepository, ContentRepository, UserRepository, MediaRepository,
            GenerationSessionRepository, NodeRepository, ActivityNodeRepository,
            NodeInteractionRepository, TrainingProgramRepository, TrainingSessionRepository,
            TrainingBookingRepository, AttendanceRecordRepository, SourceDocumentRepository,
            LearningObjectiveRepository, KeywordRepository, NodeLearningObjectiveRepository,
            NodeKeywordRepository
        )
        
        # All repositories should be classes
        repositories = [
            BaseRepository, ContentRepository, UserRepository, MediaRepository,
            GenerationSessionRepository, NodeRepository, ActivityNodeRepository,
            NodeInteractionRepository, TrainingProgramRepository, TrainingSessionRepository,
            TrainingBookingRepository, AttendanceRecordRepository, SourceDocumentRepository,
            LearningObjectiveRepository, KeywordRepository, NodeLearningObjectiveRepository,
            NodeKeywordRepository
        ]
        
        for repo_class in repositories:
            assert isinstance(repo_class, type), f"{repo_class.__name__} should be a class"
            # Skip BaseRepository as it's abstract
            if repo_class != BaseRepository:
                assert hasattr(repo_class, 'model'), f"{repo_class.__name__} should have a model property"
    
    def test_core_repositories_can_be_instantiated(self):
        """Test that core repositories can be instantiated."""
        mock_session = AsyncMock(spec=AsyncSession)
        
        # Test core repositories
        content_repo = ContentRepository(mock_session)
        assert content_repo.session == mock_session
        assert content_repo.model == ContentItem
        
        user_repo = UserRepository(mock_session)
        assert user_repo.session == mock_session  
        assert user_repo.model == User
        
        media_repo = MediaRepository(mock_session)
        assert media_repo.session == mock_session
        assert media_repo.model == MediaItem
        
        generation_repo = GenerationSessionRepository(mock_session)
        assert generation_repo.session == mock_session
        assert generation_repo.model == GenerationSession
    
    async def test_async_session_integration(self):
        """Test that repositories work with async sessions."""
        mock_session = AsyncMock(spec=AsyncSession)
        repo = ContentRepository(mock_session)
        
        # Mock a simple query operation
        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_session.execute.return_value = mock_result
        
        count = await repo.count_all()
        
        assert count == 5
        mock_session.execute.assert_called_once()