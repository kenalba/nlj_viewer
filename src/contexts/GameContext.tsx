import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import type { GameState, NLJScenario } from '../types/nlj';

interface GameContextValue {
  state: GameState;
  loadScenario: (scenario: NLJScenario) => void;
  navigateToNode: (nodeId: string) => void;
  updateVariable: (variableId: string, value: number) => void;
  completeScenario: (score?: number) => void;
  reset: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

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

  return (
    <GameContext.Provider value={gameEngine}>
      {children}
    </GameContext.Provider>
  );
};