import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, useTheme as useMuiTheme, Stack } from '@mui/material';
import { Analytics, Refresh } from '@mui/icons-material';
import type { NLJNode, NLJScenario, ChoiceNode, NodeResponseValue, ConnectionsNode as ConnectionsNodeType, WordleNode as WordleNodeType } from '../types/nlj';
import { isConnectionsNode, isConnectionsResponse, calculateConnectionsScore, isWordleNode, isWordleResponse, calculateWordleScore } from '../types/nlj';
import { UnifiedQuestionNode } from './UnifiedQuestionNode';
import { InterstitialPanel } from './InterstitialPanel';
import { NodeCard } from './NodeCard';
import { TrueFalseNode } from './TrueFalseNode';
import { OrderingNode } from './OrderingNode';
import { MatchingNode } from './MatchingNode';
import { ShortAnswerNode } from './ShortAnswerNode';
import { LikertScaleNode } from './LikertScaleNode';
import { RatingNode } from './RatingNode';
import { SliderNode } from './SliderNode';
import { TextAreaNode } from './TextAreaNode';
import { MatrixNode } from './MatrixNode';
import { ConnectionsNode } from './ConnectionsNode';
import { WordleNode } from './WordleNode';
import { XAPIResultsScreen } from './XAPIResultsScreen';
import { CompletionModal } from './CompletionModal';
import { useGameContext } from '../contexts/GameContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio } from '../contexts/AudioContext';
import { useXAPI } from '../contexts/XAPIContext';
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
  const { playSound } = useAudio();
  const { isEnabled: xapiEnabled } = useXAPI();
  const [showResults, setShowResults] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Scroll to top when node changes
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, [node.id]);

  // Automatically complete scenario when end node is rendered
  useEffect(() => {
    if (node.type === 'end' && !state.completed) {
      debugLog('Completion', 'Scenario completed by reaching end node', {
        nodeId: node.id,
        nodeType: node.type,
      });
      completeScenario();
    }
  }, [node.id, node.type, state.completed, completeScenario]);

  // Show completion modal when scenario is completed
  useEffect(() => {
    if (state.completed && !showCompletionModal) {
      const timer = setTimeout(() => {
        setShowCompletionModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.completed, showCompletionModal]);

  const handleChoiceSelect = useCallback((choice: ChoiceNode) => {
    // Play sound based on choice type
    if (choice.choiceType === 'CORRECT') {
      playSound('correct');
    } else if (choice.choiceType === 'INCORRECT') {
      playSound('incorrect');
    } else {
      playSound('click');
    }

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
  }, [playSound, state.variables, updateVariable, scenario, node.id, completeScenario, navigateToNode]);

  const handleContinue = useCallback(() => {
    playSound('navigate');
    
    debugLog('Continue', `User clicked continue from node: ${node.id}`, {
      nodeType: node.type,
      currentNode: node.id,
    });

    const nextNodeId = findNextNode(scenario, node.id);
    if (nextNodeId) {
      if (isScenarioComplete(scenario, nextNodeId)) {
        playSound('complete');
        completeScenario();
      }
      navigateToNode(nextNodeId);
    }
  }, [playSound, node.id, node.type, scenario, completeScenario, navigateToNode]);

  const handleRestart = useCallback(() => {
    playSound('navigate');
    
    debugLog('Restart', 'User clicked restart', {
      currentNode: node.id,
      scenarioId: scenario.id,
    });

    const startNode = scenario.nodes.find(n => n.type === 'start');
    if (startNode) {
      navigateToNode(startNode.id);
    }
  }, [playSound, node.id, scenario.id, scenario.nodes, navigateToNode]);

  const handleQuestionAnswer = useCallback((isCorrect: boolean, response?: NodeResponseValue) => {
    debugLog('Question Answer', `User answered question: ${isCorrect ? 'correct' : 'incorrect'}`, {
      currentNode: node.id,
      nodeType: node.type,
      isCorrect,
      response,
    });

    // Handle connections-specific scoring
    if (isConnectionsNode(node) && isConnectionsResponse(response)) {
      const connectionsScore = calculateConnectionsScore(response, node.scoring);
      debugLog('Connections Score', `Connections game completed with score: ${connectionsScore}`, {
        foundGroups: response.foundGroups.length,
        mistakes: response.mistakes,
        completed: response.completed,
        score: connectionsScore,
      });
      
      // Update the scenario score if applicable
      if (state.score !== undefined) {
        // Note: We could add a score update mechanism here if needed
      }
    }

    // Handle wordle-specific scoring
    if (isWordleNode(node) && isWordleResponse(response)) {
      const wordleScore = calculateWordleScore(response, node.scoring);
      debugLog('Wordle Score', `Wordle game completed with score: ${wordleScore}`, {
        attempts: response.attempts,
        completed: response.completed,
        won: response.won,
        score: wordleScore,
      });
      
      // Update the scenario score if applicable
      if (state.score !== undefined) {
        // Note: We could add a score update mechanism here if needed
      }
    } else if (state.score !== undefined) {
      // Note: We could add a score update mechanism here if needed
    }

    // Navigate to next node
    const nextNodeId = findNextNode(scenario, node.id);
    if (nextNodeId) {
      // Always navigate to the next node first
      navigateToNode(nextNodeId);
      
      // If the next node is an end node, complete the scenario
      if (nextNodeId === 'end' || isScenarioComplete(scenario, nextNodeId)) {
        playSound('complete');
        completeScenario();
      }
    } else {
      // Check if we're actually at the end or if there's a navigation issue
      const currentNode = scenario.nodes.find(n => n.id === node.id);
      if (currentNode?.type === 'end') {
        playSound('complete');
        completeScenario();
      } else {
        // No next node found - this could be end of survey/quiz
        // Check if this is the last question by looking at remaining links
        const remainingLinks = scenario.links.filter(l => l.sourceNodeId === node.id);
        if (remainingLinks.length === 0) {
          // No more links, this is the end of the survey/quiz
          debugLog('Completion', 'Survey/Quiz completed - no more questions', {
            currentNode: node.id,
            nodeType: node.type,
          });
          playSound('complete');
          completeScenario();
        } else {
          // Navigation failed - this is likely a scenario structure issue
          debugLog('Navigation Error', 'Could not find next node for survey question', {
            currentNode: node.id,
            nodeType: node.type,
            availableLinks: remainingLinks,
          });
          console.error(`Navigation failed: Could not find next node for ${node.id}`);
        }
      }
    }
  }, [node.id, node.type, state.score, scenario, navigateToNode, playSound, completeScenario]);

  // Completion modal handlers
  const handleGoHome = useCallback(() => {
    // For now, just restart to go to landing page
    // This could be enhanced to navigate to an actual home page
    window.location.reload();
  }, []);

  const handleRestartFromModal = useCallback(() => {
    handleRestart();
  }, [handleRestart]);

  const handleViewResultsFromModal = useCallback(() => {
    setShowResults(true);
  }, []);

  // Add keyboard support for start screen
  useEffect(() => {
    if (node.type === 'start') {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleContinue();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [node.type, handleContinue]);

  switch (node.type) {
    case 'start':
      return (
        <NodeCard animate={false}>
          <Typography gutterBottom align="center">
            {scenario.name}
          </Typography>
          <Typography sx={{ mb: 3 }} align="center">
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

    case 'end': {
      // Show xAPI results screen if enabled and user clicked to view results
      if (showResults && xapiEnabled) {
        return (
          <XAPIResultsScreen
            onBack={() => setShowResults(false)}
            scenarioName={scenario.name}
          />
        );
      }


      return (
        <NodeCard animate={false}>
          <Typography gutterBottom align="center" color="primary">
            Training Complete!
          </Typography>
          <Typography sx={{ mb: 3 }} align="center">
            You have successfully completed the training scenario.
          </Typography>
          {state.score !== undefined && (
            <Typography align="center" sx={{ mt: 2 }}>
              Final Score: {state.score}
            </Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Stack direction="row" spacing={2}>
              {xapiEnabled && (
                <Button
                  variant="contained"
                  startIcon={<Analytics />}
                  onClick={() => setShowResults(true)}
                  size="large"
                  sx={{
                    borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                    ...(themeMode === 'unfiltered' && {
                      backgroundColor: '#F6FA24',
                      color: '#000000',
                      '&:hover': {
                        backgroundColor: '#FFD700',
                      },
                    }),
                  }}
                >
                  View Results
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<Refresh />}
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
            </Stack>
          </Box>
        </NodeCard>
      );
    }

    case 'question': {
      const choices = getChoicesForQuestion(scenario, node.id);
      return (
        <UnifiedQuestionNode 
          key={node.id}
          question={node} 
          choices={choices}
          onChoiceSelect={handleChoiceSelect}
        />
      );
    }

    case 'interstitial_panel':
      return (
        <InterstitialPanel 
          key={node.id}
          panel={node} 
          onContinue={handleContinue}
        />
      );

    case 'true_false':
      return (
        <TrueFalseNode 
          key={node.id}
          question={node} 
          onAnswer={handleQuestionAnswer}
        />
      );

    case 'ordering':
      return (
        <OrderingNode 
          key={node.id}
          question={node} 
          onAnswer={handleQuestionAnswer}
        />
      );

    case 'matching':
      return (
        <MatchingNode 
          key={node.id}
          question={node} 
          onAnswer={handleQuestionAnswer}
        />
      );

    case 'short_answer':
      return (
        <ShortAnswerNode 
          key={node.id}
          question={node} 
          onAnswer={handleQuestionAnswer}
        />
      );

    case 'likert_scale':
      return (
        <LikertScaleNode 
          key={node.id}
          question={node} 
          onAnswer={(response) => handleQuestionAnswer(true, response)}
        />
      );

    case 'rating':
      return (
        <RatingNode 
          key={node.id}
          question={node} 
          onAnswer={(response) => handleQuestionAnswer(true, response)}
        />
      );

    case 'slider':
      return (
        <SliderNode 
          key={node.id}
          question={node} 
          onAnswer={(response) => handleQuestionAnswer(true, response)}
        />
      );

    case 'text_area':
      return (
        <TextAreaNode 
          key={node.id}
          question={node} 
          onAnswer={(response) => handleQuestionAnswer(true, response)}
        />
      );

    case 'matrix':
      return (
        <MatrixNode 
          key={node.id}
          question={node} 
          onAnswer={(response) => handleQuestionAnswer(true, response)}
        />
      );

    case 'connections':
      return (
        <ConnectionsNode 
          key={node.id}
          question={node} 
          onAnswer={(response) => handleQuestionAnswer(true, response)}
        />
      );

    case 'wordle':
      return (
        <WordleNode 
          key={node.id}
          question={node} 
          onAnswer={(response) => handleQuestionAnswer(true, response)}
        />
      );

    default:
      return (
        <NodeCard animate={false}>
          <Typography color="error">
            Unknown node type: {node.type}
          </Typography>
        </NodeCard>
      );
  }
  
  // Render completion modal alongside the node
  return (
    <>
      {(() => {
        switch (node.type) {
          case 'start':
            return (
              <NodeCard animate={false}>
                <Typography gutterBottom align="center">
                  {scenario.name}
                </Typography>
                <Typography sx={{ mb: 3 }} align="center">
                  Welcome to this interactive training scenario.
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={handleRestart}
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

          case 'end': {
            if (showResults && xapiEnabled) {
              return (
                <XAPIResultsScreen
                  onBack={() => setShowResults(false)}
                  scenarioName={scenario.name}
                />
              );
            }

            return (
              <NodeCard animate={false}>
                <Typography gutterBottom align="center" color="primary">
                  Training Complete!
                </Typography>
                <Typography sx={{ mb: 3 }} align="center">
                  You have successfully completed the training scenario.
                </Typography>
                {state.score !== undefined && (
                  <Typography align="center" sx={{ mt: 2 }}>
                    Final Score: {state.score}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Typography color="text.secondary">
                    Check the completion modal for options
                  </Typography>
                </Box>
              </NodeCard>
            );
          }

          default:
            return (
              <NodeCard animate={false}>
                <Typography color="error">
                  Unknown node type: {node.type}
                </Typography>
              </NodeCard>
            );
        }
      })()}
      
      {/* Completion Modal */}
      <CompletionModal
        open={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        onRestart={handleRestartFromModal}
        onGoHome={handleGoHome}
        onViewResults={xapiEnabled ? handleViewResultsFromModal : undefined}
        scenarioName={scenario.name}
        score={state.score}
        xapiEnabled={xapiEnabled}
      />
    </>
  );
};