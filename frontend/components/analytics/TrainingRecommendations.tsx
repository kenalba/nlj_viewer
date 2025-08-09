/**
 * Training Recommendations Component
 * AI-generated training recommendations with reasoning and priority
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  useTheme
} from '@mui/material';
import {
  School as SchoolIcon,
  AutoAwesome as AIIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  PlayArrow as PlayIcon,
  BookmarkBorder as BookmarkIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { apiClient } from '../../client/client';

interface TrainingRecommendation {
  topic: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimated_time: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  related_activities: string[];
  success_probability: number;
}

interface RecommendationsData {
  recommendations: TrainingRecommendation[];
  total_recommendations: number;
  personalized: boolean;
  filters: {
    user_id?: string;
    category?: string;
    limit: number;
  };
}

interface TrainingRecommendationsProps {
  userId?: string;
  category?: string;
  maxRecommendations?: number;
  showPersonalized?: boolean;
}

export const TrainingRecommendations: React.FC<TrainingRecommendationsProps> = ({
  userId,
  category,
  maxRecommendations = 10,
  showPersonalized = true
}) => {
  const theme = useTheme();
  const [data, setData] = useState<RecommendationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(category || 'all');
  const [viewMode, setViewMode] = useState<'personal' | 'general'>(
    userId && showPersonalized ? 'personal' : 'general'
  );

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'assessments', label: 'Assessments' },
    { value: 'surveys', label: 'Surveys' },
    { value: 'games', label: 'Interactive Games' },
    { value: 'training', label: 'Training Modules' },
    { value: 'compliance', label: 'Compliance' }
  ];

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: any = {
        limit: maxRecommendations,
        category: selectedCategory === 'all' ? undefined : selectedCategory
      };
      
      if (viewMode === 'personal' && userId) {
        params.user_id = userId;
      }
      
      const response = await apiClient.get('/api/analytics/training-recommendations', {
        params
      });
      
      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load training recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [selectedCategory, viewMode, userId]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.info.main;
      default: return theme.palette.text.secondary;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return theme.palette.success.main;
      case 'intermediate': return theme.palette.warning.main;
      case 'advanced': return theme.palette.error.main;
      default: return theme.palette.text.secondary;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <StarIcon color="error" />;
      case 'medium': return <TrendingUpIcon color="warning" />;
      case 'low': return <SchoolIcon color="info" />;
      default: return <SchoolIcon />;
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={fetchRecommendations}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header and Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AIIcon color="primary" />
            AI-Powered Training Recommendations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Personalized learning suggestions based on performance analysis
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {showPersonalized && userId && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>View</InputLabel>
              <Select
                value={viewMode}
                label="View"
                onChange={(e) => setViewMode(e.target.value as 'personal' | 'general')}
              >
                <MenuItem value="personal">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon fontSize="small" />
                    Personal
                  </Box>
                </MenuItem>
                <MenuItem value="general">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupsIcon fontSize="small" />
                    General
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          )}
          
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              label="Category"
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Tooltip title="Refresh Recommendations">
            <IconButton onClick={fetchRecommendations} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Recommendations Results */}
      {data && !loading && (
        <>
          {/* Summary */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {data.total_recommendations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Recommendations
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color={data.personalized ? "success.main" : "info.main"}>
                    {data.personalized ? "Personal" : "General"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recommendation Type
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {data.recommendations.filter(r => r.priority === 'high').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    High Priority
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Recommendations List */}
          <Grid container spacing={3}>
            {data.recommendations.map((recommendation, index) => (
              <Grid item xs={12} key={index}>
                <Card elevation={2}>
                  <CardContent>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Avatar sx={{ 
                          bgcolor: getPriorityColor(recommendation.priority),
                          width: 48,
                          height: 48
                        }}>
                          {getPriorityIcon(recommendation.priority)}
                        </Avatar>
                        
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" gutterBottom>
                            {recommendation.topic}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {recommendation.description}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <Chip 
                          label={recommendation.priority.toUpperCase()} 
                          color={recommendation.priority === 'high' ? 'error' : recommendation.priority === 'medium' ? 'warning' : 'info'}
                          size="small"
                        />
                        <Chip 
                          label={recommendation.difficulty_level}
                          sx={{ color: getDifficultyColor(recommendation.difficulty_level) }}
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                    </Box>

                    {/* AI Reasoning */}
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>AI Analysis:</strong> {recommendation.reason}
                      </Typography>
                    </Alert>

                    {/* Metrics */}
                    <Grid container spacing={3} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ScheduleIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            <strong>Time:</strong> {formatTime(recommendation.estimated_time)}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUpIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            <strong>Success Rate:</strong> {(recommendation.success_probability * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            <strong>Success Probability</strong>
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={recommendation.success_probability * 100}
                              color={recommendation.success_probability > 0.8 ? 'success' : 'primary'}
                              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {(recommendation.success_probability * 100).toFixed(0)}%
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Related Activities */}
                    {recommendation.related_activities.length > 0 && (
                      <Box>
                        <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                          Related Activities:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {recommendation.related_activities.map((activity, actIndex) => (
                            <Chip 
                              key={actIndex} 
                              label={activity}
                              icon={<AssignmentIcon />}
                              variant="outlined"
                              size="small"
                              clickable
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <Button
                        startIcon={<BookmarkIcon />}
                        variant="outlined"
                        size="small"
                      >
                        Save for Later
                      </Button>
                      <Button
                        startIcon={<PlayIcon />}
                        variant="contained"
                        size="small"
                        color="primary"
                      >
                        Start Training
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Empty State */}
          {data.recommendations.length === 0 && (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AIIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Recommendations Available
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  There are currently no training recommendations for the selected criteria.
                  Try adjusting your filters or check back later.
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

export default TrainingRecommendations;