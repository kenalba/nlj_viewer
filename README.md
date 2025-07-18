# NLJ Viewer - Unified Activity Viewer

A modern, responsive TypeScript React application for playing interactive Non-Linear Journey (NLJ) training scenarios, surveys, and assessments. Built with Material UI and designed for optimal mobile and desktop experiences.

## 🚀 Features

- **Unified Activity System**: Support for training scenarios, surveys, and assessments in a single platform
- **Complete Question Type Support**: 
  - **Training Questions**: Multiple Choice, True/False, Ordering, Matching, Short Answer
  - **Survey Questions**: Likert Scales, Rating Questions, Matrix Questions, Sliders, Text Areas
  - **Assessment Questions**: All training types with scoring and feedback
- **Interactive Training Scenarios**: Play branching narrative training content with real-time feedback
- **Comprehensive Survey System**: Employee feedback surveys with automotive and cross-industry templates
- **Trivie Excel Integration**: Load and convert Trivie quiz Excel files automatically
- **Mobile-Responsive Design**: Optimized for both mobile and desktop with adaptive layouts
- **Audio Feedback**: Comprehensive sound system with oscillator-based audio for user actions
- **Visual Interactions**: Drag-and-drop, connection lines, sliders, and smooth animations
- **Multi-Theme Support**: Switch between Hyundai and Unfiltered themes
- **Media Support**: 
  - Responsive image and video display with click-to-enlarge functionality
  - Automatic aspect ratio preservation
  - Loading states and error handling
- **Real-time Feedback**: Immediate response validation with user-controlled progression
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Type-Safe**: Full TypeScript coverage for robust development
- **Comprehensive Testing**: Full test suite with VSCode integration (326 tests passing)
- **Debug Mode**: Comprehensive console logging for development (auto-enabled in dev mode)
- **Deployment-Ready**: All TypeScript build errors resolved with pre-deployment verification
- **Keyboard Navigation**: Full accessibility support with keyboard controls
- **xAPI Integration**: Comprehensive learning event tracking with post-activity analytics
- **LLM Content Generation**: Comprehensive prompt generation system for creating NLJ scenarios with LLMs
- **Flow Editor**: WYSIWYG visual editor for creating and editing NLJ scenarios
  - Visual flow diagram creation with React Flow
  - Drag-and-drop node palette with 18+ node types
  - Real-time preview system with game widget support
  - Persistent sidebar editors with auto-save
  - Zoom controls and auto-layout algorithms
  - Settings dialog and export functionality
- **Production-Ready**: Optimized build process with comprehensive error checking

## 🎯 Quick Start

```bash
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

### Loading Content
1. **Upload NLJ Scenario**: Upload your own NLJ JSON file
2. **Upload Trivie Excel**: Load Trivie quiz Excel files (automatically converted)
3. **Upload Survey**: Load survey JSON files
4. **Generate LLM Prompt**: Create customized prompts for LLM-powered content generation
5. **Flow Editor**: Create and edit NLJ scenarios visually with the WYSIWYG editor
6. **Sample Content**: Try included demo content:
   - **NLJ Scenarios**: FSA sales training modules, Hyundai Ioniq9 product knowledge, Interactive decision trees
   - **Trivie Quizzes**: Excel format quiz samples
   - **Survey Templates**: Automotive Sales Department, Employee Engagement, Manager Effectiveness, Work-Life Balance

### Activity Flow
1. Select and load content (NLJ JSON, Trivie Excel, or Survey JSON)
2. Progress through various question types:
   - **Training Questions**: Multiple Choice, True/False, Ordering, Matching, Short Answer
   - **Survey Questions**: Likert Scales, Rating Questions, Matrix Questions, Sliders, Text Areas
   - **Assessment Questions**: All training types with scoring and feedback
3. Receive immediate feedback with visual and audio cues
4. Click "Continue", "Submit", or answer questions to proceed
5. Track progress via the header progress bar
6. Complete the activity and view results

### Media Interaction
- **Images**: Click any image to view full-size in a modal
- **Videos**: Play inline with standard controls
- **Responsive**: Images and videos automatically scale for your device

## 🏗️ Architecture

### Core Components
- **GameEngine** (`useGameEngine.ts`): State management for scenario progression using React Context + useReducer
- **NodeRenderer**: Dynamic rendering of all question types and interstitial panel nodes
- **ScenarioLoader**: File upload, sample scenario selection, and LLM prompt generation with Trivie Excel support
- **GameView**: Main gameplay interface with navigation and progress tracking
- **MediaViewer**: Responsive media display with click-to-enlarge functionality
- **FlowEditor**: WYSIWYG visual editor for creating and editing NLJ scenarios
- **FlowViewer**: React Flow-based visual flow diagram component with comprehensive node editing
- **WYSIWYGNodeEditor**: Persistent sidebar editor with real-time preview and auto-save
- **Question Components**: Specialized components for each question type
  - `TrueFalseNode`: Interactive True/False buttons with submit/continue workflow and keyboard support (1 for True, 2 for False)
  - `OrderingNode`: Drag-and-drop item reordering with validation
  - `MatchingNode`: Click-to-connect matching with visual connection lines and manual continue
  - `ShortAnswerNode`: Text input with flexible answer validation
  - `UnifiedQuestionNode`: Enhanced multiple choice with improved choice buttons
  - `LikertScaleNode`: 1-5, 1-7, 1-10+ scales with customizable labels
  - `RatingNode`: Star ratings, numeric scales, and categorical options
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
npm run build        # Production build (TypeScript errors resolved)
npm run preview      # Preview production build
npm run test         # Run test suite (326 tests passing)
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
npm run lint         # Run ESLint (39 non-critical issues remaining)
npm run type-check   # Run TypeScript compiler check
```

### Pre-deployment Verification
```bash
./scripts/pre-deploy.sh  # Comprehensive deployment readiness check
```

The pre-deployment script verifies:
- ✅ TypeScript compilation success
- ✅ All tests passing (326/326)
- ✅ Critical lint issues resolved
- ✅ Build process completion
- ⚠️ Reports non-critical style warnings

### Debug Mode
Development mode automatically enables comprehensive console logging for debugging purposes. Debug output includes state changes, user interactions, variable updates, and scenario events.

### Project Structure
Built with modern React architecture using TypeScript, Material-UI, and comprehensive testing. The codebase is organized into logical modules for components, contexts, hooks, types, and utilities.

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

### Current Status: ✅ Deployment-Ready

All TypeScript build errors have been resolved as of the latest commits:
- **Build**: ✅ Successful TypeScript compilation
- **Tests**: ✅ All 326 tests passing
- **Lint**: ✅ Critical errors resolved (39 non-critical style warnings remain)
- **Pre-deployment**: ✅ Verification script available

### GitHub Pages Deployment

1. **Verify deployment readiness**:
   ```bash
   ./scripts/pre-deploy.sh
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Deploy to GitHub Pages**:
   - Push to GitHub repository (automatic deployment via GitHub Actions)
   - Build outputs to `dist/` directory
   - Production build is optimized and ready

### Recent Deployment Fixes Applied
- ✅ Fixed Vitest globals type recognition
- ✅ Resolved React hooks exhaustive dependencies
- ✅ Fixed component prop type mismatches
- ✅ Eliminated unused variables and imports
- ✅ Added comprehensive pre-deployment verification

### Environment Variables
- `VITE_APP_TITLE`: Application title (default: "NLJ Viewer")
- `VITE_DEBUG`: Force debug mode (optional)

## 🔮 Future Enhancements

### ✅ Recently Completed
- **LLM Content Generation System**: Comprehensive prompt generation for LLM-powered scenario creation
  - ✅ Interactive prompt customization with audience personas and learning objectives
  - ✅ Complete schema documentation generator with all 18+ node types
  - ✅ Bloom's taxonomy integration and difficulty scaling
  - ✅ Multiple export formats (Markdown, JSON, examples)
  - ✅ Real-time preview and validation system
- **xAPI/TinCan Integration**: Comprehensive learning event emission for LRS integration
  - ✅ Phase 1: Basic xAPI statement generation and results display
  - Phase 2: Advanced analytics, CSV/JSON export, PDF reporting
  - Phase 3: LRS integration endpoints and SCORM packaging
- **Critical Bug Fixes**: UnifiedQuestionNode feedback display issue resolved
- **Enhanced Testing**: Improved test utilities with theme-aware testing capabilities

### 📋 Planned Features
- **Flow Editor Enhancements**: 
  - Tiptap integration for markdown inline editing
  - Advanced node editors for rating, matrix, slider, and text area types
  - Add Choice functionality and choice node content updating
  - Drag & drop media upload functionality
  - Image export functionality (PNG/SVG) for flow diagrams
  - Consolidate duplicative 'Text' and 'Content' fields
- **Enhanced Post-Activity Experience**: Comprehensive analytics dashboard with detailed performance metrics
- **Offline Support**: Service worker implementation for offline scenario access
- **Node Grammar Extensions**: Fill-in-the-blank, classification, hotspot, and memory game question types
- **Multi-language Support**: Internationalization framework for global deployment
- **Advanced Media Features**: 360° images, interactive hotspots, AR content integration
- **LLM Integration Enhancements**: Direct API integration with OpenAI, Claude, and other LLM providers
- **Enterprise Features**: Multi-tenant support, advanced security, compliance reporting

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