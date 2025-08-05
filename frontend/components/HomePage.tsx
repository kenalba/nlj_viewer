/**
 * Modern Home Dashboard
 * Quick actions, activity feed, and usage metrics
 */

import React, { useState, useEffect } from 'react';
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
  Paper,
  CircularProgress,
  Alert
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
  Assignment as SurveyIcon,
  AutoAwesome as GenerateIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CreateActivityModal } from '../shared/CreateActivityModal';
import type { ActivityTemplate } from '../utils/activityTemplates';
import { canEditContent, canReviewContent, canManageUsers } from '../utils/permissions';
import { contentApi, type ContentItem } from '../api/content';

interface PlatformStats {
  total: number;
  by_type: Record<string, number>;
  by_state: Record<string, number>;
  recent_count: number;
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<ContentItem[]>([]);
  const [popularActivities, setPopularActivities] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canEditContent(user);
  const canReview = canReviewContent(user);
  const isAdmin = canManageUsers(user);

  // Load platform data on component mount
  useEffect(() => {
    const loadPlatformData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load platform statistics
        const stats = await contentApi.getStats();
        setPlatformStats(stats);

        // Load recent activities (last 20 items)
        const recentResponse = await contentApi.list({ 
          sort_by: 'created_at', 
          sort_order: 'desc', 
          size: 20 
        });
        setRecentActivities(recentResponse.items);

        // Load popular activities (by completion count)
        const popularResponse = await contentApi.list({ 
          sort_by: 'completion_count', 
          sort_order: 'desc', 
          size: 4,
          state: 'published' 
        });
        setPopularActivities(popularResponse.items);

      } catch (err) {
        console.error('Failed to load platform data:', err);
        setError('Failed to load dashboard data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    loadPlatformData();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'training': return <PlayIcon />;
      case 'survey': return <SurveyIcon />;
      case 'game': return <GamesIcon />;
      case 'assessment': return <AssessmentIcon />;
      default: return <QuizIcon />;
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'published': return 'success';
      case 'approved': return 'success';
      case 'submitted': 
      case 'in_review': return 'warning';
      case 'rejected': return 'error';
      case 'draft': return 'default';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  const handleActivityCreated = (template: ActivityTemplate, name: string, description?: string) => {
    // For now, navigate to the flow editor - in a real implementation, 
    // this would create the activity in the database first
    navigate('/app/flow/new', { 
      state: { 
        template: template.template, 
        name, 
        description 
      } 
    });
  };

  return (
    <Box p={3}>
      {/* Welcome Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Welcome back, {user?.full_name || user?.username}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isAdmin 
            ? 'Manage users, oversee platform operations, and monitor content performance'
            : canReview
            ? 'Review content submissions, approve activities, and maintain quality standards'  
            : canEdit
            ? 'Create, manage, and publish learning activities with AI-powered tools'
            : 'Discover and complete interactive learning activities tailored for you'
          }
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
                      onClick={() => setCreateModalOpen(true)}
                      sx={{ flex: 1, minWidth: 120 }}
                    >
                      Create Activity
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<GenerateIcon />}
                      onClick={() => navigate('/app/generate')}
                      sx={{ flex: 1, minWidth: 120 }}
                    >
                      Generate Content
                    </Button>
                    {canReview && (
                      <Button
                        variant="outlined"
                        startIcon={<AssessmentIcon />}
                        onClick={() => navigate('/app/approvals')}
                        sx={{ flex: 1, minWidth: 120 }}
                      >
                        Review Queue
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outlined"
                        startIcon={<PeopleIcon />}
                        onClick={() => navigate('/app/people')}
                        sx={{ flex: 1, minWidth: 120 }}
                      >
                        Manage Users
                      </Button>
                    )}
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
              {loading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : platformStats ? (
                <>
                  <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
                    <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                      <Typography variant="h4" color="primary">{platformStats.total}</Typography>
                      <Typography variant="caption">Total Activities</Typography>
                    </Box>
                    <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                      <Typography variant="h4" color="success.main">{platformStats.by_type.training || 0}</Typography>
                      <Typography variant="caption">Training</Typography>
                    </Box>
                    <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                      <Typography variant="h4" color="info.main">{platformStats.by_type.survey || 0}</Typography>
                      <Typography variant="caption">Surveys</Typography>
                    </Box>
                    <Box textAlign="center" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, flex: 1, minWidth: 100 }}>
                      <Typography variant="h4" color="warning.main">{platformStats.by_type.game || 0}</Typography>
                      <Typography variant="caption">Games</Typography>
                    </Box>
                  </Box>
                  <Box display="flex" justifyContent="space-around" gap={2}>
                    <Box textAlign="center">
                      <Typography variant="h5" color="primary">{platformStats.by_type.assessment || 0}</Typography>
                      <Typography variant="caption">Assessments</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h5" color="success.main">{platformStats.recent_count}</Typography>
                      <Typography variant="caption">Recent (7 days)</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h5" color="info.main">{platformStats.by_state.published || 0}</Typography>
                      <Typography variant="caption">Published</Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No metrics available
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Popular Activities */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingIcon color="primary" />
                Popular Activities
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : popularActivities.length > 0 ? (
                <Box display="flex" flexDirection="column" gap={1}>
                  {popularActivities.map((activity) => (
                    <Box key={activity.id} display="flex" alignItems="center" justifyContent="space-between" p={1} sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{activity.title}</Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PeopleIcon fontSize="small" color="action" />
                          <Typography variant="caption">{activity.completion_count} completions</Typography>
                          <Typography variant="caption">👁 {activity.view_count} views</Typography>
                        </Box>
                      </Box>
                      <IconButton 
                        size="small" 
                        onClick={() => navigate(`/app/activities/${activity.id}`)}
                        title="View activity details"
                      >
                        <ViewIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No popular activities found
                </Typography>
              )}
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
                {loading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <CircularProgress size={24} />
                  </Box>
                ) : recentActivities.length > 0 ? (
                  recentActivities.slice(0, 8).map((activity) => (
                    <Box key={activity.id} display="flex" alignItems="center" gap={2} p={2} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Avatar sx={{ bgcolor: 'primary.light' }}>
                        {getActivityIcon(activity.content_type)}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="body1" fontWeight={500}>{activity.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Created {new Date(activity.created_at).toLocaleDateString()}
                          {activity.created_by && ` • by ${activity.created_by}`}
                        </Typography>
                        <Chip 
                          label={activity.state.replace('_', ' ')} 
                          size="small" 
                          color={getStatusColor(activity.state) as any}
                          sx={{ mt: 0.5, textTransform: 'capitalize' }}
                        />
                      </Box>
                      <IconButton 
                        onClick={() => navigate(`/app/activities/${activity.id}`)}
                        title="View activity details"
                      >
                        <ViewIcon />
                      </IconButton>
                      {canReview && (activity.state === 'submitted' || activity.state === 'in_review') && (
                        <IconButton 
                          onClick={() => navigate(`/app/activities/${activity.id}?review_mode=true`)}
                          title="Review activity"
                        >
                          <AssessmentIcon />
                        </IconButton>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" p={3}>
                    No recent activities found
                  </Typography>
                )}
              </Box>
              <Box pt={2}>
                <Button 
                  fullWidth 
                  onClick={() => navigate(canReview ? '/app/approvals' : '/app/activities')}
                >
                  {canReview ? 'View All Reviews' : 'View All Activities'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Create Activity Modal */}
      <CreateActivityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onActivityCreated={handleActivityCreated}
      />
    </Box>
  );
};

export default HomePage;