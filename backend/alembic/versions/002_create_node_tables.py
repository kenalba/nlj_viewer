"""Create node tables for Phase 1.1 - Node Extraction & Foundation

This migration creates the first-class node entities and supporting tables
for the Node Refactor Plan implementation.

Revision ID: 002_create_node_tables  
Revises: 001_initial_consolidated_schema
Create Date: 2025-01-22 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_create_node_tables'
down_revision: Union[str, None] = '001_initial_consolidated_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create node-level tables for first-class node entities."""
    
    # Create nodes table - first-class node entities
    op.create_table('nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_type', sa.String(length=50), nullable=False, comment='NLJ node type (true_false, multiple_choice, etc.)'),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='Complete node data including text, options, media, etc.'),
        sa.Column('content_hash', sa.String(length=64), nullable=True, comment='SHA-256 hash for content deduplication detection'),
        sa.Column('concept_fingerprint', sa.String(length=64), nullable=True, comment='Semantic fingerprint for similarity detection'),
        sa.Column('title', sa.String(length=255), nullable=True, comment='Node title or question text'),
        sa.Column('description', sa.Text(), nullable=True, comment='Node description'),
        sa.Column('difficulty_level', sa.Integer(), nullable=True, comment='Difficulty level 1-10'),
        sa.Column('avg_completion_time', sa.Integer(), nullable=True, comment='Average completion time in milliseconds'),
        sa.Column('success_rate', sa.DECIMAL(precision=5, scale=4), nullable=True, comment='Success rate as decimal 0.0000 to 1.0000'),
        sa.Column('difficulty_score', sa.DECIMAL(precision=3, scale=2), nullable=True, comment='Calculated difficulty score 0.00 to 5.00'),
        sa.Column('engagement_score', sa.DECIMAL(precision=3, scale=2), nullable=True, comment='Engagement score based on interaction patterns'),
        sa.Column('current_version_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Current version ID for version control'),
        sa.Column('base_language', sa.String(length=10), nullable=False, server_default='en-US', comment='Base language code'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for nodes table
    op.create_index(op.f('ix_nodes_id'), 'nodes', ['id'], unique=False)
    op.create_index('idx_nodes_type_performance', 'nodes', ['node_type', 'success_rate'], unique=False)
    op.create_index('idx_nodes_hash_lookup', 'nodes', ['content_hash', 'node_type'], unique=False)
    op.create_index('idx_nodes_fingerprint', 'nodes', ['concept_fingerprint'], unique=False)
    op.create_index('idx_nodes_success_rate', 'nodes', ['success_rate'], unique=False)
    op.create_index('idx_nodes_difficulty', 'nodes', ['difficulty_score'], unique=False)
    
    # Create activity_nodes table - many-to-many relationship
    op.create_table('activity_nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('activity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, comment='Position of node in activity sequence'),
        sa.Column('configuration_overrides', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Activity-specific node customizations'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['activity_id'], ['content_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['node_id'], ['nodes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for activity_nodes table
    op.create_index('idx_activity_nodes_activity', 'activity_nodes', ['activity_id'], unique=False)
    op.create_index('idx_activity_nodes_node', 'activity_nodes', ['node_id'], unique=False)
    op.create_index('idx_activity_position_unique', 'activity_nodes', ['activity_id', 'position'], unique=True)
    
    # Create node_interactions table - high-volume analytics tracking
    op.create_table('node_interactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('activity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', sa.String(length=255), nullable=False, comment='Activity session ID for grouping interactions'),
        sa.Column('response_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='User response data as JSON'),
        sa.Column('is_correct', sa.Boolean(), nullable=True, comment='Whether response was correct'),
        sa.Column('score', sa.DECIMAL(precision=5, scale=2), nullable=True, comment='Score awarded for response'),
        sa.Column('time_to_respond', sa.Integer(), nullable=True, comment='Time taken to respond in milliseconds'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='1', comment='Number of attempts for this interaction'),
        sa.Column('activity_session_id', sa.String(length=255), nullable=True, comment='Overall activity session ID'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['activity_id'], ['content_items.id'], ),
        sa.ForeignKeyConstraint(['node_id'], ['nodes.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for node_interactions table (optimized for analytics queries)
    op.create_index('idx_node_interactions_node_date', 'node_interactions', ['node_id', 'created_at'], unique=False)
    op.create_index('idx_node_interactions_user', 'node_interactions', ['user_id'], unique=False)
    op.create_index('idx_node_interactions_session', 'node_interactions', ['session_id'], unique=False)
    op.create_index('idx_node_interactions_activity', 'node_interactions', ['activity_id'], unique=False)
    op.create_index('idx_node_interactions_created_at', 'node_interactions', ['created_at'], unique=False)
    
    # Create learning_objectives table - normalized learning objectives
    op.create_table('learning_objectives',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('objective_text', sa.Text(), nullable=False, comment='Learning objective description'),
        sa.Column('domain', sa.String(length=100), nullable=True, comment='Domain classification (automotive, sales, programming, etc.)'),
        sa.Column('cognitive_level', sa.String(length=20), nullable=True, comment="Bloom's taxonomy level (remember, understand, apply, analyze, evaluate, create)"),
        sa.Column('difficulty_level', sa.Integer(), nullable=True, comment='Difficulty level 1-10'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0', comment='Number of times this objective has been used'),
        sa.Column('created_from_activity_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Activity that originally defined this objective'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_from_activity_id'], ['content_items.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for learning_objectives table
    op.create_index(op.f('ix_learning_objectives_id'), 'learning_objectives', ['id'], unique=False)
    op.create_index('idx_learning_objectives_text', 'learning_objectives', ['objective_text'], unique=False)
    op.create_index('idx_learning_objectives_domain', 'learning_objectives', ['domain'], unique=False)
    op.create_index('idx_learning_objectives_cognitive', 'learning_objectives', ['cognitive_level'], unique=False)
    op.create_index('idx_learning_objectives_usage', 'learning_objectives', ['usage_count'], unique=False)
    
    # Create keywords table - normalized keywords
    op.create_table('keywords',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('keyword_text', sa.String(length=255), nullable=False, comment='Keyword text'),
        sa.Column('domain', sa.String(length=100), nullable=True, comment='Domain classification'),
        sa.Column('category', sa.String(length=50), nullable=True, comment='Category (technical, process, safety, etc.)'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0', comment='Number of times this keyword has been used'),
        sa.Column('created_from_activity_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Activity that originally defined this keyword'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_from_activity_id'], ['content_items.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for keywords table
    op.create_index(op.f('ix_keywords_id'), 'keywords', ['id'], unique=False)
    op.create_index('idx_keywords_text', 'keywords', ['keyword_text'], unique=False)
    op.create_index('idx_keywords_domain', 'keywords', ['domain'], unique=False)
    op.create_index('idx_keywords_category', 'keywords', ['category'], unique=False)
    op.create_index('idx_keywords_usage', 'keywords', ['usage_count'], unique=False)
    op.create_index('idx_keywords_unique_text', 'keywords', ['keyword_text'], unique=True)
    
    # Create node_learning_objectives table - many-to-many with relevance scoring
    op.create_table('node_learning_objectives',
        sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('objective_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relevance_score', sa.DECIMAL(precision=3, scale=2), nullable=False, server_default='1.0', comment='Relevance score 0.00-1.00'),
        sa.Column('auto_tagged', sa.Boolean(), nullable=False, server_default='false', comment='Whether this relationship was created by auto-tagging'),
        sa.Column('tagged_by', postgresql.UUID(as_uuid=True), nullable=True, comment='User who created this relationship (if manual)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['node_id'], ['nodes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['objective_id'], ['learning_objectives.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tagged_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('node_id', 'objective_id')
    )
    
    # Create indexes for node_learning_objectives table
    op.create_index('idx_node_objectives_node', 'node_learning_objectives', ['node_id'], unique=False)
    op.create_index('idx_node_objectives_objective', 'node_learning_objectives', ['objective_id'], unique=False)
    op.create_index('idx_node_objectives_relevance', 'node_learning_objectives', ['relevance_score'], unique=False)
    
    # Create node_keywords table - many-to-many with relevance scoring
    op.create_table('node_keywords',
        sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('keyword_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relevance_score', sa.DECIMAL(precision=3, scale=2), nullable=False, server_default='1.0', comment='Relevance score 0.00-1.00'),
        sa.Column('auto_tagged', sa.Boolean(), nullable=False, server_default='false', comment='Whether this relationship was created by auto-tagging'),
        sa.Column('tagged_by', postgresql.UUID(as_uuid=True), nullable=True, comment='User who created this relationship (if manual)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['node_id'], ['nodes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['keyword_id'], ['keywords.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tagged_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('node_id', 'keyword_id')
    )
    
    # Create indexes for node_keywords table
    op.create_index('idx_node_keywords_node', 'node_keywords', ['node_id'], unique=False)
    op.create_index('idx_node_keywords_keyword', 'node_keywords', ['keyword_id'], unique=False)
    op.create_index('idx_node_keywords_relevance', 'node_keywords', ['relevance_score'], unique=False)
    
    # Create objective_prerequisites table - concept relationships
    op.create_table('objective_prerequisites',
        sa.Column('objective_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prerequisite_objective_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship_strength', sa.DECIMAL(precision=3, scale=2), nullable=False, server_default='1.0', comment='How essential this prerequisite is (0.00-1.00)'),
        sa.Column('relationship_type', sa.String(length=50), nullable=False, server_default='required', comment='Type: required, recommended, helpful'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['objective_id'], ['learning_objectives.id'], ),
        sa.ForeignKeyConstraint(['prerequisite_objective_id'], ['learning_objectives.id'], ),
        sa.PrimaryKeyConstraint('objective_id', 'prerequisite_objective_id')
    )
    
    # Create indexes for objective_prerequisites table
    op.create_index('idx_objective_prerequisites_obj', 'objective_prerequisites', ['objective_id'], unique=False)
    op.create_index('idx_objective_prerequisites_prereq', 'objective_prerequisites', ['prerequisite_objective_id'], unique=False)


def downgrade() -> None:
    """Drop node-level tables."""
    
    # Drop tables in reverse dependency order
    op.drop_table('objective_prerequisites')
    op.drop_table('node_keywords')
    op.drop_table('node_learning_objectives')
    op.drop_table('keywords')
    op.drop_table('learning_objectives')
    op.drop_table('node_interactions')
    op.drop_table('activity_nodes')
    op.drop_table('nodes')