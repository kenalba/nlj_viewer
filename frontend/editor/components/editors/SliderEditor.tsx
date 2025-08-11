/**
 * SliderEditor - Editor for Slider questions (continuous scale input)
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
  Slider,
} from '@mui/material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode, SliderNode } from '../../../../types/nlj';
import { FollowupEditor } from './FollowupEditor';

interface SliderEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const SliderEditor: React.FC<SliderEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as SliderNode;
  
  // Default values
  const range = nljNode.range || { min: 0, max: 100, step: 1, precision: 0 };
  const labels = nljNode.labels || { min: 'Minimum', max: 'Maximum' };
  const defaultValue = nljNode.defaultValue;
  const required = nljNode.required || false;
  const showValue = nljNode.showValue || true;
  const showTicks = nljNode.showTicks || false;
  const continuous = nljNode.continuous || true;

  const updateRange = (rangeUpdates: Partial<typeof range>) => {
    const newRange = { ...range, ...rangeUpdates };
    
    // Ensure min is less than max
    if (rangeUpdates.min !== undefined && rangeUpdates.min >= newRange.max) {
      newRange.max = rangeUpdates.min + (newRange.step || 1);
    }
    if (rangeUpdates.max !== undefined && rangeUpdates.max <= newRange.min) {
      newRange.min = Math.max(0, rangeUpdates.max - (newRange.step || 1));
    }
    
    // Adjust default value if it's outside the new range
    let updates: Partial<SliderNode> = { range: newRange };
    if (defaultValue !== undefined) {
      if (defaultValue < newRange.min || defaultValue > newRange.max) {
        updates.defaultValue = Math.max(newRange.min, Math.min(newRange.max, defaultValue));
      }
    }
    
    onUpdate(updates);
  };

  const updateLabels = (labelUpdates: Partial<typeof labels>) => {
    onUpdate({
      labels: { ...labels, ...labelUpdates }
    });
  };

  // Generate tick marks for preview
  const generateTicks = () => {
    const tickCount = Math.min(11, Math.floor((range.max - range.min) / (range.step || 1)) + 1);
    const ticks = [];
    
    for (let i = 0; i < tickCount; i++) {
      const value = range.min + (i * (range.max - range.min) / (tickCount - 1));
      ticks.push({
        value: Math.round(value / (range.step || 1)) * (range.step || 1),
        label: labels.custom?.[value] || (i === 0 ? labels.min : i === tickCount - 1 ? labels.max : ''),
      });
    }
    
    return ticks;
  };

  const formatValue = (value: number) => {
    const precision = range.precision || 0;
    return precision > 0 ? value.toFixed(precision) : Math.round(value).toString();
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Slider Configuration
      </Typography>

      {/* Range Configuration */}
      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">
          Scale Range
        </Typography>
        
        <Stack direction="row" spacing={2}>
          <TextField
            label="Min Value"
            type="number"
            value={range.min}
            onChange={(e) => updateRange({ min: parseFloat(e.target.value) || 0 })}
            size="small"
            sx={{ width: 120 }}
          />
          
          <TextField
            label="Max Value"
            type="number"
            value={range.max}
            onChange={(e) => updateRange({ max: parseFloat(e.target.value) || 100 })}
            size="small"
            sx={{ width: 120 }}
          />
          
          <TextField
            label="Step"
            type="number"
            value={range.step || 1}
            onChange={(e) => updateRange({ step: parseFloat(e.target.value) || 1 })}
            size="small"
            sx={{ width: 100 }}
            inputProps={{ min: 0.1, step: 0.1 }}
          />
          
          <TextField
            label="Precision"
            type="number"
            value={range.precision || 0}
            onChange={(e) => updateRange({ precision: parseInt(e.target.value) || 0 })}
            size="small"
            sx={{ width: 100 }}
            inputProps={{ min: 0, max: 3 }}
            helperText="Decimal places"
          />
        </Stack>
      </Stack>

      {/* Labels Configuration */}
      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">
          Scale Labels
        </Typography>
        
        <Stack direction="row" spacing={2}>
          <TextField
            label="Min Label"
            value={labels.min || ''}
            onChange={(e) => updateLabels({ min: e.target.value })}
            size="small"
            fullWidth
            helperText="Label for minimum value"
          />
          
          <TextField
            label="Max Label"
            value={labels.max || ''}
            onChange={(e) => updateLabels({ max: e.target.value })}
            size="small"
            fullWidth
            helperText="Label for maximum value"
          />
        </Stack>
      </Stack>

      {/* Preview */}
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Slider Preview:
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {labels.min}
              </Typography>
              {showValue && (
                <Typography variant="body2" color="primary" sx={{ fontWeight: 'medium' }}>
                  {formatValue(defaultValue !== undefined ? defaultValue : (range.min + range.max) / 2)}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {labels.max}
              </Typography>
            </Stack>
            
            <Box sx={{ px: 1 }}>
              <Slider
                value={defaultValue !== undefined ? defaultValue : (range.min + range.max) / 2}
                min={range.min}
                max={range.max}
                step={continuous ? range.step : null}
                disabled
                marks={showTicks ? generateTicks() : false}
                valueLabelDisplay="off"
                sx={{
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.75rem',
                  },
                }}
              />
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* Default Value */}
      <TextField
        label="Default Value"
        type="number"
        value={defaultValue !== undefined ? defaultValue : ''}
        onChange={(e) => {
          const value = parseFloat(e.target.value);
          onUpdate({ 
            defaultValue: !isNaN(value) ? Math.max(range.min, Math.min(range.max, value)) : undefined 
          });
        }}
        size="small"
        sx={{ width: 140 }}
        helperText="Optional default position"
        inputProps={{ 
          min: range.min, 
          max: range.max, 
          step: range.step || 1 
        }}
      />

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
              checked={showValue}
              onChange={(e) => onUpdate({ showValue: e.target.checked })}
            />
          }
          label="Show Current Value"
        />

        <FormControlLabel
          control={
            <Switch
              checked={showTicks}
              onChange={(e) => onUpdate({ showTicks: e.target.checked })}
            />
          }
          label="Show Tick Marks"
        />

        <FormControlLabel
          control={
            <Switch
              checked={continuous}
              onChange={(e) => onUpdate({ continuous: e.target.checked })}
            />
          }
          label="Continuous Movement"
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
          Sliders are perfect for collecting numeric input on a continuous scale. 
          Users can drag to select precise values between the minimum and maximum.
        </Typography>
      </Alert>
    </Stack>
  );
};