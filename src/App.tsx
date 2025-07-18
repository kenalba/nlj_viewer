import React, { useEffect, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { GameProvider, useGameContext } from './contexts/GameContext';
import { XAPIProvider } from './contexts/XAPIContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AudioProvider } from './contexts/AudioContext';
import { ScenarioLoader } from './components/ScenarioLoader';
import { GameView } from './components/GameView';
import { FlowEditor } from './components/FlowEditor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { debugLog, isDebugEnabled } from './utils/debug';
import type { NLJScenario } from './types/nlj';

type AppMode = 'loader' | 'game' | 'flow-editor';

const AppContent: React.FC = () => {
  const { state, reset, loadScenario } = useGameContext();
  const [appMode, setAppMode] = useState<AppMode>('loader');
  const [editorScenario, setEditorScenario] = useState<NLJScenario | null>(null);

  // Auto-switch to game mode when a scenario is loaded from ScenarioLoader
  useEffect(() => {
    if (state.scenarioId && state.currentNodeId && appMode === 'loader') {
      setAppMode('game');
    }
  }, [state.scenarioId, state.currentNodeId, appMode]);

  // Show game view if scenario is loaded and we have a current node
  if (state.scenarioId && state.currentNodeId && appMode === 'game') {
    // Get scenario data from localStorage
    const scenarioData = localStorage.getItem(`scenario_${state.scenarioId}`);
    
    if (scenarioData) {
      const scenario = JSON.parse(scenarioData);
      return <GameView scenario={scenario} onHome={() => {
        reset();
        setAppMode('loader');
      }} />;
    }
  }

  // Show flow editor if in flow editor mode
  if (appMode === 'flow-editor' && editorScenario) {
    return (
      <FlowEditor
        scenario={editorScenario}
        onBack={() => {
          setAppMode('loader');
          setEditorScenario(null);
        }}
        onPlay={(scenario) => {
          setAppMode('game');
          loadScenario(scenario);
        }}
        onSave={(scenario) => {
          // Save scenario to localStorage
          localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
          setEditorScenario(scenario);
        }}
        onExport={(scenario) => {
          // Export functionality already handled in FlowEditor
          console.log('Scenario exported:', scenario.name);
        }}
      />
    );
  }

  return (
    <ScenarioLoader 
      onFlowEdit={(scenario) => {
        setEditorScenario(scenario);
        setAppMode('flow-editor');
      }}
    />
  );
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
      <ErrorBoundary>
        <AudioProvider>
          <XAPIProvider enabled={true}>
            <GameProvider>
              <AppContent />
            </GameProvider>
          </XAPIProvider>
        </AudioProvider>
      </ErrorBoundary>
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
