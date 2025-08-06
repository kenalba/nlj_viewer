/**
 * LikertScaleEditor - Editor for Likert Scale questions
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Alert,
  Paper,
} from '@mui/material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode } from '../../../../types/nlj';

interface LikertScaleEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const LikertScaleEditor: React.FC<LikertScaleEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as any;
  const scale = nljNode.scale || { min: 1, max: 5, labels: { min: 'Strongly Disagree', max: 'Strongly Agree' } };

  const updateScale = (scaleUpdates: any) => {
    onUpdate({
      scale: { ...scale, ...scaleUpdates }
    });
  };

  const updateLabels = (labelUpdates: any) => {
    onUpdate({
      scale: { 
        ...scale, 
        labels: { ...scale.labels, ...labelUpdates }
      }
    });
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Scale Configuration
      </Typography>

      {/* Scale Range */}
      <Stack direction="row" spacing={2}>
        <TextField
          label="Min Value"
          type="number"
          value={scale.min}
          onChange={(e) => updateScale({ min: parseInt(e.target.value) || 1 })}
          size="small"
          sx={{ width: 120 }}
        />
        
        <TextField
          label="Max Value"
          type="number"
          value={scale.max}
          onChange={(e) => updateScale({ max: parseInt(e.target.value) || 5 })}
          size="small"
          sx={{ width: 120 }}
        />
      </Stack>

      {/* Scale Labels */}
      <Stack spacing={2}>
        <TextField
          label="Min Label"
          value={scale.labels.min || ''}
          onChange={(e) => updateLabels({ min: e.target.value })}
          size="small"
          fullWidth
          helperText="Label for the minimum value"
        />
        
        <TextField
          label="Max Label"
          value={scale.labels.max || ''}
          onChange={(e) => updateLabels({ max: e.target.value })}
          size="small"
          fullWidth
          helperText="Label for the maximum value"
        />
        
        {scale.labels.middle !== undefined && (
          <TextField
            label="Middle Label"
            value={scale.labels.middle || ''}
            onChange={(e) => updateLabels({ middle: e.target.value })}
            size="small"
            fullWidth
            helperText="Optional label for the middle value"
          />
        )}
      </Stack>

      {/* Scale Preview */}
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Scale Preview:
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {scale.labels.min}
            </Typography>
            
            <Stack direction="row" spacing={1} sx={{ flex: 1, justifyContent: 'center' }}>
              {Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i).map((num) => (
                <Button
                  key={num}
                  variant="outlined"
                  size="small"
                  disabled
                  sx={{ minWidth: 40 }}
                >
                  {num}
                </Button>
              ))}
            </Stack>
            
            <Typography variant="body2" color="text.secondary">
              {scale.labels.max}
            </Typography>
          </Stack>
        </Paper>
      </Box>

      {/* Default Value */}
      <TextField
        label="Default Value"
        type="number"
        value={nljNode.defaultValue || ''}
        onChange={(e) => onUpdate({ defaultValue: parseInt(e.target.value) || undefined })}
        size="small"
        sx={{ width: 120 }}
        helperText="Optional default selection"
      />

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
          Configure the scale range and labels. The preview shows how the scale will appear to users.
        </Typography>
      </Alert>
    </Stack>
  );
};