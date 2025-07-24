import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { VolumeUp, VolumeOff } from '@mui/icons-material';
import { useAudio } from '../contexts/AudioContext';

export const SoundToggle: React.FC = () => {
  const { isEnabled, setEnabled, playSound } = useAudio();

  const handleToggle = () => {
    const newState = !isEnabled;
    setEnabled(newState);
    
    // Play a test sound when enabling
    if (newState) {
      setTimeout(() => playSound('click'), 100);
    }
  };

  return (
    <Tooltip title={isEnabled ? 'Disable sounds' : 'Enable sounds'}>
      <IconButton
        onClick={handleToggle}
        color="inherit"
        sx={{
          ml: 1,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        }}
      >
        {isEnabled ? <VolumeUp /> : <VolumeOff />}
      </IconButton>
    </Tooltip>
  );
};