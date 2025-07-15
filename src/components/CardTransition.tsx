import React, { useState, useEffect, ReactNode } from 'react';
import { Box } from '@mui/material';

interface CardTransitionProps {
  children: ReactNode;
  nodeId: string;
  onTransitionComplete?: () => void;
}

export const CardTransition: React.FC<CardTransitionProps> = ({
  children,
  nodeId,
  onTransitionComplete,
}) => {
  const [currentNodeId, setCurrentNodeId] = useState(nodeId);

  useEffect(() => {
    if (nodeId !== currentNodeId) {
      // Update immediately without transition for now
      setCurrentNodeId(nodeId);
      onTransitionComplete?.();
    }
  }, [nodeId, currentNodeId, onTransitionComplete]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </Box>
  );
};