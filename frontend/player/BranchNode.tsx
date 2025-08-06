/**
 * BranchNode Component - Runtime conditional branch evaluation
 * Automatically evaluates expressions and navigates to the appropriate next node
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { NodeCard } from './NodeCard';
import type { BranchNode } from '../types/nlj';
import { useGameContext } from '../contexts/GameContext';
import { evaluateExpression } from '../utils/expressionEngine';
import { debugLog } from '../utils/debug';

interface BranchNodeProps {
  node: BranchNode;
  onNavigate: (targetNodeId: string) => void;
}

export const BranchNode: React.FC<BranchNodeProps> = ({ node, onNavigate }) => {
  const { state } = useGameContext();
  const [isEvaluating, setIsEvaluating] = useState(true);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [matchedCondition, setMatchedCondition] = useState<string | null>(null);

  useEffect(() => {
    const evaluateConditions = async () => {
      try {
        setIsEvaluating(true);
        setEvaluationError(null);

        // Create variable context from current game state
        const variableContext = {
          ...state.variables,
          // Add system variables
          currentNodeId: state.currentNodeId,
          visitedNodeCount: state.visitedNodes.size,
          score: state.score || 0,
          completed: state.completed,
        };

        debugLog('Branch Evaluation', 'Evaluating branch conditions', {
          nodeId: node.id,
          conditionCount: node.conditions.length,
          evaluationMode: node.evaluationMode,
          variables: variableContext,
        });

        let targetNodeId: string | null = null;
        let matchedLabel: string | null = null;

        // Evaluate conditions based on mode
        if (node.evaluationMode === 'first-match') {
          // Evaluate conditions in order and use first match
          for (const condition of node.conditions) {
            const result = evaluateExpression(condition.expression, variableContext);
            
            debugLog('Branch Condition', `Evaluating condition: ${condition.label}`, {
              expression: condition.expression,
              result: result.success ? result.value : `Error: ${result.error}`,
              conditionId: condition.id,
            });

            if (!result.success) {
              throw new Error(`Expression evaluation failed for condition "${condition.label}": ${result.error}`);
            }

            // If condition evaluates to true, use this target
            if (result.value) {
              targetNodeId = condition.targetNodeId;
              matchedLabel = condition.label;
              break;
            }
          }
        } else {
          // Priority order mode - evaluate all and use highest priority (first in array)
          for (const condition of node.conditions) {
            const result = evaluateExpression(condition.expression, variableContext);
            
            debugLog('Branch Condition', `Evaluating condition: ${condition.label}`, {
              expression: condition.expression,
              result: result.success ? result.value : `Error: ${result.error}`,
              conditionId: condition.id,
            });

            if (!result.success) {
              throw new Error(`Expression evaluation failed for condition "${condition.label}": ${result.error}`);
            }

            // If condition evaluates to true and we haven't found a match yet
            if (result.value && !targetNodeId) {
              targetNodeId = condition.targetNodeId;
              matchedLabel = condition.label;
              // Continue evaluating to check for higher priority matches
            }
          }
        }

        // Use default target if no conditions matched
        if (!targetNodeId && node.defaultTargetNodeId) {
          targetNodeId = node.defaultTargetNodeId;
          matchedLabel = 'Default';
        }

        if (!targetNodeId) {
          throw new Error('No matching conditions and no default target node specified');
        }

        setMatchedCondition(matchedLabel);

        debugLog('Branch Navigation', 'Branch evaluation complete', {
          nodeId: node.id,
          matchedCondition: matchedLabel,
          targetNodeId,
          evaluationMode: node.evaluationMode,
        });

        // Short delay to show evaluation result, then navigate
        setTimeout(() => {
          onNavigate(targetNodeId);
        }, 1000);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown evaluation error';
        setEvaluationError(errorMessage);
        
        debugLog('Branch Error', 'Branch evaluation failed', {
          nodeId: node.id,
          error: errorMessage,
          conditions: node.conditions,
        });
      } finally {
        setIsEvaluating(false);
      }
    };

    evaluateConditions();
  }, [node, state, onNavigate]);

  if (evaluationError) {
    return (
      <NodeCard animate={false}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Branch Evaluation Error
          </Typography>
          <Typography variant="body2">
            {evaluationError}
          </Typography>
        </Alert>
        
        {node.title && (
          <Typography variant="h6" gutterBottom>
            {node.title}
          </Typography>
        )}
        
        {node.description && (
          <Typography variant="body2" color="text.secondary">
            {node.description}
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Conditions:
          </Typography>
          {node.conditions.map((condition, index) => (
            <Box key={condition.id} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>{index + 1}. {condition.label}:</strong> {condition.expression}
              </Typography>
            </Box>
          ))}
        </Box>
      </NodeCard>
    );
  }

  return (
    <NodeCard animate={false}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
        {isEvaluating ? (
          <>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom align="center">
              Evaluating Conditions...
            </Typography>
            {node.title && (
              <Typography variant="body2" color="text.secondary" align="center">
                {node.title}
              </Typography>
            )}
          </>
        ) : matchedCondition ? (
          <>
            <Typography variant="h6" gutterBottom align="center" color="primary">
              Condition Matched: {matchedCondition}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Navigating to next section...
            </Typography>
          </>
        ) : null}
      </Box>

      {/* Debug information (hidden in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Debug Information:
          </Typography>
          <Typography variant="caption" component="div">
            Node ID: {node.id}
          </Typography>
          <Typography variant="caption" component="div">
            Evaluation Mode: {node.evaluationMode}
          </Typography>
          <Typography variant="caption" component="div">
            Conditions: {node.conditions.length}
          </Typography>
          <Typography variant="caption" component="div">
            Default Target: {node.defaultTargetNodeId || 'None'}
          </Typography>
        </Box>
      )}
    </NodeCard>
  );
};

export default BranchNode;