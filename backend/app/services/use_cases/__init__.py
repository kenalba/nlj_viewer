"""
Use Cases Layer - Clean Architecture Implementation.

This module contains all business workflow use cases that orchestrate
ORM services, domain services, and event publishing following Clean Architecture principles.

Use cases handle:
- Business workflow orchestration
- Permission validation
- Event publishing for analytics and audit
- Transaction management across multiple services
- Business rule enforcement
"""

# Phase 2.1 - Core Workflows (12 Use Cases)
from .base_use_case import BaseUseCase

# Content use cases
from .content.create_content_use_case import CreateContentUseCase
from .content.update_content_use_case import UpdateContentUseCase
from .content.review_workflow_use_case import ReviewWorkflowUseCase
from .content.generate_content_use_case import GenerateContentUseCase

# Training use cases  
from .training.manage_program_use_case import ManageProgramUseCase
from .training.manage_sessions_use_case import ManageSessionsUseCase
from .training.track_engagement_use_case import TrackEngagementUseCase

# Analytics use cases
from .analytics.generate_insights_use_case import GenerateInsightsUseCase
from .analytics.export_data_use_case import ExportDataUseCase

# User management use cases
from .user_management.authenticate_user_use_case import AuthenticateUserUseCase
from .user_management.manage_profile_use_case import ManageProfileUseCase
from .user_management.manage_permissions_use_case import ManagePermissionsUseCase

__all__ = [
    # Base class
    'BaseUseCase',
    
    # Content workflows
    'CreateContentUseCase',
    'UpdateContentUseCase', 
    'ReviewWorkflowUseCase',
    'GenerateContentUseCase',
    
    # Training workflows
    'ManageProgramUseCase',
    'ManageSessionsUseCase',
    'TrackEngagementUseCase',
    
    # Analytics workflows
    'GenerateInsightsUseCase',
    'ExportDataUseCase',
    
    # User management workflows
    'AuthenticateUserUseCase',
    'ManageProfileUseCase',
    'ManagePermissionsUseCase',
]