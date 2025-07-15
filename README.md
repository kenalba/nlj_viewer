# NLJ Viewer - Non-Linear Journey Interactive Training

A modern, responsive TypeScript React application for playing interactive Non-Linear Journey (NLJ) training scenarios. Built with Material UI and designed for optimal mobile and desktop experiences.

## 🚀 Features

- **Complete Question Type Support**: 
  - **Multiple Choice**: Enhanced choice buttons with visual feedback
  - **True/False**: Interactive buttons with immediate validation
  - **Ordering**: Drag-and-drop item reordering with visual feedback
  - **Matching**: Click-to-connect with visual connection lines
  - **Short Answer**: Flexible text input with multiple correct answers
- **Interactive Training Scenarios**: Play branching narrative training content with real-time feedback
- **Trivie Excel Integration**: Load and convert Trivie quiz Excel files automatically
- **Mobile-Responsive Design**: Optimized for both mobile and desktop with adaptive layouts
- **Audio Feedback**: Comprehensive sound system with oscillator-based audio for user actions
- **Visual Interactions**: Drag-and-drop, connection lines, and smooth animations
- **Multi-Theme Support**: Switch between Hyundai and Unfiltered themes
- **Media Support**: 
  - Responsive image and video display with click-to-enlarge functionality
  - Automatic aspect ratio preservation
  - Loading states and error handling
- **Real-time Feedback**: Immediate response validation with user-controlled progression
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Type-Safe**: Full TypeScript coverage for robust development
- **Debug Mode**: Comprehensive console logging for development (auto-enabled in dev mode)

## 🎯 Quick Start

```bash
# Navigate to the project directory
cd src

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Visit `http://localhost:5173` to load scenarios and begin training.

## 📋 Usage

### Loading Scenarios
1. **Upload NLJ Scenario**: Upload your own NLJ JSON file
2. **Upload Trivie Excel**: Load Trivie quiz Excel files (automatically converted)
3. **Sample Scenarios**: Try included demo scenarios:
   - FSA sales training modules
   - Hyundai Ioniq9 product knowledge
   - Interactive decision trees
   - Trivie quiz samples

### Training Flow
1. Select and load a scenario (NLJ JSON or Trivie Excel)
2. Progress through various question types:
   - **Multiple Choice**: Select from available options
   - **True/False**: Click True or False buttons
   - **Ordering**: Drag items to arrange in correct sequence
   - **Matching**: Click items from both columns to connect them
   - **Short Answer**: Type your response in the text field
3. Receive immediate feedback with visual and audio cues
4. Click "Continue" or answer questions to proceed
5. Track progress via the header progress bar
6. Complete the scenario and view results

### Media Interaction
- **Images**: Click any image to view full-size in a modal
- **Videos**: Play inline with standard controls
- **Responsive**: Images and videos automatically scale for your device

## 🏗️ Architecture

### Core Components
- **GameEngine** (`useGameEngine.ts`): State management for scenario progression using React Context + useReducer
- **NodeRenderer**: Dynamic rendering of all question types and interstitial panel nodes
- **ScenarioLoader**: File upload and sample scenario selection with Trivie Excel support
- **GameView**: Main gameplay interface with navigation and progress tracking
- **MediaViewer**: Responsive media display with click-to-enlarge functionality
- **Question Components**: Specialized components for each question type
  - `TrueFalseNode`: Interactive True/False buttons with feedback
  - `OrderingNode`: Drag-and-drop item reordering with validation
  - `MatchingNode`: Click-to-connect matching with visual connection lines
  - `ShortAnswerNode`: Text input with flexible answer validation
  - `UnifiedQuestionNode`: Enhanced multiple choice with improved choice buttons

### Type System
```typescript
interface NLJScenario {
  id: string;
  name: string;
  nodes: NLJNode[];
  links: Link[];
  variableDefinitions?: VariableDefinition[];
}

interface NLJNode {
  id: string;
  type: 'start' | 'question' | 'choice' | 'interstitial_panel' | 'end' | 
        'true_false' | 'ordering' | 'matching' | 'short_answer';
  text: string;
  media?: Media;
  // ... additional properties based on question type
}
```

### State Management
- **React Context + useReducer** pattern for predictable state updates
- **localStorage** persistence for scenario data
- **Real-time debugging** with development mode logging

## 🎨 Theming

The application uses a custom Material UI theme with:
- **Primary**: Black (#1A1A1A) for main interface elements
- **Secondary**: Silver (#C0C0C0) for accents and borders
- **Accent**: Blue (#0078D4) for interactive elements and progress
- **Typography**: Roboto font family with consistent hierarchy
- **Components**: Custom styling for buttons, cards, and form elements

## 🔧 Development

### Build Commands
```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check
```

### Debug Mode
Development mode automatically enables comprehensive console logging:

```javascript
// Debug mode is auto-enabled in development
// To disable: localStorage.setItem('nlj_debug', 'false')
// To enable in production: localStorage.setItem('nlj_debug', 'true')

// Available debug commands:
nlj_debug.enable()    // Enable debugging
nlj_debug.disable()   // Disable debugging
nlj_debug.isEnabled() // Check status
```

Debug output includes:
- State changes with before/after comparison
- User interactions (choices, navigation)
- Variable updates and calculations
- Scenario loading and completion events

### Project Structure
```
src/
├── components/          # React components
│   ├── GameView.tsx    # Main game interface
│   ├── NodeRenderer.tsx # Dynamic node rendering
│   ├── MediaViewer.tsx  # Responsive media display
│   └── ...
├── contexts/           # React contexts
│   └── GameContext.tsx # Game state management
├── hooks/              # Custom React hooks
│   └── useGameEngine.ts # Core game logic
├── types/              # TypeScript interfaces
│   └── nlj.ts          # NLJ schema definitions
├── utils/              # Utility functions
│   ├── debug.ts        # Debug logging system
│   ├── scenarioUtils.ts # Scenario processing
│   └── trivieInterpreter.ts # Trivie Excel parsing and conversion
├── theme/              # Material UI theme
│   └── hyundaiTheme.ts # Custom Hyundai theme
└── static/             # Static assets
    └── sample_nljs/    # Sample scenario files
```

## 🌐 Schema Support

Supports the full NLJ schema including:
- **Question Types**: Multiple Choice, True/False, Ordering, Matching, Short Answer
- **Interactive Elements**: Drag-and-drop, visual connections, text input validation
- **Interstitial panels** for narrative content between questions
- **Variable definitions** with conditional logic and scoring
- **Link relationships** for both navigation and parent-child connections
- **Media objects** (images, videos, audio metadata) with responsive display
- **Goal tracking** and completion states
- **Trivie Excel Import**: Automatic conversion from Trivie quiz format

## 📱 Responsive Design

- **Mobile-first** approach with progressive enhancement
- **Breakpoints**: 
  - Mobile: < 768px
  - Desktop: ≥ 768px
- **Adaptive layouts** for different screen sizes
- **Touch-friendly** interaction targets
- **Optimized media** display for each device type

## 🚀 Deployment

### GitHub Pages Deployment

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Configure for GitHub Pages**:
   - Ensure `vite.config.ts` has correct `base` path
   - Build outputs to `dist/` directory

3. **Deploy to GitHub Pages**:
   - Push to GitHub repository
   - Enable GitHub Pages in repository settings
   - Set source to GitHub Actions or deploy branch

### Environment Variables
- `VITE_APP_TITLE`: Application title (default: "NLJ Viewer")
- `VITE_DEBUG`: Force debug mode (optional)

## 🔮 Future Enhancements

- **xAPI/TinCan Integration**: Emit learning events for LRS (Learning Record Store) integration
- **Offline Support**: Service worker for offline scenario access
- **Analytics Dashboard**: Training completion and performance metrics
- **Scenario Authoring**: Built-in tools for creating NLJ scenarios
- **Multi-language Support**: Internationalization for global deployment
- **Advanced Media**: 360° images, interactive hotspots, AR content
- **Enhanced Question Types**: Fill-in-the-blank, hotspot questions, and more

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/) and [React](https://reactjs.org/)
- UI components from [Material-UI](https://mui.com/)
- TypeScript for type safety
- Designed for Ander's training initiatives