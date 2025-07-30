/**
 * InteractiveSection - Interactive elements preview and editing
 */

import React from 'react';
import {
  Typography,
  Stack,
  Alert,
} from '@mui/material';

import type { FlowNode } from '../../../flow/types/flow';
import type { NLJNode } from '../../../../../types/nlj';
import { ChoiceEditor } from '../../editors/ChoiceEditor';
import { TrueFalseEditor } from '../../editors/TrueFalseEditor';
import { LikertScaleEditor } from '../../editors/LikertScaleEditor';
import { ShortAnswerEditor } from '../../editors/ShortAnswerEditor';
import { ConnectionsEditor } from '../../editors/ConnectionsEditor';
import { WordleEditor } from '../../editors/WordleEditor';
import { BranchEditor } from '../../editors/BranchEditor';

interface InteractiveSectionProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  allNodes: FlowNode[];
  allEdges: any[];
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  onAddNode?: (node: FlowNode) => void;
  onAddEdge?: (edge: any) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
  // Edge management functions for branch nodes
  onRemoveEdge?: (sourceNodeId: string, targetNodeId: string) => void;
  onUpdateEdge?: (sourceNodeId: string, targetNodeId: string, updates: { label?: string }) => void;
}

export const InteractiveSection: React.FC<InteractiveSectionProps> = ({
  node,
  onUpdate,
  allNodes,
  allEdges,
  onAddNode,
  onAddEdge,
  onUpdateNode,
  onRemoveEdge,
  onUpdateEdge,
}) => {
  const nodeType = node.data.nodeType;

  // Helper function to create edge from simple parameters
  const handleAddEdge = (sourceNodeId: string, targetNodeId: string, label?: string) => {
    if (!onAddEdge) return;
    
    const newEdge = {
      id: `edge_${Date.now()}`,
      source: sourceNodeId,
      target: targetNodeId,
      type: 'custom' as const,
      data: {
        nljLink: {
          id: `link_${Date.now()}`,
          type: 'link' as const,
          sourceNodeId,
          targetNodeId,
          probability: 1.0,
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 },
        },
        probability: 1.0,
        isSelected: false,
        isHovered: false,
        label: label || undefined, // Store branch condition label
      },
    };
    
    onAddEdge(newEdge);
  };

  // Helper function to remove edge by source/target
  const handleRemoveEdge = (sourceNodeId: string, targetNodeId: string) => {
    if (!onRemoveEdge) return;
    onRemoveEdge(sourceNodeId, targetNodeId);
  };

  // Helper function to update edge label
  const handleUpdateEdge = (sourceNodeId: string, targetNodeId: string, updates: { label?: string }) => {
    if (!onUpdateEdge) return;
    onUpdateEdge(sourceNodeId, targetNodeId, updates);
  };

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

  // Check if node is a branch node
  const isBranch = (nodeType: string): boolean => {
    return nodeType === 'branch';
  };

  // Get section title
  const getSectionTitle = () => {
    if (usesChoiceNodes(nodeType)) {
      return 'Question Configuration';
    } else if (isSelfContained(nodeType)) {
      return 'Assessment Configuration';
    } else if (isGame(nodeType)) {
      return 'Game Configuration';
    } else if (isBranch(nodeType)) {
      return 'Branch Configuration';
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

      {/* Branch Editor */}
      {nodeType === 'branch' && (
        <BranchEditor
          node={node}
          onUpdate={onUpdate}
          availableNodes={allNodes
            .filter(n => n.data.nodeType !== 'choice') // Exclude choice nodes as valid targets
            .map(n => ({
              id: n.id,
              name: n.data.nljNode?.title || n.data.nljNode?.text || n.id,
              type: n.data.nodeType
            }))}
          availableVariables={[
            // TODO: Extract from scenario variable definitions
            { id: 'score', name: 'score', type: 'number' },
            { id: 'attempts', name: 'attempts', type: 'number' },
            { id: 'completed', name: 'completed', type: 'boolean' },
          ]}
          onAddEdge={handleAddEdge}
          onRemoveEdge={handleRemoveEdge}
          onUpdateEdge={handleUpdateEdge}
        />
      )}

      {/* Fallback for unknown types */}
      {!usesChoiceNodes(nodeType) && !isSelfContained(nodeType) && !isGame(nodeType) && !isBranch(nodeType) && (
        <Alert severity="warning">
          <Typography variant="body2">
            Interactive configuration for "{nodeType}" is not yet implemented.
          </Typography>
        </Alert>
      )}
    </Stack>
  );
};