import React, { useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { GameProvider, useGameContext } from './contexts/GameContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AudioProvider } from './contexts/AudioContext';
import { ScenarioLoader } from './components/ScenarioLoader';
import { GameView } from './components/GameView';
import { debugLog, isDebugEnabled } from './utils/debug';

const AppContent: React.FC = () => {
  const { state, reset } = useGameContext();

  // Show game view if scenario is loaded and we have a current node
  if (state.scenarioId && state.currentNodeId) {
    // Get scenario data from localStorage
    const scenarioData = localStorage.getItem(`scenario_${state.scenarioId}`);
    
    if (scenarioData) {
      const scenario = JSON.parse(scenarioData);
      return <GameView scenario={scenario} onHome={reset} />;
    }
  }

  return <ScenarioLoader />;
};

const AppWithTheme: React.FC = () => {
  const { currentTheme, themeMode } = useTheme();

  useEffect(() => {
    if (isDebugEnabled()) {
      console.log('🐛 NLJ Debug mode is ACTIVE');
      console.log('💡 To disable: localStorage.setItem("nlj_debug", "false") or nlj_debug.disable()');
    }
    
    debugLog('App', 'NLJ Viewer initialized', {
      version: '1.0.0',
      theme: themeMode,
      debugMode: isDebugEnabled(),
      environment: import.meta.env.DEV ? 'development' : 'production',
      timestamp: new Date().toISOString(),
    });
  }, [themeMode]);

  return (
    <MuiThemeProvider theme={currentTheme}>
      <CssBaseline />
      <AudioProvider>
        <GameProvider>
          <AppContent />
        </GameProvider>
      </AudioProvider>
    </MuiThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppWithTheme />
    </ThemeProvider>
  );
};

export default App;
