"""make activity_id nullable in node_interactions

Revision ID: 003
Revises: 002
Create Date: 2025-08-15 18:50:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Make activity_id nullable in node_interactions table to support standalone node interactions."""
    # Make activity_id column nullable
    op.alter_column('node_interactions', 'activity_id',
                    nullable=True)
    
    # Add index on activity_id for performance (if it doesn't exist)
    op.create_index('ix_node_interactions_activity_id', 'node_interactions', ['activity_id'], unique=False)


def downgrade() -> None:
    """Revert activity_id to non-nullable (requires data cleanup first)."""
    # Remove index first
    op.drop_index('ix_node_interactions_activity_id', table_name='node_interactions')
    
    # Note: This downgrade might fail if there are NULL activity_id values
    # You would need to clean up the data first
    op.alter_column('node_interactions', 'activity_id',
                    nullable=False)