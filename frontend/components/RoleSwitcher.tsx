/**
 * Role Switcher Component
 * Allows developers and admins to view the app from different role perspectives
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Box,
  Typography,
  Divider,
  useTheme
} from '@mui/material';
import {
  SwapHoriz as SwapIcon,
  Person as PlayerIcon,
  School as LearnerIcon,
  Create as CreatorIcon,
  RateReview as ReviewerIcon,
  CheckCircle as ApproverIcon,
  AdminPanelSettings as AdminIcon,
  Visibility as ViewAsIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../client/auth';

type UserRole = 'PLAYER' | 'LEARNER' | 'CREATOR' | 'REVIEWER' | 'APPROVER' | 'ADMIN';
type JobCode = 'DP' | 'GM' | 'SM' | 'SP' | 'FM' | 'FI' | 'BM' | 'BD' | 'IM';

interface RoleOption {
  role: UserRole;
  label: string;
  icon: React.ReactElement;
  color: string;
  description: string;
}

interface JobCodeOption {
  code: JobCode;
  label: string;
  description: string;
  color: string;
}

const roleOptions: RoleOption[] = [
  {
    role: 'PLAYER',
    label: 'Player',
    icon: <PlayerIcon />,
    color: '#64748b',
    description: 'Basic content access'
  },
  {
    role: 'LEARNER',
    label: 'Learner',
    icon: <LearnerIcon />,
    color: '#059669',
    description: 'Learning-focused dashboard'
  },
  {
    role: 'CREATOR',
    label: 'Creator',
    icon: <CreatorIcon />,
    color: '#dc2626',
    description: 'Content creation tools'
  },
  {
    role: 'REVIEWER',
    label: 'Reviewer',
    icon: <ReviewerIcon />,
    color: '#d97706',
    description: 'Content review and approval'
  },
  {
    role: 'APPROVER',
    label: 'Approver',
    icon: <ApproverIcon />,
    color: '#7c3aed',
    description: 'Final approval authority'
  },
  {
    role: 'ADMIN',
    label: 'Administrator',
    icon: <AdminIcon />,
    color: '#1e40af',
    description: 'Full system access'
  }
];

const jobCodeOptions: JobCodeOption[] = [
  { code: 'DP', label: 'Dealer Principal', description: 'Operations leadership', color: '#1e40af' },
  { code: 'GM', label: 'General Manager', description: 'Day-to-day operations', color: '#7c3aed' },
  { code: 'SM', label: 'Sales Manager', description: 'Sales team leadership', color: '#dc2626' },
  { code: 'SP', label: 'Sales Person', description: 'Frontline sales', color: '#059669' },
  { code: 'FM', label: 'Finance Manager', description: 'F&I department management', color: '#d97706' },
  { code: 'FI', label: 'Finance Advisor', description: 'Customer financing', color: '#ca8a04' },
  { code: 'BM', label: 'BDC Manager', description: 'Lead management', color: '#0891b2' },
  { code: 'BD', label: 'BDC Representative', description: 'Lead response', color: '#0284c7' },
  { code: 'IM', label: 'Internet Sales Manager', description: 'Online sales', color: '#7c2d12' }
];

interface RoleSwitcherProps {
  compact?: boolean;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ compact = false }) => {
  const { user } = useAuth();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [currentViewRole, setCurrentViewRole] = useState<UserRole | null>(null);
  const [currentJobCode, setCurrentJobCode] = useState<JobCode | null>(null);
  const [activeTab, setActiveTab] = useState<'app-role' | 'job-code'>('app-role');
  
  const open = Boolean(anchorEl);
  
  // Get theme-aware colors for roles
  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'PLAYER': return theme.palette.text.secondary;
      case 'LEARNER': return theme.palette.success.main;
      case 'CREATOR': return theme.palette.error.main;
      case 'REVIEWER': return theme.palette.warning.main;
      case 'APPROVER': return theme.palette.info.main;
      case 'ADMIN': return theme.palette.primary.main;
      default: return theme.palette.text.primary;
    }
  };
  
  // Get theme-aware colors for job codes
  const getJobCodeColor = (index: number) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.error.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.info.main,
    ];
    return colors[index % colors.length];
  };
  
  // Initialize state from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('viewAsRole') as UserRole;
      const storedJobCode = localStorage.getItem('viewAsJobCode') as JobCode;
      
      if (storedRole) {
        setCurrentViewRole(storedRole);
      }
      if (storedJobCode) {
        setCurrentJobCode(storedJobCode);
      }
    }
  }, []);
  
  // Only show for admins or in development mode
  if (!user || (user.role !== 'ADMIN' && process.env.NODE_ENV !== 'development')) {
    return null;
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRoleSelect = (role: UserRole) => {
    try {
      setCurrentViewRole(role);
      // Store in localStorage for persistence across page reloads
      if (typeof window !== 'undefined') {
        console.log('Storing role in localStorage:', role);
        localStorage.setItem('viewAsRole', role);
        
        // Set default job code based on app role
        const defaultJobCodes = {
          'LEARNER': 'SP',
          'CREATOR': 'SM',
          'REVIEWER': 'GM',
          'ADMIN': 'DP'
        };
        if (defaultJobCodes[role]) {
          localStorage.setItem('viewAsJobCode', defaultJobCodes[role]);
        }
      }
      
      handleClose();
      
      // Force a page reload to apply the role change
      console.log('Reloading page with new role:', role);
      window.location.reload();
    } catch (error) {
      console.error('Error in handleRoleSelect:', error);
      handleClose();
    }
  };

  const handleJobCodeSelect = (jobCode: JobCode) => {
    try {
      setCurrentJobCode(jobCode);
      // Store in localStorage for persistence across page reloads
      if (typeof window !== 'undefined') {
        console.log('Storing job code in localStorage:', jobCode);
        localStorage.setItem('viewAsJobCode', jobCode);
      }
      
      handleClose();
      
      // Force a page reload to apply the job code change
      console.log('Reloading page with new job code:', jobCode);
      window.location.reload();
    } catch (error) {
      console.error('Error in handleJobCodeSelect:', error);
      handleClose();
    }
  };

  const handleResetRole = () => {
    try {
      setCurrentViewRole(null);
      setCurrentJobCode(null);
      if (typeof window !== 'undefined') {
        console.log('Removing role and job code from localStorage');
        localStorage.removeItem('viewAsRole');
        localStorage.removeItem('viewAsJobCode');
      }
      handleClose();
      window.location.reload();
    } catch (error) {
      console.error('Error in handleResetRole:', error);
      handleClose();
    }
  };

  const getStoredRole = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('viewAsRole') as UserRole;
  };

  const getStoredJobCode = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('viewAsJobCode') as JobCode;
  };

  const effectiveRole = currentViewRole || getStoredRole() || user.role;
  const effectiveJobCode = currentJobCode || getStoredJobCode();
  const currentRoleOption = roleOptions.find(option => option.role === effectiveRole);
  const currentJobCodeOption = jobCodeOptions.find(option => option.code === effectiveJobCode);

  if (compact) {
    return (
      <Box>
        <Chip
          icon={<ViewAsIcon />}
          label={`${currentRoleOption?.label || user.role}${effectiveJobCode ? ` (${effectiveJobCode})` : ''}`}
          onClick={handleClick}
          color="secondary"
          variant="outlined"
          size="small"
          sx={{ 
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'action.hover' }
          }}
        />
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          PaperProps={{
            sx: { minWidth: 250 }
          }}
        >
          <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
            App Roles (Dev Mode)
          </Typography>
          {roleOptions.map((option) => (
            <MenuItem
              key={option.role}
              onClick={() => handleRoleSelect(option.role)}
              selected={effectiveRole === option.role}
            >
              <ListItemIcon sx={{ color: getRoleColor(option.role) }}>
                {option.icon}
              </ListItemIcon>
              <ListItemText 
                primary={option.label}
                secondary={option.description}
              />
            </MenuItem>
          ))}
          
          <Divider sx={{ my: 1 }} />
          
          <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
            Job Codes
          </Typography>
          {jobCodeOptions.map((option) => (
            <MenuItem
              key={option.code}
              onClick={() => handleJobCodeSelect(option.code)}
              selected={effectiveJobCode === option.code}
              sx={{ pl: 3 }}
            >
              <ListItemText 
                primary={`${option.code} - ${option.label}`}
                secondary={option.description}
                primaryTypographyProps={{ fontSize: '0.875rem' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </MenuItem>
          ))}
          
          {(currentViewRole || currentJobCode) && (
            <>
              <Divider sx={{ my: 1 }} />
              <MenuItem onClick={handleResetRole}>
                <ListItemIcon>
                  <SwapIcon />
                </ListItemIcon>
                <ListItemText primary="Reset All Overrides" />
              </MenuItem>
            </>
          )}
        </Menu>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        variant="outlined"
        startIcon={<ViewAsIcon />}
        endIcon={(currentViewRole || currentJobCode) ? <Chip label="Active" size="small" color="warning" /> : null}
        onClick={handleClick}
        sx={{ 
          textTransform: 'none',
          borderColor: (currentViewRole || currentJobCode) ? 'warning.main' : 'divider'
        }}
      >
        {currentRoleOption?.label || user.role}{effectiveJobCode ? ` (${effectiveJobCode})` : ''}
      </Button>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 300 }
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Switch Role Perspective
          </Typography>
          <Typography variant="caption" color="text.secondary">
            View the app from different user role perspectives (Development Mode)
          </Typography>
        </Box>
        
        {roleOptions.map((option) => (
          <MenuItem
            key={option.role}
            onClick={() => handleRoleSelect(option.role)}
            selected={effectiveRole === option.role}
            sx={{ py: 1.5 }}
          >
            <ListItemIcon sx={{ color: getRoleColor(option.role) }}>
              {option.icon}
            </ListItemIcon>
            <ListItemText 
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {option.label}
                  {effectiveRole === option.role && (
                    <Chip label="Current" size="small" color="primary" />
                  )}
                </Box>
              }
              secondary={option.description}
            />
          </MenuItem>
        ))}
        
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1 }} />
        
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Job Code Perspective
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Switch between different job roles to see relevant content
          </Typography>
        </Box>
        
        {jobCodeOptions.map((option) => (
          <MenuItem
            key={option.code}
            onClick={() => handleJobCodeSelect(option.code)}
            selected={effectiveJobCode === option.code}
            sx={{ py: 1.5 }}
          >
            <ListItemText 
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {`${option.code} - ${option.label}`}
                  {effectiveJobCode === option.code && (
                    <Chip label="Current" size="small" color="secondary" />
                  )}
                </Box>
              }
              secondary={option.description}
            />
          </MenuItem>
        ))}
        
        {(currentViewRole || currentJobCode) && (
          <>
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1 }} />
            <MenuItem onClick={handleResetRole} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <SwapIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Reset All Overrides"
                secondary={`Return to your original ${user.role} role`}
              />
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};