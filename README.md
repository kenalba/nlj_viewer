# NLJ Viewer - Non-Linear Journey Interactive Training

A modern, responsive TypeScript React application for playing interactive Non-Linear Journey (NLJ) training scenarios. Built with Material UI and designed for optimal mobile and desktop experiences.

## 🚀 Features

- **Interactive Training Scenarios**: Play branching narrative training content with real-time feedback
- **Mobile-Responsive Design**: Optimized for both mobile and desktop with adaptive layouts
- **Hyundai Branding**: Custom Material UI theme with professional black, silver, and blue accent colors
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
1. **Upload Custom Scenario**: Upload your own NLJ JSON file
2. **Sample Scenarios**: Try included demo scenarios:
   - FSA sales training modules
   - Hyundai Ioniq9 product knowledge
   - Interactive decision trees

### Training Flow
1. Select and load a scenario
2. Progress through questions and interactive content
3. Make choices with immediate feedback
4. Click "Continue" to proceed at your own pace
5. Track progress via the header progress bar
6. Complete the scenario and view results

### Media Interaction
- **Images**: Click any image to view full-size in a modal
- **Videos**: Play inline with standard controls
- **Responsive**: Images and videos automatically scale for your device

## 🏗️ Architecture

### Core Components
- **GameEngine** (`useGameEngine.ts`): State management for scenario progression using React Context + useReducer
- **NodeRenderer**: Dynamic rendering of question, choice, and interstitial panel nodes
- **ScenarioLoader**: File upload and sample scenario selection with validation
- **GameView**: Main gameplay interface with navigation and progress tracking
- **MediaViewer**: Responsive media display with click-to-enlarge functionality

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
  type: 'start' | 'question' | 'choice' | 'interstitial_panel' | 'end';
  text: string;
  media?: Media;
  // ... additional properties
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
│   └── scenarioUtils.ts # Scenario processing
├── theme/              # Material UI theme
│   └── hyundaiTheme.ts # Custom Hyundai theme
└── static/             # Static assets
    └── sample_nljs/    # Sample scenario files
```

## 🌐 Schema Support

Supports the full NLJ schema including:
- **Question/Choice nodes** with media and variable tracking
- **Interstitial panels** for narrative content
- **Variable definitions** with conditional logic
- **Link relationships** for scenario flow
- **Media objects** (images, videos, audio metadata)
- **Goal tracking** and completion states

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

- **LRS Integration**: xAPI event tracking for learning analytics
- **Offline Support**: Service worker for offline scenario access
- **Analytics Dashboard**: Training completion and performance metrics
- **Scenario Authoring**: Built-in tools for creating NLJ scenarios
- **Multi-language Support**: Internationalization for global deployment
- **Advanced Media**: 360° images, interactive hotspots, AR content

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