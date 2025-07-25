/**
 * Player Application
 * Main application for playing NLJ scenarios with unified sidebar navigation
 */

import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { GameProvider, useGameContext } from '../contexts/GameContext';
import { AppLayout } from '../shared/AppLayout';
import { GameView } from './GameView';
import { ScenarioLoader } from './ScenarioLoader';
import { XAPIResultsScreen } from './XAPIResultsScreen';
import { ContentLibrary } from './ContentLibrary';
import type { NLJScenario } from '../types/nlj';

const PlayerContent: React.FC = () => {
  const { state, reset, loadScenario } = useGameContext();
  const [currentScenario, setCurrentScenario] = useState<NLJScenario | null>(null);
  
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

  return (
    <Routes>
      <Route
        path="/"
        element={
          state.scenarioId && state.currentNodeId && currentScenario ? (
            <GameView 
              scenario={currentScenario} 
              onHome={handleHome}
            />
          ) : (
            <ScenarioLoader 
              onFlowEdit={() => {
                // In player mode, we don't allow flow editing
                // This could redirect to editor if user has permissions
              }}
            />
          )
        }
      />
      <Route path="/activities" element={<ContentLibrary contentType="all" />} />
      <Route path="/results/:sessionId" element={<XAPIResultsScreen />} />
    </Routes>
  );
};

export const PlayerApp: React.FC = () => {
  // Mock content library counts - will be replaced with API data
  const contentLibrary = {
    scenarios: 9,
    surveys: 4,
    games: 6,
    templates: 20
  };

  return (
    <GameProvider>
      <AppLayout 
        mode="player"
        contentLibrary={contentLibrary}
      >
        <PlayerContent />
      </AppLayout>
    </GameProvider>
  );
};