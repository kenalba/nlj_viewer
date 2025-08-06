/**
 * Question Settings Panel - Configure individual question settings that override activity defaults
 */

import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Paper,
  Divider,
  Tooltip,
  Alert,
  Stack,
  Chip,
  Button,
} from '@mui/material';
import {
  Help as HelpIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material';

import type { NodeSettings } from '../../../../../types/settings';
import type { NLJNode } from '../../../../../types/nlj';

interface QuestionSettingsPanelProps {
  node: NLJNode & { settings?: NodeSettings };
  activitySettings?: { shuffleAnswerOrder?: boolean; reinforcementEligible?: boolean };
  onUpdate: (settings: NodeSettings | undefined) => void;
}

export const QuestionSettingsPanel: React.FC<QuestionSettingsPanelProps> = ({
  node,
  activitySettings = {},
  onUpdate,
}) => {
  const currentSettings = node.settings || {};
  
  // Determine if this node type supports settings
  const supportsSettings = !['start', 'end', 'choice', 'interstitial_panel'].includes(node.type);
  
  if (!supportsSettings) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        This node type doesn't support question-level settings.
      </Alert>
    );
  }

  const handleSettingChange = (key: keyof NodeSettings, value: boolean | undefined) => {
    const newSettings = {
      ...currentSettings,
      [key]: value,
    };
    
    // If all settings match defaults, remove the settings object
    const hasCustomSettings = Object.values(newSettings).some(val => val !== undefined);
    onUpdate(hasCustomSettings ? newSettings : undefined);
  };

  const handleReset = () => {
    onUpdate(undefined);
  };

  const getEffectiveValue = (key: keyof NodeSettings, defaultValue: boolean): boolean => {
    if (currentSettings[key] !== undefined) {
      return currentSettings[key]!;
    }
    if (activitySettings[key] !== undefined) {
      return activitySettings[key]!;
    }
    return defaultValue;
  };

  const getValueSource = (key: keyof NodeSettings): 'question' | 'activity' | 'default' => {
    if (currentSettings[key] !== undefined) return 'question';
    if (activitySettings[key] !== undefined) return 'activity';
    return 'default';
  };

  const hasQuestionOverrides = Object.values(currentSettings).some(val => val !== undefined);

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Question Settings
        </Typography>
        {hasQuestionOverrides && (
          <Button
            size="small"
            startIcon={<RestoreIcon />}
            onClick={handleReset}
            color="secondary"
          >
            Reset to Defaults
          </Button>
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
        Override activity-level defaults for this specific question. Leave blank to use activity defaults.
      </Alert>

      <Stack spacing={2}>
        {/* Shuffle Answer Order */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Shuffle Answer Order
              </Typography>
              <Tooltip title="Override the activity-level setting for this question">
                <HelpIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
              </Tooltip>
            </Box>
            <Chip
              size="small"
              label={getValueSource('shuffleAnswerOrder')}
              color={getValueSource('shuffleAnswerOrder') === 'question' ? 'primary' : 'default'}
              variant={getValueSource('shuffleAnswerOrder') === 'question' ? 'filled' : 'outlined'}
              sx={{ fontSize: '0.75rem', height: 20 }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={getEffectiveValue('shuffleAnswerOrder', false)}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    // Only set if different from activity default
                    const activityValue = activitySettings.shuffleAnswerOrder ?? false;
                    handleSettingChange('shuffleAnswerOrder', newValue !== activityValue ? newValue : undefined);
                  }}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  {getEffectiveValue('shuffleAnswerOrder', false) ? 'Enabled' : 'Disabled'}
                </Typography>
              }
            />
          </Box>
        </Box>

        <Divider />

        {/* Reinforcement Eligible */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Reinforcement Eligible
              </Typography>
              <Tooltip title="Override the activity-level setting for this question">
                <HelpIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
              </Tooltip>
            </Box>
            <Chip
              size="small"
              label={getValueSource('reinforcementEligible')}
              color={getValueSource('reinforcementEligible') === 'question' ? 'primary' : 'default'}
              variant={getValueSource('reinforcementEligible') === 'question' ? 'filled' : 'outlined'}
              sx={{ fontSize: '0.75rem', height: 20 }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={getEffectiveValue('reinforcementEligible', true)}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    // Only set if different from activity default
                    const activityValue = activitySettings.reinforcementEligible ?? true;
                    handleSettingChange('reinforcementEligible', newValue !== activityValue ? newValue : undefined);
                  }}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  {getEffectiveValue('reinforcementEligible', true) ? 'Enabled' : 'Disabled'}
                </Typography>
              }
            />
          </Box>
        </Box>
      </Stack>

      {/* Settings Preview */}
      {hasQuestionOverrides && (
        <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
          <Typography variant="caption" color="primary.dark" fontWeight={600} display="block" gutterBottom>
            Question Override Active:
          </Typography>
          {currentSettings.shuffleAnswerOrder !== undefined && (
            <Typography variant="caption" display="block">
              • Shuffle Answer Order: {currentSettings.shuffleAnswerOrder ? 'Enabled' : 'Disabled'}
            </Typography>
          )}
          {currentSettings.reinforcementEligible !== undefined && (
            <Typography variant="caption" display="block">
              • Reinforcement Eligible: {currentSettings.reinforcementEligible ? 'Enabled' : 'Disabled'}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};