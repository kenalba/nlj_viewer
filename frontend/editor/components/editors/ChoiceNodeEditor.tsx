/**
 * ChoiceNodeEditor - Editor for individual choice nodes
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
} from '@mui/material';
import {
  CheckCircle as CorrectIcon,
  Cancel as IncorrectIcon,
  RadioButtonUnchecked as NeutralIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode } from '../../../../types/nlj';
import { RichTextEditor } from './RichTextEditor';

interface ChoiceNodeEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const ChoiceNodeEditor: React.FC<ChoiceNodeEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as any; // Type assertion for choice node fields

  // Handle correctness change
  const handleCorrectnessChange = (
    _: React.MouseEvent<HTMLElement>,
    newValue: 'CORRECT' | 'INCORRECT' | 'NEUTRAL'
  ) => {
    if (newValue !== null) {
      onUpdate({
        choiceType: newValue,
        isCorrect: newValue === 'CORRECT',
      });
    }
  };

  // Handle order change for ordering questions
  const handleOrderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numericValue = value === '' ? undefined : parseInt(value, 10);
    
    if (value === '' || (!isNaN(numericValue!) && numericValue! >= 1)) {
      onUpdate({ correctOrder: numericValue });
    }
  };

  // Get current correctness value
  const getCurrentCorrectness = (): 'CORRECT' | 'INCORRECT' | 'NEUTRAL' => {
    return nljNode.choiceType || (nljNode.isCorrect ? 'CORRECT' : 'INCORRECT');
  };

  const currentCorrectness = getCurrentCorrectness();

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
        Choice Options
      </Typography>

      {/* Choice Text */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
          Choice Text
        </Typography>
        
        <RichTextEditor
          value={nljNode.text || ''}
          onUpdate={(value) => onUpdate({ text: value })}
          placeholder="Enter choice text..."
          minHeight={80}
          showToolbar={true}
          autoFocus={false}
        />
      </Box>

      {/* Correctness Status */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
          Correctness Status
        </Typography>
        
        <ToggleButtonGroup
          value={currentCorrectness}
          exclusive
          onChange={handleCorrectnessChange}
          size="small"
          sx={{ 
            width: '100%',
            gap: 1,
            '& .MuiToggleButton-root': {
              flex: 1,
              fontSize: '0.75rem',
              fontWeight: 600,
              py: 1.5,
              px: 2,
              borderRadius: '8px',
              border: '2px solid',
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
              '&.Mui-selected': {
                fontWeight: 700,
                borderWidth: '2px',
                '&:hover': {
                  backgroundColor: 'inherit',
                },
              },
            },
            '& .MuiToggleButton-root[value="CORRECT"]': {
              '&.Mui-selected': {
                backgroundColor: 'success.light',
                borderColor: 'success.main',
                color: 'success.contrastText',
              },
            },
            '& .MuiToggleButton-root[value="INCORRECT"]': {
              '&.Mui-selected': {
                backgroundColor: 'error.light',
                borderColor: 'error.main',
                color: 'error.contrastText',
              },
            },
            '& .MuiToggleButton-root[value="NEUTRAL"]': {
              '&.Mui-selected': {
                backgroundColor: 'grey.300',
                borderColor: 'grey.600',
                color: 'grey.800',
              },
            },
          }}
        >
          <ToggleButton value="CORRECT">
            <CorrectIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
            Correct
          </ToggleButton>
          <ToggleButton value="INCORRECT">
            <IncorrectIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
            Incorrect
          </ToggleButton>
          <ToggleButton value="NEUTRAL">
            <NeutralIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
            Neutral
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Matching Text for Matching Questions */}
      {nljNode.matchingText !== undefined && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
            Matching Text (Right Item)
          </Typography>
          
          <RichTextEditor
            value={nljNode.matchingText || ''}
            onUpdate={(value) => onUpdate({ matchingText: value })}
            placeholder="Enter matching text..."
            minHeight={60}
            showToolbar={false}
            autoFocus={false}
          />
        </Box>
      )}

      {/* Correct Order for Ordering Questions */}
      {nljNode.correctOrder !== undefined && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
            Correct Order Position
          </Typography>
          
          <TextField
            type="number"
            value={nljNode.correctOrder || ''}
            onChange={handleOrderChange}
            placeholder="Enter order position (1, 2, 3, etc.)"
            size="small"
            InputProps={{
              inputProps: { min: 1, step: 1 }
            }}
            sx={{ width: '200px' }}
          />
        </Box>
      )}

      {/* Choice Feedback */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
          Choice Feedback
        </Typography>
        
        <RichTextEditor
          value={nljNode.feedback || ''}
          onUpdate={(value) => onUpdate({ feedback: value })}
          placeholder="Enter feedback shown when this choice is selected..."
          minHeight={80}
          showToolbar={true}
          autoFocus={false}
        />
      </Box>

      {/* Value/Score */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
          Point Value (Optional)
        </Typography>
        
        <TextField
          type="number"
          value={nljNode.value || ''}
          onChange={(e) => {
            const value = e.target.value;
            const numericValue = value === '' ? undefined : parseInt(value, 10);
            onUpdate({ value: numericValue });
          }}
          placeholder="Points awarded for this choice"
          size="small"
          sx={{ width: '200px' }}
        />
      </Box>
    </Stack>
  );
};