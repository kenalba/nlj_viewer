# NLJ Viewer - Unified Learning Platform

A full-stack TypeScript application for creating, managing, and delivering interactive Non-Linear Journey (NLJ) training scenarios, surveys, assessments, and games with comprehensive analytics and role-based access control.

## Platform Features

### **Backend Infrastructure (Phase 1 Complete ✅)**
- **FastAPI Backend**: High-performance Python backend with async support
- **PostgreSQL Database**: Robust data persistence with SQLAlchemy ORM
- **JWT Authentication**: Secure user authentication and session management
- **Role-Based Access Control**: Multi-tier permissions (Player/Creator/Reviewer/Approver/Admin)
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

### **Content Management**
- **Trivie Excel Support**: Import and convert Trivie quiz Excel files to NLJ format
- **Survey Templates**: Pre-built automotive and cross-industry employee feedback surveys
- **LLM Content Generation**: Comprehensive prompt generation system for AI-powered content creation
- **Version Control**: Content versioning with publication workflow
- **Approval System**: Multi-stage content approval process (planned)

### **Analytics & Tracking**
- **xAPI Integration**: Comprehensive event tracking with learning analytics
- **Usage Metrics**: Platform-wide analytics dashboard with completion rates, user engagement
- **Post-Activity Results**: Detailed performance analysis and event logs
- **Real-time Monitoring**: Live activity tracking and user progress

## Quick Start

### Development
```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to load scenarios.

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
2. **Generate LLM Prompts**: Create customized prompts for LLM-powered content generation
3. **Navigate**: Progress through various question types with interactive elements
4. **Receive Feedback**: Immediate validation, scoring, and audio feedback
5. **Track Progress**: Visual completion indicators and scenario completion

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
- **Variable tracking and conditions**: Dynamic scenario progression
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

## Latest Completion: Create Activity Modal Enhancement ✅

✅ **Phase 5 Complete**: Enhanced Content Creation Workflow
- **Create Activity Modal**: Template-based activity creation with 5 pre-built templates (Blank Canvas, Survey, Assessment, Training Scenario, Interactive Game)
- **Template System**: Complete activity templates with proper node structures, links, and variable definitions
- **Visual Template Selection**: Material-UI cards with themed icons and descriptions for each activity type
- **Two-Step Creation Flow**: Template selection followed by activity details (name and description)
- **Flow Editor Integration**: Seamless template prepopulation in Flow Editor with navigation state handling
- **Unified Modal Integration**: Consistent "New Activity" experience across ContentDashboard, HomePage, and ContentLibrary
- **Responsive Design**: Compact 2-row layout that fits without scrolling, with proper spacing and visual hierarchy

## Next Priority: Content Creation Enhancements

🔄 **UPCOMING**: Advanced Content Creation Tools
- Extract LLM Prompt Construction as standalone sidebar feature
- Add content creation templates to New Activity workflow  
- Implement Import Activity functionality with file upload and JSON paste
- Enhanced content management and approval workflows

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
