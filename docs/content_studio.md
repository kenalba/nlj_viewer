# Content Studio - AI Content Generation Product Specification

## Objective

Create an integrated Content Studio that eliminates context switching by allowing users to upload source documents, configure AI generation parameters, and create NLJ scenarios entirely within the platform. This feature serves as Phase 1 toward the comprehensive Ander Library 2.0 vision while delivering immediate value through streamlined content creation workflows.

**Current State**: Users generate prompts in NLJ platform → switch to Claude.ai → upload documents → paste prompts → copy generated JSON → return to NLJ platform

**Target State**: Users upload documents → configure generation parameters → generate content → edit in Flow Editor - all within a single platform experience

## Success Metrics

| **Goal**            | **Metric**                                                            | **Target**          |
| ------------------- | --------------------------------------------------------------------- | ------------------- |
| Workflow Efficiency | Time from document upload to Flow Editor (vs. current manual process) | 75% reduction       |
| User Adoption       | % of content creators using Content Studio vs. manual process         | 80% within 6 months |
| Content Quality     | % of generated scenarios requiring minimal editing before publication | 60% improvement     |
| Platform Retention  | Reduction in session abandonment during content creation              | 50% reduction       |
| Document Reuse      | Average documents per user reused across multiple generations         | 2.5+ reuses         |

## User Stories

### Primary User Stories (Phase 1)

**Epic 1: Document Management**

- **As a content creator**, I want to upload multiple source documents (PDFs, PowerPoints, Word docs) in a single session so that I can generate comprehensive training scenarios from diverse materials
- **As a content creator**, I want to see my recently uploaded documents so that I can reuse sources across multiple content generation sessions
- **As a content creator**, I want to preview document contents before generation so that I can verify the right materials are selected

**Epic 2: AI Content Generation**

- **As a content creator**, I want to configure generation parameters (audience, objectives, complexity, node types) so that the AI creates content tailored to my specific needs
- **As a content creator**, I want to combine multiple documents with my prompt configuration in a single generation request so that I can create rich, multi-source scenarios
- **As a content creator**, I want to see generation progress and handle errors gracefully so that I understand what's happening and can retry if needed

**Epic 3: Content Handoff**

- **As a content creator**, I want generated scenarios to open directly in the Flow Editor so that I can immediately review and refine the content
- **As a content creator**, I want to save generated scenarios as drafts so that I can return to edit them later
- **As a content creator**, I want to track which source documents were used for each generated activity so that I can understand content lineage

### Secondary User Stories (Future Phases)

**Epic 4: Document Library**

- **As a content creator**, I want to organize documents into collections so that I can group related materials for specific training programs
- **As a content creator**, I want to add metadata and tags to documents so that I can search and filter my source library effectively
- **As an admin**, I want to see usage analytics for source documents so that I can understand which materials are most valuable

## Requirements & Acceptance Criteria

### Functional Requirements

#### Document Upload & Management

**Requirement 1.1**: Multi-file upload interface

- **AC 1.1.1**: Users can drag-and-drop multiple files (PDF, DOCX, PPTX) simultaneously
- **AC 1.1.2**: Upload progress indicators show for each file with error handling
- **AC 1.1.3**: File validation prevents unsupported formats with clear error messages
- **AC 1.1.4**: Maximum file size of 32MB per file, 100MB total per session (Claude API limits)

**Requirement 1.2**: Document library interface

- **AC 1.2.1**: Recently uploaded documents display in card/list view with thumbnails
- **AC 1.2.2**: Document metadata shows: filename, upload date, file size, usage count
- **AC 1.2.3**: Users can select multiple documents for generation via checkboxes
- **AC 1.2.4**: Delete functionality removes documents from library and Claude Files API

#### AI Configuration & Generation

**Requirement 2.1**: Enhanced prompt configuration

- **AC 2.1.1**: All existing LLMPromptGenerator configuration options remain available
- **AC 2.1.2**: Selected documents display in configuration interface with ability to modify selection
- **AC 2.1.3**: Real-time character count shows total prompt + document size approaching API limits

**Requirement 2.2**: Integrated generation workflow

- **AC 2.2.1**: Single "Generate Content" action combines prompt + documents in Claude API call
- **AC 2.2.2**: Generation progress indicator with estimated completion time
- **AC 2.2.3**: Error handling for API failures with retry mechanism and clear error messages
- **AC 2.2.4**: Generated JSON validates against NLJ schema with specific error reporting

#### Flow Editor Integration

**Requirement 3.1**: Seamless content handoff

- **AC 3.1.1**: Generated scenarios open directly in Flow Editor with pre-populated nodes
- **AC 3.1.2**: Source document references stored with activity metadata
- **AC 3.1.3**: "Back to Content Studio" navigation maintains generation session state

**Requirement 3.2**: Content persistence

- **AC 3.2.1**: Generated scenarios auto-save as drafts with source document lineage
- **AC 3.2.2**: Activity metadata includes: generation timestamp, source documents, configuration used
- **AC 3.2.3**: Users can access generation history from both Content Studio and Activity Library

### Technical Requirements

#### Backend Infrastructure

**Requirement 4.1**: Claude Files API integration

- **AC 4.1.1**: Secure file upload to Claude Files API with proper authentication
- **AC 4.1.2**: File ID storage in PostgreSQL with expiration tracking
- **AC 4.1.3**: Automatic cleanup of expired file references

**Requirement 4.2**: Enhanced content generation endpoint

- **AC 4.2.1**: API endpoint accepts prompt configuration + document IDs
- **AC 4.2.2**: Combines existing prompt generation logic with document references
- **AC 4.2.3**: Returns validated NLJ JSON with generation metadata

#### Frontend Architecture

**Requirement 5.1**: Content Studio interface

- **AC 5.1.1**: New main navigation item "Content Studio" accessible to creators/admins
- **AC 5.1.2**: Multi-step wizard: Upload → Configure → Generate → Edit
- **AC 5.1.3**: Responsive design consistent with existing platform UI patterns

**Requirement 5.2**: State management

- **AC 5.2.1**: Generation session state persists across page navigation
- **AC 5.2.2**: Document selection state maintained throughout configuration process
- **AC 5.2.3**: Error states and progress indicators integrated with global loading patterns

### Performance Requirements

**Requirement 6.1**: Response times

- **AC 6.1.1**: Document upload completes within 30 seconds for 32MB files
- **AC 6.1.2**: Generation process completes within 60 seconds for standard scenarios
- **AC 6.1.3**: Flow Editor loads generated content within 5 seconds

**Requirement 6.2**: Scalability

- **AC 6.2.1**: Support 50 concurrent document uploads without degradation
- **AC 6.2.2**: Database queries for document library remain under 500ms
- **AC 6.2.3**: Claude API rate limiting handled gracefully with user feedback

### Security & Compliance Requirements

**Requirement 7.1**: Data protection

- **AC 7.1.1**: Document uploads require authentication and authorization
- **AC 7.1.2**: File access restricted to uploading user only
- **AC 7.1.3**: Document content encrypted in transit and at rest (Claude Files API)

**Requirement 7.2**: API security

- **AC 7.2.1**: Claude API keys stored securely in environment variables
- **AC 7.2.2**: Request logging excludes sensitive document content
- **AC 7.2.3**: Rate limiting prevents API abuse

## Technical Implementation

### Architecture Overview

```
Content Studio Frontend
├── Document Upload Component (React + react-dropzone)
├── Library Management Interface
├── Enhanced Prompt Configuration (existing LLMPromptGenerator)
└── Generation Progress & Results

FastAPI Backend
├── /api/documents/upload → Claude Files API
├── /api/documents/list → PostgreSQL query
├── /api/content/generate → Claude Messages API + Files
└── Enhanced Activity creation with source metadata

Database Schema Extensions
├── documents table (id, filename, claude_file_id, user_id, created_at, expires_at)
├── activity_sources table (activity_id, document_id, used_in_generation)
└── generation_sessions table (session_id, config, documents, result)
```

### API Endpoints

**POST /api/documents/upload**

- Upload file to Claude Files API
- Store metadata in PostgreSQL
- Return document reference for UI

**GET /api/documents**

- List user's uploaded documents
- Include usage statistics and expiration status

**POST /api/content/generate**

- Accept prompt configuration + document IDs
- Combine with existing prompt generation logic
- Call Claude API with files and prompt
- Return validated NLJ scenario

**POST /api/activities/create-from-generation**

- Create activity with source document lineage
- Store generation metadata
- Return activity ID for Flow Editor navigation

## Assumptions

- Claude Files API remains stable and available
- Users have reliable internet connections for document uploads
- Document content quality is sufficient for AI generation (users pre-validate sources)
- Current PostgreSQL infrastructure can handle additional document metadata tables
- Existing authentication/authorization system extends to document access control

## Risks & Mitigations

| **Risk**                           | **Impact** | **Mitigation**                                                    |
| ---------------------------------- | ---------- | ----------------------------------------------------------------- |
| Claude API rate limits/costs       | High       | Implement usage quotas, graceful degradation                      |
| Large document processing failures | Medium     | File size validation, chunking for oversized documents            |
| User adoption slower than expected | Medium     | Progressive rollout, user training, fallback to existing workflow |
| Document storage costs             | Low        | Automatic cleanup of expired files, usage monitoring              |

## Future Considerations (Phase 2+)

**Enhanced Document Intelligence**

- Document versioning and change tracking
- AI-generated metadata (keywords, summaries, difficulty levels)
- Content similarity detection and recommendations

**Collaborative Features**

- Document sharing between users
- Team collections and approval workflows
- Usage analytics and impact tracking

**Advanced Generation**

- Template-based generation with document mapping
- Batch generation across multiple document sets
- Custom AI model fine-tuning for domain-specific content

## Definition of Done

**Phase 1 Complete When:**

- [x] Users can upload documents without leaving NLJ platform
- [x] Generated scenarios open directly in Flow Editor
- [x] Document reuse works across multiple generation sessions
- [x] All acceptance criteria above are met
- [ ] User testing shows 75% workflow time reduction vs. manual process
- [x] Production deployment with monitoring and error tracking active

**Success Validation:**

- 50+ scenarios generated using Content Studio within first month
- User feedback scores 4.0+ for workflow improvement
- Zero critical bugs in production for 2+ weeks
- Performance metrics meet all specified targets

## Implementation Status

✅ **Phase 1 Complete - January 2025**

The Content Studio has been successfully implemented and integrated into the NLJ platform with the following completed features:

### Completed Features
- **Document Management**: Multi-format upload (PDF, DOCX, PPTX) with Claude Files API integration  
- **Source Library**: Complete document library with metadata, usage tracking, and reuse capabilities
- **AI Generation**: Real-time content generation with Claude Messages API and document context
- **Flow Editor Integration**: Direct handoff from generated content to visual editor
- **Database Schema**: Full tracking with source documents, generation sessions, and activity lineage
- **Backend Infrastructure**: FastAPI endpoints with background task processing and error handling
- **Frontend Integration**: Tabbed interface within Content Generation page with comprehensive UX

### Technical Implementation Details
- **API Integration**: Claude Files API (500MB limit, 24-hour expiration) and Messages API
- **Database**: PostgreSQL with enhanced schema for source documents and generation sessions
- **Real-time Updates**: Progress tracking with polling and status updates
- **Error Handling**: Comprehensive validation and user feedback for all failure scenarios
- **Performance**: Background task processing ensures responsive UI during generation

### Next Phase: UX Refinements
Current areas for improvement identified through initial usage:
- Source selection scalability improvements
- Simplified interface design (remove tabs, improve layout)
- Enhanced upload workflows
- Performance optimizations for large document libraries
