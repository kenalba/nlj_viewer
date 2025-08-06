/**
 * User Detail Page
 * Comprehensive user profile view with placeholder sections for future features
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Skeleton,
  Alert,
  IconButton,
  Breadcrumbs,
  Link,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
  PlayArrow as PlayIcon,
  Quiz as QuizIcon,
  ThumbUp as ThumbUpIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../api/users';
import type { User } from '../api/auth';
import { canEditUser } from '../utils/permissions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const UserDetailPage: React.FC = () => {
  // Extract ID from URL path since we're not using proper route parameters
  const pathSegments = window.location.pathname.split('/');
  const peopleIndex = pathSegments.indexOf('people');
  const userId = peopleIndex !== -1 ? pathSegments[peopleIndex + 1] : null;
  
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  // Debug logging
  console.log('UserDetailPage rendered with ID:', userId);
  console.log('Current pathname:', window.location.pathname);
  console.log('Path segments:', pathSegments);
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState(0);

  const canEdit = canEditUser(currentUser, { id: userId } as User);

  // Fetch user data
  const fetchUser = useCallback(async () => {
    if (!userId) {
      setError('No user ID provided');
      setLoading(false);
      return;
    }
    
    console.log('🔍 Fetching user with ID:', userId);
    
    try {
      setLoading(true);
      setError(null);
      const userData = await usersAPI.getUser(userId);
      console.log('✅ User data loaded:', userData);
      setUser(userData);
    } catch (err: any) {
      console.error('❌ Failed to fetch user:', err);
      console.error('Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      
      if (err.response?.status === 404) {
        setError('User not found');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this user');
      } else {
        setError(`Failed to load user data: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  }, []);

  const handleBack = useCallback(() => {
    navigate('/app/people');
  }, [navigate]);

  const handleEdit = useCallback(() => {
    // TODO: Open edit user modal or navigate to edit page
    console.log('Edit user:', user);
  }, [user]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'approver': return 'warning';
      case 'reviewer': return 'info';
      case 'creator': return 'default';
      default: return 'default';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" width="100%" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="text" sx={{ fontSize: '2rem', mb: 1 }} />
        <Skeleton variant="text" sx={{ fontSize: '1rem', mb: 2 }} />
        <Grid container spacing={2}>
          {[...Array(4)].map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box sx={{ p: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back to People
        </Button>
        <Alert severity="error">
          {error || 'User not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Navigation */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs>
          <Link
            component="button"
            variant="body2"
            onClick={handleBack}
            sx={{ textDecoration: 'none' }}
          >
            People
          </Link>
          <Typography variant="body2" color="text.primary">
            {user.full_name || user.username}
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* User Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <Avatar 
            sx={{ 
              width: 80, 
              height: 80, 
              bgcolor: 'primary.main',
              fontSize: '2rem'
            }}
          >
            {getInitials(user.full_name || user.username)}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h4">
                  {user.full_name || user.username}
                </Typography>
                <Chip
                  label={user.is_active ? 'Active' : 'Inactive'}
                  color={user.is_active ? 'success' : 'default'}
                  variant={user.is_active ? 'filled' : 'outlined'}
                />
              </Box>
              
              {canEdit && (
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<BlockIcon />}
                    onClick={() => {
                      // TODO: Implement disable/enable user functionality
                      console.log('Toggle user status:', user);
                    }}
                    size="small"
                  >
                    {user.is_active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => {
                      // TODO: Open user settings/permissions modal
                      console.log('Manage permissions:', user);
                    }}
                    size="small"
                  >
                    Permissions
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={handleEdit}
                    size="small"
                  >
                    Edit User
                  </Button>
                </Stack>
              )}
            </Box>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              @{user.username} • {user.email}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                color={getRoleColor(user.role)}
                size="small"
                variant="outlined"
                icon={<BadgeIcon />}
              />
              <Typography variant="body2" color="text.secondary">
                Joined {new Date(user.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Overview" icon={<PersonIcon />} />
          <Tab label="Activity" icon={<PlayIcon />} />
          <Tab label="Content" icon={<AssignmentIcon />} />
          <Tab label="Analytics" icon={<AnalyticsIcon />} />
          <Tab label="History" icon={<HistoryIcon />} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={currentTab} index={0}>
        {/* Overview Tab */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon />
                  Profile Information
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <EmailIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Email Address"
                      secondary={user.email}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <BadgeIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Role"
                      secondary={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ScheduleIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Member Since"
                      secondary={new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AnalyticsIcon />
                  Quick Stats
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Placeholder for user statistics and metrics
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Activities Completed</Typography>
                  <Typography variant="body2" fontWeight="bold">-</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Content Created</Typography>
                  <Typography variant="body2" fontWeight="bold">-</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Last Active</Typography>
                  <Typography variant="body2" fontWeight="bold">-</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        {/* Activity Tab */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlayIcon />
              Activity History
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Track user's learning progress, completed activities, and engagement metrics.
            </Typography>
            <Alert severity="info">
              Activity tracking features will be implemented in a future update.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        {/* Content Tab */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon />
              Content Created
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              View all content items created by this user, including drafts, published, and archived content.
            </Typography>
            <Alert severity="info">
              Content management features will be implemented in a future update.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        {/* Analytics Tab */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon />
              Performance Analytics
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Detailed analytics on user performance, engagement patterns, and learning outcomes.
            </Typography>
            <Alert severity="info">
              Advanced analytics features will be implemented in a future update.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={4}>
        {/* History Tab */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon />
              Account History
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Audit trail of account changes, login history, and administrative actions.
            </Typography>
            <Alert severity="info">
              Account history features will be implemented in a future update.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>
    </Box>
  );
};