import React from 'react';
import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import type { NLJNode, NLJScenario, ChoiceNode } from '../types/nlj';
import { QuestionCard } from './QuestionCard';
import { ChoiceSelector } from './ChoiceSelector';
import { InterstitialPanel } from './InterstitialPanel';
import { useGameContext } from '../contexts/GameContext';
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
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h4" gutterBottom align="center">
              {scenario.name}
            </Typography>
            <Typography variant="body1" paragraph align="center">
              Welcome to this interactive training scenario.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleContinue}
                size="large"
              >
                Start Training
              </Button>
            </Box>
          </CardContent>
        </Card>
      );

    case 'end':
      return (
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h4" gutterBottom align="center" color="primary">
              Training Complete!
            </Typography>
            <Typography variant="body1" paragraph align="center">
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
              >
                Restart Training
              </Button>
            </Box>
          </CardContent>
        </Card>
      );

    case 'question':
      const choices = getChoicesForQuestion(scenario, node.id);
      return (
        <Box>
          <QuestionCard question={node} />
          {choices.length > 0 && (
            <ChoiceSelector 
              choices={choices} 
              onChoiceSelect={handleChoiceSelect}
            />
          )}
        </Box>
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
        <Card elevation={2}>
          <CardContent>
            <Typography variant="body1" color="error">
              Unknown node type: {node.type}
            </Typography>
          </CardContent>
        </Card>
      );
  }
};