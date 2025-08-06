/**
 * HomePage Component
 * Modern dashboard with Today's activities, What's Next, and newsfeed
 * Inspired by Figma design with card-based layout
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  IconButton,
  Divider,
  LinearProgress,
  Grid,
  useTheme,
  alpha
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingIcon,
  Notifications as NotificationIcon,
  Event as EventIcon,
  Person as PersonIcon,
  Quiz as QuizIcon,
  School as TrainingIcon,
  Games as GamesIcon,
  Assessment as AssessmentIcon,
  Announcement as AnnouncementIcon,
  Celebration as CelebrationIcon,
  Update as UpdateIcon,
  AccessTime as TimeIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DashboardProvider, useDashboard } from '../contexts/DashboardContext';
import { RoleSwitcher } from './RoleSwitcher';
import { useAuth } from '../contexts/AuthContext';

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'training': return <TrainingIcon />;
    case 'assessment': return <AssessmentIcon />;
    case 'game': return <GamesIcon />;
    case 'survey': return <QuizIcon />;
    default: return <PlayIcon />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'training': return '#1976d2';
    case 'assessment': return '#388e3c';
    case 'game': return '#f57c00';
    case 'survey': return '#7b1fa2';
    default: return '#1976d2';
  }
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'webinar': return <EventIcon />;
    case 'workshop': return <TrainingIcon />;
    case 'meeting': return <PersonIcon />;
    default: return <EventIcon />;
  }
};

const HomePageContent: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    dashboardType,
    metrics,
    recommendedActivities,
    upcomingEvents,
    recentActivity,
    showRoleSwitcher
  } = useDashboard();

  // Split recommended activities into Today (first 2-3) and What's Next (rest)
  const todayActivities = recommendedActivities.slice(0, 3);
  const nextActivities = recommendedActivities.slice(3, 6);

  // Mock news feed data
  const newsItems = [
    {
      id: '1',
      type: 'announcement',
      title: 'New Product Training Available',
      content: 'Learn about our latest electric vehicle lineup with interactive scenarios.',
      timestamp: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      author: 'Training Team'
    },
    {
      id: '2',
      type: 'achievement',
      title: 'Monthly Learning Champions',
      content: 'Congratulations to this month\'s top performers in completing training modules.',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      author: 'Learning & Development'
    },
    {
      id: '3',
      type: 'update',
      title: 'Platform Update v2.1',
      content: 'New features include improved mobile experience and enhanced analytics.',
      timestamp: new Date(Date.now() - 86400000 * 2), // 2 days ago
      author: 'System Admin'
    }
  ];

  const getNewsIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <AnnouncementIcon />;
      case 'achievement': return <CelebrationIcon />;
      case 'update': return <UpdateIcon />;
      default: return <NotificationIcon />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Welcome back, {user?.full_name || user?.username}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {dashboardType === 'learner' && 'Continue your learning journey'}
            {dashboardType === 'creator' && 'Ready to create amazing content'}
            {dashboardType === 'reviewer' && 'Review queue needs your attention'}
            {dashboardType === 'admin' && 'Platform overview and management'}
            {dashboardType === 'player' && 'Explore and learn'}
          </Typography>
        </Box>
        
      </Box>

      {/* Main Grid Layout */}
      <Grid container spacing={3}>
        {/* Left Column - Today & What's Next */}
        <Grid item xs={12} md={8}>
          {/* Today Section */}
          <Paper sx={{ mb: 3, p: 3, backgroundColor: theme.palette.background.paper }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <ScheduleIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Today
              </Typography>
              <Chip 
                label={`${todayActivities.length} activities`} 
                size="small" 
                sx={{ ml: 2, backgroundColor: alpha(theme.palette.primary.main, 0.1) }}
              />
            </Box>
            
            {todayActivities.length > 0 ? (
              <Grid container spacing={2}>
                {todayActivities.map((activity) => (
                  <Grid item xs={12} sm={6} md={4} key={activity.id}>
                    <Card 
                      sx={{ 
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: theme.shadows[4]
                        }
                      }}
                    >
                      <CardContent sx={{ flex: 1, pb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar 
                            sx={{ 
                              width: 32, 
                              height: 32, 
                              mr: 1.5,
                              backgroundColor: alpha(getActivityColor(activity.type), 0.1),
                              color: getActivityColor(activity.type)
                            }}
                          >
                            {getActivityIcon(activity.type)}
                          </Avatar>
                          <Chip 
                            label={activity.type} 
                            size="small" 
                            variant="outlined"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>
                        
                        <Typography variant="h6" sx={{ mb: 1, fontSize: '1rem', lineHeight: 1.3 }}>
                          {activity.title}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                          <TimeIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="body2">
                            {activity.completionTime} min
                          </Typography>
                        </Box>
                      </CardContent>
                      
                      <CardActions sx={{ pt: 0 }}>
                        <Button 
                          startIcon={<PlayIcon />}
                          variant="contained"
                          size="small"
                          fullWidth
                          onClick={() => navigate(`/app/play/${activity.id}`)}
                          sx={{ 
                            backgroundColor: getActivityColor(activity.type),
                            '&:hover': {
                              backgroundColor: alpha(getActivityColor(activity.type), 0.8)
                            }
                          }}
                        >
                          Start Now
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No activities scheduled for today. Great work staying on track!
                </Typography>
              </Box>
            )}
          </Paper>

          {/* What's Next Section */}
          <Paper sx={{ p: 3, backgroundColor: theme.palette.background.paper }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingIcon sx={{ mr: 1, color: theme.palette.secondary.main }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  What's Next
                </Typography>
              </Box>
              <Button 
                endIcon={<ChevronRightIcon />}
                onClick={() => navigate('/app/activities')}
                sx={{ textTransform: 'none' }}
              >
                View All
              </Button>
            </Box>
            
            {nextActivities.length > 0 ? (
              <List disablePadding>
                {nextActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItemButton
                      onClick={() => navigate(`/app/play/${activity.id}`)}
                      sx={{ 
                        borderRadius: 1,
                        mb: 1,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.04)
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar 
                          sx={{ 
                            width: 36, 
                            height: 36,
                            backgroundColor: alpha(getActivityColor(activity.type), 0.1),
                            color: getActivityColor(activity.type)
                          }}
                        >
                          {getActivityIcon(activity.type)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.title}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip 
                              label={activity.type} 
                              size="small" 
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.75rem', textTransform: 'capitalize' }}
                            />
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                              <TimeIcon sx={{ fontSize: 14, mr: 0.25 }} />
                              {activity.completionTime}m
                            </Typography>
                          </Box>
                        }
                      />
                      <IconButton size="small">
                        <PlayIcon />
                      </IconButton>
                    </ListItemButton>
                    {index < nextActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  All caught up! Check back later for new content.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Column - Newsfeed & Events */}
        <Grid item xs={12} md={4}>
          {/* Quick Stats */}
          <Paper sx={{ mb: 3, p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Quick Stats
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 600 }}>
                    {metrics.completedActivities}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Completed
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="secondary" sx={{ fontWeight: 600 }}>
                    {metrics.learningHours}h
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Learning Time
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Progress</Typography>
                <Typography variant="body2">
                  {Math.round((metrics.completedActivities / metrics.totalActivities) * 100)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(metrics.completedActivities / metrics.totalActivities) * 100}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          </Paper>

          {/* Upcoming Events */}
          <Paper sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              <EventIcon sx={{ mr: 1 }} />
              Upcoming Events
            </Typography>
            
            <List disablePadding>
              {upcomingEvents.map((event, index) => (
                <React.Fragment key={event.id}>
                  <ListItem disablePadding>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32, backgroundColor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main }}>
                        {getEventIcon(event.type)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={event.title}
                      secondary={event.date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      primaryTypographyProps={{ fontSize: '0.875rem' }}
                      secondaryTypographyProps={{ fontSize: '0.75rem' }}
                    />
                  </ListItem>
                  {index < upcomingEvents.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>

          {/* Newsfeed */}
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <NotificationIcon sx={{ mr: 1 }} />
                News & Updates
              </Typography>
            </Box>
            
            <List disablePadding>
              {newsItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ListItem disablePadding sx={{ mb: 2 }}>
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <Avatar 
                          sx={{ 
                            width: 28, 
                            height: 28, 
                            mr: 1.5, 
                            mt: 0.5,
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main
                          }}
                        >
                          {getNewsIcon(item.type)}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {item.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.4 }}>
                            {item.content}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              by {item.author}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTimeAgo(item.timestamp)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </ListItem>
                  {index < newsItems.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export const HomePage: React.FC = () => {
  return (
    <DashboardProvider>
      <HomePageContent />
    </DashboardProvider>
  );
};