"""
Comprehensive unit tests for all ORM repositories.
Tests repository functionality without database dependencies using mocks.
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
from app.services.orm_repositories.node_repository import (
    NodeRepository,
)
from app.services.orm_repositories.training_repository import (
    TrainingProgramRepository,
    TrainingSessionRepository,
)
from app.services.orm_repositories.source_document_repository import SourceDocumentRepository
from app.services.orm_repositories.learning_objective_repository import (
    LearningObjectiveRepository,
    KeywordRepository,
    NodeLearningObjectiveRepository,
    NodeKeywordRepository,
)

# Model imports
from app.models.content import ContentItem, ContentState, ContentType
from app.models.user import User, UserRole
from app.models.media import MediaItem, MediaState, MediaType
from app.models.generation_session import GenerationSession, GenerationStatus
from app.models.node import Node
from app.models.training_program import TrainingProgram, TrainingSession
from app.models.source_document import SourceDocument
from app.models.learning_objective import LearningObjective, Keyword

# Configure pytest-asyncio to support async tests
pytestmark = pytest.mark.asyncio


class TestBaseRepository:
    """Test the abstract BaseRepository functionality."""

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

    async def test_get_by_id(self, concrete_repo, mock_session):
        """Test get_by_id method."""
        test_id = uuid4()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = User(id=test_id)
        mock_session.execute.return_value = mock_result

        result = await concrete_repo.get_by_id(test_id)

        assert result.id == test_id
        mock_session.execute.assert_called_once()

    async def test_get_all(self, concrete_repo, mock_session):
        """Test get_all method with pagination."""
        mock_users = [User(id=uuid4()) for _ in range(3)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_users
        mock_session.execute.return_value = mock_result

        result = await concrete_repo.get_all(limit=10, offset=0)

        assert len(result) == 3
        mock_session.execute.assert_called_once()

    async def test_create(self, concrete_repo, mock_session):
        """Test create method."""
        test_data = {"username": "testuser", "email": "test@example.com"}

        with patch.object(concrete_repo.model, "__init__", return_value=None):
            created_user = User(**test_data)
            created_user.id = uuid4()

            with patch.object(concrete_repo, "_create_instance", return_value=created_user):
                result = await concrete_repo.create(**test_data)

                assert result == created_user
                mock_session.add.assert_called_once()
                mock_session.commit.assert_called_once()
                mock_session.refresh.assert_called_once()

    async def test_update_by_id(self, concrete_repo, mock_session):
        """Test update_by_id method."""
        test_id = uuid4()
        update_data = {"username": "updated_user"}

        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute.return_value = mock_result

        updated_user = User(id=test_id, username="updated_user")
        mock_get_result = MagicMock()
        mock_get_result.scalar_one_or_none.return_value = updated_user
        mock_session.execute.side_effect = [mock_result, mock_get_result]

        result = await concrete_repo.update_by_id(test_id, **update_data)

        assert result.username == "updated_user"
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_called_once()

    async def test_delete_by_id(self, concrete_repo, mock_session):
        """Test delete_by_id method."""
        test_id = uuid4()

        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute.return_value = mock_result

        result = await concrete_repo.delete_by_id(test_id)

        assert result is True
        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    async def test_count_all(self, concrete_repo, mock_session):
        """Test count_all method."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 42
        mock_session.execute.return_value = mock_result

        result = await concrete_repo.count_all()

        assert result == 42
        mock_session.execute.assert_called_once()

    async def test_bulk_create(self, concrete_repo, mock_session):
        """Test bulk_create method."""
        test_data = [
            {"username": "user1", "email": "user1@example.com"},
            {"username": "user2", "email": "user2@example.com"},
        ]

        created_users = [User(id=uuid4(), **data) for data in test_data]

        with patch.object(concrete_repo, "_create_instance", side_effect=created_users):
            result = await concrete_repo.bulk_create(test_data)

            assert len(result) == 2
            assert mock_session.add_all.called
            mock_session.commit.assert_called_once()


class TestContentRepository:
    """Test ContentRepository functionality."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def content_repo(self, mock_session):
        return ContentRepository(mock_session)

    async def test_get_published_content(self, content_repo, mock_session):
        """Test getting published content."""
        mock_content = [
            ContentItem(id=uuid4(), state=ContentState.PUBLISHED),
            ContentItem(id=uuid4(), state=ContentState.PUBLISHED),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_content
        mock_session.execute.return_value = mock_result

        result = await content_repo.get_published_content(limit=10)

        assert len(result) == 2
        mock_session.execute.assert_called_once()

    async def test_search_content(self, content_repo, mock_session):
        """Test content search functionality."""
        search_term = "test"
        mock_content = [ContentItem(id=uuid4(), title="Test Content")]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_content
        mock_session.execute.return_value = mock_result

        result = await content_repo.search_content(search_term=search_term, content_type=ContentType.SURVEY, limit=5)

        assert len(result) == 1
        mock_session.execute.assert_called_once()

    async def test_get_content_statistics(self, content_repo, mock_session):
        """Test content statistics generation."""
        # Mock different query results
        mock_state_counts = MagicMock()
        mock_state_counts.all.return_value = [(ContentState.PUBLISHED, 10), (ContentState.DRAFT, 5)]

        mock_type_counts = MagicMock()
        mock_type_counts.all.return_value = [(ContentType.SURVEY, 8), (ContentType.GAME, 7)]

        mock_total = MagicMock()
        mock_total.scalar.return_value = 15

        mock_view_stats = MagicMock()
        mock_view_stats.first.return_value = (100, 6.67, 25)

        mock_session.execute.side_effect = [mock_state_counts, mock_type_counts, mock_total, mock_view_stats]

        result = await content_repo.get_content_statistics()

        assert result["total_content"] == 15
        assert result["by_state"][ContentState.PUBLISHED] == 10
        assert result["by_type"][ContentType.SURVEY] == 8
        assert result["total_views"] == 100
        assert result["average_views"] == 6.67
        assert result["max_views"] == 25

    async def test_increment_view_count(self, content_repo, mock_session):
        """Test incrementing view count."""
        content_id = uuid4()

        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_session.execute.return_value = mock_result

        result = await content_repo.increment_view_count(content_id)

        assert result is True
        mock_session.execute.assert_called_once()


class TestUserRepository:
    """Test UserRepository functionality."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def user_repo(self, mock_session):
        return UserRepository(mock_session)

    async def test_get_by_username(self, user_repo, mock_session):
        """Test getting user by username."""
        username = "testuser"
        mock_user = User(id=uuid4(), username=username)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session.execute.return_value = mock_result

        result = await user_repo.get_by_username(username)

        assert result.username == username
        mock_session.execute.assert_called_once()

    async def test_username_exists(self, user_repo, mock_session):
        """Test checking if username exists."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_session.execute.return_value = mock_result

        result = await user_repo.username_exists("existing_user")

        assert result is True
        mock_session.execute.assert_called_once()

    async def test_get_users_by_role(self, user_repo, mock_session):
        """Test getting users by role."""
        mock_users = [User(id=uuid4(), role=UserRole.CREATOR), User(id=uuid4(), role=UserRole.CREATOR)]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_users
        mock_session.execute.return_value = mock_result

        result = await user_repo.get_users_by_role(UserRole.CREATOR)

        assert len(result) == 2
        mock_session.execute.assert_called_once()

    async def test_search_users(self, user_repo, mock_session):
        """Test user search functionality."""
        search_term = "john"
        mock_users = [User(id=uuid4(), username="johndoe")]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_users
        mock_session.execute.return_value = mock_result

        result = await user_repo.search_users(search_term=search_term, role_filter=UserRole.CREATOR, limit=10)

        assert len(result) == 1
        mock_session.execute.assert_called_once()


class TestMediaRepository:
    """Test MediaRepository functionality."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def media_repo(self, mock_session):
        return MediaRepository(mock_session)

    async def test_get_by_type(self, media_repo, mock_session):
        """Test getting media by type."""
        mock_media = [
            MediaItem(id=uuid4(), media_type=MediaType.PODCAST),
            MediaItem(id=uuid4(), media_type=MediaType.PODCAST),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_media
        mock_session.execute.return_value = mock_result

        result = await media_repo.get_by_type(MediaType.PODCAST)

        assert len(result) == 2
        mock_session.execute.assert_called_once()

    async def test_update_processing_state(self, media_repo, mock_session):
        """Test updating media processing state."""
        media_id = uuid4()

        # Mock the update_by_id method to return the updated media
        updated_media = MediaItem(id=media_id, state=MediaState.COMPLETED)

        with patch.object(media_repo, "update_by_id", return_value=updated_media) as mock_update:
            result = await media_repo.update_processing_state(media_id, MediaState.COMPLETED)

            assert result is True
            mock_update.assert_called_once()

    async def test_mark_as_failed(self, media_repo, mock_session):
        """Test marking media as failed."""
        media_id = uuid4()
        error_message = "Processing failed"

        with patch.object(media_repo, "update_processing_state", return_value=True) as mock_update:
            result = await media_repo.mark_as_failed(media_id, error_message)

            assert result is True
            mock_update.assert_called_once_with(media_id, MediaState.FAILED, error_message)


class TestNodeRepository:
    """Test NodeRepository functionality."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def node_repo(self, mock_session):
        return NodeRepository(mock_session)

    async def test_get_nodes_by_content(self, node_repo, mock_session):
        """Test getting nodes by content ID."""
        content_id = uuid4()
        mock_nodes = [
            Node(id=uuid4(), content_id=content_id, node_type="question"),
            Node(id=uuid4(), content_id=content_id, node_type="information"),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_nodes
        mock_session.execute.return_value = mock_result

        result = await node_repo.get_nodes_by_content(content_id)

        assert len(result) == 2
        mock_session.execute.assert_called_once()

    async def test_get_node_statistics(self, node_repo, mock_session):
        """Test node statistics generation."""
        # Mock query results for statistics
        mock_type_counts = MagicMock()
        mock_type_counts.all.return_value = [("question", 10), ("information", 5)]

        mock_total = 15

        mock_session.execute.return_value = mock_type_counts

        with patch.object(node_repo, "count_all", return_value=mock_total):
            result = await node_repo.get_node_statistics()

            assert result["total_nodes"] == 15
            assert result["by_type"]["question"] == 10


class TestTrainingRepositories:
    """Test training-related repositories."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    async def test_training_program_repository(self, mock_session):
        """Test TrainingProgramRepository functionality."""
        repo = TrainingProgramRepository(mock_session)

        mock_programs = [TrainingProgram(id=uuid4(), is_active=True), TrainingProgram(id=uuid4(), is_active=True)]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_programs
        mock_session.execute.return_value = mock_result

        result = await repo.get_active_programs()

        assert len(result) == 2
        mock_session.execute.assert_called_once()

    async def test_training_session_repository(self, mock_session):
        """Test TrainingSessionRepository functionality."""
        repo = TrainingSessionRepository(mock_session)
        program_id = uuid4()

        mock_sessions = [TrainingSession(id=uuid4(), program_id=program_id)]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_sessions
        mock_session.execute.return_value = mock_result

        result = await repo.get_sessions_by_program(program_id)

        assert len(result) == 1
        mock_session.execute.assert_called_once()


class TestLearningObjectiveRepositories:
    """Test learning objective and keyword repositories."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    async def test_learning_objective_repository(self, mock_session):
        """Test LearningObjectiveRepository functionality."""
        repo = LearningObjectiveRepository(mock_session)

        mock_objectives = [LearningObjective(id=uuid4(), domain="math"), LearningObjective(id=uuid4(), domain="math")]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_objectives
        mock_session.execute.return_value = mock_result

        result = await repo.get_by_domain("math")

        assert len(result) == 2
        mock_session.execute.assert_called_once()

    async def test_keyword_repository(self, mock_session):
        """Test KeywordRepository functionality."""
        repo = KeywordRepository(mock_session)

        keyword_name = "machine learning"
        mock_keyword = Keyword(id=uuid4(), name=keyword_name)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_keyword
        mock_session.execute.return_value = mock_result

        result = await repo.get_by_name(keyword_name)

        assert result.name == keyword_name
        mock_session.execute.assert_called_once()

    async def test_find_or_create_keyword(self, mock_session):
        """Test find_or_create_keyword functionality."""
        repo = KeywordRepository(mock_session)

        # Test when keyword doesn't exist - should create new one
        with patch.object(repo, "get_by_name", return_value=None):
            new_keyword = Keyword(id=uuid4(), name="new_keyword")
            with patch.object(repo, "create", return_value=new_keyword):
                result = await repo.find_or_create_keyword("new_keyword")

                assert result == new_keyword

    async def test_node_associations(self, mock_session):
        """Test node association repositories."""
        node_obj_repo = NodeLearningObjectiveRepository(mock_session)
        node_kw_repo = NodeKeywordRepository(mock_session)

        node_id = uuid4()
        objective_id = uuid4()

        # Test objective association
        mock_objectives = [LearningObjective(id=objective_id)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_objectives
        mock_session.execute.return_value = mock_result

        result = await node_obj_repo.get_objectives_for_node(node_id)
        assert len(result) == 1

        # Test keyword association
        mock_keywords = [Keyword(id=uuid4(), name="test")]
        mock_result.scalars.return_value.all.return_value = mock_keywords

        result = await node_kw_repo.get_keywords_for_node(node_id)
        assert len(result) == 1


class TestSourceDocumentRepository:
    """Test SourceDocumentRepository functionality."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def source_repo(self, mock_session):
        return SourceDocumentRepository(mock_session)

    async def test_get_by_file_hash(self, source_repo, mock_session):
        """Test getting document by file hash."""
        file_hash = "abc123"
        mock_doc = SourceDocument(id=uuid4(), file_hash=file_hash)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_doc
        mock_session.execute.return_value = mock_result

        result = await source_repo.get_by_file_hash(file_hash)

        assert result.file_hash == file_hash
        mock_session.execute.assert_called_once()


class TestGenerationSessionRepository:
    """Test GenerationSessionRepository functionality."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def generation_repo(self, mock_session):
        return GenerationSessionRepository(mock_session)

    async def test_get_by_status(self, generation_repo, mock_session):
        """Test getting generation sessions by status."""
        mock_sessions = [
            GenerationSession(id=uuid4(), status=GenerationStatus.PENDING),
            GenerationSession(id=uuid4(), status=GenerationStatus.PENDING),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_sessions
        mock_session.execute.return_value = mock_result

        result = await generation_repo.get_by_status(GenerationStatus.PENDING)

        assert len(result) == 2
        mock_session.execute.assert_called_once()


# Integration test to verify all repositories can be imported and instantiated
class TestRepositoryIntegration:
    """Test that all repositories integrate properly."""

    def test_all_repositories_import(self):
        """Test that all repositories can be imported successfully."""
        from app.services.orm_repositories import (
            BaseRepository,
            ContentRepository,
            UserRepository,
            MediaRepository,
            GenerationSessionRepository,
            NodeRepository,
            ActivityNodeRepository,
            NodeInteractionRepository,
            TrainingProgramRepository,
            TrainingSessionRepository,
            TrainingBookingRepository,
            AttendanceRecordRepository,
            SourceDocumentRepository,
            LearningObjectiveRepository,
            KeywordRepository,
            NodeLearningObjectiveRepository,
            NodeKeywordRepository,
        )

        # All repositories should be classes
        repositories = [
            BaseRepository,
            ContentRepository,
            UserRepository,
            MediaRepository,
            GenerationSessionRepository,
            NodeRepository,
            ActivityNodeRepository,
            NodeInteractionRepository,
            TrainingProgramRepository,
            TrainingSessionRepository,
            TrainingBookingRepository,
            AttendanceRecordRepository,
            SourceDocumentRepository,
            LearningObjectiveRepository,
            KeywordRepository,
            NodeLearningObjectiveRepository,
            NodeKeywordRepository,
        ]

        for repo_class in repositories:
            assert isinstance(repo_class, type)
            # Skip BaseRepository as it's abstract
            if repo_class != BaseRepository:
                assert hasattr(repo_class, "model")

    def test_repository_instantiation(self):
        """Test that concrete repositories can be instantiated."""
        mock_session = AsyncMock(spec=AsyncSession)

        # Test a few key repositories
        content_repo = ContentRepository(mock_session)
        assert content_repo.session == mock_session
        assert content_repo.model == ContentItem

        user_repo = UserRepository(mock_session)
        assert user_repo.session == mock_session
        assert user_repo.model == User

        media_repo = MediaRepository(mock_session)
        assert media_repo.session == mock_session
        assert media_repo.model == MediaItem
