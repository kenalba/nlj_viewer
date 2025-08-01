"""Add Content Studio tables for source documents and generation sessions

Revision ID: add_content_studio_tables
Revises: 8643bf2351a8
Create Date: 2025-08-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_content_studio_tables'
down_revision = '8643bf2351a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
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
    sa.Column('usage_count', sa.Integer(), nullable=True),
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

    # Add generation_session_id column to content_items table
    op.add_column('content_items', sa.Column('generation_session_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Generation session that created this content'))
    op.create_foreign_key(None, 'content_items', 'generation_sessions', ['generation_session_id'], ['id'])
    op.create_index(op.f('ix_content_items_generation_session_id'), 'content_items', ['generation_session_id'], unique=False)


def downgrade() -> None:
    # Remove generation_session_id from content_items
    op.drop_index(op.f('ix_content_items_generation_session_id'), table_name='content_items')
    op.drop_constraint(None, 'content_items', type_='foreignkey')
    op.drop_column('content_items', 'generation_session_id')

    # Drop activity_sources table
    op.drop_index(op.f('ix_activity_sources_source_document_id'), table_name='activity_sources')
    op.drop_index(op.f('ix_activity_sources_id'), table_name='activity_sources')
    op.drop_index(op.f('ix_activity_sources_generation_session_id'), table_name='activity_sources')
    op.drop_index(op.f('ix_activity_sources_activity_id'), table_name='activity_sources')
    op.drop_table('activity_sources')

    # Drop generation_session_sources association table
    op.drop_table('generation_session_sources')

    # Drop generation_sessions table
    op.drop_index(op.f('ix_generation_sessions_user_id'), table_name='generation_sessions')
    op.drop_index(op.f('ix_generation_sessions_status'), table_name='generation_sessions')
    op.drop_index(op.f('ix_generation_sessions_id'), table_name='generation_sessions')
    op.drop_table('generation_sessions')

    # Drop source_documents table
    op.drop_index(op.f('ix_source_documents_user_id'), table_name='source_documents')
    op.drop_index(op.f('ix_source_documents_id'), table_name='source_documents')
    op.drop_index(op.f('ix_source_documents_claude_file_id'), table_name='source_documents')
    op.drop_table('source_documents')