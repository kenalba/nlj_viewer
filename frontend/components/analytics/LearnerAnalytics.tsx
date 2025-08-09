/**
 * Learner Analytics Component
 * Displays learner performance data and insights from Ralph LRS
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { apiClient } from '../../client/client';
import { PlaceholderCard } from './PlaceholderCard';

interface LearnerData {
  email: string;
  name: string;
  total_activities: number;
  completed_activities: number;
  completion_rate: number;
  average_score: number | null;
  learning_streak: number;
  last_activity: string;
}

export const LearnerAnalytics: React.FC = () => {
  const [topPerformers, setTopPerformers] = useState<LearnerData[]>([]);
  const [activeStreaks, setActiveStreaks] = useState<LearnerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchLearnerData();
  }, []);

  const fetchLearnerData = async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, we'll use the platform overview data to get learner emails
      // and then fetch individual learner analytics
      const overviewResponse = await apiClient.get('/api/analytics/overview');
      const overview = overviewResponse.data.data;

      // TODO: We need a new endpoint that gives us a list of all learners
      // For now, we'll create placeholder data structure that matches what we expect
      // when the backend provides the proper endpoint

      console.log('Overview data:', overview);
      
      // Simulate API delay and show that we're trying to fetch real data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // This is where we would normally fetch real learner analytics data
      // setTopPerformers(realTopPerformersData);
      // setActiveStreaks(realStreaksData);

      // For now, show empty state to indicate we need the proper API endpoints
      setTopPerformers([]);
      setActiveStreaks([]);

    } catch (err) {
      console.error('Error fetching learner analytics:', err);
      setError('Failed to fetch learner analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchLearnerData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        👥 Learner Performance Analytics
      </Typography>
      
      {/* Search and Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search learners..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Role Filter</InputLabel>
          <Select 
            label="Role Filter" 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="learner">Learners</MenuItem>
            <MenuItem value="creator">Creators</MenuItem>
            <MenuItem value="admin">Admins</MenuItem>
          </Select>
        </FormControl>
        <Button startIcon={<FilterIcon />} variant="outlined">
          More Filters
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Top Performers */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🏆 Top Performers
                </Typography>
                {topPerformers.length === 0 ? (
                  <Box sx={{ 
                    py: 4, 
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: 'grey.300',
                    borderRadius: 2,
                    bgcolor: 'grey.50'
                  }}>
                    <Typography variant="h6" color="grey.600" gutterBottom>
                      No Learner Data Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Top performers will appear here once learners complete activities.
                      Generate sample data or wait for actual learning activity.
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {topPerformers.slice(0, 5).map((learner, index) => (
                      <ListItem key={learner.email} divider>
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: index < 3 ? 'gold' : 'grey.300', width: 32, height: 32 }}>
                            {index + 1}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={learner.name}
                          secondary={`${learner.completion_rate}% completion • ${learner.learning_streak} day streak`}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StarIcon sx={{ color: 'gold', fontSize: 16 }} />
                          <Typography variant="caption">
                            {learner.average_score ? (learner.average_score * 100).toFixed(0) + '%' : 'N/A'}
                          </Typography>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Learning Streaks */}
          <Box sx={{ flex: 1 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🔥 Current Learning Streaks
                </Typography>
                {activeStreaks.length === 0 ? (
                  <Box sx={{ 
                    py: 4, 
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: 'grey.300',
                    borderRadius: 2,
                    bgcolor: 'grey.50'
                  }}>
                    <Typography variant="h6" color="grey.600" gutterBottom>
                      No Streak Data Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Learning streaks will appear here based on consecutive daily activity.
                      Generate sample data or wait for actual learning streaks.
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {activeStreaks.slice(0, 5).map((learner, index) => (
                      <ListItem key={learner.email} divider>
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: 'orange.main', width: 32, height: 32 }}>
                            🔥
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={learner.name}
                          secondary={`Last activity: ${learner.last_activity}`}
                        />
                        <Chip 
                          label={`${learner.learning_streak} days`} 
                          color="warning" 
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Placeholder for Individual Learner Deep-Dive */}
      <Box sx={{ mt: 3 }}>
        <PlaceholderCard 
          title="🔍 Individual Learner Deep-Dive"
          description="Select a learner above to view detailed analytics including personal progress dashboard, recent activities with scores, learning path progression, and engagement heatmap."
          features={[
            "Personal progress dashboard",
            "Recent activities with detailed scores", 
            "Learning path progression tracking",
            "Engagement heatmap visualization",
            "Personalized recommendations (ML-powered)"
          ]}
        />
      </Box>
    </Box>
  );
};