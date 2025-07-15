import React from 'react';
import { Typography, Button, Box, useTheme as useMuiTheme } from '@mui/material';
import type { InterstitialPanelNode } from '../types/nlj';
import { MediaViewer } from './MediaViewer';
import { NodeCard } from './NodeCard';
import { useTheme } from '../contexts/ThemeContext';

interface InterstitialPanelProps {
  panel: InterstitialPanelNode;
  onContinue: () => void;
}

export const InterstitialPanel: React.FC<InterstitialPanelProps> = ({
  panel,
  onContinue,
}) => {
  const displayText = panel.text || panel.content || '';
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();

  return (
    <NodeCard variant="interstitial" animate={false} sx={{ mb: 2 }}>
      {panel.media && (
        <Box sx={{ mb: 2 }}>
          <MediaViewer 
            media={panel.media} 
            alt="Scenario content"
            size="large"
          />
        </Box>
      )}
      {displayText && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          {displayText}
        </Typography>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button
          variant="contained"
          onClick={onContinue}
          size="large"
          sx={{
            borderRadius: (muiTheme.shape.borderRadius as number) * 3,
            boxShadow: themeMode === 'unfiltered' ? 
              '0 4px 16px rgba(246, 250, 36, 0.3)' : 
              'none',
            '&:hover': {
              ...(themeMode === 'unfiltered' && {
                boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                transform: 'translateY(-2px)',
              }),
            },
          }}
        >
          Continue
        </Button>
      </Box>
    </NodeCard>
  );
};