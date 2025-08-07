/**
 * App Layout Component
 * Provides unified layout structure with sidebar navigation and top bar
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon
} from '@mui/icons-material';
import { SidebarNavigation } from './SidebarNavigation';
import { useNavigate, useLocation } from 'react-router-dom';
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
  hideSidebar?: boolean; // Deprecated - now calculated internally
}

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export const AppLayout: React.FC<AppLayoutProps> = ({
  mode,
  children,
  title,
  contentLibrary,
  topBarActions,
  hideSidebar = false // Deprecated - now calculated internally
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile); // Start closed on mobile

  // Calculate whether to hide sidebar based on current location
  const shouldHideSidebar = useMemo(() => {
    const isFlowEditor = location.pathname.includes('/flow');
    const isPlayingActivity = location.pathname.includes('/app/play/');
    return isFlowEditor || isPlayingActivity;
  }, [location.pathname]);

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
    const canEdit = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role.toLowerCase());
    return canEdit ? 'NLJ Platform' : 'NLJ Player';
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation - conditionally rendered */}
      {!shouldHideSidebar && (
        <SidebarNavigation
          mode={mode}
          open={sidebarOpen}
          onToggle={handleSidebarToggle}
          contentLibrary={contentLibrary}
        />
      )}

      {/* Mobile Menu Button - when sidebar is hidden or on mobile */}
      {(shouldHideSidebar || (isMobile && !sidebarOpen)) && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: theme.zIndex.appBar + 1,
            backgroundColor: theme.palette.background.paper,
            borderRadius: '50%',
            boxShadow: theme.shadows[4],
          }}
        >
          <IconButton
            onClick={handleSidebarToggle}
            sx={{
              color: theme.palette.primary.main,
              p: 1.5
            }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      )}

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