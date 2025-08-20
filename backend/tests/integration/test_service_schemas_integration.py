"""
Integration tests for service schemas with ORM services.

Tests how service schemas work with the existing ORM services architecture,
validating the Clean Architecture boundaries and data flow patterns.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models.content import ContentState, ContentType
from app.models.media import MediaState, MediaType
from app.models.generation_session import GenerationStatus
from app.schemas.services.content_schemas import (
    ContentServiceSchema,
    ContentCreateServiceSchema
)
from app.schemas.services.user_schemas import (
    UserCreateServiceSchema
)
from app.schemas.services.media_schemas import (
    MediaServiceSchema,
    MediaCreateServiceSchema
)
from app.schemas.services.generation_schemas import (
    GenerationSessionServiceSchema
)
from app.schemas.services.node_schemas import (
    NodeServiceSchema,
    NodeCreateServiceSchema
)


class TestServiceSchemaIntegrationPatterns:
    """Test service schemas integration with ORM services."""
    
    def test_content_service_schema_validates_orm_data(self):
        """Test that ContentServiceSchema validates data for ContentOrmService."""
        # Test data that would be passed to ContentOrmService.create_content
        valid_create_data = {
            "title": "Integration Test Content",
            "content_type": ContentType.TRAINING,
            "description": "Test content for integration",
            "nlj_data": {
                "title": "Integration Test Scenario",
                "nodes": [
                    {"id": "node1", "type": "start", "data": {"text": "Welcome"}}
                ],
                "edges": []
            }
        }
        
        # Service schema should validate this data
        schema = ContentCreateServiceSchema(**valid_create_data, created_by=uuid.uuid4())
        
        # Verify the schema contains valid data for ORM service
        assert schema.title == "Integration Test Content"
        assert schema.content_type == ContentType.TRAINING
        assert schema.nlj_data is not None
        assert schema.id is not None  # Auto-generated
        assert schema.state == ContentState.DRAFT  # Default state
        assert schema.version == 1  # Default version
        
        # Test invalid data is rejected
        with pytest.raises(ValidationError) as exc_info:
            ContentCreateServiceSchema(
                title="",  # Empty title should fail
                content_type=ContentType.TRAINING,
                created_by=uuid.uuid4()
            )
        assert "String should have at least 1 character" in str(exc_info.value)
    
    def test_content_schema_state_transitions_match_orm_logic(self):
        """Test that service schema state transitions match ORM service logic."""
        schema = ContentServiceSchema(
            id=uuid.uuid4(),
            title="Test Content",
            nlj_data={"title": "Test NLJ", "nodes": [{"id": "1", "type": "question", "content": {"text": "Test question"}}], "edges": []},
            content_type=ContentType.TRAINING,
            state=ContentState.DRAFT,
            version=1,
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        # Test state transition validation (matches ContentOrmService.update_content_state)
        assert schema.can_transition_to(ContentState.PUBLISHED)
        assert not schema.can_transition_to(ContentState.ARCHIVED)
        
        # Test business rules
        assert schema.can_be_published()
        assert schema.can_be_edited()
        assert not schema.is_published()
    
    def test_user_service_schema_validates_auth_data(self):
        """Test that UserServiceSchema validates data for UserOrmService."""
        # Valid user creation data
        valid_user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "full_name": "Test User",
            "plain_password": "SecurePass123!"
        }
        
        schema = UserCreateServiceSchema(**valid_user_data)
        
        # Verify schema provides data for ORM service
        assert schema.email == "test@example.com"
        assert schema.full_name == "Test User"
        assert schema.username == "testuser"
        assert schema.plain_password == "SecurePass123!"
        assert schema.is_active is True  # Default
        assert schema.id is not None  # Auto-generated
        
        # Test email validation
        with pytest.raises(ValidationError) as exc_info:
            UserCreateServiceSchema(
                username="testuser",
                email="invalid-email",
                full_name="Test User",
                plain_password="SecurePass123!"
            )
        assert "Invalid email format" in str(exc_info.value)
        
        # Test password strength validation
        with pytest.raises(ValidationError) as exc_info:
            UserCreateServiceSchema(
                username="testuser",
                email="test@example.com",
                full_name="Test User",
                plain_password="weak"
            )
        assert "Password must be at least 8 characters" in str(exc_info.value)
    
    def test_media_service_schema_validates_processing_workflow(self):
        """Test MediaServiceSchema validates data for MediaOrmService."""
        # Valid media creation data (matches MediaOrmService.create_media signature)
        valid_media_data = {
            "title": "Test Media",
            "file_path": "/uploads/test.mp3",
            "media_type": MediaType.PODCAST,
            "created_by": uuid.uuid4(),
            "source_document_id": uuid.uuid4(),
            "file_size": 1024000,
            "duration": 300
        }
        
        schema = MediaCreateServiceSchema(**valid_media_data)
        
        # Verify schema provides correct data for ORM service
        assert schema.title == "Test Media"
        assert schema.media_type == MediaType.PODCAST
        assert schema.media_state == MediaState.GENERATING  # Default state
        assert schema.file_size == 1024000
        assert schema.duration == 300
        
        # Test state validation (matches MediaOrmService logic)
        assert schema.is_generating()
        assert not schema.is_completed()
        
        # Test media type validation
        assert schema.is_audio()
        assert not schema.is_video()
        assert not schema.is_visual()
    
    def test_node_service_schema_validates_analytics_data(self):
        """Test NodeServiceSchema validates data for NodeOrmService."""
        # Valid node data (matches NodeOrmService.create_node parameters)
        valid_node_data = {
            "node_type": "multiple_choice",
            "content": {
                "question": "What is 2 + 2?",
                "options": ["3", "4", "5", "6"],
                "correct_answer": 1
            },
            "title": "Basic Math Question",
            "difficulty_level": 2,
            "created_by": uuid.uuid4()
        }
        
        schema = NodeCreateServiceSchema(**valid_node_data)
        
        # Verify schema provides data for ORM service
        assert schema.node_type == "multiple_choice"
        assert schema.content["question"] == "What is 2 + 2?"
        assert schema.title == "Basic Math Question"
        assert schema.difficulty_level == 2
        assert schema.id is not None  # Auto-generated
        
        # Test performance analytics (matches Node model methods)
        analytics_node = NodeServiceSchema(
            id=uuid.uuid4(),
            node_type="multiple_choice", 
            content={"question": "Test"},
            success_rate=Decimal("0.85"),
            difficulty_score=Decimal("3.2"),
            avg_completion_time=5000,
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        assert analytics_node.is_high_performing()
        assert not analytics_node.needs_optimization()
        
        # Test content hash generation for deduplication
        content_hash = analytics_node.generate_content_hash()
        assert len(content_hash) == 64  # SHA-256 hash
        
        # Same content should generate same hash
        duplicate_node = NodeServiceSchema(
            id=uuid.uuid4(),  # Different ID
            node_type="multiple_choice",
            content={"question": "Test"},  # Same content
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        assert analytics_node.generate_content_hash() == duplicate_node.generate_content_hash()
    
    def test_generation_session_schema_validates_ai_workflow(self):
        """Test GenerationSessionServiceSchema validates data for GenerationSessionOrmService."""
        # Valid generation session data
        valid_session_data = {
            "status": GenerationStatus.PROCESSING,
            "user_id": uuid.uuid4(),
            "prompt_config": {
                "model": "claude-3-haiku",
                "max_tokens": 4000,
                "temperature": 0.7
            }
        }
        
        schema = GenerationSessionServiceSchema(**valid_session_data)
        
        # Verify schema provides data for ORM service
        assert schema.status == GenerationStatus.PROCESSING
        assert schema.user_id is not None
        assert schema.prompt_config is not None
        
        # Test status validation methods (mirrors GenerationSession business logic)
        assert schema.is_processing()
        assert not schema.is_completed()
        assert not schema.is_failed()
        
        # Test state transitions
        assert schema.can_transition_to_status(GenerationStatus.COMPLETED)
        assert schema.can_transition_to_status(GenerationStatus.FAILED)
        assert not schema.can_transition_to_status(GenerationStatus.PENDING)
        
        # Test prompt config validation
        with pytest.raises(ValidationError) as exc_info:
            GenerationSessionServiceSchema(**{**valid_session_data, "prompt_config": {}})
        assert "Prompt config cannot be empty" in str(exc_info.value)


class TestServiceSchemaConversionUtilities:
    """Test service schema conversion utilities work with ORM services."""
    
    def test_content_schema_to_orm_service_data(self):
        """Test converting ContentServiceSchema data for ORM service calls."""
        # Create service schema
        schema = ContentCreateServiceSchema(
            title="Test Content",
            content_type=ContentType.TRAINING,
            description="Test description",
            nlj_data={"title": "Test NLJ", "nodes": [{"id": "node1", "type": "question"}], "edges": []},
            created_by=uuid.uuid4()
        )
        
        # Extract data for ORM service call (matches ContentOrmService.create_content parameters)
        orm_data = {
            "title": schema.title,
            "nlj_data": schema.nlj_data,
            "creator_id": schema.created_by,
            "description": schema.description,
            "content_type": schema.content_type
        }
        
        # Verify data format matches ORM service expectations
        assert orm_data["title"] == "Test Content"
        assert orm_data["content_type"] == ContentType.TRAINING
        assert orm_data["creator_id"] is not None
        assert isinstance(orm_data["nlj_data"], dict)
    
    def test_user_schema_to_orm_service_data(self):
        """Test converting UserServiceSchema data for ORM service calls."""
        schema = UserCreateServiceSchema(
            username="testuser",
            email="test@example.com",
            full_name="Test User",
            plain_password="SecurePass123!"
        )
        
        # Extract data for ORM service call (matches UserOrmService.create_user parameters)
        orm_data = {
            "username": schema.username,
            "email": schema.email,
            "full_name": schema.full_name,
            "password_hash": schema.hashed_password
        }
        
        # Verify data format
        assert orm_data["username"] == "testuser"
        assert orm_data["email"] == "test@example.com"
        assert orm_data["full_name"] == "Test User"
        # Note: hashed_password will be None since plain_password doesn't automatically hash
    
    def test_media_schema_to_orm_service_data(self):
        """Test converting MediaServiceSchema data for ORM service calls."""
        schema = MediaCreateServiceSchema(
            title="Test Media",
            file_path="/uploads/test.mp3",
            media_type=MediaType.PODCAST,
            created_by=uuid.uuid4(),
            source_document_id=uuid.uuid4()
        )
        
        # Extract data for ORM service call (matches MediaOrmService.create_media parameters)
        orm_data = {
            "title": schema.title,
            "file_path": schema.file_path,
            "media_type": schema.media_type,
            "creator_id": schema.created_by,
            "source_document_id": schema.source_document_id
        }
        
        # Verify data format
        assert orm_data["title"] == "Test Media"
        assert orm_data["media_type"] == MediaType.PODCAST
        assert orm_data["creator_id"] is not None
        assert orm_data["source_document_id"] is not None


class TestServiceSchemaBusinessValidation:
    """Test service schema business validation rules."""
    
    def test_content_business_rules(self):
        """Test content business validation rules."""
        schema = ContentServiceSchema(
            id=uuid.uuid4(),
            title="Test Content",
            nlj_data={"title": "Test NLJ", "nodes": [{"id": "node1", "type": "question"}], "edges": []},
            content_type=ContentType.TRAINING,
            state=ContentState.DRAFT,
            version=1,
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        # Test workflow state transitions
        valid_transitions = {
            ContentState.DRAFT: [ContentState.SUBMITTED, ContentState.PUBLISHED],
            ContentState.SUBMITTED: [ContentState.IN_REVIEW, ContentState.DRAFT],
            ContentState.IN_REVIEW: [ContentState.APPROVED, ContentState.REJECTED],
            ContentState.APPROVED: [ContentState.PUBLISHED, ContentState.IN_REVIEW],
            ContentState.PUBLISHED: [ContentState.ARCHIVED],
            ContentState.REJECTED: [ContentState.DRAFT],
            ContentState.ARCHIVED: []
        }
        
        for from_state, valid_to_states in valid_transitions.items():
            test_schema = ContentServiceSchema(
                id=uuid.uuid4(),
                title="Test",
                nlj_data={"title": "Test NLJ", "nodes": [{"id": "node1", "type": "question"}], "edges": []},
                content_type=ContentType.TRAINING,
                state=from_state,
                version=1,
                created_by=uuid.uuid4(),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            for to_state in ContentState:
                if to_state in valid_to_states:
                    assert test_schema.can_transition_to(to_state), \
                        f"Should allow transition from {from_state} to {to_state}"
                else:
                    assert not test_schema.can_transition_to(to_state), \
                        f"Should NOT allow transition from {from_state} to {to_state}"
    
    def test_media_processing_workflow_rules(self):
        """Test media processing workflow business rules."""
        # Test different processing states
        states_and_transitions = {
            MediaState.GENERATING: [MediaState.COMPLETED, MediaState.FAILED],
            MediaState.COMPLETED: [MediaState.ARCHIVED],
            MediaState.FAILED: [MediaState.GENERATING],  # Can retry
            MediaState.ARCHIVED: []  # Terminal state
        }
        
        for from_state, valid_to_states in states_and_transitions.items():
            schema = MediaServiceSchema(
                id=uuid.uuid4(),
                title="Test Media",
                file_path="/test.mp3",
                media_type=MediaType.PODCAST,
                media_state=from_state,
                created_by=uuid.uuid4(),
                source_document_id=uuid.uuid4(),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            for to_state in MediaState:
                if to_state in valid_to_states:
                    assert schema.can_transition_to(to_state), \
                        f"Should allow media transition from {from_state} to {to_state}"
                else:
                    assert not schema.can_transition_to(to_state), \
                        f"Should NOT allow media transition from {from_state} to {to_state}"
    
    def test_node_performance_optimization_rules(self):
        """Test node performance optimization business rules."""
        # High-performing node
        high_perf_node = NodeServiceSchema(
            id=uuid.uuid4(),
            node_type="multiple_choice",
            content={"question": "Easy question"},
            success_rate=Decimal("0.92"),
            difficulty_score=Decimal("2.1"),
            avg_completion_time=3000,
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        assert high_perf_node.is_high_performing()
        assert not high_perf_node.needs_optimization()
        
        # Low-performing node
        low_perf_node = NodeServiceSchema(
            id=uuid.uuid4(),
            node_type="multiple_choice",
            content={"question": "Difficult question"},
            success_rate=Decimal("0.35"),
            difficulty_score=Decimal("4.8"),
            avg_completion_time=45000,
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        assert not low_perf_node.is_high_performing()
        assert low_perf_node.needs_optimization()
        
        # Test performance summary
        summary = low_perf_node.get_performance_summary()
        assert summary["success_rate"] == 0.35
        assert summary["difficulty_score"] == 4.8
        assert summary["node_type"] == "multiple_choice"


class TestServiceSchemaFieldValidation:
    """Test service schema field validation patterns."""
    
    def test_uuid_field_validation(self):
        """Test UUID field validation across schemas."""
        # Valid UUID
        valid_uuid = uuid.uuid4()
        
        schema = ContentServiceSchema(
            id=valid_uuid,
            title="Test",
            nlj_data={"title": "Test NLJ", "nodes": [{"id": "node1", "type": "question"}], "edges": []},
            content_type=ContentType.TRAINING,
            state=ContentState.DRAFT,
            version=1,
            created_by=valid_uuid,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        assert schema.id == valid_uuid
        assert schema.created_by == valid_uuid
    
    def test_decimal_precision_validation(self):
        """Test decimal precision validation for financial/metric fields."""
        # Valid decimal values
        node = NodeServiceSchema(
            id=uuid.uuid4(),
            node_type="test",
            content={"test": "data"},
            success_rate=Decimal("0.8500"),  # 4 decimal places
            difficulty_score=Decimal("3.25"),  # 2 decimal places
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        assert node.success_rate == Decimal("0.8500")
        assert node.difficulty_score == Decimal("3.25")
    
    def test_string_length_validation(self):
        """Test string length validation across schemas."""
        # Test title length limits
        with pytest.raises(ValidationError) as exc_info:
            ContentServiceSchema(
                id=uuid.uuid4(),
                title="x" * 256,  # Too long
                nlj_data={"title": "Test NLJ", "nodes": [{"id": "node1", "type": "question"}], "edges": []},
                content_type=ContentType.TRAINING,
                state=ContentState.DRAFT,
                version=1,
                created_by=uuid.uuid4(),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
        assert "String should have at most 255 characters" in str(exc_info.value)
        
        # Test empty strings
        with pytest.raises(ValidationError) as exc_info:
            ContentServiceSchema(
                id=uuid.uuid4(),
                title="",  # Empty
                nlj_data={"title": "Test NLJ", "nodes": [{"id": "node1", "type": "question"}], "edges": []},
                content_type=ContentType.TRAINING,
                state=ContentState.DRAFT,
                version=1,
                created_by=uuid.uuid4(),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
        assert "String should have at least 1 character" in str(exc_info.value)
    
    def test_enum_validation(self):
        """Test enum validation across schemas."""
        # Valid enum values
        schema = ContentServiceSchema(
            id=uuid.uuid4(),
            title="Test",
            nlj_data={"title": "Test NLJ", "nodes": [{"id": "node1", "type": "question"}], "edges": []},
            content_type=ContentType.TRAINING,  # Valid enum
            state=ContentState.DRAFT,  # Valid enum
            version=1,
            created_by=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        assert schema.content_type == ContentType.TRAINING
        assert schema.state == ContentState.DRAFT