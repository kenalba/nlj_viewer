"""Add player and learner roles

Revision ID: 8643bf2351a8
Revises: 3cb8325d225a
Create Date: 2025-07-30 10:49:55.604286

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8643bf2351a8"
down_revision = "3cb8325d225a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Add new values to the userrole enum
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'PLAYER'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'LEARNER'")


def downgrade() -> None:
    """Downgrade database schema."""
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type and updating all references
    pass
