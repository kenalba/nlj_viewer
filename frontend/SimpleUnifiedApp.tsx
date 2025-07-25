/**
 * Simple Unified App - No complex routing, just state-based rendering
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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

const SimpleContent: React.FC = () => {
  const { state, reset } = useGameContext();
  const { user } = useAuth();
  const location = useLocation();
  const [currentScenario, setCurrentScenario] = useState<NLJScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<NLJScenario | null>(null);
  
  console.log('SimpleContent:', { path: location.pathname, user: user?.username });
  
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
    console.log('Rendering Activities');
    return <ContentLibrary contentType="all" />;
  }
  
  if (path.includes('/dashboard') && canEdit) {
    console.log('Rendering Dashboard');
    return <ContentDashboard onEditScenario={setEditingScenario} />;
  }
  
  if (path.includes('/flow') && canEdit) {
    console.log('Rendering Flow Editor');
    if (!editingScenario) {
      return <div>No scenario selected</div>;
    }
    return (
      <FlowEditor
        scenario={editingScenario}
        onBack={() => setEditingScenario(null)}
        onPlay={(scenario) => console.log('Play:', scenario.name)}
        onSave={(scenario) => {
          console.log('Save:', scenario.name);
          setEditingScenario(scenario);
        }}
        onExport={(scenario) => console.log('Export:', scenario.name)}
      />
    );
  }
  
  if (path.includes('/results/')) {
    console.log('Rendering Results');
    return <XAPIResultsScreen />;
  }
  
  // Default: Home page
  console.log('Rendering Home/ScenarioLoader');
  return state.scenarioId && state.currentNodeId && currentScenario ? (
    <GameView scenario={currentScenario} onHome={handleHome} />
  ) : (
    <ScenarioLoader onFlowEdit={() => console.log('Flow edit requested')} />
  );
};

export const SimpleUnifiedApp: React.FC = () => {
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
        <SimpleContent />
      </AppLayout>
    </GameProvider>
  );
};