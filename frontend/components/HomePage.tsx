/**
 * Modern Home Dashboard
 * Quick actions, activity feed, and usage metrics
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  LinearProgress,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  NotificationsActive as NotificationIcon,
  Quiz as QuizIcon,
  Games as GamesIcon,
  Assignment as SurveyIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role);
  const canReview = user?.role && ['reviewer', 'approver', 'admin'].includes(user.role);

  // Mock data - would come from API in real implementation
  const usageMetrics = {
    totalActivities: 147,
    activeUsers: 342,
    completionsThisWeek: 1234,
    averageScore: 87.5
  };

  const recentActivity = [
    { id: 1, title: 'Sales Training Module 3', type: 'training', author: 'John Smith', status: 'pending_review', date: '2 hours ago' },
    { id: 2, title: 'Customer Satisfaction Survey', type: 'survey', author: 'Sarah Jones', status: 'published', date: '4 hours ago' },
    { id: 3, title: 'Product Knowledge Quiz', type: 'game', author: 'Mike Chen', status: 'draft', date: '1 day ago' },
    { id: 4, title: 'Leadership Assessment', type: 'assessment', author: 'Lisa Park', status: 'needs_revision', date: '2 days ago' }
  ];

  const popularActivities = [
    { id: 1, title: 'Onboarding Fundamentals', completions: 234, rating: 4.8 },
    { id: 2, title: 'Sales Techniques Workshop', completions: 189, rating: 4.6 },
    { id: 3, title: 'Safety Protocol Training', completions: 156, rating: 4.9 },
    { id: 4, title: 'Customer Service Excellence', completions: 142, rating: 4.7 }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'training': return <PlayIcon />;
      case 'survey': return <SurveyIcon />;
      case 'game': return <GamesIcon />;
      case 'assessment': return <AssessmentIcon />;
      default: return <QuizIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success';
      case 'pending_review': return 'warning';
      case 'needs_revision': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box p={3}>
      {/* Welcome Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Welcome back, {user?.full_name || user?.username}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {canEdit ? 'Create, manage, and track your learning activities' : 'Explore and complete learning activities'}
        </Typography>
      </Box>

      {/* Simple 2-Column Flexbox Layout */}
      <Box display="flex" gap={3} sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Left Column */}
        <Box flex={1} display="flex" flexDirection="column" gap={3}>
          {/* Quick Actions */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddIcon color="primary" />
                Quick Actions
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={() => navigate('/app/activities')}
                  sx={{ flex: 1, minWidth: 120 }}
                >
                  Browse Activities
                </Button>
                {canEdit && (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/app/flow/new')}
                      sx={{ flex: 1, minWidth: 120 }}
                    >
                      Create Activity
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<AssessmentIcon />}
                      onClick={() => {/* TODO: Navigate to analytics */}}
                      sx={{ flex: 1, minWidth: 120 }}
                    >
                      View Analytics
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PeopleIcon />}
                      onClick={() => {/* TODO: Navigate to user management */}}
                      sx={{ flex: 1, minWidth: 120 }}
                    >
                      Manage Users
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Platform Metrics */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingIcon color="primary" />
                Platform Metrics
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
                <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                  <Typography variant="h4" color="primary">{usageMetrics.totalActivities}</Typography>
                  <Typography variant="caption">Total Activities</Typography>
                </Box>
                <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                  <Typography variant="h4" color="success.main">{usageMetrics.activeUsers}</Typography>
                  <Typography variant="caption">Active Users</Typography>
                </Box>
                <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                  <Typography variant="h4" color="info.main">{usageMetrics.completionsThisWeek}</Typography>
                  <Typography variant="caption">This Week</Typography>
                </Box>
                <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                  <Typography variant="h4" color="warning.main">{usageMetrics.averageScore}%</Typography>
                  <Typography variant="caption">Avg Score</Typography>
                </Box>
              </Box>
              <Box display="flex" justifyContent="space-around" gap={2}>
                <Box textAlign="center">
                  <Typography variant="h5" color="primary">85%</Typography>
                  <Typography variant="caption">Completion Rate</Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="h5" color="success.main">4.2</Typography>
                  <Typography variant="caption">Avg Rating</Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="h5" color="info.main">42</Typography>
                  <Typography variant="caption">New Users</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Popular Activities */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingIcon color="primary" />
                Popular Activities
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                {popularActivities.map((activity) => (
                  <Box key={activity.id} display="flex" alignItems="center" justifyContent="space-between" p={1} sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{activity.title}</Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PeopleIcon fontSize="small" color="action" />
                        <Typography variant="caption">{activity.completions} completions</Typography>
                        <Typography variant="caption">★ {activity.rating}</Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={() => {/* TODO: Navigate to activity */}}>
                      <PlayIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right Column - Review Queue */}
        <Box flex={1}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationIcon color="primary" />
                {canReview ? 'Review Queue' : 'Recent Activity'}
              </Typography>
              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {[...recentActivity, ...recentActivity, ...recentActivity].map((activity, index) => (
                  <Box key={`${activity.id}-${index}`} display="flex" alignItems="center" gap={2} p={2} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      {getActivityIcon(activity.type)}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="body1" fontWeight={500}>{activity.title}</Typography>
                      <Typography variant="body2" color="text.secondary">by {activity.author} • {activity.date}</Typography>
                      <Chip 
                        label={activity.status.replace('_', ' ')} 
                        size="small" 
                        color={getStatusColor(activity.status) as any}
                        sx={{ mt: 0.5, textTransform: 'capitalize' }}
                      />
                    </Box>
                    {canReview && activity.status === 'pending_review' && (
                      <IconButton onClick={() => {/* TODO: Navigate to review */}}>
                        <ViewIcon />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>
              <Box pt={2}>
                <Button fullWidth onClick={() => {/* TODO: Show all activities */}}>
                  View All Reviews
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default HomePage;