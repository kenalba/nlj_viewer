/**
 * TrueFalseEditor - Editor for True/False questions
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material';
import {
  CheckCircle as TrueIcon,
  Cancel as FalseIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';

interface TrueFalseEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const TrueFalseEditor: React.FC<TrueFalseEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as any;

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Correct Answer
      </Typography>

      {/* Answer Selection */}
      <Stack direction="row" spacing={2}>
        <Button
          variant={nljNode.correctAnswer === true ? 'contained' : 'outlined'}
          color="success"
          startIcon={<TrueIcon />}
          onClick={() => onUpdate({ correctAnswer: true })}
          sx={{ flex: 1 }}
        >
          True
        </Button>
        
        <Button
          variant={nljNode.correctAnswer === false ? 'contained' : 'outlined'}
          color="error"
          startIcon={<FalseIcon />}
          onClick={() => onUpdate({ correctAnswer: false })}
          sx={{ flex: 1 }}
        >
          False
        </Button>
      </Stack>

      {/* Current Selection Display */}
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Correct Answer: 
        </Typography>
        <Typography 
          variant="h6" 
          color={nljNode.correctAnswer === true ? 'success.main' : 
                 nljNode.correctAnswer === false ? 'error.main' : 'text.secondary'}
          sx={{ fontWeight: 'bold' }}
        >
          {nljNode.correctAnswer === true ? 'TRUE' : 
           nljNode.correctAnswer === false ? 'FALSE' : 'NOT SET'}
        </Typography>
      </Box>

      {/* Additional Options */}
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={nljNode.required || false}
              onChange={(e) => onUpdate({ required: e.target.checked })}
            />
          }
          label="Required Question"
        />
      </Stack>

      {/* Instructions */}
      <Alert severity="info">
        <Typography variant="body2">
          Click the True or False button above to set the correct answer for this question.
        </Typography>
      </Alert>
    </Stack>
  );
};