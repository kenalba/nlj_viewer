import React, { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useXAPI } from './XAPIContext';
import type { GameState, NLJScenario, NodeResponseValue } from '../types/nlj';
import { isConnectionsResponse, calculateConnectionsScore } from '../types/nlj';

interface GameContextValue {
  state: GameState;
  loadScenario: (scenario: NLJScenario) => void;
  navigateToNode: (nodeId: string) => void;
  updateVariable: (variableId: string, value: number) => void;
  completeScenario: (score?: number) => void;
  reset: () => void;
  // Helper function for connections-specific score calculation
  calculateConnectionsGameScore: (
    response: NodeResponseValue,
    scoring?: { correctGroupPoints?: number; completionBonus?: number; mistakePenalty?: number }
  ) => number;
}

export const GameContext = createContext<GameContextValue | undefined>(undefined);

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const gameEngine = useGameEngine();
  const { trackActivityCompleted } = useXAPI();

  // Helper function for connections-specific score calculation
  const calculateConnectionsGameScore = useCallback((
    response: NodeResponseValue,
    scoring?: { correctGroupPoints?: number; completionBonus?: number; mistakePenalty?: number }
  ): number => {
    if (!isConnectionsResponse(response)) return 0;
    return calculateConnectionsScore(response, scoring);
  }, []);

  // Enhanced complete scenario with xAPI tracking
  const completeScenario = useCallback((score?: number) => {
    // Get current scenario from state to track completion
    const currentScenario = {
      id: gameEngine.state.scenarioId,
      name: 'Current Scenario', // We'll need to store this in game state
      nodes: [],
      links: [],
      orientation: 'horizontal' as const,
      activityType: 'training' as const
    };
    
    // Call original complete scenario
    gameEngine.completeScenario(score);
    
    // Track completion in xAPI
    if (currentScenario.id) {
      trackActivityCompleted(currentScenario, score);
    }
  }, [gameEngine, trackActivityCompleted]);

  const contextValue: GameContextValue = {
    ...gameEngine,
    completeScenario,
    calculateConnectionsGameScore
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};