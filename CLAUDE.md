# NLJ Viewer - Unified Learning Platform

A full-stack TypeScript application for creating, managing, and delivering interactive Non-Linear Journey (NLJ) training scenarios, surveys, assessments, and games with comprehensive analytics and role-based access control.

## Platform Features

### **Backend Infrastructure (Phase 1 Complete ✅)**
- **FastAPI Backend**: High-performance Python backend with async support
- **PostgreSQL Database**: Robust data persistence with SQLAlchemy ORM
- **JWT Authentication**: Secure user authentication and session management
- **Role-Based Access Control**: Multi-tier permissions (Player/Creator/Reviewer/Approver/Admin)
- **Event-Driven Architecture**: Apache Kafka (KRaft mode) for real-time integration and xAPI event streaming
- **Internal Scheduling System**: Native training session scheduling and booking management
- **Docker Deployment**: Containerized deployment with Docker Compose
- **OpenAPI Documentation**: Auto-generated API documentation
- **Content API**: Full CRUD operations with filtering, search, and pagination

### **Frontend Architecture (Phase 2 Complete ✅)**
- **Unified Dashboard**: Modern home page with quick actions, metrics, and review queue
- **Activities Browser**: Card/table view toggle with advanced filtering and search
- **Content-Aware URLs**: Deep linking support for activities (`/app/play/[id]`)
- **Responsive Design**: Mobile-first design with Material-UI components
- **Theme Support**: Dark/light themes with toggle functionality
- **Sidebar Navigation**: Role-based navigation with unified layout

### **Flow Editor Integration (Phase 3 Complete ✅)**
- **Visual Flow Editor**: React Flow-based WYSIWYG editor with drag-and-drop
- **Database Integration**: Save/load scenarios directly from PostgreSQL
- **Node Palette**: 18+ node types with comprehensive editors
- **Real-time Preview**: Live preview system with game widget support
- **Auto-layout**: Hierarchical and force-directed layout algorithms
- **Export Functionality**: JSON export with proper scenario structure

### **Learning Activities & Games**
- **Complete Question Type Support**: True/False, Multiple Choice, Ordering, Matching, Short Answer, Likert Scales, Rating Questions, Matrix Questions, Sliders, Text Areas
- **Interactive Games**: Connections word puzzles (NYT-style) and Wordle games with comprehensive dictionary validation
- **Visual Interactions**: Drag-and-drop ordering, visual connection lines for matching
- **Keyboard Navigation**: Full keyboard support for accessibility (arrow keys, Enter, number keys)
- **Audio Feedback**: Oscillator-based audio system with user-controlled sound toggle
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Media Support**: Images, videos, and rich content integration

### **Content Management & AI Generation**
- **Content Studio**: Integrated AI-powered content generation with Claude API
  - Document upload and management (PDF, DOCX, PPTX) with Claude Files API
  - Source document library with metadata extraction and reuse capabilities
  - Real-time content generation with progress tracking and error handling
  - Direct integration with Flow Editor for seamless content creation workflow
- **LLM Content Generation**: Comprehensive prompt generation system for external AI tools
- **Document Intelligence**: AI-generated metadata including summaries, keywords, learning objectives
- **Trivie Excel Support**: Import and convert Trivie quiz Excel files to NLJ format
- **Survey Templates**: Pre-built automotive and cross-industry employee feedback surveys
- **Version Control**: Content versioning with publication workflow
- **Approval System**: Multi-stage content approval process (planned)

### **Public Activity Sharing (Latest Complete ✅)**
- **Secure Token-Based Sharing**: Cryptographically secure share tokens with optional expiration dates
- **QR Code Generation**: Automatic QR code creation for mobile-friendly sharing and access
- **Public Player Interface**: Unauthenticated access to shared activities with clean, branded interface
- **Share Analytics**: Real-time tracking of public views, completions, and engagement metrics
- **Comprehensive Share Management**: Create, revoke, and monitor public shares through unified modal interface
- **Cross-Platform Access**: Works across desktop and mobile devices with responsive design
- **Backend Integration**: FastAPI endpoints with PostgreSQL storage for share tokens and analytics

### **Analytics & Tracking**
- **xAPI Integration**: Comprehensive event tracking with learning analytics
- **Usage Metrics**: Platform-wide analytics dashboard with completion rates, user engagement
- **Post-Activity Results**: Detailed performance analysis and event logs
- **Real-time Monitoring**: Live activity tracking and user progress
- **Public Share Analytics**: Track performance of publicly shared activities

## Quick Start

### Development (Frontend Only)
```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to load scenarios.

### Full System Development (with Internal Scheduling & Kafka)
```bash
# Start all services including internal scheduling and Kafka event bus
docker-compose up

# Visit these URLs:
# - NLJ Frontend: http://localhost:5173
# - NLJ API: http://localhost:8000/docs
# - Kafka UI: http://localhost:8080 (optional dev tool)
```

### Production Deployment
```bash
# Build and deploy to production
./deploy-callcoach.sh

# Or manual deployment:
npm run build:frontend
sudo cp -r frontend/dist/* /var/www/callcoach.training/
sudo systemctl restart callcoach-api
sudo nginx -s reload
```

**Production Site**: https://callcoach.training  
**API Documentation**: https://callcoach.training/api/docs

## Architecture

### Core Components

- **GameEngine** (`useGameEngine.ts`): State management for scenario progression
- **NodeRenderer**: Dynamic rendering of all question types and panel nodes
- **ScenarioLoader**: File upload, sample scenario selection, and LLM prompt generation with Trivie Excel support
- **GameView**: Main gameplay interface with progress tracking
- **Content Studio**: Integrated AI content generation system
  - `ContentGenerationPage`: Tabbed interface with Prompt Generator and Content Studio
  - `SourceLibrarySelection`: Document selection and management interface
  - `PromptConfiguration`: AI generation parameter configuration with presets
  - `GenerationProgress`: Real-time generation tracking and error handling
  - `GenerationResults`: Results display and Flow Editor integration
- **Public Sharing System**: Complete public activity sharing infrastructure
  - `ShareModal`: Consolidated sharing interface with QR code generation and analytics
  - `PublicActivityPlayer`: Unauthenticated activity player for shared content
  - `SharedTokenService`: Backend service for secure token management and analytics
  - Public routing system bypassing authentication for `/shared/[token]` URLs
- **Question Components**: Specialized components for each question type
  - `TrueFalseNode`: Interactive True/False buttons with submit/continue workflow and keyboard support
  - `OrderingNode`: Drag-and-drop item reordering with validation
  - `MatchingNode`: Click-to-connect matching with visual connection lines and manual continue
  - `ShortAnswerNode`: Text input with flexible answer validation
  - `UnifiedQuestionNode`: Multiple choice with enhanced choice buttons and comprehensive keyboard support
  - `LikertScaleNode`: 1-5, 1-7, 1-10+ scales with custom labels
  - `RatingNode`: Star ratings, numeric scales, and categorical ratings
  - `MatrixNode`: Grid-based questions with responsive design
  - `SliderNode`: Continuous scale input with custom ranges
  - `TextAreaNode`: Long-form text input with validation
  - `ConnectionsNode`: NYT-style word puzzle games with 4x4 grid, difficulty-based color coding, and category grouping
  - `WordleNode`: Wordle-style word guessing games with comprehensive dictionary validation and native keyboard input

### Type System

```typescript
interface NLJScenario {
  id: string;
  name: string;
  nodes: NLJNode[];
  links: Link[];
  variableDefinitions?: VariableDefinition[];
}
```

### State Management

React Context + useReducer pattern for:

- Current node tracking
- Variable state management
- Progress calculation
- Scenario completion

## Usage

1. **Load Scenario**: Upload NLJ JSON file, Trivie Excel file, or select sample
2. **Generate Content**: 
   - **Content Studio**: Upload documents → configure AI parameters → generate scenarios directly in-platform
   - **Prompt Generator**: Create customized prompts for external LLM tools (ChatGPT, Claude, etc.)
3. **Edit & Refine**: Use Flow Editor to customize generated or uploaded scenarios
4. **Navigate**: Progress through various question types with interactive elements
5. **Receive Feedback**: Immediate validation, scoring, and audio feedback
6. **Track Progress**: Visual completion indicators and scenario completion

## Development

### Build Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run test -- --run # Run test suite (326 tests passing) - ALWAYS use --run flag
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
npm run lint         # Run ESLint (39 non-critical issues remaining)
```

**IMPORTANT**: Always use `npm run test -- --run` instead of `npm run test` to avoid watch mode.

### Pre-deployment Verification

```bash
./scripts/pre-deploy.sh  # Verify build, tests, and critical lint issues
```

The pre-deployment script automatically checks:
- TypeScript compilation success
- All tests passing
- Critical lint issues (allows non-critical warnings)
- Deployment readiness status

### Testing Content

Sample content available:
- **NLJ Scenarios** (`/static/sample_nljs/`): FSA sales training modules, product knowledge scenarios, interactive decision trees
- **Trivie Quizzes** (`/static/sample_trivie_quiz/`): Excel format quiz exports
- **Survey Templates** (`/static/sample_surveys/`): Automotive and cross-industry employee feedback surveys
- **Connections Games** (`/static/sample_connections/`): NYT-style word puzzle games with category grouping
- **Wordle Games** (`/static/sample_wordle/`): Wordle-style word guessing games with comprehensive dictionary validation

## Schema Support

Supports comprehensive activity schema including:

- **Training Question Types**: Multiple Choice, True/False, Ordering, Matching, Short Answer
- **Survey Question Types**: 
  - Likert Scales (1-5, 1-7, 1-10+ scales with custom labels)
  - Rating Questions (stars, numeric, categorical)
  - Matrix Questions (grid-based with responsive design)
  - Sliders (continuous scale input)
  - Text Areas (long-form responses with validation)
- **Game Types**: 
  - Connections Games (4x4 word puzzle grids with difficulty-based color coding)
  - Wordle Games (word guessing with comprehensive Scrabble dictionary validation)
- **Interactive Elements**: Drag-and-drop, visual connections, text input, continuous scales, word selection
- **Media Integration**: Images, videos, and rich content
- **Variable tracking and conditions**: Dynamic scenario progression with comprehensive expression engine
  - Mathematical operations (+, -, *, /, %, ^)
  - String manipulation (concatenation, length, substring)
  - Conditional logic (if-then-else, comparison operators)
  - Variable interpolation with `{{variable}}` syntax
  - Real-time expression validation and error reporting
- **Interstitial panels**: Informational content between questions
- **Multiple outcome paths**: Branching narrative support
- **Feedback and scoring**: Immediate validation with audio feedback
- **Trivie Excel Import**: Automatic conversion from Trivie quiz format
- **Survey Templates**: Pre-built automotive and cross-industry surveys
  - Automotive Sales Department Survey
  - Employee Engagement Survey
  - Manager Effectiveness Survey (360-degree feedback)
  - Work-Life Balance & Well-being Survey

## Current Development Status

✅ **Core System**: Fully functional with all question types implemented
✅ **Testing**: 326 tests passing, comprehensive test coverage including TrueFalseNode, OrderingNode, MatchingNode, ConnectionsNode, WordleNode, FlowViewer, and ScenarioLoader
✅ **Production Deployment**: Live at https://callcoach.training with nginx, PostgreSQL, and FastAPI backend
✅ **UI/UX**: Responsive design, enhanced keyboard navigation, audio feedback
✅ **xAPI Integration**: Complete event tracking system with learning analytics
✅ **Flow Editor**: WYSIWYG visual editor with React Flow integration
  - Visual flow diagram creation and editing
  - Node-based editing with comprehensive editors for all question types
  - Real-time preview system with game widget support
  - Drag-and-drop node palette with 18+ node types
  - Auto-layout with hierarchical and force-directed algorithms
  - Persistent sidebar editors with unsaved changes detection
  - Zoom controls with dynamic positioning
  - Settings dialog with layout configuration
  - Export functionality (JSON format)
✅ **Bug Fixes**: 
  - UnifiedQuestionNode feedback display issue resolved
  - React error #310 in completion screen fixed (hooks moved to top-level)
  - TrueFalseNode enhanced with submit/continue workflow and keyboard controls (1 for True, 2 for False)
  - MatchingNode auto-proceeding fixed with manual continue button
  - Flow Editor infinite loop issues resolved
  - Nested textbox structure in editors fixed
  - Zoom controls positioning and visibility restored
  - TypeScript errors in Flow Editor components resolved
✅ **Connections Games**: NYT-style word puzzle games with 4x4 grid, difficulty-based color coding, and comprehensive test coverage
✅ **Wordle Games**: Word guessing games with comprehensive Scrabble dictionary validation (9,378+ words), native keyboard input, and Return to Menu functionality
✅ **Enhanced Features**: Download Sample JSON buttons for LLM context generation
✅ **Game State Management**: Wordle-specific score calculation and game state handling integrated into GameContext
✅ **Wordle xAPI Tracking**: Comprehensive event tracking for wordle games including game starts, guess attempts, hint usage, and completion events
✅ **LLM Content Generation**: Comprehensive prompt generation system for creating NLJ scenarios with Large Language Models
  - Interactive prompt customization with audience personas, learning objectives, and content styles
  - Complete schema documentation generator with all 18+ node types and Bloom's taxonomy integration
  - Multiple export formats (Markdown prompts, JSON schemas, reference guides)
  - Real-time preview and validation system with professional Material-UI interface
✅ **Node Type Utilities**: Centralized node type classification and icon management system
  - Extracted repeated node type logic from 4+ components into shared utilities
  - Consolidated 100+ lines of duplicate code into reusable functions
  - Comprehensive test coverage with 31 unit tests for all node type utilities
  - Improved maintainability and consistency across Flow Editor components
✅ **Phase 3 Complete**: Unified Frontend Architecture and Database Integration
  - FastAPI backend with JWT authentication, PostgreSQL database, Docker deployment
  - Content API with full CRUD operations, role-based access control, filtering/search
  - Database migration from static files to PostgreSQL with 139 sample activities
  - Unified sidebar navigation system with working React Router integration
  - Simplified admin user interface with compact design
  - Card/Table view toggle with MUI DataGrid integration for Activities browser
  - Consistent card sizing and color coding for content types
  - Role-based permissions system (Player/Creator/Reviewer/Approver/Admin)
  - Complete routing system refactor for reliability
  - Theme integration with toggle functionality
  - Code cleanup and architectural simplification

## xAPI Integration - Phase 1 Complete

**Phase 1** (✅ Complete): Basic xAPI statement generation and results display
- ✅ xAPI types and interfaces
- ✅ Statement generation utilities  
- ✅ Event tracking context provider
- ✅ Activity lifecycle event emission
- ✅ Question interaction event emission
- ✅ Connections game event tracking
- ✅ Wordle game event tracking
- ✅ Post-activity results screen with event log
- ✅ Theme-aware analytics display

**Phase 2** (Planned): Advanced analytics and integration
- Detailed performance analytics
- CSV/JSON export capabilities
- PDF report generation
- LRS integration endpoints

## Current Priority: Phase 4 Complete ✅

✅ **Phase 4 Complete**: Enhanced User Experience and Navigation
- **Modern Home Dashboard**: Redesigned with flexbox layout, quick actions, platform metrics, and review queue
- **Content-Aware URLs**: Deep linking support for activities with `/app/play/[id]` structure  
- **Immersive Activity Experience**: Sidebar automatically hidden during gameplay for distraction-free learning
- **Improved Back Navigation**: Fixed "Back to Home" functionality to return to Activities browser
- **Responsive Layout**: Clean 2-column dashboard design that adapts to all screen sizes
- **Role-Based Dashboard**: Different layouts and features for creators/admins vs players
- **Enhanced Flow Editor Integration**: Complete database integration with save/load from PostgreSQL

## Latest Completion: Content Studio Integration ✅

✅ **Phase 7 Complete**: AI-Powered Content Studio with Claude API Integration
- **Integrated Content Studio**: Full integration with Anthropic Claude API for in-app content generation
  - Claude Files API integration for document upload and management (500MB limit, 24-hour expiration)
  - Claude Messages API for content generation with document context awareness
  - Real-time generation progress tracking with polling and status updates
- **Source Document Management**: Complete document lifecycle management
  - Multi-format support (PDF, DOCX, PPTX) with automatic conversion to PDF
  - Document library with metadata display, usage tracking, and reuse capabilities
  - Source detail pages with comprehensive metadata extraction and PDF preview
- **Content Generation Workflow**: Streamlined creation process integrated into existing interface
  - Tabbed interface within Content Generation page (Prompt Generator + Content Studio)
  - Document selection with filtering and multi-select capabilities
  - Comprehensive prompt configuration with presets and validation
  - Direct handoff to Flow Editor with generated scenarios
- **Database Schema Enhancements**: Full tracking and lineage support
  - Source documents with Claude API integration and usage metrics
  - Generation sessions with prompt configuration and progress tracking
  - Activity-source linkage for content lineage and provenance
- **Backend Services**: Complete API infrastructure for content generation
  - FastAPI endpoints for document management and generation workflows
  - Background task processing with proper session management
  - Comprehensive error handling and validation with schema compliance

## Previous Completion: Variable Interpolation & Permissions System Refactoring ✅

✅ **Phase 6 Complete**: Advanced Variable Management and Permissions System
- **Variable Interpolation Engine**: Comprehensive expression evaluation system with support for mathematical operations, string manipulation, and conditional logic
- **Expression Validation**: Real-time expression validation with detailed error reporting and syntax highlighting
- **Dynamic Content Rendering**: Variable interpolation in content with `{{variable}}` syntax support across all content types
- **Branch Editor**: Advanced editor for conditional branching logic with expression-based conditions
- **InterpolatedContent Component**: Unified component for rendering content with variable substitution
- **Centralized Permissions System**: Migration from hardcoded role checking to centralized permissions functions
  - Replaced manual role arrays with `canEditContent()`, `canReviewContent()`, `canManageUsers()` functions
  - Updated 10+ components to use User objects instead of role strings
  - Fixed workflow state permissions for review actions (IN_REVIEW and SUBMITTED_FOR_REVIEW states)
  - Resolved missing review buttons issue through proper permission checking
- **Enhanced Sample Content**: New expression-enabled scenarios demonstrating variable interpolation capabilities
- **UI/UX Improvements**: 
  - Redesigned review action panels with improved 2-row button layout
  - Updated Content Generation page layout to match other tabs
  - Enhanced Flow Editor with variable browser modal improvements

✅ **Phase 5 Complete**: Enhanced Content Creation Workflow
- **Create Activity Modal**: Template-based activity creation with 5 pre-built templates (Blank Canvas, Survey, Assessment, Training Scenario, Interactive Game)
- **Template System**: Complete activity templates with proper node structures, links, and variable definitions
- **Visual Template Selection**: Material-UI cards with themed icons and descriptions for each activity type
- **Two-Step Creation Flow**: Template selection followed by activity details (name and description)
- **Flow Editor Integration**: Seamless template prepopulation in Flow Editor with navigation state handling
- **Unified Modal Integration**: Consistent "New Activity" experience across ContentDashboard, HomePage, and ContentLibrary
- **Responsive Design**: Compact 2-row layout that fits without scrolling, with proper spacing and visual hierarchy

## Latest Completion: Event-Driven Training System ✅

✅ **Phase 8 Complete**: Event-Driven Training Session Management with Real-Time UI
- **Internal Scheduling Service**: Comprehensive native scheduling system replacing external dependencies
  - Full CRUD operations for training programs, sessions, and instances
  - Native registration, cancellation, and waitlist management with conflict detection
  - Automated capacity validation and overbooking prevention with intelligent conflict resolution
  - Complete database schema with training sessions, instances, bookings, and participant management
- **Event-Driven Architecture**: Complete Kafka integration for real-time operation tracking
  - Apache Kafka (KRaft mode) for xAPI event streaming and system integration
  - Event-driven API endpoints with async operation tracking and status polling
  - Real-time status updates for all training operations (create, register, cancel, schedule)
  - Comprehensive event consumers for booking confirmations, cancellations, and attendance tracking
- **Frontend Training System**: Complete user interface for training program management
  - **TrainingSessionsPage**: Comprehensive 3-tab interface (Available Sessions, My Registrations, Program Browser)
  - **ProgramDetailPage**: Full program management with sessions overview, analytics, and administrative controls
  - **CreateProgramPage**: Program creation with real-time status polling and event-driven confirmation
  - **CreateSessionPage**: Session scheduling interface with date/time pickers, location management, and capacity controls
  - **Real-Time Status Polling**: Custom hooks (useStatusPolling, useBookingStatusPolling) for live operation tracking
  - **StatusIndicator Component**: Visual progress tracking for all async operations with detailed progress display
- **Registration Workflow**: Complete learner registration system
  - **RegistrationModal**: Event-driven registration with real-time booking confirmations and waitlist management
  - Automated booking status tracking (confirmed, pending, waitlisted, cancelled)
  - Special requirements handling and cancellation management
  - Integration with availability checking and conflict resolution
- **Role-Based Permissions**: Complete permission system for training operations
  - Program managers can create, edit, and delete training programs
  - Session instructors can schedule and manage training sessions
  - Learners can browse, register, and manage their training bookings
  - Administrative oversight with comprehensive program analytics and reporting

## Next Priority: Training System Enhancements

🔄 **UPCOMING**: Advanced Training Features
- **Calendar Integration**: Visual calendar UI for session scheduling and booking management
- **Instructor Management**: Instructor assignment workflows and availability tracking
- **Recurring Sessions**: Automated recurring session templates and bulk scheduling
- **Enhanced Analytics**: Comprehensive training program performance dashboard and reporting
- **Mobile Optimization**: Enhanced mobile experience for training session browsing and registration

🔄 **Content Studio UX Improvements**
- Fix Question Types and Interactions field being empty on Content Generation flow
- Improve source selection scalability and performance
- Add Upload Source flow directly to source selection interface
- Simplify Content Generation page by removing tabs and combining approaches
- Move from grid to flexbox layout for better responsiveness and scalability

## Future Enhancements

- **Flow Editor Enhancements**: 
  - Tiptap integration for markdown inline editing
  - Advanced node editors for rating, matrix, slider, and text area types
  - Add Choice functionality and choice node content updating
  - Drag & drop media upload functionality
  - Image export functionality (PNG/SVG) for flow diagrams
  - Consolidate duplicative 'Text' and 'Content' fields
- **Approval Workflow System**: Multi-stage content approval process
- **Node Grammar Extensions**: Fill-in-the-blank, classification, hotspot, and memory game question types
- **Advanced xAPI Features**: Statement batching, offline storage, custom authentication
- **Offline capability**: Service worker and local storage sync
- **Enhanced Post-Scenario Experience**: Comprehensive analytics dashboard
- **LLM Integration Enhancements**: Direct API integration with OpenAI, Claude, and other LLM providers
- **SCORM Integration**: Package activities as SCORM content
- **Multi-tenant Support**: Enterprise-ready features
