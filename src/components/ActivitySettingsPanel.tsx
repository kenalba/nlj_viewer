/**
 * Activity Settings Panel - Configure scenario-wide settings
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Paper,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
  Alert,
  Stack,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Help as HelpIcon,
} from '@mui/icons-material';

import type { ActivitySettings } from '../types/settings';
import type { NLJScenario } from '../types/nlj';

interface ActivitySettingsPanelProps {
  scenario: NLJScenario;
  onUpdate: (settings: ActivitySettings) => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const ActivitySettingsPanel: React.FC<ActivitySettingsPanelProps> = ({
  scenario,
  onUpdate,
  isExpanded = false,
  onToggle,
}) => {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);
  const currentSettings = scenario.settings || {};
  
  const expanded = onToggle ? isExpanded : localExpanded;
  const handleToggle = onToggle || (() => setLocalExpanded(!localExpanded));

  const handleSettingChange = (key: keyof ActivitySettings, value: boolean) => {
    const newSettings = {
      ...currentSettings,
      [key]: value,
    };
    onUpdate(newSettings);
  };

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        mb: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
        onClick={handleToggle}
      >
        <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Activity Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          Default behavior for all questions
        </Typography>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* Settings Panel */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            These settings apply to all questions in this scenario. Individual questions can override these defaults.
          </Alert>

          <Stack spacing={3}>
            {/* Shuffle Answer Order */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentSettings.shuffleAnswerOrder || false}
                      onChange={(e) => handleSettingChange('shuffleAnswerOrder', e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="subtitle1" fontWeight={500}>
                      Shuffle Answer Order
                    </Typography>
                  }
                />
                <Tooltip title="Randomize the order of answer choices to prevent memorization patterns">
                  <HelpIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 1 }} />
                </Tooltip>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                When enabled, answer choices will be randomly shuffled for multiple choice and ordering questions.
                This helps prevent users from memorizing answer positions.
              </Typography>
            </Box>

            {/* Reinforcement Eligible */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentSettings.reinforcementEligible !== false} // Default to true
                      onChange={(e) => handleSettingChange('reinforcementEligible', e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="subtitle1" fontWeight={500}>
                      Reinforcement Eligible
                    </Typography>
                  }
                />
                <Tooltip title="Include questions in spaced repetition systems for personalized learning">
                  <HelpIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 1 }} />
                </Tooltip>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                When enabled, questions are eligible for inclusion in spaced repetition and adaptive learning systems.
                Disable this for questions that shouldn't be repeated (e.g., scenario-specific content).
              </Typography>
            </Box>
          </Stack>

          {/* Current Values Display */}
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Current Settings:
            </Typography>
            <Typography variant="body2" component="div">
              • Shuffle Answer Order: <strong>{currentSettings.shuffleAnswerOrder ? 'Enabled' : 'Disabled'}</strong>
            </Typography>
            <Typography variant="body2" component="div">
              • Reinforcement Eligible: <strong>{currentSettings.reinforcementEligible !== false ? 'Enabled' : 'Disabled'}</strong>
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};