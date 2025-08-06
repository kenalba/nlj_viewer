/**
 * Learner Dashboard
 * Specialized dashboard for learners with progress tracking and recommended activities
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
  LinearProgress,
  Paper,
  Divider,
  IconButton
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  EmojiEvents as TrophyIcon,
  BookmarkBorder as BookmarkIcon,
  Notifications as NotificationIcon,
  CalendarMonth as CalendarIcon,
  Speed as SpeedIcon,
  School as SchoolIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useDashboard } from '../../contexts/DashboardContext';
import { useNavigate } from 'react-router-dom';

interface MetricCardProps {
  icon: React.ReactElement;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, subtitle, color, trend }) => (
  <Card elevation={2} sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Avatar sx={{ bgcolor: color, mr: 2 }}>
          {icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography color="textSecondary" variant="caption" display="block">
            {title}
          </Typography>
          <Typography variant="h4" component="div" fontWeight="bold">
            {value}
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="textSecondary">
        {subtitle}
      </Typography>
      {trend && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <TrendingUpIcon 
            sx={{ 
              fontSize: 16, 
              mr: 0.5, 
              color: trend.positive ? 'success.main' : 'error.main',
              transform: trend.positive ? 'none' : 'scaleY(-1)'
            }} 
          />
          <Typography 
            variant="caption" 
            color={trend.positive ? 'success.main' : 'error.main'}
          >
            {trend.value}
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

export const LearnerDashboard: React.FC = () => {
  const { user, metrics, quickActions, recommendedActivities, upcomingEvents, recentActivity } = useDashboard();
  const navigate = useNavigate();

  if (!user) return null;

  const completionRate = Math.round((metrics.completedActivities / metrics.totalActivities) * 100);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Welcome back, {user.full_name || user.username}! 👋
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          Ready to continue your learning journey? You're making great progress!
        </Typography>
        
        {/* Job Codes Display */}
        {user.job_codes && user.job_codes.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Your roles:
            </Typography>
            {user.job_codes.map((code) => (
              <Chip 
                key={code} 
                label={code} 
                size="small" 
                variant="outlined" 
                color="primary"
              />
            ))}
          </Box>
        )}
        
        {/* Location Info */}
        {(user.region || user.dealership) && (
          <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
            {user.region && (
              <Typography variant="body2" color="textSecondary">
                📍 {user.region}
              </Typography>
            )}
            {user.dealership && (
              <Typography variant="body2" color="textSecondary">
                🏢 {user.dealership}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<SchoolIcon />}
            title="Learning Progress"
            value={`${completionRate}%`}
            subtitle={`${metrics.completedActivities} of ${metrics.totalActivities} completed`}
            color="#059669"
            trend={{ value: "+12% this month", positive: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<ScheduleIcon />}
            title="Learning Hours"
            value={metrics.learningHours}
            subtitle="Total hours invested"
            color="#dc2626"
            trend={{ value: "+5 hours this week", positive: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<TrophyIcon />}
            title="Achievements"
            value={metrics.achievements}
            subtitle="Badges earned"
            color="#d97706"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<CalendarIcon />}
            title="Upcoming Sessions"
            value={metrics.upcomingSessions}
            subtitle="Training scheduled"
            color="#7c3aed"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={8}>
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                ⚡ Quick Actions
              </Typography>
              <Grid container spacing={2}>
                {quickActions.slice(0, 4).map((action) => (
                  <Grid item xs={12} sm={6} key={action.id}>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="large"
                      startIcon={<span style={{ fontSize: '1.2rem' }}>{action.icon}</span>}
                      onClick={() => navigate(action.path)}
                      sx={{ 
                        py: 2, 
                        textAlign: 'left', 
                        justifyContent: 'flex-start',
                        textTransform: 'none'
                      }}
                    >
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="subtitle2" display="block">
                          {action.title}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" display="block">
                          {action.description}
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Recommended Activities */}
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  🎯 Recommended for You
                </Typography>
                <Button size="small" color="primary">
                  View All
                </Button>
              </Box>
              
              {recommendedActivities.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {recommendedActivities.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      <ListItem 
                        sx={{ 
                          px: 0, 
                          py: 2,
                          '&:hover': { bgcolor: 'action.hover' },
                          borderRadius: 1,
                          cursor: 'pointer'
                        }}
                        onClick={() => navigate(`/app/play/${activity.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {activity.type === 'training' ? <SchoolIcon /> :
                             activity.type === 'assessment' ? <AssignmentIcon /> : <PlayIcon />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {activity.title}
                              <Chip size="small" label={activity.type} variant="outlined" />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ScheduleIcon sx={{ fontSize: 16 }} />
                                <Typography variant="caption">
                                  {activity.completionTime} min
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {activity.jobCodes.map((code: string) => (
                                  <Chip key={code} label={code} size="small" variant="outlined" />
                                ))}
                              </Box>
                            </Box>
                          }
                        />
                        <IconButton edge="end">
                          <PlayIcon />
                        </IconButton>
                      </ListItem>
                      {index < recommendedActivities.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="textSecondary">
                    No recommendations available. Complete your profile for personalized content!
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Progress Overview */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                📊 Learning Progress
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Overall Completion</Typography>
                  <Typography variant="body2" fontWeight="bold">{completionRate}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={completionRate} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', text: 'center' }}>
                <Box>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {metrics.completedActivities}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Completed
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h4" color="textSecondary">
                    {metrics.totalActivities - metrics.completedActivities}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Remaining
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                📅 Upcoming Events
              </Typography>
              <List sx={{ p: 0 }}>
                {upcomingEvents.slice(0, 3).map((event, index) => (
                  <React.Fragment key={event.id}>
                    <ListItem sx={{ px: 0, py: 1 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                          <CalendarIcon sx={{ fontSize: 16 }} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight="medium">
                            {event.title}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary">
                            {event.date.toLocaleDateString()}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < upcomingEvents.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                🕐 Recent Activity
              </Typography>
              <List sx={{ p: 0 }}>
                {recentActivity.slice(0, 3).map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            <strong>{activity.action}</strong> {activity.item}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary">
                            {activity.timestamp.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};