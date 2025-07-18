/**
 * ShortAnswerEditor - Editor for Short Answer questions
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  IconButton,
  FormControlLabel,
  Switch,
  Alert,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';

interface ShortAnswerEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const ShortAnswerEditor: React.FC<ShortAnswerEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as any;
  const correctAnswers = nljNode.correctAnswers || [''];

  const updateCorrectAnswers = (answers: string[]) => {
    onUpdate({ correctAnswers: answers });
  };

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...correctAnswers];
    newAnswers[index] = value;
    updateCorrectAnswers(newAnswers);
  };

  const handleAddAnswer = () => {
    updateCorrectAnswers([...correctAnswers, '']);
  };

  const handleRemoveAnswer = (index: number) => {
    const newAnswers = correctAnswers.filter((_: string, i: number) => i !== index);
    updateCorrectAnswers(newAnswers);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Correct Answers
      </Typography>

      {/* Answer Input Preview */}
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Answer Input Preview:
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
          <TextField
            placeholder="User will type their answer here..."
            disabled
            fullWidth
            variant="outlined"
            size="small"
          />
        </Paper>
      </Box>

      {/* Correct Answers */}
      <Stack spacing={2}>
        {correctAnswers.map((answer: string, index: number) => (
          <Stack key={index} direction="row" spacing={1} alignItems="center">
            <TextField
              label={`Correct Answer ${index + 1}`}
              value={answer}
              onChange={(e) => handleAnswerChange(index, e.target.value)}
              fullWidth
              size="small"
              placeholder="Enter an acceptable answer"
            />
            
            <IconButton
              onClick={() => handleRemoveAnswer(index)}
              color="error"
              size="small"
              disabled={correctAnswers.length <= 1}
            >
              <RemoveIcon />
            </IconButton>
          </Stack>
        ))}
        
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddAnswer}
          variant="outlined"
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        >
          Add Answer
        </Button>
      </Stack>

      {/* Answer Settings */}
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={nljNode.caseSensitive || false}
              onChange={(e) => onUpdate({ caseSensitive: e.target.checked })}
            />
          }
          label="Case Sensitive"
        />
        
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
          Add multiple acceptable answers. The user's response will be considered correct if it matches any of these answers.
          Use the "Case Sensitive" option to control whether capitalization matters.
        </Typography>
      </Alert>
    </Stack>
  );
};