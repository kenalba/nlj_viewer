/**
 * ChoiceEditor - Editor for choice-based assessments
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Button,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CorrectIcon,
  Cancel as IncorrectIcon,
} from '@mui/icons-material';

import type { FlowNode, FlowEdge } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';
import { RichTextEditor } from './RichTextEditor';
import { generateId, NODE_TYPE_INFO } from '../../../utils/flowUtils';

interface ChoiceEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  allNodes: FlowNode[];
  allEdges: FlowEdge[];
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  onAddNode?: (node: FlowNode) => void;
  onAddEdge?: (edge: FlowEdge) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
}

export const ChoiceEditor: React.FC<ChoiceEditorProps> = ({
  node,
  onUpdate: _onUpdate,
  allNodes,
  allEdges,
  onAddNode,
  onAddEdge,
  onUpdateNode: _onUpdateNode,
}) => {
  const nodeType = node.data.nodeType;

  // Get connected choice nodes
  const getConnectedChoiceNodes = () => {
    const connectedChoiceEdges = allEdges.filter((edge: any) => 
      edge.source === node.id
    );
    
    // Use a Set to prevent duplicates and filter by unique node IDs
    const seenNodeIds = new Set();
    return connectedChoiceEdges
      .map((edge: any) => 
        allNodes.find((n: any) => n.id === edge.target && n.data.nodeType === 'choice')
      )
      .filter((choiceNode: any) => {
        if (!choiceNode || seenNodeIds.has(choiceNode.id)) {
          return false;
        }
        seenNodeIds.add(choiceNode.id);
        return true;
      });
  };

  // Get appropriate labels for different question types
  const getChoiceLabel = (nodeType: string): string => {
    switch (nodeType) {
      case 'question':
      case 'multi_select':
      case 'checkbox':
        return 'Choices';
      case 'matching':
        return 'Matching Pairs';
      case 'ordering':
        return 'Items to Order';
      default:
        return 'Options';
    }
  };

  const getAddButtonLabel = (nodeType: string): string => {
    switch (nodeType) {
      case 'question':
      case 'multi_select':
      case 'checkbox':
        return 'Add Choice';
      case 'matching':
        return 'Add Matching Pair';
      case 'ordering':
        return 'Add Item';
      default:
        return 'Add Option';
    }
  };

  // Check if this question type needs correctness indicators
  const needsCorrectness = (nodeType: string): boolean => {
    return ['question', 'multi_select', 'checkbox'].includes(nodeType);
  };

  // Check if this is a matching question
  const isMatching = (nodeType: string): boolean => {
    return nodeType === 'matching';
  };

  // Check if this is an ordering question
  const isOrdering = (nodeType: string): boolean => {
    return nodeType === 'ordering';
  };

  const choiceNodes = getConnectedChoiceNodes();
  const choiceLabel = getChoiceLabel(nodeType);
  const addButtonLabel = getAddButtonLabel(nodeType);

  // Handle updating choice node content
  const handleUpdateChoiceNode = (choiceNodeId: string, updates: Partial<NLJNode>) => {
    // This would need to be passed up to the parent to update the specific choice node
    // For now, we'll show a message that this functionality is coming
    console.log('Update choice node:', choiceNodeId, updates);
  };

  // Handle toggling correctness
  const handleToggleCorrectness = (choiceNodeId: string, isCorrect: boolean) => {
    handleUpdateChoiceNode(choiceNodeId, { isCorrect });
  };

  // Handle adding a new choice node
  const handleAddChoice = () => {
    if (!onAddNode || !onAddEdge) {
      console.log('Add choice clicked - missing callbacks');
      return;
    }

    const choiceNodeId = generateId('choice');
    const existingChoiceCount = choiceNodes.length;
    
    // Create choice node NLJ data
    const choiceNljNode = {
      id: choiceNodeId,
      type: 'choice' as const,
      x: node.position.x + 300, // Position to the right of the question node
      y: node.position.y + (existingChoiceCount * 120), // Stack vertically
      width: 200,
      height: 80,
      title: `Choice ${existingChoiceCount + 1}`,
      text: `Choice ${existingChoiceCount + 1}`,
      description: '',
      parentId: node.id, // Required for ChoiceNode
      isCorrect: false,
      choiceType: 'INCORRECT' as const,
      feedback: '',
      value: 0,
      ...(isMatching(nodeType) && { matchingText: '' }),
      ...(isOrdering(nodeType) && { correctOrder: existingChoiceCount + 1 }),
    };

    // Create Flow node
    const choiceFlowNode: FlowNode = {
      id: choiceNodeId,
      type: 'custom',
      position: { x: node.position.x + 300, y: node.position.y + (existingChoiceCount * 120) },
      data: {
        nljNode: choiceNljNode,
        label: NODE_TYPE_INFO.choice.label,
        nodeType: 'choice',
        isStart: false,
        isEnd: false,
        hasContent: true,
        isInteractive: false,
        questionType: 'choice',
      },
    };

    // Create edge from question to choice
    const edgeId = generateId('edge');
    const choiceEdge: FlowEdge = {
      id: edgeId,
      source: node.id,
      target: choiceNodeId,
      type: 'custom',
      data: {
        nljLink: {
          id: generateId('link'),
          type: 'link',
          sourceNodeId: node.id,
          targetNodeId: choiceNodeId,
          probability: 1.0,
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 },
        },
        probability: 1.0,
        isSelected: false,
        isHovered: false,
      },
    };

    // Add the node and edge
    onAddNode(choiceFlowNode);
    onAddEdge(choiceEdge);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
        {choiceLabel} ({choiceNodes.length})
      </Typography>

      {/* Choice List */}
      {choiceNodes.length > 0 ? (
        <Stack spacing={1.5}>
          {choiceNodes.map((choiceNode: any, index: number) => (
            <Paper
              key={choiceNode.id}
              variant="outlined"
              sx={{
                p: 1.5,
                position: 'relative',
                '&:hover': {
                  borderColor: 'primary.main',
                  '& .choice-actions': {
                    opacity: 1,
                  },
                },
              }}
            >
              <Stack spacing={1.5}>
                
                {/* Choice Header */}
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <DragIcon sx={{ color: 'action.disabled', cursor: 'grab' }} />
                  
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                    {isMatching(nodeType) ? `Pair ${index + 1}` : 
                     isOrdering(nodeType) ? `Item ${index + 1}` : 
                     `Choice ${index + 1}`}
                  </Typography>
                  
                  {/* Correctness indicator */}
                  {needsCorrectness(nodeType) && (
                    <Chip
                      icon={choiceNode.data.nljNode.isCorrect ? <CorrectIcon /> : <IncorrectIcon />}
                      label={choiceNode.data.nljNode.isCorrect ? 'Correct' : 'Incorrect'}
                      color={choiceNode.data.nljNode.isCorrect ? 'success' : 'error'}
                      size="small"
                      variant="outlined"
                      onClick={() => handleToggleCorrectness(choiceNode.id, !choiceNode.data.nljNode.isCorrect)}
                      sx={{ cursor: 'pointer' }}
                    />
                  )}
                  
                  {/* Order indicator */}
                  {isOrdering(nodeType) && choiceNode.data.nljNode.correctOrder && (
                    <Chip
                      label={`Order: ${choiceNode.data.nljNode.correctOrder}`}
                      color="primary"
                      size="small"
                      variant="outlined"
                    />
                  )}
                  
                  {/* Actions */}
                  <Box sx={{ flexGrow: 1 }} />
                  <Box className="choice-actions" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
                    <IconButton size="small" color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Stack>

                {/* Choice Text */}
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
                    {isMatching(nodeType) ? 'Left Item' : 'Choice Text'}
                  </Typography>
                  
                  <RichTextEditor
                    value={choiceNode.data.nljNode.text || ''}
                    onUpdate={(value) => handleUpdateChoiceNode(choiceNode.id, { text: value })}
                    placeholder="Click to edit choice text..."
                    multiline
                    minHeight={50}
                    showToolbar={false}
                    autoFocus={false}
                  />
                </Box>

                {/* Matching Right Item */}
                {isMatching(nodeType) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
                      Right Item
                    </Typography>
                    
                    <RichTextEditor
                      value={choiceNode.data.nljNode.matchingText || ''}
                      onUpdate={(value) => handleUpdateChoiceNode(choiceNode.id, { matchingText: value })}
                      placeholder="Click to edit matching text..."
                      multiline
                      minHeight={50}
                      showToolbar={false}
                      autoFocus={false}
                    />
                  </Box>
                )}

                {/* Choice Feedback */}
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
                    Feedback (Optional)
                  </Typography>
                  
                  <RichTextEditor
                    value={choiceNode.data.nljNode.feedback || ''}
                    onUpdate={(value) => handleUpdateChoiceNode(choiceNode.id, { feedback: value })}
                    placeholder="Click to add feedback for this choice..."
                    multiline
                    minHeight={50}
                    showToolbar={false}
                    autoFocus={false}
                  />
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            No {choiceLabel.toLowerCase()} connected to this question. 
            Add {choiceLabel.toLowerCase()} from the node palette and connect them to this question.
          </Typography>
        </Alert>
      )}

      {/* Add Choice Button */}
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={handleAddChoice}
        sx={{ alignSelf: 'flex-start' }}
        size="small"
      >
        {addButtonLabel}
      </Button>

      {/* Instructions */}
      <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
          <strong>Tip:</strong> Click on any text field to edit it inline. 
          Click the correctness chips to toggle correct/incorrect answers.
          Use the node palette to add more choice nodes and connect them to this question.
        </Typography>
      </Alert>
    </Stack>
  );
};