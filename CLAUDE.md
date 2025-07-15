# NLJ Viewer - Non-Linear Journey Interactive Training

A TypeScript React application for playing interactive Non-Linear Journey (NLJ) training scenarios using Material UI components.

## Features

- **Interactive Training Scenarios**: Play branching narrative training content
- **Complete Question Type Support**: True/False, Multiple Choice, Ordering, Matching, and Short Answer
- **Mobile-Responsive Design**: Built with Material UI for optimal mobile/desktop experience
- **Real-time Feedback**: Immediate response validation and scoring with audio feedback
- **Visual Interactions**: Drag-and-drop ordering, visual connection lines for matching
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Trivie Excel Support**: Load and convert Trivie quiz Excel files to NLJ format
- **Media Support**: Images, videos, and rich content integration
- **Type-Safe**: Full TypeScript coverage for robust development

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
```

### Testing Scenarios

Sample scenarios available in `/static/sample_nljs/`:

- FSA sales training modules
- Product knowledge scenarios
- Interactive decision trees
- Trivie quiz sample files (Excel format)

## Schema Support

Supports full NLJ schema including:

- **Question Types**: Multiple Choice, True/False, Ordering, Matching, Short Answer
- **Interactive Elements**: Drag-and-drop, visual connections, text input
- **Media Integration**: Images, videos, and rich content
- **Variable tracking and conditions**: Dynamic scenario progression
- **Interstitial panels**: Informational content between questions
- **Multiple outcome paths**: Branching narrative support
- **Feedback and scoring**: Immediate validation with audio feedback
- **Trivie Excel Import**: Automatic conversion from Trivie quiz format

## Future Enhancements

- **xAPI/TinCan Integration**: Emit learning events for LRS (Learning Record Store) integration
- **Offline capability**: Local storage and sync functionality
- **Post-Scenario Experience**: user-facing wrapup of the scenario, including quiz score if appropriate.
