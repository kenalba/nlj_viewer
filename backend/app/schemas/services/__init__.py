"""
Service-Level Schemas - Clean Architecture Implementation.

These schemas are separate from API request/response schemas and provide:
- Business-level validation rules
- Service layer data transformation
- Domain-specific constraints
- Conversion utilities between API and service boundaries

Structure:
- content_schemas.py - Content management service DTOs
- user_schemas.py - User and authentication service DTOs  
- media_schemas.py - Media processing service DTOs
- generation_schemas.py - AI generation service DTOs
- node_schemas.py - Node management service DTOs
- training_schemas.py - Training program service DTOs
- analytics_schemas.py - Analytics and reporting service DTOs
- common.py - Shared validation utilities and base schemas
"""

from .content_schemas import *  # noqa: F403, F401
from .user_schemas import *  # noqa: F403, F401
from .media_schemas import *  # noqa: F403, F401
from .generation_schemas import *  # noqa: F403, F401
from .common import *  # noqa: F403, F401

__all__ = [
    # Content Service Schemas
    "ContentServiceSchema",
    "ContentCreateServiceSchema", 
    "ContentUpdateServiceSchema",
    "ContentStateTransitionSchema",
    
    # User Service Schemas
    "UserServiceSchema",
    "UserCreateServiceSchema",
    "UserUpdateServiceSchema", 
    "UserAuthenticationSchema",
    "PasswordChangeServiceSchema",
    
    # Media Service Schemas
    "MediaServiceSchema",
    "MediaCreateServiceSchema",
    "MediaProcessingSchema",
    "MediaGenerationServiceSchema",
    
    # Generation Service Schemas
    "GenerationSessionServiceSchema",
    "GenerationConfigServiceSchema",
    "GenerationStatusServiceSchema",
    
    # Common utilities
    "ServiceSchemaBase",
    "ValidationMixin",
    "ConversionMixin",
]