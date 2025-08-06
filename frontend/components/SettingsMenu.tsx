/**
 * Settings Menu Component
 * Provides theme toggle and other user preferences
 */

import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Switch
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsMenuProps {
  compact?: boolean;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ compact = false }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { isDarkMode, toggleTheme } = useTheme();
  
  const open = Boolean(anchorEl);
  
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeToggle = () => {
    toggleTheme();
    // Don't close menu so user can see the change
  };

  return (
    <>
      <IconButton 
        onClick={handleClick}
        size={compact ? "small" : "medium"}
        sx={{ 
          p: compact ? 0.5 : 1
        }}
      >
        <SettingsIcon sx={{ fontSize: compact ? '1rem' : '1.25rem' }} />
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 280 }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Settings
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Customize your experience
          </Typography>
        </Box>

        {/* Theme Toggle */}
        <MenuItem onClick={handleThemeToggle} sx={{ py: 1.5 }}>
          <ListItemIcon>
            {isDarkMode ? <LightIcon /> : <DarkIcon />}
          </ListItemIcon>
          <ListItemText 
            primary="Theme"
            secondary={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          />
          <Switch 
            checked={isDarkMode} 
            onChange={handleThemeToggle}
            size="small"
          />
        </MenuItem>

        <Divider />

        {/* Additional settings can be added here as they are implemented */}
      </Menu>
    </>
  );
};