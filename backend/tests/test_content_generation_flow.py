"""
Simple test for content generation workflow validation.

Tests that the use case properly validates permissions, documents, and initiates generation.
"""

import pytest
import pytest_asyncio
import uuid
from unittest.mock import AsyncMock, patch

from app.models.generation_session import GenerationStatus
from app.models.user import UserRole
from app.services.use_cases.content.generate_content_use_case import (
    GenerateContentUseCase,
    GenerateContentRequest
)

# Mark all tests in this module as async
pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def sample_source_documents(test_session, test_user):
    """Create sample source documents for testing."""
    from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
    from app.services.orm_repositories.source_document_repository import SourceDocumentRepository

    # Create source document service
    source_document_repository = SourceDocumentRepository(test_session)
    source_document_orm_service = SourceDocumentOrmService(test_session, source_document_repository)

    doc1 = await source_document_orm_service.create_document(
        filename="python_guide.pdf",
        original_filename="python_guide.pdf",
        file_path="/test/uploads/python_guide.pdf",
        file_type="application/pdf",
        original_file_type="application/pdf",
        user_id=test_user.id,
        file_size=1024,
        summary="Python programming fundamentals with examples and exercises.",
    )

    return [doc1]


@pytest.fixture
def sample_user_context(test_user):
    """Sample user context using the existing test_user fixture."""
    return {
        "user_id": str(test_user.id),
        "user_email": test_user.email,
        "user_name": test_user.full_name,
        "user_role": test_user.role,
    }


@pytest.fixture
def realistic_nlj_response():
    """Realistic NLJ activity JSON structure."""
    return {
        "name": "Python Programming Fundamentals",
        "description": "Learn Python basics through interactive examples",
        "activityType": "training",
        "orientation": "vertical",
        "nodes": [
            {
                "id": "start-1",
                "type": "information",
                "title": "Welcome to Python",
                "content": "Welcome to Python programming! Let's start with the basics.",
                "x": 100,
                "y": 100,
                "width": 200,
                "height": 100
            },
            {
                "id": "question-1", 
                "type": "question",
                "title": "Python Variables",
                "content": "How do you create a variable in Python?",
                "x": 400,
                "y": 100,
                "width": 200,
                "height": 100
            }
        ],
        "links": [
            {
                "id": "link-1",
                "source": "start-1",
                "target": "question-1"
            }
        ]
    }


class TestContentGenerationFlow:
    """Test the content generation workflow."""

    async def test_successful_generation_initiation(
        self, test_session, sample_source_documents, sample_user_context, realistic_nlj_response
    ):
        """Test successful content generation workflow initiation."""
        from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
        from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
        from app.services.orm_services.content_orm_service import ContentOrmService
        from app.services.orm_repositories.generation_repository import GenerationSessionRepository
        from app.services.orm_repositories.source_document_repository import SourceDocumentRepository
        from app.services.orm_repositories.content_repository import ContentRepository

        # Create repositories and ORM services
        generation_repository = GenerationSessionRepository(test_session)
        generation_session_orm_service = GenerationSessionOrmService(test_session, generation_repository)

        source_document_repository = SourceDocumentRepository(test_session)
        source_document_orm_service = SourceDocumentOrmService(test_session, source_document_repository)

        content_repository = ContentRepository(test_session)
        content_orm_service = ContentOrmService(test_session, content_repository)

        # Mock event publishing
        with patch("app.services.use_cases.base_use_case.BaseUseCase._publish_event") as mock_publish:
            mock_publish.return_value = AsyncMock()

            # Create use case
            use_case = GenerateContentUseCase(
                session=test_session,
                generation_session_orm_service=generation_session_orm_service,
                source_document_orm_service=source_document_orm_service,
                content_orm_service=content_orm_service,
            )

            # Create request
            request = GenerateContentRequest(
                source_document_ids=[doc.id for doc in sample_source_documents],
                prompt_config={
                    "generated_prompt_text": "Create a Python programming activity",
                    "generation_type": "activity",
                    "audience_persona": "Python beginners",
                },
                generation_type="activity",
                activity_name="Python Basics",
                activity_description="Learn Python fundamentals",
            )

            # Execute use case
            response = await use_case.execute(request, sample_user_context)

            # Verify response
            assert response is not None
            assert response.generation_started is True
            assert response.generation_session is not None
            assert response.generation_session.status == GenerationStatus.PROCESSING

            # Verify generation session was created
            session_id = uuid.UUID(response.generation_session.id)
            created_session = await generation_session_orm_service.get_by_id(session_id)
            assert created_session is not None
            assert created_session.session_type == "activity"
            assert created_session.user_id == uuid.UUID(sample_user_context["user_id"])

            # Verify events were published
            assert mock_publish.call_count >= 2
            published_events = [call.args[0] for call in mock_publish.call_args_list]
            assert "publish_content_generation_requested" in published_events
            assert "publish_content_generation_started" in published_events

    async def test_permission_validation(self, test_session, sample_source_documents):
        """Test that generation requires proper permissions."""
        from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
        from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
        from app.services.orm_services.content_orm_service import ContentOrmService
        from app.services.orm_repositories.generation_repository import GenerationSessionRepository
        from app.services.orm_repositories.source_document_repository import SourceDocumentRepository
        from app.services.orm_repositories.content_repository import ContentRepository

        # Create services
        generation_repository = GenerationSessionRepository(test_session)
        generation_session_orm_service = GenerationSessionOrmService(test_session, generation_repository)

        source_document_repository = SourceDocumentRepository(test_session)
        source_document_orm_service = SourceDocumentOrmService(test_session, source_document_repository)

        content_repository = ContentRepository(test_session)
        content_orm_service = ContentOrmService(test_session, content_repository)

        # Test with insufficient permissions (VIEWER role)
        viewer_context = {
            "user_id": str(uuid.uuid4()),
            "user_email": "viewer@example.com",
            "user_name": "Test Viewer",
            "user_role": UserRole.VIEWER,
        }

        use_case = GenerateContentUseCase(
            session=test_session,
            generation_session_orm_service=generation_session_orm_service,
            source_document_orm_service=source_document_orm_service,
            content_orm_service=content_orm_service,
        )

        request = GenerateContentRequest(
            source_document_ids=[doc.id for doc in sample_source_documents],
            prompt_config={
                "generated_prompt_text": "Test prompt",
                "generation_type": "activity",
            },
            generation_type="activity",
        )

        # Should raise PermissionError
        with pytest.raises(PermissionError, match="Insufficient permissions"):
            await use_case.execute(request, viewer_context)

    async def test_validation_errors(self, test_session, sample_user_context):
        """Test various validation error scenarios."""
        from app.services.orm_services.generation_session_orm_service import GenerationSessionOrmService
        from app.services.orm_services.source_document_orm_service import SourceDocumentOrmService
        from app.services.orm_services.content_orm_service import ContentOrmService
        from app.services.orm_repositories.generation_repository import GenerationSessionRepository
        from app.services.orm_repositories.source_document_repository import SourceDocumentRepository
        from app.services.orm_repositories.content_repository import ContentRepository

        # Create services
        generation_repository = GenerationSessionRepository(test_session)
        generation_session_orm_service = GenerationSessionOrmService(test_session, generation_repository)

        source_document_repository = SourceDocumentRepository(test_session)
        source_document_orm_service = SourceDocumentOrmService(test_session, source_document_repository)

        content_repository = ContentRepository(test_session)
        content_orm_service = ContentOrmService(test_session, content_repository)

        use_case = GenerateContentUseCase(
            session=test_session,
            generation_session_orm_service=generation_session_orm_service,
            source_document_orm_service=source_document_orm_service,
            content_orm_service=content_orm_service,
        )

        # Test with no source documents
        with pytest.raises(ValueError, match="At least one source document is required"):
            request = GenerateContentRequest(
                source_document_ids=[],
                prompt_config={"generated_prompt_text": "test", "generation_type": "activity"},
                generation_type="activity",
            )
            await use_case.execute(request, sample_user_context)

        # Test with missing prompt config
        with pytest.raises(ValueError, match="Prompt configuration is required"):
            request = GenerateContentRequest(
                source_document_ids=[uuid.uuid4()],
                prompt_config={},
                generation_type="activity"
            )
            await use_case.execute(request, sample_user_context)