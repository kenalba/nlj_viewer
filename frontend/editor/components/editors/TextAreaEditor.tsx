/**
 * TextAreaEditor - Editor for Text Area questions (long-form text input)
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Paper,
  Chip,
} from '@mui/material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode, TextAreaNode } from '../../../../types/nlj';
import { FollowupEditor } from './FollowupEditor';

interface TextAreaEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const TextAreaEditor: React.FC<TextAreaEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as TextAreaNode;
  
  // Default values
  const placeholder = nljNode.placeholder || '';
  const maxLength = nljNode.maxLength;
  const minLength = nljNode.minLength;
  const required = nljNode.required || false;
  const rows = nljNode.rows || 4;
  const columns = nljNode.columns;
  const resizable = nljNode.resizable !== false; // Default true
  const spellCheck = nljNode.spellCheck !== false; // Default true
  const wordCount = nljNode.wordCount || false;

  const updateLengthConstraint = (field: 'minLength' | 'maxLength', value: string) => {
    const numValue = parseInt(value) || undefined;
    
    // Validation to ensure minLength < maxLength
    if (field === 'minLength' && maxLength && numValue && numValue >= maxLength) {
      return; // Don't update if it would violate constraint
    }
    if (field === 'maxLength' && minLength && numValue && numValue <= minLength) {
      return; // Don't update if it would violate constraint
    }
    
    onUpdate({ [field]: numValue });
  };

  const formatCharacterCount = (length?: number) => {
    if (!length) return '0';
    if (length >= 1000) return `${(length / 1000).toFixed(1)}k`;
    return length.toString();
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Text Area Configuration
      </Typography>

      {/* Basic Configuration */}
      <Stack spacing={2}>
        <TextField
          label="Placeholder Text"
          value={placeholder}
          onChange={(e) => onUpdate({ placeholder: e.target.value })}
          size="small"
          fullWidth
          helperText="Hint text shown when empty"
        />

        <Stack direction="row" spacing={2}>
          <TextField
            label="Rows"
            type="number"
            value={rows}
            onChange={(e) => onUpdate({ rows: parseInt(e.target.value) || 4 })}
            size="small"
            sx={{ width: 100 }}
            inputProps={{ min: 2, max: 20 }}
            helperText="Height in rows"
          />

          <TextField
            label="Columns"
            type="number"
            value={columns || ''}
            onChange={(e) => onUpdate({ columns: parseInt(e.target.value) || undefined })}
            size="small"
            sx={{ width: 120 }}
            inputProps={{ min: 20, max: 200 }}
            helperText="Width (optional)"
          />
        </Stack>
      </Stack>

      {/* Length Constraints */}
      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">
          Length Constraints
        </Typography>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Minimum Length"
            type="number"
            value={minLength || ''}
            onChange={(e) => updateLengthConstraint('minLength', e.target.value)}
            size="small"
            sx={{ width: 140 }}
            inputProps={{ min: 0 }}
            helperText="Min characters"
          />

          <TextField
            label="Maximum Length"
            type="number"
            value={maxLength || ''}
            onChange={(e) => updateLengthConstraint('maxLength', e.target.value)}
            size="small"
            sx={{ width: 140 }}
            inputProps={{ min: 1 }}
            helperText="Max characters"
          />
        </Stack>

        {(minLength || maxLength) && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Character Limit:
            </Typography>
            {minLength && (
              <Chip
                label={`Min: ${formatCharacterCount(minLength)}`}
                size="small"
                variant="outlined"
                color="primary"
              />
            )}
            {maxLength && (
              <Chip
                label={`Max: ${formatCharacterCount(maxLength)}`}
                size="small"
                variant="outlined"
                color="secondary"
              />
            )}
          </Stack>
        )}
      </Stack>

      {/* Preview */}
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Text Area Preview:
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
          <TextField
            placeholder={placeholder || 'Enter your response here...'}
            multiline
            rows={rows}
            fullWidth
            disabled
            variant="outlined"
            sx={{
              '& .MuiInputBase-root': {
                resize: resizable ? 'vertical' : 'none',
              },
              '& .MuiInputBase-input': {
                cursor: 'not-allowed',
              }
            }}
          />
          
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1}>
              {required && (
                <Chip label="Required" size="small" color="error" variant="outlined" />
              )}
              {spellCheck && (
                <Chip label="Spell Check" size="small" color="info" variant="outlined" />
              )}
              {wordCount && (
                <Chip label="Word Count" size="small" color="success" variant="outlined" />
              )}
            </Stack>
            
            {maxLength && (
              <Typography variant="caption" color="text.secondary">
                0 / {formatCharacterCount(maxLength)}
              </Typography>
            )}
          </Stack>
        </Paper>
      </Box>

      {/* Additional Options */}
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
            />
          }
          label="Required Question"
        />

        <FormControlLabel
          control={
            <Switch
              checked={resizable}
              onChange={(e) => onUpdate({ resizable: e.target.checked })}
            />
          }
          label="Resizable Text Area"
        />

        <FormControlLabel
          control={
            <Switch
              checked={spellCheck}
              onChange={(e) => onUpdate({ spellCheck: e.target.checked })}
            />
          }
          label="Enable Spell Check"
        />

        <FormControlLabel
          control={
            <Switch
              checked={wordCount}
              onChange={(e) => onUpdate({ wordCount: e.target.checked })}
            />
          }
          label="Show Word Count"
        />
      </Stack>

      {/* Follow-up Configuration */}
      <FollowupEditor
        followUp={nljNode.followUp}
        onUpdate={(followUp) => onUpdate({ followUp })}
      />

      {/* Instructions */}
      <Alert severity="info">
        <Typography variant="body2">
          Text areas are ideal for collecting detailed feedback, explanations, or long-form responses. 
          Configure length constraints and formatting options to guide user input.
        </Typography>
      </Alert>
    </Stack>
  );
};