"""add_workflow_template_tables_manual

Revision ID: 3cb8325d225a
Revises: dac4479d39ec
Create Date: 2025-07-28 14:36:19.775895

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3cb8325d225a'
down_revision = 'dac4479d39ec'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade database schema."""
    
    # Tables already exist in database - this migration is a placeholder
    # to track the schema changes in version control
    pass


def downgrade() -> None:
    """Downgrade database schema."""
    
    # Drop tables in reverse order
    op.drop_table('stage_reviewer_assignments')
    op.drop_table('workflow_stage_instances')  
    op.drop_table('workflow_template_stages')
    op.drop_table('workflow_templates')