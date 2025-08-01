"""Add shared tokens table for public activity sharing

Revision ID: 002
Revises: 001
Create Date: 2025-01-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_shared_tokens'
down_revision = '001_consolidated_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create shared_tokens table
    op.create_table('shared_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(length=16), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('access_count', sa.Integer(), nullable=False),
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['content_id'], ['content_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    
    # Create indexes for performance
    op.create_index(op.f('ix_shared_tokens_token'), 'shared_tokens', ['token'], unique=True)
    op.create_index(op.f('ix_shared_tokens_content_id'), 'shared_tokens', ['content_id'], unique=False)
    op.create_index(op.f('ix_shared_tokens_created_by'), 'shared_tokens', ['created_by'], unique=False)
    op.create_index(op.f('ix_shared_tokens_is_active'), 'shared_tokens', ['is_active'], unique=False)
    op.create_index(op.f('ix_shared_tokens_created_at'), 'shared_tokens', ['created_at'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_shared_tokens_created_at'), table_name='shared_tokens')
    op.drop_index(op.f('ix_shared_tokens_is_active'), table_name='shared_tokens')
    op.drop_index(op.f('ix_shared_tokens_created_by'), table_name='shared_tokens')
    op.drop_index(op.f('ix_shared_tokens_content_id'), table_name='shared_tokens')
    op.drop_index(op.f('ix_shared_tokens_token'), table_name='shared_tokens')
    
    # Drop table
    op.drop_table('shared_tokens')