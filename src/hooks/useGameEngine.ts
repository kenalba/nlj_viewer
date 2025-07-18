import { useReducer, useCallback } from 'react';
import type { GameState, GameAction, NLJScenario } from '../types/nlj';
import { debugState, debugLog } from '../utils/debug';
import { convertScenarioMarkdownToHtml } from '../utils/markdownUtils';

const initialState: GameState = {
  scenarioId: '',
  currentNodeId: '',
  variables: {},
  visitedNodes: new Set(),
  completed: false,
  activityType: 'training',
  responses: {},
  sessionId: crypto.randomUUID(),
  startTime: new Date(),
};

const gameReducer = (state: GameState, action: GameAction): GameState => {
  let newState: GameState;
  
  switch (action.type) {
    case 'LOAD_SCENARIO': {
      const rawScenario: NLJScenario = action.payload;
      
      // Convert any markdown content to HTML before storing the scenario
      const scenario: NLJScenario = convertScenarioMarkdownToHtml(rawScenario);
      
      // Save the converted scenario to localStorage so it can be accessed by App/GameView
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      
      const startNode = scenario.nodes.find(n => n.type === 'start');
      const initialVariables = scenario.variableDefinitions?.reduce(
        (acc, def) => ({ ...acc, [def.id]: 0 }),
        {}
      ) || {};
      
      newState = {
        ...initialState,
        scenarioId: scenario.id,
        currentNodeId: startNode?.id || '',
        variables: initialVariables,
      };
      
      debugLog('Scenario', `Loaded scenario: ${scenario.name}`, {
        scenarioId: scenario.id,
        startNodeId: startNode?.id,
        totalNodes: scenario.nodes.length,
        variables: initialVariables,
        markdownConverted: true,
        savedToLocalStorage: true,
      });
      break;
    }

    case 'NAVIGATE_TO_NODE': {
      const { nodeId } = action.payload;
      newState = {
        ...state,
        currentNodeId: nodeId,
        visitedNodes: new Set([...state.visitedNodes, nodeId]),
      };
      
      debugLog('Navigation', `Navigated to node: ${nodeId}`, {
        previousNode: state.currentNodeId,
        newNode: nodeId,
        totalVisited: newState.visitedNodes.size,
      });
      break;
    }

    case 'UPDATE_VARIABLE': {
      const { variableId, value } = action.payload;
      newState = {
        ...state,
        variables: {
          ...state.variables,
          [variableId]: value,
        },
      };
      
      debugLog('Variable', `Updated variable: ${variableId}`, {
        previousValue: state.variables[variableId],
        newValue: value,
        allVariables: newState.variables,
      });
      break;
    }

    case 'COMPLETE_SCENARIO': {
      newState = {
        ...state,
        completed: true,
        score: action.payload?.score,
      };
      
      debugLog('Completion', 'Scenario completed', {
        score: action.payload?.score,
        visitedNodes: Array.from(state.visitedNodes),
        finalVariables: state.variables,
      });
      break;
    }

    case 'RESET': {
      newState = initialState;
      debugLog('Reset', 'Game state reset', null);
      break;
    }

    default:
      newState = state;
      break;
  }
  
  // Log state changes
  debugState(action.type, state, newState);
  
  return newState;
};

export const useGameEngine = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const loadScenario = useCallback((scenario: NLJScenario) => {
    dispatch({ type: 'LOAD_SCENARIO', payload: scenario });
  }, []);

  const navigateToNode = useCallback((nodeId: string) => {
    dispatch({ type: 'NAVIGATE_TO_NODE', payload: { nodeId } });
  }, []);

  const updateVariable = useCallback((variableId: string, value: number) => {
    dispatch({ type: 'UPDATE_VARIABLE', payload: { variableId, value } });
  }, []);

  const completeScenario = useCallback((score?: number) => {
    dispatch({ type: 'COMPLETE_SCENARIO', payload: { score } });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    loadScenario,
    navigateToNode,
    updateVariable,
    completeScenario,
    reset,
  };
};