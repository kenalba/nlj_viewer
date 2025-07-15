import React from 'react';
import { Box, Typography, Button, useTheme as useMuiTheme } from '@mui/material';
import type { NLJNode, NLJScenario, ChoiceNode } from '../types/nlj';
import { UnifiedQuestionNode } from './UnifiedQuestionNode';
import { InterstitialPanel } from './InterstitialPanel';
import { NodeCard } from './NodeCard';
import { useGameContext } from '../contexts/GameContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  findNextNode, 
  getChoicesForQuestion, 
  isScenarioComplete,
  applyVariableChanges 
} from '../utils/scenarioUtils';
import { debugLog } from '../utils/debug';

interface NodeRendererProps {
  node: NLJNode;
  scenario: NLJScenario;
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({ node, scenario }) => {
  const { state, navigateToNode, updateVariable, completeScenario } = useGameContext();
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();

  const handleChoiceSelect = (choice: ChoiceNode) => {
    debugLog('Choice', `User selected choice: ${choice.text}`, {
      choiceId: choice.id,
      choiceType: choice.choiceType,
      currentNode: node.id,
      variableChanges: choice.variableChanges,
    });

    // Apply variable changes
    if (choice.variableChanges) {
      const newVariables = applyVariableChanges(state.variables, choice);
      Object.entries(newVariables).forEach(([variableId, value]) => {
        if (value !== state.variables[variableId]) {
          updateVariable(variableId, value);
        }
      });
    }

    // Find next node
    const nextNodeId = findNextNode(scenario, choice.id);
    if (nextNodeId) {
      if (isScenarioComplete(scenario, nextNodeId)) {
        debugLog('Completion', 'Scenario will complete after this navigation', {
          currentNode: node.id,
          nextNode: nextNodeId,
        });
        completeScenario();
      }
      navigateToNode(nextNodeId);
    }
  };

  const handleContinue = () => {
    debugLog('Continue', `User clicked continue from node: ${node.id}`, {
      nodeType: node.type,
      currentNode: node.id,
    });

    const nextNodeId = findNextNode(scenario, node.id);
    if (nextNodeId) {
      if (isScenarioComplete(scenario, nextNodeId)) {
        completeScenario();
      }
      navigateToNode(nextNodeId);
    }
  };

  const handleRestart = () => {
    debugLog('Restart', 'User clicked restart', {
      currentNode: node.id,
      scenarioId: scenario.id,
    });

    const startNode = scenario.nodes.find(n => n.type === 'start');
    if (startNode) {
      navigateToNode(startNode.id);
    }
  };

  switch (node.type) {
    case 'start':
      return (
        <NodeCard variant="interstitial" animate={false}>
          <Typography variant="h4" gutterBottom align="center">
            {scenario.name}
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }} align="center">
            Welcome to this interactive training scenario.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleContinue}
              size="large"
              sx={{
                borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                boxShadow: themeMode === 'unfiltered' ? 
                  '0 4px 16px rgba(246, 250, 36, 0.3)' : 
                  'none',
                '&:hover': {
                  ...(themeMode === 'unfiltered' && {
                    boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                    transform: 'translateY(-2px)',
                  }),
                },
              }}
            >
              Start Training
            </Button>
          </Box>
        </NodeCard>
      );

    case 'end':
      return (
        <NodeCard variant="interstitial" animate={false}>
          <Typography variant="h4" gutterBottom align="center" color="primary">
            Training Complete!
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }} align="center">
            You have successfully completed the training scenario.
          </Typography>
          {state.score !== undefined && (
            <Typography variant="h6" align="center" sx={{ mt: 2 }}>
              Final Score: {state.score}
            </Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleRestart}
              size="large"
              sx={{
                borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                ...(themeMode === 'unfiltered' && {
                  borderColor: '#F6FA24',
                  color: '#F6FA24',
                  '&:hover': {
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(246, 250, 36, 0.1)',
                    color: '#FFD700',
                  },
                }),
              }}
            >
              Restart Training
            </Button>
          </Box>
        </NodeCard>
      );

    case 'question':
      const choices = getChoicesForQuestion(scenario, node.id);
      return (
        <UnifiedQuestionNode 
          question={node} 
          choices={choices}
          onChoiceSelect={handleChoiceSelect}
        />
      );

    case 'interstitial_panel':
      return (
        <InterstitialPanel 
          panel={node} 
          onContinue={handleContinue}
        />
      );

    default:
      return (
        <NodeCard variant="default" animate={false}>
          <Typography variant="body1" color="error">
            Unknown node type: {node.type}
          </Typography>
        </NodeCard>
      );
  }
};