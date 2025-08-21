"""fix additional enum columns (source_document, media_style)

Revision ID: d6709d231a6f
Revises: 46599381bb39
Create Date: 2025-08-21 13:11:30.518053

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd6709d231a6f'
down_revision = '46599381bb39'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Create new enum types first
    op.execute("CREATE TYPE versionstatus AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')")
    op.execute("CREATE TYPE mediatype AS ENUM ('PODCAST', 'VIDEO', 'IMAGE', 'INFOGRAPHIC', 'AUDIO_SUMMARY')")
    op.execute("CREATE TYPE mediastate AS ENUM ('GENERATING', 'COMPLETED', 'FAILED', 'ARCHIVED')")
    op.execute("CREATE TYPE mediastyle AS ENUM ('NPR_INTERVIEW', 'EDUCATIONAL_SUMMARY', 'CONVERSATIONAL_DEEP_DIVE', 'TECHNICAL_BREAKDOWN')")
    op.execute("CREATE TYPE filetype AS ENUM ('PDF', 'DOCX', 'PPTX', 'TXT', 'ORIGINAL_PDF')")
    op.execute("CREATE TYPE conversionstatus AS ENUM ('PENDING', 'CONVERTING', 'CONVERTED', 'FAILED', 'NOT_REQUIRED')")
    op.execute("CREATE TYPE reviewdecision AS ENUM ('APPROVE', 'REQUEST_REVISION', 'REJECT')")
    op.execute("CREATE TYPE workflowtemplatetype AS ENUM ('TRAINING', 'ASSESSMENT', 'SURVEY', 'GAME', 'DEFAULT')")
    
    # Convert columns to enum types with explicit casting and case conversion
    op.execute("ALTER TABLE content_versions ALTER COLUMN version_status TYPE versionstatus USING UPPER(version_status)::versionstatus")
    op.execute("ALTER TABLE media_items ALTER COLUMN media_type TYPE mediatype USING UPPER(media_type)::mediatype")
    op.execute("ALTER TABLE media_items ALTER COLUMN media_state TYPE mediastate USING UPPER(media_state)::mediastate")
    op.execute("ALTER TABLE media_items ALTER COLUMN media_style TYPE mediastyle USING UPPER(media_style)::mediastyle")
    op.execute("ALTER TABLE source_documents ALTER COLUMN file_type TYPE filetype USING UPPER(file_type)::filetype")
    op.execute("ALTER TABLE source_documents ALTER COLUMN original_file_type TYPE filetype USING UPPER(original_file_type)::filetype")
    op.execute("ALTER TABLE source_documents ALTER COLUMN conversion_status TYPE conversionstatus USING UPPER(conversion_status)::conversionstatus")
    op.execute("ALTER TABLE workflow_reviews ALTER COLUMN decision TYPE reviewdecision USING UPPER(decision)::reviewdecision")
    op.execute("ALTER TABLE workflow_templates ALTER COLUMN content_type TYPE workflowtemplatetype USING UPPER(content_type)::workflowtemplatetype")


def downgrade() -> None:
    """Downgrade database schema."""
    # Convert columns back to VARCHAR with explicit casting
    op.execute("ALTER TABLE workflow_templates ALTER COLUMN content_type TYPE VARCHAR(20) USING content_type::text")
    op.execute("ALTER TABLE workflow_reviews ALTER COLUMN decision TYPE VARCHAR(20) USING decision::text")
    op.execute("ALTER TABLE source_documents ALTER COLUMN conversion_status TYPE VARCHAR(20) USING conversion_status::text")
    op.execute("ALTER TABLE source_documents ALTER COLUMN original_file_type TYPE VARCHAR(20) USING original_file_type::text")
    op.execute("ALTER TABLE source_documents ALTER COLUMN file_type TYPE VARCHAR(20) USING file_type::text")
    op.execute("ALTER TABLE media_items ALTER COLUMN media_style TYPE VARCHAR(30) USING media_style::text")
    op.execute("ALTER TABLE media_items ALTER COLUMN media_state TYPE VARCHAR(20) USING media_state::text")
    op.execute("ALTER TABLE media_items ALTER COLUMN media_type TYPE VARCHAR(20) USING media_type::text")
    op.execute("ALTER TABLE content_versions ALTER COLUMN version_status TYPE VARCHAR(20) USING version_status::text")
    
    # Drop enum types after reverting columns
    op.execute("DROP TYPE IF EXISTS versionstatus")
    op.execute("DROP TYPE IF EXISTS mediatype")
    op.execute("DROP TYPE IF EXISTS mediastate")
    op.execute("DROP TYPE IF EXISTS mediastyle")
    op.execute("DROP TYPE IF EXISTS filetype")
    op.execute("DROP TYPE IF EXISTS conversionstatus")
    op.execute("DROP TYPE IF EXISTS reviewdecision")
    op.execute("DROP TYPE IF EXISTS workflowtemplatetype")