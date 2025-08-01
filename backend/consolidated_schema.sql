-- Consolidated schema with Content Studio
-- Drop existing tables if they exist
DROP TABLE IF EXISTS activity_sources CASCADE;
DROP TABLE IF EXISTS generation_session_sources CASCADE;
DROP TABLE IF EXISTS workflow_stages CASCADE;
DROP TABLE IF EXISTS workflow_templates CASCADE;
DROP TABLE IF EXISTS approval_workflows CASCADE;
DROP TABLE IF EXISTS generation_sessions CASCADE;
DROP TABLE IF EXISTS source_documents CASCADE;
DROP TABLE IF EXISTS content_versions CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL,
    is_verified BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    department VARCHAR(100),
    job_title VARCHAR(100),
    phone VARCHAR(20),
    bio TEXT,
    preferences JSON,
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_id ON users (id);

-- Create content_items table
CREATE TABLE content_items (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL,
    learning_style VARCHAR(50),
    difficulty_level VARCHAR(20),
    estimated_duration INTEGER,
    nlj_data JSON NOT NULL,
    is_template BOOLEAN NOT NULL,
    template_category VARCHAR(100),
    state VARCHAR(30) NOT NULL,
    view_count INTEGER NOT NULL,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    generation_session_id UUID
);

CREATE INDEX ix_content_items_content_type ON content_items (content_type);
CREATE INDEX ix_content_items_created_by_id ON content_items (created_by_id);
CREATE INDEX ix_content_items_id ON content_items (id);
CREATE INDEX ix_content_items_state ON content_items (state);
CREATE INDEX ix_content_items_title ON content_items (title);

-- Create content_versions table
CREATE TABLE content_versions (
    id UUID PRIMARY KEY,
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    nlj_data JSON NOT NULL,
    change_summary TEXT,
    state VARCHAR(30) NOT NULL,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX ix_content_versions_content_id ON content_versions (content_id);
CREATE INDEX ix_content_versions_created_by_id ON content_versions (created_by_id);
CREATE INDEX ix_content_versions_id ON content_versions (id);
CREATE INDEX ix_content_versions_state ON content_versions (state);

-- Create source_documents table
CREATE TABLE source_documents (
    id UUID PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    original_file_type VARCHAR(20) NOT NULL,
    conversion_status VARCHAR(20) NOT NULL,
    conversion_error TEXT,
    claude_file_id VARCHAR(255),
    file_size BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    extracted_title VARCHAR(500),
    extracted_author VARCHAR(255),
    page_count INTEGER,
    description TEXT,
    tags VARCHAR[],
    -- AI-generated metadata
    summary TEXT,
    keywords VARCHAR[],
    learning_objectives VARCHAR[],
    content_type_classification VARCHAR(100),
    difficulty_level VARCHAR(20),
    estimated_reading_time INTEGER,
    key_concepts VARCHAR[],
    target_audience VARCHAR(200),
    subject_matter_areas VARCHAR[],
    actionable_items VARCHAR[],
    assessment_opportunities VARCHAR[],
    content_gaps VARCHAR[],
    -- Usage tracking
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    uploaded_to_claude_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX ix_source_documents_claude_file_id ON source_documents (claude_file_id);
CREATE INDEX ix_source_documents_id ON source_documents (id);
CREATE INDEX ix_source_documents_user_id ON source_documents (user_id);

-- Create generation_sessions table
CREATE TABLE generation_sessions (
    id UUID PRIMARY KEY,
    prompt_config JSON NOT NULL,
    claude_conversation_id VARCHAR(255),
    claude_message_id VARCHAR(255),
    generated_content JSON,
    validated_nlj JSON,
    validation_errors JSON,
    total_tokens_used INTEGER,
    generation_time_seconds FLOAT,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX ix_generation_sessions_id ON generation_sessions (id);
CREATE INDEX ix_generation_sessions_status ON generation_sessions (status);
CREATE INDEX ix_generation_sessions_user_id ON generation_sessions (user_id);

-- Add foreign key for content_items.generation_session_id
ALTER TABLE content_items ADD CONSTRAINT fk_content_items_generation_session_id 
    FOREIGN KEY (generation_session_id) REFERENCES generation_sessions(id);
CREATE INDEX ix_content_items_generation_session_id ON content_items (generation_session_id);

-- Create approval_workflows table
CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
    current_state VARCHAR(30) NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    assigned_reviewer_id UUID REFERENCES users(id),
    requires_approval BOOLEAN NOT NULL,
    auto_publish BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX ix_approval_workflows_assigned_reviewer_id ON approval_workflows (assigned_reviewer_id);
CREATE UNIQUE INDEX ix_approval_workflows_content_version_id ON approval_workflows (content_version_id);
CREATE INDEX ix_approval_workflows_current_state ON approval_workflows (current_state);
CREATE INDEX ix_approval_workflows_id ON approval_workflows (id);

-- Create workflow_templates table
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content_types VARCHAR[] NOT NULL,
    stages JSON NOT NULL,
    auto_assign_rules JSON,
    escalation_rules JSON,
    is_active BOOLEAN NOT NULL,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX ix_workflow_templates_created_by_id ON workflow_templates (created_by_id);
CREATE INDEX ix_workflow_templates_id ON workflow_templates (id);
CREATE INDEX ix_workflow_templates_is_active ON workflow_templates (is_active);

-- Create workflow_stages table  
CREATE TABLE workflow_stages (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    required_role VARCHAR(50),
    assigned_user_id UUID REFERENCES users(id),
    status VARCHAR(30) NOT NULL,
    decision VARCHAR(20),
    comments TEXT,
    internal_notes TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX ix_workflow_stages_assigned_user_id ON workflow_stages (assigned_user_id);
CREATE INDEX ix_workflow_stages_id ON workflow_stages (id);
CREATE INDEX ix_workflow_stages_status ON workflow_stages (status);
CREATE INDEX ix_workflow_stages_workflow_id ON workflow_stages (workflow_id);

-- Create generation_session_sources association table
CREATE TABLE generation_session_sources (
    generation_session_id UUID NOT NULL REFERENCES generation_sessions(id),
    source_document_id UUID NOT NULL REFERENCES source_documents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (generation_session_id, source_document_id)
);

-- Create activity_sources table
CREATE TABLE activity_sources (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    source_document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
    generation_session_id UUID NOT NULL REFERENCES generation_sessions(id) ON DELETE CASCADE,
    citation_references VARCHAR[],
    influence_weight FLOAT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX ix_activity_sources_activity_id ON activity_sources (activity_id);
CREATE INDEX ix_activity_sources_generation_session_id ON activity_sources (generation_session_id);
CREATE INDEX ix_activity_sources_id ON activity_sources (id);
CREATE INDEX ix_activity_sources_source_document_id ON activity_sources (source_document_id);