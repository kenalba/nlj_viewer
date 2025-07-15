# NLJ Viewer - Non-Linear Journey Interactive Training

A TypeScript React application for playing interactive Non-Linear Journey (NLJ) training scenarios using Material UI components.

## Features

- **Interactive Training Scenarios**: Play branching narrative training content
- **Mobile-Responsive Design**: Built with Material UI for optimal mobile/desktop experience
- **Real-time Feedback**: Immediate response validation and scoring
- **Progress Tracking**: Visual progress indicators and completion tracking
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
- **NodeRenderer**: Dynamic rendering of question, choice, and panel nodes
- **ScenarioLoader**: File upload and sample scenario selection
- **GameView**: Main gameplay interface with progress tracking

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

1. **Load Scenario**: Upload JSON file or select sample
2. **Navigate**: Progress through questions and choices
3. **Receive Feedback**: Immediate validation and scoring
4. **Track Progress**: Visual completion indicators

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

## Schema Support

Supports full NLJ schema including:
- Question/Choice nodes with media
- Variable tracking and conditions
- Interstitial panels
- Multiple outcome paths
- Feedback and scoring

## Future Enhancements

- LRS (Learning Record Store) integration
- Offline capability
- Analytics dashboard
- Scenario authoring tools