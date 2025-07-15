import React from 'react';
import { Card, CardContent, Typography, Button, Box } from '@mui/material';
import type { InterstitialPanelNode } from '../types/nlj';
import { MediaViewer } from './MediaViewer';

interface InterstitialPanelProps {
  panel: InterstitialPanelNode;
  onContinue: () => void;
}

export const InterstitialPanel: React.FC<InterstitialPanelProps> = ({
  panel,
  onContinue,
}) => {
  const displayText = panel.text || panel.content || '';

  return (
    <Card elevation={2} sx={{ mb: 2 }}>
      {panel.media && (
        <MediaViewer 
          media={panel.media} 
          alt="Scenario content"
          size="large"
        />
      )}
      <CardContent>
        {displayText && (
          <Typography variant="body1" paragraph>
            {displayText}
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="contained"
            onClick={onContinue}
            size="large"
          >
            Continue
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};