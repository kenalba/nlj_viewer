# NLJ Viewer - Unified Activity Viewer

A TypeScript React application for playing interactive Non-Linear Journey (NLJ) training scenarios, surveys, and assessments using Material UI components.

## Features

- **Unified Activity System**: Support for training scenarios, surveys, and assessments in a single platform
- **Complete Question Type Support**: True/False, Multiple Choice, Ordering, Matching, Short Answer, Likert Scales, Rating Questions, Matrix Questions, Sliders, and Text Areas
- **Mobile-Responsive Design**: Built with Material UI for optimal mobile/desktop experience
- **Real-time Feedback**: Immediate response validation and scoring with audio feedback
- **Visual Interactions**: Drag-and-drop ordering, visual connection lines for matching
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Trivie Excel Support**: Load and convert Trivie quiz Excel files to NLJ format
- **Survey System**: Comprehensive survey question types with automotive and cross-industry templates
- **Media Support**: Images, videos, and rich content integration
- **Type-Safe**: Full TypeScript coverage for robust development
- **Comprehensive Testing**: Full test suite with VSCode integration

## Quick Start

```bash
cd src
npm install
npm run dev
```

Visit `http://localhost:5173` to load scenarios.

## Architecture

### Core Components

- **GameEngine** (`useGameEngine.ts`): State management for scenario progression
- **NodeRenderer**: Dynamic rendering of all question types and panel nodes
- **ScenarioLoader**: File upload and sample scenario selection with Trivie Excel support
- **GameView**: Main gameplay interface with progress tracking
- **Question Components**: Specialized components for each question type
  - `TrueFalseNode`: Interactive True/False buttons with feedback
  - `OrderingNode`: Drag-and-drop item reordering with validation
  - `MatchingNode`: Click-to-connect matching with visual connection lines
  - `ShortAnswerNode`: Text input with flexible answer validation
  - `UnifiedQuestionNode`: Multiple choice with enhanced choice buttons
  - `LikertScaleNode`: 1-5, 1-7, 1-10+ scales with custom labels
  - `RatingNode`: Star ratings, numeric scales, and categorical ratings
  - `MatrixNode`: Grid-based questions with responsive design
  - `SliderNode`: Continuous scale input with custom ranges
  - `TextAreaNode`: Long-form text input with validation

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
2. **Navigate**: Progress through various question types with interactive elements
3. **Receive Feedback**: Immediate validation, scoring, and audio feedback
4. **Track Progress**: Visual completion indicators and scenario completion

## Development

### Build Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run test suite
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
```

### Testing Content

Sample content available:
- **NLJ Scenarios** (`/static/sample_nljs/`): FSA sales training modules, product knowledge scenarios, interactive decision trees
- **Trivie Quizzes** (`/static/sample_trivie_quiz/`): Excel format quiz exports
- **Survey Templates** (`/static/sample_surveys/`): Automotive and cross-industry employee feedback surveys

## Schema Support

Supports comprehensive activity schema including:

- **Training Question Types**: Multiple Choice, True/False, Ordering, Matching, Short Answer
- **Survey Question Types**: 
  - Likert Scales (1-5, 1-7, 1-10+ scales with custom labels)
  - Rating Questions (stars, numeric, categorical)
  - Matrix Questions (grid-based with responsive design)
  - Sliders (continuous scale input)
  - Text Areas (long-form responses with validation)
- **Interactive Elements**: Drag-and-drop, visual connections, text input, continuous scales
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

## Future Enhancements

- **xAPI/TinCan Integration**: Emit learning events for LRS (Learning Record Store) integration
- **Offline capability**: Local storage and sync functionality
- **Post-Scenario Experience**: user-facing wrapup of the scenario, including quiz score if appropriate.
