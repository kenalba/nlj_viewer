/**
 * FollowupEditor - Unified component for follow-up configuration in survey questions
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
  Collapse,
  Paper,
} from '@mui/material';

import type { SurveyFollowUpConfig } from '../../../../types/nlj';

interface FollowupEditorProps {
  followUp?: SurveyFollowUpConfig;
  onUpdate: (followUp?: SurveyFollowUpConfig) => void;
  disabled?: boolean;
}

export const FollowupEditor: React.FC<FollowupEditorProps> = ({
  followUp,
  onUpdate,
  disabled = false,
}) => {
  // Default values
  const isEnabled = followUp?.enabled || false;
  const prompt = followUp?.prompt || '';
  const required = followUp?.required || false;
  const placeholder = followUp?.placeholder || '';
  const maxLength = followUp?.maxLength || undefined;

  // Update follow-up configuration
  const updateFollowUp = (updates: Partial<SurveyFollowUpConfig>) => {
    if (!isEnabled && !updates.enabled) {
      // If disabling, clear the entire configuration
      onUpdate(undefined);
      return;
    }

    const newFollowUp: SurveyFollowUpConfig = {
      enabled: isEnabled,
      prompt,
      required,
      placeholder,
      maxLength,
      ...updates,
    };

    onUpdate(newFollowUp);
  };

  // Handle enabling/disabling follow-up
  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled) {
      // Enable with default configuration
      updateFollowUp({
        enabled: true,
        prompt: 'Please explain your answer:',
        required: false,
        placeholder: 'Enter your thoughts here...',
      });
    } else {
      // Disable and clear configuration
      onUpdate(undefined);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Follow-up Response
      </Typography>

      {/* Enable Follow-up Toggle */}
      <FormControlLabel
        control={
          <Switch
            checked={isEnabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
            disabled={disabled}
          />
        }
        label="Include follow-up verbatim response"
      />

      {/* Follow-up Configuration (when enabled) */}
      <Collapse in={isEnabled}>
        <Paper 
          variant="outlined" 
          sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}
        >
          <Stack spacing={2}>
            
            {/* Follow-up Prompt */}
            <TextField
              label="Follow-up Prompt"
              value={prompt}
              onChange={(e) => updateFollowUp({ prompt: e.target.value })}
              fullWidth
              size="small"
              placeholder="Please explain your answer:"
              helperText="The text shown to prompt the user for additional details"
              disabled={disabled}
            />

            {/* Placeholder Text */}
            <TextField
              label="Placeholder Text"
              value={placeholder}
              onChange={(e) => updateFollowUp({ placeholder: e.target.value })}
              fullWidth
              size="small"
              placeholder="Enter your thoughts here..."
              helperText="Placeholder text shown in the follow-up input field"
              disabled={disabled}
            />

            {/* Character Limit */}
            <TextField
              label="Character Limit"
              type="number"
              value={maxLength || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                updateFollowUp({ maxLength: value > 0 ? value : undefined });
              }}
              size="small"
              sx={{ width: 150 }}
              helperText="Optional maximum character limit"
              inputProps={{ min: 1, max: 5000 }}
              disabled={disabled}
            />

            {/* Required Response Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={required}
                  onChange={(e) => updateFollowUp({ required: e.target.checked })}
                  disabled={disabled}
                />
              }
              label="Follow-up response required"
            />

          </Stack>
        </Paper>
      </Collapse>

      {/* Informational Alert */}
      {isEnabled && (
        <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
          <Typography variant="body2">
            Follow-up responses provide valuable qualitative insights. Users will see a text area 
            after responding to the main question where they can provide additional context.
          </Typography>
        </Alert>
      )}
    </Stack>
  );
};