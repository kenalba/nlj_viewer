/**
 * Hook for creating variable context for interpolation
 */

import { useMemo } from 'react';
import { useGameContext } from '../contexts/GameContext';
import type { VariableContext } from '../utils/variableInterpolation';

interface UseVariableContextOptions {
  includeSystemVariables?: boolean;
  additionalVariables?: Record<string, any>;
}

export function useVariableContext(options: UseVariableContextOptions = {}): VariableContext {
  const { includeSystemVariables = true, additionalVariables = {} } = options;
  const { state } = useGameContext();

  return useMemo(() => {
    const context: VariableContext = {
      ...state.variables,
      ...additionalVariables,
    };

    if (includeSystemVariables) {
      context.currentNodeId = state.currentNodeId;
      context.visitedNodeCount = state.visitedNodes.size;
      context.score = state.score || 0;
      context.completed = state.completed;
      context.sessionId = state.sessionId;
      
      // Add timing information if available
      if (state.startTime) {
        const now = new Date();
        context.sessionDuration = Math.floor((now.getTime() - state.startTime.getTime()) / 1000); // in seconds
      }
    }

    return context;
  }, [state, includeSystemVariables, additionalVariables]);
}

export default useVariableContext;