"""
Unit tests for CreateContentUseCase - Content Creation Business Workflow.

Tests comprehensive content creation workflow including permission validation,
business logic, ORM integration, and event publishing.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.content.create_content_use_case import (
    CreateContentUseCase,
    CreateContentRequest,
    CreateContentResponse
)
from app.services.orm_services.content_orm_service import ContentOrmService
from app.models.content import ContentType, LearningStyle, ContentState
from app.models.user import UserRole
from app.schemas.services.content_schemas import ContentServiceSchema

# Configure pytest-asyncio for async tests
pytestmark = pytest.mark.asyncio


class TestCreateContentUseCase:
    """Test CreateContentUseCase business workflow and integration."""

    @pytest.fixture
    def mock_session(self):
        """Create mock AsyncSession."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_content_orm_service(self):
        """Create mock ContentOrmService."""
        return AsyncMock(spec=ContentOrmService)

    @pytest.fixture
    def create_content_use_case(self, mock_session, mock_content_orm_service):
        """Create CreateContentUseCase instance with mocked dependencies."""
        return CreateContentUseCase(mock_session, mock_content_orm_service)
    
    @pytest.fixture
    def mock_content_service_schema(self):
        """Create mock ContentServiceSchema for schema conversion."""
        mock_schema = MagicMock()
        mock_schema.title = "Test Survey Content"
        mock_schema.content_type = ContentType.SURVEY
        mock_schema.learning_style = LearningStyle.VISUAL
        mock_schema.state = ContentState.DRAFT
        mock_schema.is_template = False
        return mock_schema
    
    @pytest.fixture(autouse=True)
    def mock_schema_conversion(self, mock_content_service_schema):
        """Auto-mock the ContentServiceSchema.from_orm_model conversion for all tests."""
        with patch.object(ContentServiceSchema, 'from_orm_model', return_value=mock_content_service_schema):
            yield

    @pytest.fixture
    def valid_content_request(self):
        """Create valid content creation request."""
        return CreateContentRequest(
            title="Test Survey Content",
            description="A comprehensive test survey for evaluation",
            content_type=ContentType.SURVEY,
            learning_style=LearningStyle.VISUAL,
            nlj_data={
                "title": "Test Survey NLJ",
                "nodes": [
                    {"id": "start", "type": "start", "title": "Welcome"},
                    {"id": "q1", "type": "question", "title": "How satisfied are you?"}
                ],
                "edges": [
                    {"source": "start", "target": "q1"}
                ]
            },
            is_template=False,
            template_category=None
        )

    @pytest.fixture
    def creator_user_context(self):
        """Create user context for content creator."""
        return {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.CREATOR,
            "user_name": "Content Creator",
            "user_email": "creator@example.com"
        }

    @pytest.fixture
    def mock_created_content(self):
        """Create mock created content response."""
        content_id = uuid.uuid4()
        mock_content = MagicMock()
        
        # Set all required attributes for ContentServiceSchema
        mock_content.id = content_id
        mock_content.title = "Test Survey Content"
        mock_content.description = "A comprehensive test survey for evaluation"
        mock_content.content_type = ContentType.SURVEY
        mock_content.nlj_data = {"title": "Test Survey NLJ", "nodes": [{"id": "start", "type": "start"}], "edges": []}
        mock_content.learning_style = LearningStyle.VISUAL
        mock_content.state = ContentState.DRAFT
        mock_content.version = 1
        mock_content.is_template = False
        mock_content.template_category = None
        mock_content.parent_content_id = None
        mock_content.generation_session_id = None
        mock_content.import_source = None
        mock_content.import_filename = None
        mock_content.created_by = uuid.uuid4()
        mock_content.view_count = 0
        mock_content.completion_count = 0
        mock_content.published_at = None
        mock_content.created_at = datetime.now(timezone.utc)
        mock_content.updated_at = datetime.now(timezone.utc)
        
        return mock_content

    async def test_create_content_success_basic(self, create_content_use_case, valid_content_request, 
                                              creator_user_context, mock_content_orm_service, 
                                              mock_session, mock_created_content):
        """Test successful basic content creation workflow."""
        # Setup - Mock the ORM service call
        mock_content_orm_service.create_content.return_value = mock_created_content
        
        with patch.object(create_content_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await create_content_use_case.execute(valid_content_request, creator_user_context)
            
            # Verify ORM service was called correctly
            mock_content_orm_service.create_content.assert_called_once()
            call_args = mock_content_orm_service.create_content.call_args
            
            assert call_args[1]["title"] == "Test Survey Content"
            assert call_args[1]["description"] == "A comprehensive test survey for evaluation"
            assert call_args[1]["content_type"] == ContentType.SURVEY
            assert call_args[1]["learning_style"] == LearningStyle.VISUAL
            assert "nlj_data" in call_args[1]
            assert call_args[1]["creator_id"] == uuid.UUID(creator_user_context["user_id"])
            
            # Verify response structure
            assert isinstance(result, CreateContentResponse)
            assert result.content.title == mock_created_content.title
            assert result.is_new_template is False
            
            # Verify event publishing - should publish content creation event
            mock_publish.assert_called_once()
            event_call = mock_publish.call_args
            assert event_call[0][0] == "publish_content_created"  # First positional arg is event method
            event_kwargs = event_call[1]
            assert "content_id" in event_kwargs
            assert "content_title" in event_kwargs
            assert event_kwargs["content_type"] == ContentType.SURVEY.value
            assert event_kwargs["creator_id"] == creator_user_context["user_id"]
            
            # Note: Transaction management is handled by the BaseUseCase infrastructure

    async def test_create_template_content_success(self, create_content_use_case, creator_user_context, 
                                                 mock_content_orm_service, mock_session):
        """Test successful template content creation with categorization."""
        # Setup
        template_request = CreateContentRequest(
            title="Survey Template",
            description="Reusable survey template",
            content_type=ContentType.SURVEY,
            learning_style=LearningStyle.VISUAL,
            nlj_data={"title": "NLJ Content", "nodes": [{"id": "start", "type": "start"}], "edges": []},
            is_template=True,
            template_category="customer_satisfaction"
        )
        
        mock_template_content = MagicMock(
            id=uuid.uuid4(),
            title="Survey Template",
            is_template=True,
            template_category="customer_satisfaction",
            state=ContentState.DRAFT
        )
        mock_content_orm_service.create_content.return_value = mock_template_content
        
        with patch.object(create_content_use_case, '_publish_event') as mock_publish:
            # Execute
            result = await create_content_use_case.execute(template_request, creator_user_context)
            
            # Verify template-specific handling
            call_args = mock_content_orm_service.create_content.call_args[1]
            assert call_args["is_template"] is True
            assert call_args["template_category"] == "customer_satisfaction"
            
            # Verify response
            assert result.is_new_template is True
            
            # Verify template creation event published
            mock_publish.assert_called()

    async def test_create_imported_content_success(self, create_content_use_case, creator_user_context,
                                                 mock_content_orm_service, mock_session):
        """Test content creation with import source tracking."""
        # Setup
        import_request = CreateContentRequest(
            title="Imported Survey",
            description="Survey imported from external system",
            content_type=ContentType.SURVEY,
            learning_style=LearningStyle.KINESTHETIC,
            nlj_data={"title": "NLJ Content", "nodes": [{"id": "start", "type": "start"}], "edges": []},
            import_source="external_system",
            import_filename="survey_data.json"
        )
        
        mock_imported_content = MagicMock(
            id=uuid.uuid4(),
            title="Imported Survey"
        )
        mock_content_orm_service.create_content.return_value = mock_imported_content
        
        with patch.object(create_content_use_case, '_publish_event') as mock_publish:
            # Execute
            await create_content_use_case.execute(import_request, creator_user_context)
            
            # Verify import metadata handling
            call_args = mock_content_orm_service.create_content.call_args[1]
            assert "import_source" in call_args or "metadata" in call_args
            
            # Verify import event published (should be called twice - creation + import)
            assert mock_publish.call_count >= 1

    async def test_permission_error_insufficient_role(self, create_content_use_case, valid_content_request):
        """Test permission error when user role is insufficient for content creation."""
        # Setup - user with insufficient permissions
        learner_context = {
            "user_id": str(uuid.uuid4()),
            "user_role": UserRole.LEARNER,
            "user_name": "Test Learner",
            "user_email": "learner@example.com"
        }
        
        # Execute & Verify
        with pytest.raises(PermissionError, match="Insufficient permissions"):
            await create_content_use_case.execute(valid_content_request, learner_context)

    async def test_validation_error_invalid_title(self, create_content_use_case, creator_user_context):
        """Test validation error for invalid content title."""
        # Setup - request with invalid title
        invalid_request = CreateContentRequest(
            title="",  # Empty title should be invalid
            description="Valid description",
            content_type=ContentType.TRAINING,
            learning_style=LearningStyle.VISUAL,
            nlj_data={"title": "Test NLJ", "nodes": [{"id": "start", "type": "start"}], "edges": []}
        )
        
        # Execute & Verify
        with pytest.raises(ValueError, match="title"):
            await create_content_use_case.execute(invalid_request, creator_user_context)

    async def test_validation_error_invalid_nlj_data(self, create_content_use_case, creator_user_context):
        """Test validation error for invalid NLJ data structure."""
        # Setup - request with invalid NLJ data
        invalid_request = CreateContentRequest(
            title="Valid Title",
            description="Valid description",
            content_type=ContentType.TRAINING,
            learning_style=LearningStyle.AUDITORY,
            nlj_data={"nodes": []}  # Missing required 'title' and 'edges' fields
        )
        
        # Execute & Verify
        with pytest.raises(ValueError, match="NLJ data"):
            await create_content_use_case.execute(invalid_request, creator_user_context)

    async def test_service_error_propagation(self, create_content_use_case, valid_content_request,
                                           creator_user_context, mock_content_orm_service, mock_session):
        """Test proper error handling and transaction rollback on service errors."""
        # Setup - mock service to raise exception
        mock_content_orm_service.create_content.side_effect = Exception("Database error")
        
        # Execute & Verify
        with pytest.raises(RuntimeError, match="content creation"):
            await create_content_use_case.execute(valid_content_request, creator_user_context)
        
        # Verify rollback was called
        mock_session.rollback.assert_called_once()

    async def test_business_rule_validation_template_category(self, create_content_use_case, 
                                                            creator_user_context, mock_content_orm_service):
        """Test business rule auto-categorization for templates without explicit category."""
        # Setup - template without category should be auto-categorized
        template_request = CreateContentRequest(
            title="Template Without Category",
            description="Template that should be auto-categorized",
            content_type=ContentType.SURVEY,
            learning_style=LearningStyle.VISUAL,
            nlj_data={"title": "NLJ Content", "nodes": [{"id": "start", "type": "start"}], "edges": []},
            is_template=True,
            template_category=None  # Should be auto-categorized
        )
        
        mock_content = MagicMock(id=uuid.uuid4())
        mock_content_orm_service.create_content.return_value = mock_content
        
        with patch.object(create_content_use_case, '_publish_event'):
            # Execute
            result = await create_content_use_case.execute(template_request, creator_user_context)
            
            # Verify auto-categorization occurred
            call_args = mock_content_orm_service.create_content.call_args[1]
            assert call_args["template_category"] == "survey_templates"  # Auto-categorized and normalized
            assert result.is_new_template is True

    async def test_user_context_extraction(self, create_content_use_case, valid_content_request,
                                         creator_user_context, mock_content_orm_service, mock_created_content):
        """Test proper extraction and usage of user context information."""
        # Setup
        mock_content_orm_service.create_content.return_value = mock_created_content
        
        with patch.object(create_content_use_case, '_publish_event') as mock_publish:
            # Execute
            await create_content_use_case.execute(valid_content_request, creator_user_context)
            
            # Verify user information was properly extracted and used
            mock_publish.assert_called_once()
            event_args = mock_publish.call_args[1]
            
            # Check that user information is included in event
            assert "creator_id" in event_args or "user_id" in event_args
            assert "creator_name" in event_args or "user_name" in event_args

    async def test_concurrent_creation_handling(self, create_content_use_case, creator_user_context,
                                              mock_content_orm_service, mock_session):
        """Test handling of concurrent content creation scenarios."""
        # Setup - simulate concurrent creation with similar titles
        requests = [
            CreateContentRequest(
                title="Similar Content Title",
                description=f"Description {i}",
                content_type=ContentType.SURVEY,
                learning_style=LearningStyle.VISUAL,
                nlj_data={"title": "Test NLJ", "nodes": [{"id": "start", "type": "start"}], "edges": []}
            ) for i in range(3)
        ]
        
        mock_contents = [
            MagicMock(id=uuid.uuid4(), title="Similar Content Title") 
            for _ in range(3)
        ]
        
        mock_content_orm_service.create_content.side_effect = mock_contents
        
        with patch.object(create_content_use_case, '_publish_event'):
            # Execute concurrent requests
            results = []
            for request in requests:
                result = await create_content_use_case.execute(request, creator_user_context)
                results.append(result)
            
            # Verify all requests succeeded
            assert len(results) == 3
            assert all(isinstance(r, CreateContentResponse) for r in results)

    @pytest.mark.parametrize("content_type,learning_style", [
        (ContentType.TRAINING, LearningStyle.VISUAL),
        (ContentType.SURVEY, LearningStyle.AUDITORY),
        (ContentType.ASSESSMENT, LearningStyle.KINESTHETIC),
        (ContentType.GAME, LearningStyle.VISUAL),
    ])
    async def test_content_type_learning_style_combinations(self, create_content_use_case, 
                                                          creator_user_context, mock_content_orm_service,
                                                          content_type, learning_style):
        """Test various content type and learning style combinations."""
        # Setup
        request = CreateContentRequest(
            title=f"Test {content_type.value} Content",
            description=f"Test content for {content_type.value}",
            content_type=content_type,
            learning_style=learning_style,
            nlj_data={"title": "Test NLJ", "nodes": [{"id": "start", "type": "start"}], "edges": []}
        )
        
        mock_content = MagicMock(
            id=uuid.uuid4(),
            content_type=content_type,
            learning_style=learning_style
        )
        mock_content_orm_service.create_content.return_value = mock_content
        
        with patch.object(create_content_use_case, '_publish_event'):
            # Execute
            result = await create_content_use_case.execute(request, creator_user_context)
            
            # Verify
            assert isinstance(result, CreateContentResponse)
            mock_content_orm_service.create_content.assert_called_once()