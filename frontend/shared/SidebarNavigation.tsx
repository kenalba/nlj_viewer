/**
 * Unified Sidebar Navigation Component
 * Provides consistent left sidebar navigation for both Player and Flow Editor
 */

import React, { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  IconButton,
  Collapse,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Home as HomeIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Folder as FolderIcon,
  Quiz as QuizIcon,
  Games as GamesIcon,
  Assessment as AssessmentIcon,
  ContentCopy as TemplateIcon,
  RateReview as ReviewIcon,
  AutoAwesome as GenerateIcon,
  LibraryBooks as SourcesIcon,
  People as PeopleIcon,
  ExpandLess,
  ExpandMore,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { canEditContent, canReviewContent, canManageUsers } from '../utils/permissions';
import { useNavigate, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: string | number;
  children?: SidebarItem[];
  onClick?: () => void;
}

interface SidebarNavigationProps {
  mode: 'player' | 'editor';
  open?: boolean;
  onToggle?: () => void;
  contentLibrary?: {
    scenarios: number;
    surveys: number;
    games: number;
    templates: number;
  };
}

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  mode,
  open = true,
  onToggle,
  contentLibrary = { scenarios: 0, surveys: 0, games: 0, templates: 0 }
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  
  const [expandedItems, setExpandedItems] = useState<string[]>(['content']);

  const handleExpand = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfile = () => {
    // TODO: Implement profile page
    console.log('Navigate to profile');
  };

  // Role-based navigation items with structured dividers
  const getNavigationItems = (): SidebarItem[] => {
    const canEdit = canEditContent(user);
    const canReview = canReviewContent(user);
    const isAdmin = canManageUsers(user);
    
    const items: SidebarItem[] = [
      // Main navigation
      {
        id: 'home',
        label: 'Home',
        icon: <HomeIcon />,
        path: '/app'
      },
      {
        id: 'divider-main',
        label: '',
        icon: <></>,
        path: undefined
      },
      {
        id: 'activities',
        label: 'Activities',
        icon: <FolderIcon />,
        path: '/app/activities'
      }
    ];

    // Add creation/editing features for users with appropriate roles
    if (canEdit) {
      items.push(
        {
          id: 'generate',
          label: 'Content Generation',
          icon: <GenerateIcon />,
          path: '/app/generate'
        },
        {
          id: 'sources',
          label: 'Source Library',
          icon: <SourcesIcon />,
          path: '/app/sources'
        }
      );
    }

    // Add approval dashboard for reviewers and approvers
    if (canReview) {
      items.push({
        id: 'approvals',
        label: 'Approvals',
        icon: <ReviewIcon />,
        path: '/app/approvals'
      });
    }

    // Add divider and People management for admin users
    if (isAdmin) {
      items.push(
        {
          id: 'divider-admin',
          label: '',
          icon: <></>,
          path: undefined
        },
        {
          id: 'people',
          label: 'People',
          icon: <PeopleIcon />,
          path: '/app/people'
        }
      );
    }

    return items;
  };

  const renderNavItem = (item: SidebarItem, level = 0) => {
    // Handle divider items
    if (item.id.startsWith('divider-')) {
      return <Divider key={item.id} sx={{ my: 1 }} />;
    }

    const isActive = location.pathname === item.path;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <Box
            onClick={(e) => {
              if (hasChildren) {
                handleExpand(item.id);
              } else if (item.path) {
                navigate(item.path);
              } else if (item.onClick) {
                item.onClick();
              }
            }}
            sx={{
              minHeight: 48,
              px: 2.5,
              pl: level > 0 ? 4 : 2.5,
              backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05)
              }
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: open ? 3 : 'auto',
                justifyContent: 'center',
                color: isActive ? theme.palette.primary.main : 'inherit'
              }}
            >
              {item.icon}
            </ListItemIcon>
            
            {open && (
              <>
                <ListItemText 
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: level > 0 ? '0.875rem' : '1rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? theme.palette.primary.main : 'inherit'
                  }}
                />
                
                {item.badge && (
                  <Chip
                    label={item.badge}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.75rem',
                      backgroundColor: theme.palette.primary.main,
                      color: 'white'
                    }}
                  />
                )}
                
                {hasChildren && (
                  isExpanded ? <ExpandLess /> : <ExpandMore />
                )}
              </>
            )}
          </Box>
        </ListItem>
        
        {hasChildren && open && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderNavItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const navigationItems = getNavigationItems();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden',
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`
        },
      }}
    >
      {/* Header with toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          px: open ? 2 : 1,
          py: 2,
          minHeight: 64
        }}
      >
        {open && (
          <Typography variant="h6" noWrap component="div">
            {mode === 'player' ? 'NLJ Player' : 'NLJ Editor'}
          </Typography>
        )}
        
        <IconButton onClick={onToggle}>
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <List sx={{ flexGrow: 1, py: 1 }}>
        {navigationItems.map(item => renderNavItem(item))}
      </List>

      <Divider />

      {/* Theme Controls Section */}
      <Box sx={{ p: open ? 2 : 1, display: 'flex', justifyContent: 'center' }}>
        <ThemeToggle />
      </Box>

      <Divider />

      {/* User Profile Section */}
      <Box sx={{ p: open ? 2 : 1 }}>
        {user && (
          <>
            {open && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
                <Avatar sx={{ width: 28, height: 28 }}>
                  <PersonIcon sx={{ fontSize: '1rem' }} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, noWrap: true }}>
                    {user.full_name || user.username}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', textTransform: 'capitalize', color: 'text.secondary' }}>
                    {user.role}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={handleProfile} sx={{ p: 0.5 }}>
                  <SettingsIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
                <IconButton size="small" onClick={handleLogout} sx={{ p: 0.5 }}>
                  <LogoutIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Box>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default SidebarNavigation;