/**
 * App Layout Component
 * Provides unified layout structure with sidebar navigation and top bar
 */

import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  useTheme,
  alpha
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon
} from '@mui/icons-material';
import { SidebarNavigation } from './SidebarNavigation';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AppLayoutProps {
  mode: 'player' | 'editor';
  children: React.ReactNode;
  title?: string;
  contentLibrary?: {
    scenarios: number;
    surveys: number;
    games: number;
    templates: number;
  };
  topBarActions?: React.ReactNode;
}

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export const AppLayout: React.FC<AppLayoutProps> = ({
  mode,
  children,
  title,
  contentLibrary,
  topBarActions
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Mode switching removed - now using role-based permissions
  const handleModeSwitch = () => {
    // This function is kept for compatibility but no longer switches modes
    // Instead, the app shows different features based on user role
    console.log('Mode switching is now role-based');
  };

  const getDefaultTitle = () => {
    if (title) return title;
    // Show unified title, but indicate available features based on user role
    const canEdit = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role);
    return canEdit ? 'NLJ Platform' : 'NLJ Player';
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <SidebarNavigation
        mode={mode}
        open={sidebarOpen}
        onToggle={handleSidebarToggle}
        contentLibrary={contentLibrary}
      />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0, // Allow flex shrinking
          overflow: 'hidden'
        }}
      >

        {/* Content Area */}
        <Box
          sx={{
            flexGrow: 1,
            width: '100%',
            maxWidth: '100%',
            p: 0, // No default padding - let children control their own spacing
            backgroundColor: theme.palette.background.default,
            overflow: 'auto'
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;