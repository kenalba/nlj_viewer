# NLJ Viewer - Unified Activity Viewer

A TypeScript React application for playing interactive Non-Linear Journey (NLJ) training scenarios, surveys, and assessments using Material UI components.

## Features

- **Unified Activity System**: Support for training scenarios, surveys, assessments, Connections word puzzles, and Wordle games in a single platform
- **Complete Question Type Support**: True/False, Multiple Choice, Ordering, Matching, Short Answer, Likert Scales, Rating Questions, Matrix Questions, Sliders, Text Areas, Connections Games, and Wordle Games
- **LLM Content Generation**: Comprehensive prompt generation system for creating NLJ scenarios with Large Language Models
- **Mobile-Responsive Design**: Built with Material UI for optimal mobile/desktop experience
- **Real-time Feedback**: Immediate response validation and scoring with audio feedback
- **Visual Interactions**: Drag-and-drop ordering, visual connection lines for matching
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Trivie Excel Support**: Load and convert Trivie quiz Excel files to NLJ format
- **Survey System**: Comprehensive survey question types with automotive and cross-industry templates
- **Media Support**: Images, videos, and rich content integration
- **Type-Safe**: Full TypeScript coverage for robust development
- **Comprehensive Testing**: Full test suite with VSCode integration (249 tests passing)
- **Deployment-Ready**: All TypeScript build errors resolved and pre-deployment verification script included
- **Keyboard Navigation**: Full keyboard support for accessibility (arrow keys, Enter, number keys)
  - **UnifiedQuestionNode**: Number keys (1-9) for choice selection, Enter to submit/continue
  - **TrueFalseNode**: 1 for True, 2 for False, Enter to submit/continue
- **Audio Feedback**: Oscillator-based audio system with user-controlled sound toggle
- **Multi-Theme Support**: Hyundai and Unfiltered themes with dynamic switching
- **xAPI Integration**: Comprehensive event tracking with learning analytics and post-activity results

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to load scenarios.

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
npm run test         # Run test suite (249 tests passing)
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
npm run lint         # Run ESLint (39 non-critical issues remaining)
```

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
✅ **Testing**: 249 tests passing, comprehensive test coverage including TrueFalseNode, OrderingNode, MatchingNode, ConnectionsNode, and WordleNode
✅ **Deployment**: TypeScript build errors resolved, deployment-ready
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

## Future Enhancements

- **Flow Editor Enhancements**: 
  - Tiptap integration for markdown inline editing
  - Advanced node editors for rating, matrix, slider, and text area types
  - Add Choice functionality and choice node content updating
  - Drag & drop media upload functionality
  - Image export functionality (PNG/SVG) for flow diagrams
  - Consolidate duplicative 'Text' and 'Content' fields
- **Node Grammar Extensions**: Fill-in-the-blank, classification, hotspot, and memory game question types
- **Advanced xAPI Features**: Statement batching, offline storage, custom authentication
- **Offline capability**: Service worker and local storage sync
- **Enhanced Post-Scenario Experience**: Comprehensive analytics dashboard
- **LLM Integration Enhancements**: Direct API integration with OpenAI, Claude, and other LLM providers
- **SCORM Integration**: Package activities as SCORM content
- **Multi-tenant Support**: Enterprise-ready features
