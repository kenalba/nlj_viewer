"""Add media items table and update shared tokens for media sharing

Revision ID: 003
Revises: 002
Create Date: 2025-01-08 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_add_media_items'
down_revision = '002_add_shared_tokens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create media_items table
    op.create_table('media_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('media_type', sa.String(length=20), nullable=False),
        sa.Column('media_state', sa.String(length=20), nullable=False),
        sa.Column('transcript', sa.Text(), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('generation_prompt', sa.Text(), nullable=True),
        sa.Column('selected_keywords', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('selected_objectives', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('generation_config', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('media_style', sa.String(length=30), nullable=True),
        sa.Column('voice_config', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('source_document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('generation_start_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('generation_end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('generation_error', sa.Text(), nullable=True),
        sa.Column('play_count', sa.Integer(), nullable=False),
        sa.Column('last_played_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['source_document_id'], ['source_documents.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for media_items
    op.create_index(op.f('ix_media_items_created_by'), 'media_items', ['created_by'], unique=False)
    op.create_index(op.f('ix_media_items_id'), 'media_items', ['id'], unique=False)
    op.create_index(op.f('ix_media_items_media_state'), 'media_items', ['media_state'], unique=False)
    op.create_index(op.f('ix_media_items_media_type'), 'media_items', ['media_type'], unique=False)
    op.create_index(op.f('ix_media_items_source_document_id'), 'media_items', ['source_document_id'], unique=False)
    op.create_index(op.f('ix_media_items_title'), 'media_items', ['title'], unique=False)
    
    # Update shared_tokens to support media sharing
    # Add media_id column
    op.add_column('shared_tokens', sa.Column('media_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add foreign key constraint for media_id
    op.create_foreign_key('fk_shared_tokens_media_id', 'shared_tokens', 'media_items', ['media_id'], ['id'], ondelete='CASCADE')
    
    # Make content_id nullable since we can now share either content or media
    op.alter_column('shared_tokens', 'content_id', nullable=True)
    
    # Add check constraint to ensure either content_id or media_id is set (but not both)
    op.create_check_constraint(
        'shared_tokens_content_or_media_check', 
        'shared_tokens',
        '(content_id IS NOT NULL AND media_id IS NULL) OR (content_id IS NULL AND media_id IS NOT NULL)'
    )


def downgrade() -> None:
    # Drop check constraint
    op.drop_constraint('shared_tokens_content_or_media_check', 'shared_tokens', type_='check')
    
    # Make content_id non-nullable again
    op.alter_column('shared_tokens', 'content_id', nullable=False)
    
    # Drop foreign key constraint for media_id
    op.drop_constraint('fk_shared_tokens_media_id', 'shared_tokens', type_='foreignkey')
    
    # Drop media_id column
    op.drop_column('shared_tokens', 'media_id')
    
    # Drop indexes for media_items
    op.drop_index(op.f('ix_media_items_title'), table_name='media_items')
    op.drop_index(op.f('ix_media_items_source_document_id'), table_name='media_items')
    op.drop_index(op.f('ix_media_items_media_type'), table_name='media_items')
    op.drop_index(op.f('ix_media_items_media_state'), table_name='media_items')
    op.drop_index(op.f('ix_media_items_id'), table_name='media_items')
    op.drop_index(op.f('ix_media_items_created_by'), table_name='media_items')
    
    # Drop media_items table
    op.drop_table('media_items')