/**
 * Settings Menu Component
 * Provides theme toggle, role switching, and other user preferences
 */

import React, { useState, useEffect } from 'react';
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
  SwapHoriz as SwapIcon,
  Person as PersonIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  Visibility as ViewAsIcon,
  School as LearnerIcon,
  Create as CreatorIcon,
  RateReview as ReviewerIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

type UserRole = 'PLAYER' | 'LEARNER' | 'CREATOR' | 'REVIEWER' | 'APPROVER' | 'ADMIN';
type JobCode = 'DP' | 'GM' | 'SM' | 'SP' | 'FM' | 'FI' | 'BM' | 'BD' | 'IM';

const roleOptions = [
  { role: 'LEARNER', label: 'Learner', icon: <LearnerIcon /> },
  { role: 'CREATOR', label: 'Creator', icon: <CreatorIcon /> },
  { role: 'REVIEWER', label: 'Reviewer', icon: <ReviewerIcon /> },
  { role: 'ADMIN', label: 'Administrator', icon: <AdminIcon /> }
];

const jobCodeOptions = [
  { code: 'DP', label: 'Dealer Principal' },
  { code: 'GM', label: 'General Manager' },
  { code: 'SM', label: 'Sales Manager' },
  { code: 'SP', label: 'Sales Person' },
  { code: 'FM', label: 'Finance Manager' },
  { code: 'FI', label: 'Finance Advisor' },
  { code: 'BM', label: 'BDC Manager' },
  { code: 'BD', label: 'BDC Representative' },
  { code: 'IM', label: 'Internet Sales Manager' }
];

interface SettingsMenuProps {
  compact?: boolean;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ compact = false }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [appRoleAnchorEl, setAppRoleAnchorEl] = useState<null | HTMLElement>(null);
  const [jobCodeAnchorEl, setJobCodeAnchorEl] = useState<null | HTMLElement>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentJobCode, setCurrentJobCode] = useState<JobCode | null>(null);
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const muiTheme = useMuiTheme();
  
  const open = Boolean(anchorEl);
  
  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('viewAsRole') as UserRole;
      const storedJobCode = localStorage.getItem('viewAsJobCode') as JobCode;
      setCurrentRole(storedRole);
      setCurrentJobCode(storedJobCode);
    }
  }, []);
  
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setAppRoleAnchorEl(null);
    setJobCodeAnchorEl(null);
  };

  const handleThemeToggle = () => {
    toggleTheme();
    // Don't close menu so user can see the change
  };

  const handleAppRoleHover = (event: React.MouseEvent<HTMLElement>) => {
    setAppRoleAnchorEl(event.currentTarget);
    setJobCodeAnchorEl(null); // Close job code menu if open
  };

  const handleJobCodeHover = (event: React.MouseEvent<HTMLElement>) => {
    setJobCodeAnchorEl(event.currentTarget);
    setAppRoleAnchorEl(null); // Close app role menu if open
  };

  const handleNestedMenuClose = () => {
    setAppRoleAnchorEl(null);
    setJobCodeAnchorEl(null);
  };

  const handleRoleSelect = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem('viewAsRole', role);
    
    // Set default job code based on app role
    const defaultJobCodes = {
      'LEARNER': 'SP',
      'CREATOR': 'SM',
      'REVIEWER': 'GM',
      'ADMIN': 'DP'
    };
    if (defaultJobCodes[role]) {
      const jobCode = defaultJobCodes[role] as JobCode;
      setCurrentJobCode(jobCode);
      localStorage.setItem('viewAsJobCode', jobCode);
    }
    
    window.location.reload();
  };

  const handleJobCodeSelect = (jobCode: JobCode) => {
    setCurrentJobCode(jobCode);
    localStorage.setItem('viewAsJobCode', jobCode);
    window.location.reload();
  };

  const handleResetOverrides = () => {
    setCurrentRole(null);
    setCurrentJobCode(null);
    localStorage.removeItem('viewAsRole');
    localStorage.removeItem('viewAsJobCode');
    handleClose();
    window.location.reload();
  };

  const hasOverrides = currentRole || currentJobCode;

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

        {/* App Role & Job Code Switcher - Only for admins or dev mode */}
        {user && (user.role === 'ADMIN' || process.env.NODE_ENV === 'development') && (
          <>
            {/* App Role Selection */}
            <MenuItem 
              onMouseEnter={handleAppRoleHover}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <PersonIcon />
              </ListItemIcon>
              <ListItemText 
                primary="App Role"
                secondary={currentRole ? `Viewing as: ${roleOptions.find(r => r.role === currentRole)?.label}` : 'Select app role for testing'}
              />
            </MenuItem>

            {/* Job Code Selection */}
            <MenuItem 
              onMouseEnter={handleJobCodeHover}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <ViewAsIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Job Code"
                secondary={currentJobCode ? `Viewing as: ${jobCodeOptions.find(j => j.code === currentJobCode)?.label} (${currentJobCode})` : 'Select job code for content filtering'}
              />
            </MenuItem>

            {/* Reset Option */}
            {hasOverrides && (
              <MenuItem onClick={handleResetOverrides} sx={{ py: 1.5 }}>
                <ListItemIcon>
                  <SwapIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Reset All Overrides"
                  secondary={`Return to your ${user.role} role`}
                />
              </MenuItem>
            )}

            <Divider />
          </>
        )}

        {/* Nested App Role Menu */}
        <Menu
          anchorEl={appRoleAnchorEl}
          open={Boolean(appRoleAnchorEl)}
          onClose={handleNestedMenuClose}
          anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
          transformOrigin={{ horizontal: 'left', vertical: 'top' }}
          onMouseLeave={handleNestedMenuClose}
        >
          {roleOptions.map((option) => (
            <MenuItem
              key={option.role}
              onClick={() => handleRoleSelect(option.role as UserRole)}
              selected={currentRole === option.role}
              sx={{ py: 1 }}
            >
              <ListItemIcon>
                {option.icon}
              </ListItemIcon>
              <ListItemText primary={option.label} />
            </MenuItem>
          ))}
        </Menu>

        {/* Nested Job Code Menu */}
        <Menu
          anchorEl={jobCodeAnchorEl}
          open={Boolean(jobCodeAnchorEl)}
          onClose={handleNestedMenuClose}
          anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
          transformOrigin={{ horizontal: 'left', vertical: 'top' }}
          onMouseLeave={handleNestedMenuClose}
        >
          {jobCodeOptions.map((option) => (
            <MenuItem
              key={option.code}
              onClick={() => handleJobCodeSelect(option.code as JobCode)}
              selected={currentJobCode === option.code}
              sx={{ py: 1 }}
            >
              <ListItemText primary={`${option.code} - ${option.label}`} />
            </MenuItem>
          ))}
        </Menu>

        {/* Future settings can go here */}
        <MenuItem disabled>
          <ListItemIcon>
            <PersonIcon />
          </ListItemIcon>
          <ListItemText 
            primary="Profile Settings"
            secondary="Coming soon"
          />
        </MenuItem>
      </Menu>
    </>
  );
};