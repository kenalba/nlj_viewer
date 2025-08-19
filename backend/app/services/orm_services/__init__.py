"""
ORM Services Layer - Clean Architecture Implementation.

This layer provides transaction-managed CRUD operations using repository abstractions.
Sits between Use Cases and Repositories, handling data persistence with proper boundaries.

Key Responsibilities:
- Transaction management (commit/rollback boundaries)
- CRUD operations using repository pattern
- Data validation at ORM level
- Complex entity relationship management
- Clean separation from business logic

Usage:
    from app.services.orm_services import ContentOrmService, UserOrmService

    # In dependency injection
    content_service = ContentOrmService(session, content_repo)
    user_service = UserOrmService(session, user_repo)
"""

from .base_orm_service import BaseOrmService
from .content_orm_service import ContentOrmService
from .user_orm_service import UserOrmService
from .media_orm_service import MediaOrmService
from .generation_session_orm_service import GenerationSessionOrmService
from .node_orm_service import NodeOrmService
from .source_document_orm_service import SourceDocumentOrmService
from .training_orm_service import TrainingOrmService
from .learning_objective_orm_service import LearningObjectiveOrmService

__all__ = [
    # Base
    "BaseOrmService",
    # Core Entity Services
    "ContentOrmService",
    "UserOrmService",
    "MediaOrmService",
    "GenerationSessionOrmService",
    # Specialized Services
    "NodeOrmService",
    "SourceDocumentOrmService",
    "TrainingOrmService",
    "LearningObjectiveOrmService",
]
