import React from 'react';
import { IconButton, Tooltip, Box } from '@mui/material';
import { Palette, Business } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { themeMode, toggleTheme } = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Tooltip title={`Switch to ${themeMode === 'hyundai' ? 'Unfiltered' : 'Hyundai'} theme`}>
        <IconButton
          onClick={toggleTheme}
          color="inherit"
          sx={{
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'rotate(180deg)',
            },
          }}
        >
          {themeMode === 'hyundai' ? <Palette /> : <Business />}
        </IconButton>
      </Tooltip>
    </Box>
  );
};