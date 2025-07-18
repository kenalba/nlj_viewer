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

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';
import { InlineTextEditor } from './InlineTextEditor';
import { MarkdownRenderer } from '../../../../components/MarkdownRenderer';

interface ChoiceEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  allNodes: FlowNode[];
  allEdges: any[];
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const ChoiceEditor: React.FC<ChoiceEditorProps> = ({
  node,
  onUpdate,
  allNodes,
  allEdges,
}) => {
  const nodeType = node.data.nodeType;

  // Get connected choice nodes
  const getConnectedChoiceNodes = () => {
    const connectedChoiceEdges = allEdges.filter((edge: any) => 
      edge.source === node.id
    );
    return connectedChoiceEdges.map((edge: any) => 
      allNodes.find((n: any) => n.id === edge.target && n.data.nodeType === 'choice')
    ).filter(Boolean);
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

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        {choiceLabel} ({choiceNodes.length})
      </Typography>

      {/* Choice List */}
      {choiceNodes.length > 0 ? (
        <Stack spacing={2}>
          {choiceNodes.map((choiceNode: any, index: number) => (
            <Paper
              key={choiceNode.id}
              variant="outlined"
              sx={{
                p: 2,
                position: 'relative',
                '&:hover': {
                  borderColor: 'primary.main',
                  '& .choice-actions': {
                    opacity: 1,
                  },
                },
              }}
            >
              <Stack spacing={2}>
                
                {/* Choice Header */}
                <Stack direction="row" alignItems="center" spacing={2}>
                  <DragIcon sx={{ color: 'action.disabled', cursor: 'grab' }} />
                  
                  <Typography variant="subtitle2" color="text.secondary">
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
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {isMatching(nodeType) ? 'Left Item' : 'Choice Text'}
                  </Typography>
                  
                  <InlineTextEditor
                    value={choiceNode.data.nljNode.text || ''}
                    onUpdate={(value) => handleUpdateChoiceNode(choiceNode.id, { text: value })}
                    placeholder="Click to edit choice text..."
                    multiline
                    rows={2}
                    sx={{ 
                      p: 1.5, 
                      bgcolor: 'action.hover', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                </Box>

                {/* Matching Right Item */}
                {isMatching(nodeType) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Right Item
                    </Typography>
                    
                    <InlineTextEditor
                      value={choiceNode.data.nljNode.matchingText || ''}
                      onUpdate={(value) => handleUpdateChoiceNode(choiceNode.id, { matchingText: value })}
                      placeholder="Click to edit matching text..."
                      multiline
                      rows={2}
                      sx={{ 
                        p: 1.5, 
                        bgcolor: 'action.hover', 
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                  </Box>
                )}

                {/* Choice Feedback */}
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Feedback (Optional)
                  </Typography>
                  
                  <InlineTextEditor
                    value={choiceNode.data.nljNode.feedback || ''}
                    onUpdate={(value) => handleUpdateChoiceNode(choiceNode.id, { feedback: value })}
                    placeholder="Click to add feedback for this choice..."
                    multiline
                    rows={2}
                    sx={{ 
                      p: 1.5, 
                      bgcolor: 'background.default', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
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
        onClick={() => {
          // TODO: Implement add choice functionality
          console.log('Add choice clicked');
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        {addButtonLabel}
      </Button>

      {/* Instructions */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Tip:</strong> Click on any text field to edit it inline. 
          Click the correctness chips to toggle correct/incorrect answers.
          Use the node palette to add more choice nodes and connect them to this question.
        </Typography>
      </Alert>
    </Stack>
  );
};