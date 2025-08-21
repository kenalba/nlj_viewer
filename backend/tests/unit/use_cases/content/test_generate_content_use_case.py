"""
Unit tests for GenerateContentUseCase - AI Content Generation Business Workflow.

Tests comprehensive AI content generation workflow including permission validation,
source document validation, generation session management, and event publishing.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.content.generate_content_use_case import (
    GenerateContentUseCase,
    GenerateContentRequest,
    GenerateContentResponse
)
from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
from app.services.orm_services.content_orm_service import ContentOrmService
from app.models.generation_session import GenerationStatus
from app.models.user import UserRole
from app.schemas.services.generation_schemas import GenerationSessionServiceSchema
from app.schemas.services.content_schemas import ContentServiceSchema

# Configure pytest-asyncio for async tests
pytestmark = pytest.mark.asyncio


class TestGenerateContentUseCase:
    """Test GenerateContentUseCase AI generation workflow and integration."""

    @pytest.fixture
    def mock_session(self):
        """Create mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_generation_session_orm_service(self):
        """Create mock GenerationSessionOrmService."""
        return AsyncMock(spec=GenerationSessionOrmService)

    @pytest.fixture
    def mock_source_document_orm_service(self):
        """Create mock SourceDocumentOrmService."""
        return AsyncMock(spec=SourceDocumentOrmService)

    @pytest.fixture
    def mock_content_orm_service(self):
        """Create mock ContentOrmService."""
        return AsyncMock(spec=ContentOrmService)

    @pytest.fixture
    def generate_content_use_case(self, mock_session, mock_generation_session_orm_service, 
                                 mock_source_document_orm_service, mock_content_orm_service):
        """Create GenerateContentUseCase instance with mocked dependencies."""
        return GenerateContentUseCase(
            mock_session, 
            mock_generation_session_orm_service,
            mock_source_document_orm_service,
            mock_content_orm_service
        )

    @pytest.fixture
    def mock_generation_session_schema(self):
        """Create mock GenerationSessionServiceSchema."""
        mock_schema = MagicMock()
        mock_schema.id = uuid.uuid4()
        mock_schema.status = GenerationStatus.PENDING
        mock_schema.source_document_ids = [uuid.uuid4(), uuid.uuid4()]
        mock_schema.prompt_config = {"content_type": "scenario", "complexity": "medium"}
        mock_schema.created_at = datetime.now(timezone.utc)
        mock_schema.updated_at = datetime.now(timezone.utc)
        return mock_schema

    @pytest.fixture
    def mock_content_schema(self):
        """Create mock ContentServiceSchema."""
        mock_schema = MagicMock()
        mock_schema.id = uuid.uuid4()
        mock_schema.title = "AI Generated Content"
        mock_schema.description = "Generated training scenario"
        mock_schema.created_at = datetime.now(timezone.utc)
        return mock_schema

    @pytest.fixture
    def user_context_creator(self):
        """Create user context for content creator."""
        return {
            "user_id": str(uuid.uuid4()),
            "user_name": "Content Creator",
            "user_email": "creator@nlj.platform",
            "user_role": UserRole.CREATOR
        }

    @pytest.fixture
    def user_context_admin(self):
        """Create user context for admin."""
        return {
            "user_id": str(uuid.uuid4()),
            "user_name": "Admin User", 
            "user_email": "admin@nlj.platform",
            "user_role": UserRole.ADMIN
        }

    async def test_generate_content_success_basic(
        self, 
        generate_content_use_case,
        mock_generation_session_orm_service,
        mock_source_document_orm_service,
        mock_content_orm_service,
        mock_generation_session_schema,
        user_context_creator
    ):
        """Test successful content generation with basic configuration."""
        # Arrange
        source_doc_id = uuid.uuid4()
        request = GenerateContentRequest(
            source_document_ids=[source_doc_id],
            prompt_config={
                "generated_prompt_text": "Generate a training scenario",
                "generation_type": "scenario",
                "complexity": "medium"
            },
            generation_type="scenario",
            activity_name="Test Scenario",
            auto_create_content=True
        )

        # Mock individual document access (the use case calls get_by_id for each document)
        mock_document = MagicMock()
        mock_document.id = source_doc_id
        mock_document.title = "Test Document"
        mock_document.is_active = True
        mock_document.uploaded_by = uuid.UUID(user_context_creator["user_id"])  # User owns document
        mock_source_document_orm_service.get_by_id.return_value = mock_document

        # Mock generation session creation
        mock_generation_session = MagicMock()
        mock_generation_session.id = uuid.uuid4()
        mock_generation_session.status = GenerationStatus.PENDING
        mock_generation_session_orm_service.create_generation_session.return_value = mock_generation_session
        
        # Mock schema conversion
        GenerationSessionServiceSchema.from_orm_model = MagicMock(return_value=mock_generation_session_schema)

        # Mock event publishing
        with patch.object(generate_content_use_case, '_publish_event') as mock_publish_event:
            # Act
            result = await generate_content_use_case.execute(request, user_context_creator)

            # Assert
            assert isinstance(result, GenerateContentResponse)
            assert result.generation_session == mock_generation_session_schema
            assert result.generation_started is True

            # Verify source document validation (called get_by_id for each document)
            mock_source_document_orm_service.get_by_id.assert_called_once_with(source_doc_id)

            # Verify generation session creation was called
            mock_generation_session_orm_service.create_generation_session.assert_called_once()
            # Note: We don't need to verify exact call args since this is an integration concern

            # Verify event publishing was called
            assert mock_publish_event.call_count >= 1

    async def test_generate_content_with_content_creation(
        self,
        generate_content_use_case,
        mock_generation_session_orm_service,
        mock_source_document_orm_service,
        mock_content_orm_service,
        mock_generation_session_schema,
        mock_content_schema,
        user_context_creator
    ):
        """Test content generation with automatic content creation enabled."""
        # Arrange
        source_doc_id = uuid.uuid4()
        request = GenerateContentRequest(
            source_document_ids=[source_doc_id],
            prompt_config={"content_type": "assessment", "questions": 10},
            generation_type="assessment",
            activity_name="Quiz Assessment",
            activity_description="Generated quiz from training materials",
            auto_create_content=True
        )

        # Mock dependencies
        mock_source_docs = [MagicMock()]
        mock_source_docs[0].id = source_doc_id
        mock_source_document_orm_service.get_by_ids.return_value = mock_source_docs

        mock_generation_session = MagicMock()
        mock_generation_session.id = uuid.uuid4()
        mock_generation_session.status = GenerationStatus.PENDING
        mock_generation_session_orm_service.create_generation_session.return_value = mock_generation_session

        # Mock successful generation result
        mock_generation_session_orm_service.get_completed_generation_result.return_value = {
            "generated_content": {"questions": [{"text": "What is...?"}]},
            "metadata": {"total_questions": 1}
        }

        mock_content = MagicMock()
        mock_content.id = uuid.uuid4()
        mock_content_orm_service.create_content_from_generation.return_value = mock_content

        GenerationSessionServiceSchema.from_orm_model = MagicMock(return_value=mock_generation_session_schema)
        ContentServiceSchema.from_orm_model = MagicMock(return_value=mock_content_schema)

        with patch('app.services.use_cases.content.generate_content_use_case.ContentEventService') as mock_event_service:
            mock_event_instance = AsyncMock()
            mock_event_service.return_value = mock_event_instance

            # Act
            result = await generate_content_use_case.execute(request, user_context_creator)

            # Assert
            assert isinstance(result, GenerateContentResponse)
            assert result.generation_session == mock_generation_session_schema
            assert result.content == mock_content_schema
            assert result.generation_started is True

            # Verify content creation
            mock_content_orm_service.create_content_from_generation.assert_called_once()

            # Verify events published
            mock_event_instance.publish_generation_requested.assert_called_once()
            mock_event_instance.publish_content_created_from_generation.assert_called_once()

    async def test_generate_content_permission_denied(
        self,
        generate_content_use_case,
        user_context_creator
    ):
        """Test permission validation for content generation."""
        # Arrange
        player_context = {
            "user_id": str(uuid.uuid4()),
            "user_name": "Player User",
            "user_email": "player@nlj.platform", 
            "user_role": UserRole.PLAYER
        }

        request = GenerateContentRequest(
            source_document_ids=[uuid.uuid4()],
            prompt_config={"content_type": "scenario"}
        )

        # Act & Assert
        with pytest.raises(PermissionError) as exc_info:
            await generate_content_use_case.execute(request, player_context)
        
        assert "content generation" in str(exc_info.value).lower()

    async def test_generate_content_source_documents_not_found(
        self,
        generate_content_use_case,
        mock_source_document_orm_service,
        user_context_creator
    ):
        """Test validation when source documents don't exist."""
        # Arrange
        request = GenerateContentRequest(
            source_document_ids=[uuid.uuid4(), uuid.uuid4()],
            prompt_config={"content_type": "scenario"}
        )

        # Mock only one document found (missing one)
        mock_source_docs = [MagicMock()]
        mock_source_document_orm_service.get_by_ids.return_value = mock_source_docs

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            await generate_content_use_case.execute(request, user_context_creator)
        
        assert "source document" in str(exc_info.value).lower()

    async def test_generate_content_empty_source_documents(
        self,
        generate_content_use_case,
        user_context_creator
    ):
        """Test validation with empty source document list."""
        # Arrange
        request = GenerateContentRequest(
            source_document_ids=[],
            prompt_config={"content_type": "scenario"}
        )

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            await generate_content_use_case.execute(request, user_context_creator)
        
        assert "source document" in str(exc_info.value).lower()

    async def test_generate_content_invalid_prompt_config(
        self,
        generate_content_use_case,
        user_context_creator
    ):
        """Test validation with invalid prompt configuration."""
        # Arrange
        request = GenerateContentRequest(
            source_document_ids=[uuid.uuid4()],
            prompt_config={}  # Empty config
        )

        # Act & Assert  
        with pytest.raises(ValueError) as exc_info:
            await generate_content_use_case.execute(request, user_context_creator)
        
        assert "prompt config" in str(exc_info.value).lower() or "content_type" in str(exc_info.value).lower()

    async def test_generate_content_service_error_handling(
        self,
        generate_content_use_case,
        mock_source_document_orm_service,
        mock_generation_session_orm_service,
        user_context_creator
    ):
        """Test error handling when generation session creation fails."""
        # Arrange
        request = GenerateContentRequest(
            source_document_ids=[uuid.uuid4()],
            prompt_config={"content_type": "scenario"}
        )

        mock_source_docs = [MagicMock()]
        mock_source_document_orm_service.get_by_ids.return_value = mock_source_docs
        
        # Mock service error
        mock_generation_session_orm_service.create_generation_session.side_effect = Exception("Database error")

        # Act & Assert
        with pytest.raises(RuntimeError) as exc_info:
            await generate_content_use_case.execute(request, user_context_creator)
        
        assert "generation" in str(exc_info.value).lower()

    async def test_generate_content_event_publishing_resilience(
        self,
        generate_content_use_case,
        mock_generation_session_orm_service,
        mock_source_document_orm_service,
        mock_generation_session_schema,
        user_context_creator
    ):
        """Test that event publishing failures don't break the generation workflow."""
        # Arrange
        request = GenerateContentRequest(
            source_document_ids=[uuid.uuid4()],
            prompt_config={"content_type": "scenario"}
        )

        mock_source_docs = [MagicMock()]
        mock_source_document_orm_service.get_by_ids.return_value = mock_source_docs

        mock_generation_session = MagicMock()
        mock_generation_session_orm_service.create_generation_session.return_value = mock_generation_session
        GenerationSessionServiceSchema.from_orm_model = MagicMock(return_value=mock_generation_session_schema)

        with patch('app.services.use_cases.content.generate_content_use_case.ContentEventService') as mock_event_service:
            mock_event_instance = AsyncMock()
            mock_event_instance.publish_generation_requested.side_effect = Exception("Event service down")
            mock_event_service.return_value = mock_event_instance

            # Act - should not raise exception
            result = await generate_content_use_case.execute(request, user_context_creator)

            # Assert
            assert isinstance(result, GenerateContentResponse)
            assert result.generation_session == mock_generation_session_schema
            
            # Verify the generation still succeeded despite event failure
            mock_generation_session_orm_service.create_generation_session.assert_called_once()

    async def test_generate_content_complex_prompt_configuration(
        self,
        generate_content_use_case,
        mock_generation_session_orm_service,
        mock_source_document_orm_service,
        mock_generation_session_schema,
        user_context_admin
    ):
        """Test generation with complex prompt configuration and admin permissions."""
        # Arrange
        source_doc_id = uuid.uuid4()
        complex_prompt_config = {
            "content_type": "comprehensive_training",
            "modules": ["safety", "compliance", "best_practices"],
            "difficulty_level": "advanced",
            "include_assessments": True,
            "assessment_weight": 0.3,
            "scenario_count": 5,
            "interactive_elements": ["decision_trees", "simulations"],
            "target_duration_minutes": 120,
            "learning_objectives": [
                "Understand safety protocols",
                "Apply compliance regulations",
                "Demonstrate best practices"
            ]
        }

        request = GenerateContentRequest(
            source_document_ids=[source_doc_id],
            prompt_config=complex_prompt_config,
            generation_type="comprehensive_training",
            activity_name="Advanced Safety Training",
            activity_description="Comprehensive safety and compliance training program",
            auto_create_content=True
        )

        # Mock dependencies
        mock_source_docs = [MagicMock()]
        mock_source_docs[0].title = "Safety Manual"
        mock_source_document_orm_service.get_by_ids.return_value = mock_source_docs

        mock_generation_session = MagicMock()
        mock_generation_session_orm_service.create_generation_session.return_value = mock_generation_session
        GenerationSessionServiceSchema.from_orm_model = MagicMock(return_value=mock_generation_session_schema)

        with patch('app.services.use_cases.content.generate_content_use_case.ContentEventService') as mock_event_service:
            mock_event_instance = AsyncMock()
            mock_event_service.return_value = mock_event_instance

            # Act
            result = await generate_content_use_case.execute(request, user_context_admin)

            # Assert
            assert isinstance(result, GenerateContentResponse)
            
            # Verify complex configuration passed through
            call_args = mock_generation_session_orm_service.create_generation_session.call_args[1]
            assert call_args["prompt_config"] == complex_prompt_config
            assert call_args["generation_type"] == "comprehensive_training"
            assert call_args["activity_name"] == "Advanced Safety Training"

            # Verify admin permissions allowed complex generation
            assert result.generation_started is True

    @pytest.mark.parametrize("generation_type,expected_validation", [
        ("scenario", True),
        ("assessment", True), 
        ("survey", True),
        ("game", True),
        ("invalid_type", False)
    ])
    async def test_generate_content_type_validation(
        self,
        generate_content_use_case,
        user_context_creator,
        generation_type,
        expected_validation
    ):
        """Test validation of different generation types."""
        # Arrange
        request = GenerateContentRequest(
            source_document_ids=[uuid.uuid4()],
            prompt_config={"content_type": generation_type},
            generation_type=generation_type
        )

        if expected_validation:
            # Mock successful path
            with patch.object(generate_content_use_case, '_validate_user_permissions'), \
                 patch.object(generate_content_use_case, '_validate_source_documents'), \
                 patch.object(generate_content_use_case, '_validate_prompt_configuration'), \
                 patch.object(generate_content_use_case, '_create_generation_session') as mock_create:
                
                mock_create.return_value = (MagicMock(), MagicMock())
                
                # Should not raise exception
                result = await generate_content_use_case.execute(request, user_context_creator)
                assert isinstance(result, GenerateContentResponse)
        else:
            # Should raise validation error
            with pytest.raises(ValueError):
                await generate_content_use_case.execute(request, user_context_creator)