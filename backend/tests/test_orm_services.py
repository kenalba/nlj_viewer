"""
Unit tests for ORM Services Layer - Clean Architecture Implementation.

Tests transaction management, error handling, and business logic for all ORM services.
Uses mock-based testing approach following existing patterns.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

# ORM Services imports
from app.services.orm_services.base_orm_service import BaseOrmService
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from app.services.orm_services.media_orm_service import MediaOrmService
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from app.services.orm_services.node_orm_service import NodeOrmService
from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.learning_objective_orm_service import LearningObjectiveOrmService

# Repository imports for mocking
from app.services.orm_repositories.base_repository import BaseRepository
from app.services.orm_repositories.content_repository import ContentRepository
from app.services.orm_repositories.user_repository import UserRepository
from app.services.orm_repositories.media_repository import MediaRepository
from app.services.orm_repositories.generation_repository import GenerationSessionRepository
from app.services.orm_repositories.node_repository import NodeRepository, ActivityNodeRepository, NodeInteractionRepository
from app.services.orm_repositories.source_document_repository import SourceDocumentRepository
from app.services.orm_repositories.training_repository import (
    TrainingProgramRepository, TrainingSessionRepository, 
    TrainingBookingRepository, AttendanceRecordRepository
)
from app.services.orm_repositories.learning_objective_repository import (
    LearningObjectiveRepository, KeywordRepository,
    NodeLearningObjectiveRepository, NodeKeywordRepository
)

# Model imports for type checking
from app.models.user import User, UserRole
from app.models.content import ContentState, ContentType, LearningStyle
from app.models.media import MediaState, MediaType
from app.models.generation_session import GenerationStatus

# Configure pytest-asyncio for async tests
pytestmark = pytest.mark.asyncio


class TestBaseOrmService:
    """Test BaseOrmService abstract functionality and transaction management."""
    
    @pytest.fixture
    def mock_session(self):
        """Create mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_repository(self):
        """Create mock repository."""
        return AsyncMock(spec=BaseRepository)
    
    @pytest.fixture
    def concrete_service(self, mock_session, mock_repository):
        """Create concrete service for testing BaseOrmService."""
        
        class ConcreteOrmService(BaseOrmService[User, BaseRepository]):
            async def validate_entity_data(self, **kwargs):
                return kwargs
            
            async def handle_entity_relationships(self, entity):
                return entity
        
        return ConcreteOrmService(mock_session, mock_repository)
    
    async def test_create_success(self, concrete_service, mock_session, mock_repository):
        """Test successful entity creation with transaction management."""
        # Setup
        test_data = {"username": "testuser", "email": "test@example.com"}
        mock_entity = MagicMock()
        mock_entity.id = uuid.uuid4()
        mock_entity.username = "testuser"
        
        mock_repository.create.return_value = mock_entity
        
        # Execute
        result = await concrete_service.create(**test_data)
        
        # Verify
        assert result.username == "testuser"
        mock_repository.create.assert_called_once_with(**test_data)
        mock_session.commit.assert_called_once()
        mock_session.rollback.assert_not_called()
    
    async def test_create_repository_error(self, concrete_service, mock_session, mock_repository):
        """Test create with repository error triggers rollback."""
        # Setup
        test_data = {"username": "testuser"}
        mock_repository.create.side_effect = SQLAlchemyError("Repository error")
        
        # Execute & Verify
        with pytest.raises(RuntimeError, match="Failed to create entity"):
            await concrete_service.create(**test_data)
        
        mock_session.rollback.assert_called_once()
        mock_session.commit.assert_not_called()
    
    async def test_create_commit_error(self, concrete_service, mock_session, mock_repository):
        """Test create with commit error triggers rollback."""
        # Setup
        test_data = {"username": "testuser"}
        mock_entity = MagicMock()
        mock_repository.create.return_value = mock_entity
        mock_session.commit.side_effect = SQLAlchemyError("Commit error")
        
        # Execute & Verify
        with pytest.raises(RuntimeError, match="Failed to create entity"):
            await concrete_service.create(**test_data)
        
        mock_session.rollback.assert_called_once()
    
    async def test_get_by_id_success(self, concrete_service, mock_repository):
        """Test successful get by ID operation."""
        # Setup
        test_id = uuid.uuid4()
        mock_entity = MagicMock()
        mock_entity.id = test_id
        mock_repository.get_by_id.return_value = mock_entity
        
        # Execute
        result = await concrete_service.get_by_id(test_id)
        
        # Verify
        assert result.id == test_id
        mock_repository.get_by_id.assert_called_once_with(test_id)
    
    async def test_update_success(self, concrete_service, mock_session, mock_repository):
        """Test successful entity update with transaction management."""
        # Setup
        test_id = uuid.uuid4()
        update_data = {"username": "updated_user"}
        mock_entity = MagicMock()
        mock_entity.id = test_id
        
        mock_repository.update_by_id.return_value = mock_entity
        
        # Execute
        result = await concrete_service.update_by_id(test_id, **update_data)
        
        # Verify
        assert result is not None
        mock_repository.update_by_id.assert_called_once_with(test_id, **update_data)
        mock_session.commit.assert_called_once()
    
    async def test_delete_success(self, concrete_service, mock_session, mock_repository):
        """Test successful entity deletion with transaction management."""
        # Setup
        test_id = uuid.uuid4()
        mock_repository.delete_by_id.return_value = True
        
        # Execute
        result = await concrete_service.delete_by_id(test_id)
        
        # Verify
        assert result is True
        mock_repository.delete_by_id.assert_called_once_with(test_id)
        mock_session.commit.assert_called_once()


class TestContentOrmService:
    """Test ContentOrmService functionality and content-specific operations."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_repository(self):
        return AsyncMock(spec=ContentRepository)
    
    @pytest.fixture
    def content_service(self, mock_session, mock_repository):
        return ContentOrmService(mock_session, mock_repository)
    
    async def test_create_content_success(self, content_service, mock_session, mock_repository):
        """Test successful content creation with state validation."""
        # Setup
        creator_id = uuid.uuid4()
        content_data = {
            "title": "Test Content",
            "content_type": ContentType.SURVEY,
            "created_by": creator_id,
            "nlj_data": {"nodes": [], "edges": []}
        }
        
        mock_content = MagicMock()
        mock_content.id = uuid.uuid4()
        mock_content.title = "Test Content"
        mock_content.state = ContentState.DRAFT
        
        mock_repository.create.return_value = mock_content
        
        # Execute
        result = await content_service.create_content(
            title="Test Content",
            description="Test content description",
            content_type=ContentType.SURVEY,
            learning_style=LearningStyle.VISUAL,
            creator_id=creator_id,
            nlj_data={"nodes": [], "edges": []}
        )
        
        # Verify
        assert result.title == "Test Content"
        assert result.state == ContentState.DRAFT
        mock_session.commit.assert_called_once()
    
    async def test_publish_content_success(self, content_service, mock_session, mock_repository):
        """Test content publishing with state transition."""
        # Setup
        content_id = uuid.uuid4()
        
        # Mock the content that get_by_id returns (for state validation)
        mock_existing_content = MagicMock()
        mock_existing_content.id = content_id
        mock_existing_content.state = ContentState.DRAFT
        mock_existing_content.can_transition_to.return_value = True
        
        # Mock the updated content that update_by_id returns
        mock_updated_content = MagicMock()
        mock_updated_content.id = content_id
        mock_updated_content.state = ContentState.PUBLISHED
        
        mock_repository.get_by_id.return_value = mock_existing_content
        mock_repository.update_by_id.return_value = mock_updated_content
        
        # Execute
        result = await content_service.update_content_state(content_id, ContentState.PUBLISHED)
        
        # Verify
        assert result.state == ContentState.PUBLISHED
        mock_repository.get_by_id.assert_called_once_with(content_id)
        mock_existing_content.can_transition_to.assert_called_once_with(ContentState.PUBLISHED)
        mock_session.commit.assert_called_once()
    
    async def test_get_content_by_state_success(self, content_service, mock_repository):
        """Test getting content by state."""
        # Setup
        mock_content_items = [
            MagicMock(id=uuid.uuid4(), title="Content 1", state=ContentState.PUBLISHED),
            MagicMock(id=uuid.uuid4(), title="Content 2", state=ContentState.PUBLISHED)
        ]
        mock_repository.get_published_content.return_value = mock_content_items
        
        # Execute
        result = await content_service.get_published_content(limit=10)
        
        # Verify
        assert len(result) == 2
        assert result[0].state == ContentState.PUBLISHED
        mock_repository.get_published_content.assert_called_once_with(limit=10, offset=0)


class TestUserOrmService:
    """Test UserOrmService functionality and authentication operations."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_repository(self):
        return AsyncMock(spec=UserRepository)
    
    @pytest.fixture
    def user_service(self, mock_session, mock_repository):
        return UserOrmService(mock_session, mock_repository)
    
    async def test_create_user_success(self, user_service, mock_session, mock_repository):
        """Test successful user creation with validation."""
        # Setup
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "hashed_password": "hashed_pwd",
            "full_name": "Test User"
        }
        
        mock_user = MagicMock()
        mock_user.id = uuid.uuid4()
        mock_user.username = "testuser"
        mock_user.role = UserRole.CREATOR  # Default role is CREATOR, not LEARNER
        
        # Mock repository methods to return no existing users
        mock_repository.username_exists.return_value = False
        mock_repository.email_exists.return_value = False
        mock_repository.create.return_value = mock_user
        
        # Execute
        result = await user_service.create_user(
            username="testuser",
            email="test@example.com", 
            password="TestPassword123!",
            full_name="Test User"
        )
        
        # Verify
        assert result.username == "testuser"
        assert result.role == UserRole.CREATOR
        mock_session.commit.assert_called_once()
    
    async def test_authenticate_user_success(self, user_service, mock_repository):
        """Test successful user authentication."""
        # Setup
        username = "testuser"
        mock_user = MagicMock()
        mock_user.username = username
        mock_user.is_active = True
        mock_user.hashed_password = "stored_hash"
        
        mock_repository.get_by_username_or_email.return_value = mock_user
        
        with patch('app.services.orm_services.user_orm_service.verify_password', return_value=True):
            # Execute
            result = await user_service.authenticate_user(username, "correct_password")
            
            # Verify
            assert result == mock_user
            mock_repository.get_by_username_or_email.assert_called_once_with(username)
    
    async def test_authenticate_user_invalid_password(self, user_service, mock_repository):
        """Test authentication with invalid password."""
        # Setup
        username = "testuser"
        mock_user = MagicMock()
        mock_user.is_active = True
        mock_user.hashed_password = "stored_hash"
        
        mock_repository.get_by_username.return_value = mock_user
        
        with patch('app.services.orm_services.user_orm_service.verify_password', return_value=False):
            # Execute
            result = await user_service.authenticate_user(username, "wrong_password")
            
            # Verify
            assert result is None
    
    async def test_validate_entity_data_email_validation(self, user_service):
        """Test email validation in validate_entity_data."""
        # Test valid email
        result = await user_service.validate_entity_data(email="test@example.com")
        assert result["email"] == "test@example.com"
        
        # Test invalid email
        with pytest.raises(ValueError, match="Invalid email format"):
            await user_service.validate_entity_data(email="invalid-email")


class TestMediaOrmService:
    """Test MediaOrmService functionality and media processing operations."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_repository(self):
        return AsyncMock(spec=MediaRepository)
    
    @pytest.fixture
    def media_service(self, mock_session, mock_repository):
        return MediaOrmService(mock_session, mock_repository)
    
    async def test_create_media_success(self, media_service, mock_session, mock_repository):
        """Test successful media creation with processing state."""
        # Setup
        uploader_id = uuid.uuid4()
        media_data = {
            "filename": "test.jpg",
            "file_path": "/uploads/test.jpg",
            "file_size": 1024,
            "media_type": MediaType.IMAGE,
            "uploaded_by": uploader_id
        }
        
        mock_media = MagicMock()
        mock_media.id = uuid.uuid4()
        mock_media.title = "test.jpg"
        mock_media.processing_state = MediaState.GENERATING
        
        mock_repository.create.return_value = mock_media
        
        # Execute
        source_document_id = uuid.uuid4()
        result = await media_service.create_media(
            title="test.jpg",
            file_path="/uploads/test.jpg",
            media_type=MediaType.IMAGE,
            creator_id=uploader_id,
            source_document_id=source_document_id
        )
        
        # Verify
        assert result.title == "test.jpg"
        assert result.processing_state == MediaState.GENERATING
        mock_session.commit.assert_called_once()
    
    async def test_update_processing_state_success(self, media_service, mock_session, mock_repository):
        """Test processing state update."""
        # Setup
        media_id = uuid.uuid4()
        
        # Mock the repository to return True for successful update
        mock_repository.update_by_id.return_value = True
        
        # Execute
        result = await media_service.update_processing_state(media_id, MediaState.COMPLETED)
        
        # Verify
        assert result is True
        mock_repository.update_by_id.assert_called_once_with(
            media_id, media_state=MediaState.COMPLETED
        )
        mock_session.commit.assert_called_once()


class TestGenerationSessionOrmService:
    """Test GenerationSessionOrmService functionality and AI generation workflows."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_repository(self):
        return AsyncMock(spec=GenerationSessionRepository)
    
    @pytest.fixture
    def generation_service(self, mock_session, mock_repository):
        return GenerationSessionOrmService(mock_session, mock_repository)
    
    async def test_create_generation_session_success(self, generation_service, mock_session, mock_repository):
        """Test successful generation session creation."""
        # Setup
        user_id = uuid.uuid4()
        generation_data = {
            "user_id": user_id,
            "generation_type": "content",
            "prompt": "Generate a survey about Python"
        }
        
        mock_session_obj = MagicMock()
        mock_session_obj.id = uuid.uuid4()
        mock_session_obj.status = GenerationStatus.PENDING
        mock_session_obj.session_type = "content"
        
        mock_repository.create.return_value = mock_session_obj
        
        # Execute
        result = await generation_service.create_generation_session(
            user_id=user_id,
            session_type="content",
            config={"prompt": "Generate a survey about Python"}
        )
        
        # Verify
        assert result.status == GenerationStatus.PENDING
        assert result.session_type == "content"
        mock_session.commit.assert_called_once()
    
    async def test_update_generation_status_success(self, generation_service, mock_session, mock_repository):
        """Test generation status update with transition validation."""
        # Setup
        session_id = uuid.uuid4()
        
        # Mock the existing session (for status transition validation)
        mock_existing_session = MagicMock()
        mock_existing_session.id = session_id
        mock_existing_session.status = GenerationStatus.PROCESSING  # Valid starting state
        
        # Mock the updated session
        mock_updated_session = MagicMock()
        mock_updated_session.id = session_id
        mock_updated_session.status = GenerationStatus.COMPLETED
        
        mock_repository.get_by_id.return_value = mock_existing_session
        mock_repository.update_by_id.return_value = mock_updated_session
        
        # Execute
        result = await generation_service.update_session_status(
            session_id, GenerationStatus.COMPLETED
        )
        
        # Verify
        assert result.status == GenerationStatus.COMPLETED
        mock_repository.get_by_id.assert_called_once_with(session_id)
        mock_session.commit.assert_called_once()


class TestNodeOrmService:
    """Test NodeOrmService consolidated operations with multiple repositories."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_node_repo(self):
        return AsyncMock(spec=NodeRepository)
    
    @pytest.fixture
    def mock_activity_repo(self):
        return AsyncMock(spec=ActivityNodeRepository)
    
    @pytest.fixture
    def mock_interaction_repo(self):
        return AsyncMock(spec=NodeInteractionRepository)
    
    @pytest.fixture
    def node_service(self, mock_session, mock_node_repo, mock_activity_repo, mock_interaction_repo):
        return NodeOrmService(mock_session, mock_node_repo, mock_activity_repo, mock_interaction_repo)
    
    async def test_commit_transaction_success(self, node_service, mock_session):
        """Test transaction commit in consolidated service."""
        # Execute
        await node_service.commit_transaction()
        
        # Verify
        mock_session.commit.assert_called_once()
    
    async def test_commit_transaction_error(self, node_service, mock_session):
        """Test transaction commit error handling."""
        # Setup
        mock_session.commit.side_effect = SQLAlchemyError("Commit failed")
        
        # Execute & Verify
        with pytest.raises(RuntimeError, match="Failed to commit transaction"):
            await node_service.commit_transaction()
        
        mock_session.rollback.assert_called_once()


class TestSourceDocumentOrmService:
    """Test SourceDocumentOrmService functionality and document management."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_repository(self):
        return AsyncMock(spec=SourceDocumentRepository)
    
    @pytest.fixture
    def document_service(self, mock_session, mock_repository):
        return SourceDocumentOrmService(mock_session, mock_repository)
    
    async def test_create_document_success(self, document_service, mock_session, mock_repository):
        """Test successful document creation with metadata."""
        # Setup
        creator_id = uuid.uuid4()
        document_data = {
            "title": "Test Document",
            "file_path": "/uploads/test.pdf",
            "file_size": 2048,
            "file_type": "application/pdf",
            "creator_id": creator_id
        }
        
        mock_document = MagicMock()
        mock_document.id = uuid.uuid4()
        mock_document.title = "Test Document"
        mock_document.file_type = "application/pdf"
        
        mock_repository.create.return_value = mock_document
        
        # Execute
        result = await document_service.create_document(
            title="Test Document",
            file_path="/uploads/test.pdf", 
            file_size=2048,
            file_type="application/pdf",
            creator_id=creator_id
        )
        
        # Verify
        assert result.title == "Test Document"
        assert result.file_type == "application/pdf"
        mock_session.commit.assert_called_once()
    
    async def test_validate_entity_data_validation(self, document_service):
        """Test document data validation."""
        # Test valid data
        result = await document_service.validate_entity_data(
            title="Test Document",
            file_path="/uploads/test.pdf",
            file_size=1024,
            creator_id=uuid.uuid4()
        )
        assert result["title"] == "Test Document"
        assert result["file_size"] == 1024
        
        # Test invalid file size
        with pytest.raises(ValueError, match="File size must be a non-negative integer"):
            await document_service.validate_entity_data(file_size=-1)


class TestTrainingOrmService:
    """Test TrainingOrmService consolidated training operations."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture 
    def mock_program_repo(self):
        return AsyncMock(spec=TrainingProgramRepository)
    
    @pytest.fixture
    def mock_session_repo(self):
        return AsyncMock(spec=TrainingSessionRepository)
    
    @pytest.fixture
    def mock_booking_repo(self):
        return AsyncMock(spec=TrainingBookingRepository)
    
    @pytest.fixture
    def mock_attendance_repo(self):
        return AsyncMock(spec=AttendanceRecordRepository)
    
    @pytest.fixture
    def training_service(self, mock_session, mock_program_repo, mock_session_repo, mock_booking_repo, mock_attendance_repo):
        return TrainingOrmService(mock_session, mock_program_repo, mock_session_repo, mock_booking_repo, mock_attendance_repo)
    
    async def test_create_training_program_success(self, training_service, mock_session, mock_program_repo):
        """Test successful training program creation."""
        # Setup
        content_id = uuid.uuid4()
        creator_id = uuid.uuid4()
        
        mock_program = MagicMock()
        mock_program.id = uuid.uuid4()
        mock_program.title = "Python Training"
        mock_program.is_active = True
        
        mock_program_repo.create.return_value = mock_program
        
        # Execute
        result = await training_service.create_training_program(
            title="Python Training",
            description="Learn Python programming",
            content_id=content_id,
            created_by=creator_id
        )
        
        # Verify
        assert result.title == "Python Training"
        assert result.is_active is True
        mock_session.commit.assert_called_once()
    
    async def test_create_training_program_integrity_error(self, training_service, mock_session, mock_program_repo):
        """Test training program creation with integrity error."""
        # Setup
        mock_program_repo.create.side_effect = IntegrityError("", "", "")
        
        # Execute & Verify
        with pytest.raises(ValueError, match="Invalid content or user ID provided"):
            await training_service.create_training_program(
                title="Test Program",
                description="Test Description",
                content_id=uuid.uuid4(),
                created_by=uuid.uuid4()
            )
        
        mock_session.rollback.assert_called_once()


class TestLearningObjectiveOrmService:
    """Test LearningObjectiveOrmService consolidated knowledge management."""
    
    @pytest.fixture
    def mock_session(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_objective_repo(self):
        return AsyncMock(spec=LearningObjectiveRepository)
    
    @pytest.fixture
    def mock_keyword_repo(self):
        return AsyncMock(spec=KeywordRepository)
    
    @pytest.fixture
    def mock_node_objective_repo(self):
        return AsyncMock(spec=NodeLearningObjectiveRepository)
    
    @pytest.fixture
    def mock_node_keyword_repo(self):
        return AsyncMock(spec=NodeKeywordRepository)
    
    @pytest.fixture
    def learning_service(self, mock_session, mock_objective_repo, mock_keyword_repo, mock_node_objective_repo, mock_node_keyword_repo):
        return LearningObjectiveOrmService(
            mock_session, mock_objective_repo, mock_keyword_repo, 
            mock_node_objective_repo, mock_node_keyword_repo
        )
    
    async def test_create_learning_objective_success(self, learning_service, mock_session, mock_objective_repo):
        """Test successful learning objective creation."""
        # Setup
        objective_data = {
            "title": "Learn Python Basics",
            "description": "Understand Python fundamentals",
            "domain": "Programming"
        }
        
        mock_objective = MagicMock()
        mock_objective.id = uuid.uuid4()
        mock_objective.title = "Learn Python Basics"
        mock_objective.domain = "Programming"
        
        mock_objective_repo.create.return_value = mock_objective
        
        # Execute
        result = await learning_service.create_learning_objective(
            title="Learn Python Basics",
            description="Understand Python fundamentals", 
            domain="Programming"
        )
        
        # Verify
        assert result.title == "Learn Python Basics"
        assert result.domain == "Programming"
        mock_session.commit.assert_called_once()
    
    async def test_associate_node_with_objective_success(self, learning_service, mock_session, mock_node_objective_repo):
        """Test successful node-objective association."""
        # Setup
        node_id = uuid.uuid4()
        objective_id = uuid.uuid4()
        
        mock_association = MagicMock()
        mock_association.node_id = node_id
        mock_association.objective_id = objective_id
        
        mock_node_objective_repo.associate_node_with_objective.return_value = mock_association
        
        # Execute
        result = await learning_service.associate_node_with_objective(node_id, objective_id)
        
        # Verify
        assert result.node_id == node_id
        assert result.objective_id == objective_id
        mock_session.commit.assert_called_once()
    
    async def test_associate_node_with_objective_integrity_error(self, learning_service, mock_session, mock_node_objective_repo):
        """Test node-objective association with integrity error."""
        # Setup
        node_id = uuid.uuid4()
        objective_id = uuid.uuid4()
        
        mock_node_objective_repo.associate_node_with_objective.side_effect = IntegrityError("", "", "")
        
        # Execute & Verify
        with pytest.raises(ValueError, match="Invalid node or objective ID provided"):
            await learning_service.associate_node_with_objective(node_id, objective_id)
        
        mock_session.rollback.assert_called_once()


class TestTransactionManagement:
    """Test transaction management patterns across all ORM services."""
    
    async def test_successful_operation_commits_transaction(self):
        """Test that successful operations commit transactions."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_repository = AsyncMock(spec=ContentRepository)
        
        service = ContentOrmService(mock_session, mock_repository)
        
        # Setup successful operation
        mock_content = MagicMock()
        mock_content.id = uuid.uuid4()
        mock_repository.create.return_value = mock_content
        
        # Execute
        await service.create_content(
            title="Test", description="Test description",
            content_type=ContentType.SURVEY, learning_style=LearningStyle.VISUAL,
            creator_id=uuid.uuid4(), nlj_data={}
        )
        
        # Verify transaction committed
        mock_session.commit.assert_called_once()
        mock_session.rollback.assert_not_called()
    
    async def test_repository_error_rolls_back_transaction(self):
        """Test that repository errors trigger transaction rollback."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_repository = AsyncMock(spec=UserRepository)
        
        service = UserOrmService(mock_session, mock_repository)
        
        # Setup mocks to pass validation but fail at repository create
        mock_repository.username_exists.return_value = False
        mock_repository.email_exists.return_value = False
        mock_repository.create.side_effect = SQLAlchemyError("Database error")
        
        # Execute & Verify
        with pytest.raises(RuntimeError):
            await service.create_user(
                username="test", email="test@example.com", 
                password="TestPassword123!", full_name="Test User"
            )
        
        # Verify transaction rolled back
        mock_session.rollback.assert_called_once()
        mock_session.commit.assert_not_called()
    
    async def test_commit_error_triggers_rollback(self):
        """Test that commit errors trigger rollback."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_repository = AsyncMock(spec=MediaRepository)
        
        service = MediaOrmService(mock_session, mock_repository)
        
        # Setup commit error
        mock_media = MagicMock()
        mock_repository.create.return_value = mock_media
        mock_session.commit.side_effect = SQLAlchemyError("Commit failed")
        
        # Execute & Verify
        with pytest.raises(RuntimeError):
            await service.create_media(
                title="test.jpg", file_path="/test",
                media_type=MediaType.IMAGE, creator_id=uuid.uuid4(),
                source_document_id=uuid.uuid4()
            )
        
        # Verify rollback was called
        mock_session.rollback.assert_called_once()


class TestDataValidationPatterns:
    """Test data validation patterns across ORM services."""
    
    async def test_user_email_validation(self):
        """Test email validation in UserOrmService."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_repository = AsyncMock(spec=UserRepository)
        
        service = UserOrmService(mock_session, mock_repository)
        
        # Test valid email
        valid_data = await service.validate_entity_data(email="test@example.com")
        assert valid_data["email"] == "test@example.com"
        
        # Test invalid email formats
        invalid_emails = ["invalid", "@example.com", "test@", "test@.com", ""]
        
        for invalid_email in invalid_emails:
            with pytest.raises(ValueError, match="Invalid email format"):
                await service.validate_entity_data(email=invalid_email)
    
    async def test_document_validation_patterns(self):
        """Test document validation in SourceDocumentOrmService."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_repository = AsyncMock(spec=SourceDocumentRepository)
        
        service = SourceDocumentOrmService(mock_session, mock_repository)
        
        # Test valid document data
        creator_id = uuid.uuid4()
        valid_data = await service.validate_entity_data(
            title="Test Document",
            file_path="/uploads/test.pdf", 
            file_size=1024,
            file_type="application/pdf",
            creator_id=creator_id
        )
        
        assert valid_data["title"] == "Test Document"
        assert valid_data["file_size"] == 1024
        assert valid_data["uploaded_by"] == creator_id
        
        # Test invalid file size
        with pytest.raises(ValueError, match="File size must be a non-negative integer"):
            await service.validate_entity_data(file_size=-1)
        
        # Test empty title
        with pytest.raises(ValueError, match="Title must be a non-empty string"):
            await service.validate_entity_data(title="")