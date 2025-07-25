/**
 * Main Application Component
 * Unified app with role-based access and simplified routing
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { GameProvider, useGameContext } from './contexts/GameContext';
import { AppLayout } from './shared/AppLayout';
import { GameView } from './player/GameView';
import { ScenarioLoader } from './player/ScenarioLoader';
import { XAPIResultsScreen } from './player/XAPIResultsScreen';
import { ContentLibrary } from './player/ContentLibrary';
import { ContentDashboard } from './editor/ContentDashboard';
import { FlowEditor } from './editor/FlowEditor';
import { useAuth } from './contexts/AuthContext';
import type { NLJScenario } from './types/nlj';

const AppContent: React.FC = () => {
  const { state, reset } = useGameContext();
  const { user } = useAuth();
  const location = useLocation();
  const [currentScenario, setCurrentScenario] = useState<NLJScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<NLJScenario | null>(null);
  
  
  // Load scenario from localStorage when game state changes
  useEffect(() => {
    if (state.scenarioId) {
      const scenarioData = localStorage.getItem(`scenario_${state.scenarioId}`);
      if (scenarioData) {
        setCurrentScenario(JSON.parse(scenarioData));
      }
    } else {
      setCurrentScenario(null);
    }
  }, [state.scenarioId]);

  const handleHome = () => {
    reset();
    setCurrentScenario(null);
  };

  const canEdit = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role);

  // Super simple path matching
  const path = location.pathname;
  
  if (path.includes('/activities')) {
    return <ContentLibrary contentType="all" />;
  }
  
  if (path.includes('/dashboard') && canEdit) {
    return <ContentDashboard onEditScenario={setEditingScenario} />;
  }
  
  if (path.includes('/flow') && canEdit) {
    if (!editingScenario) {
      return <div>No scenario selected</div>;
    }
    return (
      <FlowEditor
        scenario={editingScenario}
        onBack={() => setEditingScenario(null)}
        onPlay={(scenario) => {
          // TODO: Implement scenario play functionality
        }}
        onSave={(scenario) => {
          setEditingScenario(scenario);
        }}
        onExport={(scenario) => {
          // TODO: Implement scenario export functionality
        }}
      />
    );
  }
  
  if (path.includes('/results/')) {
    return <XAPIResultsScreen />;
  }
  
  // Default: Home page
  return state.scenarioId && state.currentNodeId && currentScenario ? (
    <GameView scenario={currentScenario} onHome={handleHome} />
  ) : (
    <Box sx={{ p: 3, width: '100%', maxWidth: '100%' }}>
      <ScenarioLoader onFlowEdit={() => {}} />
    </Box>
  );
};

export const App: React.FC = () => {
  const { user } = useAuth();
  
  const contentLibrary = {
    scenarios: 9,
    surveys: 4,
    games: 6,
    templates: 20
  };

  const appMode = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) ? 'editor' : 'player';

  return (
    <GameProvider>
      <AppLayout mode={appMode} contentLibrary={contentLibrary}>
        <AppContent />
      </AppLayout>
    </GameProvider>
  );
};