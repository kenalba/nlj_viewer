"""Consolidated schema with Content Studio

Revision ID: 001_consolidated_schema
Revises: 
Create Date: 2025-08-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_consolidated_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table('users',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=True),
    sa.Column('role', sa.String(length=50), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_verified', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('department', sa.String(length=100), nullable=True),
    sa.Column('job_title', sa.String(length=100), nullable=True),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('bio', sa.Text(), nullable=True),
    sa.Column('preferences', sa.JSON(), nullable=True),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # Create content_items table
    op.create_table('content_items',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('content_type', sa.String(length=50), nullable=False),
    sa.Column('learning_style', sa.String(length=50), nullable=True),
    sa.Column('difficulty_level', sa.String(length=20), nullable=True),
    sa.Column('estimated_duration', sa.Integer(), nullable=True),
    sa.Column('nlj_data', sa.JSON(), nullable=False),
    sa.Column('is_template', sa.Boolean(), nullable=False),
    sa.Column('template_category', sa.String(length=100), nullable=True),
    sa.Column('state', sa.String(length=30), nullable=False),
    sa.Column('view_count', sa.Integer(), nullable=False),
    sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('generation_session_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Generation session that created this content'),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_content_items_content_type'), 'content_items', ['content_type'], unique=False)
    op.create_index(op.f('ix_content_items_created_by_id'), 'content_items', ['created_by_id'], unique=False)
    op.create_index(op.f('ix_content_items_id'), 'content_items', ['id'], unique=False)
    op.create_index(op.f('ix_content_items_state'), 'content_items', ['state'], unique=False)
    op.create_index(op.f('ix_content_items_title'), 'content_items', ['title'], unique=False)

    # Create content_versions table
    op.create_table('content_versions',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('content_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('version_number', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('nlj_data', sa.JSON(), nullable=False),
    sa.Column('change_summary', sa.Text(), nullable=True),
    sa.Column('state', sa.String(length=30), nullable=False),
    sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['content_id'], ['content_items.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_content_versions_content_id'), 'content_versions', ['content_id'], unique=False)
    op.create_index(op.f('ix_content_versions_created_by_id'), 'content_versions', ['created_by_id'], unique=False)
    op.create_index(op.f('ix_content_versions_id'), 'content_versions', ['id'], unique=False)
    op.create_index(op.f('ix_content_versions_state'), 'content_versions', ['state'], unique=False)

    # Create source_documents table
    op.create_table('source_documents',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False, comment='Current filename (may be converted)'),
    sa.Column('original_filename', sa.String(length=255), nullable=False, comment='Original uploaded filename'),
    sa.Column('file_type', sa.String(length=20), nullable=False, comment='Current file type (after conversion if applicable)'),
    sa.Column('original_file_type', sa.String(length=20), nullable=False, comment='Original file type before conversion'),
    sa.Column('conversion_status', sa.String(length=20), nullable=False),
    sa.Column('conversion_error', sa.Text(), nullable=True),
    sa.Column('claude_file_id', sa.String(length=255), nullable=True, comment='Claude Files API file ID'),
    sa.Column('file_size', sa.BigInteger(), nullable=False, comment='File size in bytes'),
    sa.Column('file_path', sa.String(length=500), nullable=False, comment='Local file system path'),
    sa.Column('extracted_title', sa.String(length=500), nullable=True, comment='Title extracted from document metadata'),
    sa.Column('extracted_author', sa.String(length=255), nullable=True, comment='Author extracted from document metadata'),
    sa.Column('page_count', sa.Integer(), nullable=True, comment='Number of pages (for PDFs)'),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True, comment='User-defined tags for organization'),
    # AI-generated metadata
    sa.Column('summary', sa.Text(), nullable=True, comment='AI-generated summary'),
    sa.Column('keywords', postgresql.ARRAY(sa.String()), nullable=True, comment='AI-extracted keywords'),
    sa.Column('learning_objectives', postgresql.ARRAY(sa.String()), nullable=True, comment='Potential learning objectives'),
    sa.Column('content_type_classification', sa.String(length=100), nullable=True, comment='AI-classified content type'),
    sa.Column('difficulty_level', sa.String(length=20), nullable=True, comment='Content difficulty level'),
    sa.Column('estimated_reading_time', sa.Integer(), nullable=True, comment='Estimated reading time in minutes'),
    sa.Column('key_concepts', postgresql.ARRAY(sa.String()), nullable=True, comment='Main concepts for questions'),
    sa.Column('target_audience', sa.String(length=200), nullable=True, comment='Intended audience'),
    sa.Column('subject_matter_areas', postgresql.ARRAY(sa.String()), nullable=True, comment='Subject areas covered'),
    sa.Column('actionable_items', postgresql.ARRAY(sa.String()), nullable=True, comment='Actionable steps/processes'),
    sa.Column('assessment_opportunities', postgresql.ARRAY(sa.String()), nullable=True, comment='Assessment possibilities'),
    sa.Column('content_gaps', postgresql.ARRAY(sa.String()), nullable=True, comment='Missing information needs'),
    # Usage tracking
    sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('uploaded_to_claude_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True, comment='Claude Files API expiration date'),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_source_documents_claude_file_id'), 'source_documents', ['claude_file_id'], unique=True)
    op.create_index(op.f('ix_source_documents_id'), 'source_documents', ['id'], unique=False)
    op.create_index(op.f('ix_source_documents_user_id'), 'source_documents', ['user_id'], unique=False)

    # Create generation_sessions table
    op.create_table('generation_sessions',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('prompt_config', sa.JSON(), nullable=False, comment='LLM prompt configuration used for generation'),
    sa.Column('claude_conversation_id', sa.String(length=255), nullable=True, comment='Claude conversation ID for continuity'),
    sa.Column('claude_message_id', sa.String(length=255), nullable=True, comment='Claude message ID for the generation request'),
    sa.Column('generated_content', sa.JSON(), nullable=True, comment='Raw response from Claude API'),
    sa.Column('validated_nlj', sa.JSON(), nullable=True, comment='Validated NLJ scenario data'),
    sa.Column('validation_errors', sa.JSON(), nullable=True, comment='Validation errors if NLJ schema validation failed'),
    sa.Column('total_tokens_used', sa.Integer(), nullable=True, comment='Total tokens consumed in generation'),
    sa.Column('generation_time_seconds', sa.Float(), nullable=True, comment='Time taken for generation in seconds'),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_generation_sessions_id'), 'generation_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_generation_sessions_status'), 'generation_sessions', ['status'], unique=False)
    op.create_index(op.f('ix_generation_sessions_user_id'), 'generation_sessions', ['user_id'], unique=False)

    # Add foreign key for content_items.generation_session_id
    op.create_foreign_key(None, 'content_items', 'generation_sessions', ['generation_session_id'], ['id'])
    op.create_index(op.f('ix_content_items_generation_session_id'), 'content_items', ['generation_session_id'], unique=False)

    # Create approval_workflows table
    op.create_table('approval_workflows',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('content_version_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('current_state', sa.String(length=30), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True, comment='When submitted for review'),
    sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True, comment='When final approval was granted'),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True, comment='When version was published'),
    sa.Column('assigned_reviewer_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Currently assigned reviewer'),
    sa.Column('requires_approval', sa.Boolean(), nullable=False, comment='Whether this content type requires approval'),
    sa.Column('auto_publish', sa.Boolean(), nullable=False, comment='Automatically publish after approval'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['assigned_reviewer_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['content_version_id'], ['content_versions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_approval_workflows_assigned_reviewer_id'), 'approval_workflows', ['assigned_reviewer_id'], unique=False)
    op.create_index(op.f('ix_approval_workflows_content_version_id'), 'approval_workflows', ['content_version_id'], unique=True)
    op.create_index(op.f('ix_approval_workflows_current_state'), 'approval_workflows', ['current_state'], unique=False)
    op.create_index(op.f('ix_approval_workflows_id'), 'approval_workflows', ['id'], unique=False)

    # Create workflow_templates table
    op.create_table('workflow_templates',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('content_types', postgresql.ARRAY(sa.String()), nullable=False, comment='Content types this template applies to'),
    sa.Column('stages', sa.JSON(), nullable=False, comment='Workflow stages configuration'),
    sa.Column('auto_assign_rules', sa.JSON(), nullable=True, comment='Rules for automatic reviewer assignment'),
    sa.Column('escalation_rules', sa.JSON(), nullable=True, comment='Escalation rules for overdue reviews'),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflow_templates_created_by_id'), 'workflow_templates', ['created_by_id'], unique=False)
    op.create_index(op.f('ix_workflow_templates_id'), 'workflow_templates', ['id'], unique=False)
    op.create_index(op.f('ix_workflow_templates_is_active'), 'workflow_templates', ['is_active'], unique=False)

    # Create workflow_stages table
    op.create_table('workflow_stages',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('stage_name', sa.String(length=100), nullable=False),
    sa.Column('stage_order', sa.Integer(), nullable=False),
    sa.Column('required_role', sa.String(length=50), nullable=True, comment='Role required to approve this stage'),
    sa.Column('assigned_user_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Specific user assigned to this stage'),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('decision', sa.String(length=20), nullable=True, comment='approve, reject, or request_changes'),
    sa.Column('comments', sa.Text(), nullable=True, comment='Reviewer comments'),
    sa.Column('internal_notes', sa.Text(), nullable=True, comment='Internal notes not visible to content creator'),
    sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['assigned_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['workflow_id'], ['approval_workflows.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflow_stages_assigned_user_id'), 'workflow_stages', ['assigned_user_id'], unique=False)
    op.create_index(op.f('ix_workflow_stages_id'), 'workflow_stages', ['id'], unique=False)
    op.create_index(op.f('ix_workflow_stages_status'), 'workflow_stages', ['status'], unique=False)
    op.create_index(op.f('ix_workflow_stages_workflow_id'), 'workflow_stages', ['workflow_id'], unique=False)

    # Create generation_session_sources association table
    op.create_table('generation_session_sources',
    sa.Column('generation_session_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('source_document_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['generation_session_id'], ['generation_sessions.id'], ),
    sa.ForeignKeyConstraint(['source_document_id'], ['source_documents.id'], ),
    sa.PrimaryKeyConstraint('generation_session_id', 'source_document_id')
    )

    # Create activity_sources table
    op.create_table('activity_sources',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('activity_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('source_document_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('generation_session_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('citation_references', postgresql.ARRAY(sa.String()), nullable=True, comment='Specific page/section references used from the source document'),
    sa.Column('influence_weight', sa.Float(), nullable=True, comment='How heavily this source influenced the generated content (0.0-1.0)'),
    sa.Column('notes', sa.Text(), nullable=True, comment='Additional notes about how this source was used'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['activity_id'], ['content_items.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['generation_session_id'], ['generation_sessions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['source_document_id'], ['source_documents.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_activity_sources_activity_id'), 'activity_sources', ['activity_id'], unique=False)
    op.create_index(op.f('ix_activity_sources_generation_session_id'), 'activity_sources', ['generation_session_id'], unique=False)
    op.create_index(op.f('ix_activity_sources_id'), 'activity_sources', ['id'], unique=False)
    op.create_index(op.f('ix_activity_sources_source_document_id'), 'activity_sources', ['source_document_id'], unique=False)


def downgrade() -> None:
    # Drop all tables in reverse order
    op.drop_table('activity_sources')
    op.drop_table('generation_session_sources')
    op.drop_table('workflow_stages')
    op.drop_table('workflow_templates')
    op.drop_table('approval_workflows')
    op.drop_table('generation_sessions')
    op.drop_table('source_documents')
    op.drop_table('content_versions')
    op.drop_table('content_items')
    op.drop_table('users')