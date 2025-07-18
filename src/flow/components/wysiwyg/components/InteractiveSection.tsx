/**
 * InteractiveSection - Interactive elements preview and editing
 */

import React from 'react';
import {
  Typography,
  Stack,
  Alert,
} from '@mui/material';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';
import { ChoiceEditor } from '../editors/ChoiceEditor';
import { TrueFalseEditor } from '../editors/TrueFalseEditor';
import { LikertScaleEditor } from '../editors/LikertScaleEditor';
import { ShortAnswerEditor } from '../editors/ShortAnswerEditor';
import { ConnectionsEditor } from '../editors/ConnectionsEditor';
import { WordleEditor } from '../editors/WordleEditor';

interface InteractiveSectionProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  allNodes: FlowNode[];
  allEdges: any[];
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  onAddNode?: (node: FlowNode) => void;
  onAddEdge?: (edge: any) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
}

export const InteractiveSection: React.FC<InteractiveSectionProps> = ({
  node,
  onUpdate,
  allNodes,
  allEdges,
  onAddNode,
  onAddEdge,
  onUpdateNode,
}) => {
  const nodeType = node.data.nodeType;

  // Check if node uses choice nodes
  const usesChoiceNodes = (nodeType: string): boolean => {
    return [
      'question',
      'multi_select', 
      'checkbox',
      'matching',
      'ordering'
    ].includes(nodeType);
  };

  // Check if node is self-contained
  const isSelfContained = (nodeType: string): boolean => {
    return [
      'true_false',
      'short_answer',
      'likert_scale',
      'rating',
      'matrix',
      'slider',
      'text_area'
    ].includes(nodeType);
  };

  // Check if node is a game
  const isGame = (nodeType: string): boolean => {
    return ['connections', 'wordle'].includes(nodeType);
  };

  // Get section title
  const getSectionTitle = () => {
    if (usesChoiceNodes(nodeType)) {
      return 'Question Configuration';
    } else if (isSelfContained(nodeType)) {
      return 'Assessment Configuration';
    } else if (isGame(nodeType)) {
      return 'Game Configuration';
    }
    return 'Interactive Elements';
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h6" color="text.primary">
        {getSectionTitle()}
      </Typography>


      {/* Choice-based Assessment Editor */}
      {usesChoiceNodes(nodeType) && (
        <ChoiceEditor
          node={node}
          onUpdate={onUpdate}
          allNodes={allNodes}
          allEdges={allEdges}
          onAddNode={onAddNode}
          onAddEdge={onAddEdge}
          onUpdateNode={onUpdateNode}
        />
      )}

      {/* True/False Editor */}
      {nodeType === 'true_false' && (
        <TrueFalseEditor
          node={node}
          onUpdate={onUpdate}
        />
      )}

      {/* Likert Scale Editor */}
      {nodeType === 'likert_scale' && (
        <LikertScaleEditor
          node={node}
          onUpdate={onUpdate}
        />
      )}

      {/* Short Answer Editor */}
      {nodeType === 'short_answer' && (
        <ShortAnswerEditor
          node={node}
          onUpdate={onUpdate}
        />
      )}

      {/* Other Assessment Types */}
      {(['rating', 'matrix', 'slider', 'text_area'].includes(nodeType)) && (
        <Alert severity="info">
          <Typography variant="body2">
            <strong>{nodeType.replace('_', ' ').toUpperCase()} Configuration:</strong> 
            Advanced editing for this assessment type will be available in a future update.
          </Typography>
        </Alert>
      )}

      {/* Connections Game Editor */}
      {nodeType === 'connections' && (
        <ConnectionsEditor
          node={node}
          onUpdate={onUpdate}
        />
      )}

      {/* Wordle Game Editor */}
      {nodeType === 'wordle' && (
        <WordleEditor
          node={node}
          onUpdate={onUpdate}
        />
      )}

      {/* Fallback for unknown types */}
      {!usesChoiceNodes(nodeType) && !isSelfContained(nodeType) && !isGame(nodeType) && (
        <Alert severity="warning">
          <Typography variant="body2">
            Interactive configuration for "{nodeType}" is not yet implemented.
          </Typography>
        </Alert>
      )}
    </Stack>
  );
};