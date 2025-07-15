import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { GameProvider, useGameContext } from './contexts/GameContext';
import { ScenarioLoader } from './components/ScenarioLoader';
import { GameView } from './components/GameView';
import { hyundaiTheme } from './theme/hyundaiTheme';
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

const App: React.FC = () => {
  useEffect(() => {
    if (isDebugEnabled()) {
      console.log('🐛 NLJ Debug mode is ACTIVE');
      console.log('💡 To disable: localStorage.setItem("nlj_debug", "false") or nlj_debug.disable()');
    }
    
    debugLog('App', 'NLJ Viewer initialized', {
      version: '1.0.0',
      theme: 'Hyundai',
      debugMode: isDebugEnabled(),
      environment: import.meta.env.DEV ? 'development' : 'production',
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <ThemeProvider theme={hyundaiTheme}>
      <CssBaseline />
      <GameProvider>
        <AppContent />
      </GameProvider>
    </ThemeProvider>
  );
};

export default App;
