/**
 * Top Performers Analysis Component
 * ML-driven top performer identification with behavioral characteristics
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Avatar,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  useTheme
} from '@mui/material';
import {
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  School as SchoolIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TrendIcon
} from '@mui/icons-material';
import { apiClient } from '../../client/client';

interface PerformanceCharacteristics {
  adaptability_score: number;
  persistence_level: number;
  accuracy_trend: string;
  consistency_score: number;
  speed_score: number;
  preferred_activity_types: string[];
  peak_performance_hours: number[];
  learning_style_indicators: Record<string, number>;
}

interface TopPerformer {
  user_id: string;
  user_name: string;
  user_email: string;
  overall_score: number;
  completion_rate: number;
  average_score: number;
  average_time_to_completion: number;
  total_activities: number;
  completed_activities: number;
  strong_categories: string[];
  weak_categories: string[];
  performance_trend: string;
  rank: number;
  characteristics?: PerformanceCharacteristics;
}

interface TopPerformersData {
  top_performers: TopPerformer[];
  total_analyzed: number;
  category: string;
  analysis_metadata: {
    time_period: string;
    ranking_algorithm: string;
    characteristics_included: boolean;
  };
}

interface TopPerformersAnalysisProps {
  defaultCategory?: string;
  defaultTimePeriod?: string;
  maxPerformers?: number;
}

export const TopPerformersAnalysis: React.FC<TopPerformersAnalysisProps> = ({
  defaultCategory = "all",
  defaultTimePeriod = "90d",
  maxPerformers = 20
}) => {
  const theme = useTheme();
  const [data, setData] = useState<TopPerformersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [timePeriod, setTimePeriod] = useState(defaultTimePeriod);
  const [expandedPerformer, setExpandedPerformer] = useState<string | null>(null);

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "assessments", label: "Assessments" },
    { value: "surveys", label: "Surveys" },
    { value: "games", label: "Games" },
    { value: "training", label: "Training Modules" }
  ];

  const timePeriods = [
    { value: "30d", label: "Last 30 Days" },
    { value: "90d", label: "Last 90 Days" },
    { value: "180d", label: "Last 180 Days" },
    { value: "1y", label: "Last Year" }
  ];

  const fetchTopPerformers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/analytics/top-performers/${category}`, {
        params: {
          limit: maxPerformers,
          time_period: timePeriod,
          include_characteristics: true
        }
      });
      
      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load top performers data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopPerformers();
  }, [category, timePeriod]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return theme.palette.warning.main; // Gold
    if (rank === 2) return theme.palette.grey[400]; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return theme.palette.primary.main;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUpIcon color="success" />;
      case 'declining': return <TrendIcon sx={{ color: theme.palette.error.main, transform: 'rotate(180deg)' }} />;
      default: return <TrendIcon color="action" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return theme.palette.success.main;
    if (score >= 0.6) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const renderCharacteristics = (characteristics: PerformanceCharacteristics) => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Performance Characteristics
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Adaptability</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
              <PsychologyIcon sx={{ mr: 1, color: getScoreColor(characteristics.adaptability_score) }} />
              <Typography variant="h6" color={getScoreColor(characteristics.adaptability_score)}>
                {(characteristics.adaptability_score * 100).toFixed(0)}%
              </Typography>
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Persistence</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
              <SchoolIcon sx={{ mr: 1, color: getScoreColor(characteristics.persistence_level) }} />
              <Typography variant="h6" color={getScoreColor(characteristics.persistence_level)}>
                {(characteristics.persistence_level * 100).toFixed(0)}%
              </Typography>
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Speed</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
              <SpeedIcon sx={{ mr: 1, color: getScoreColor(characteristics.speed_score) }} />
              <Typography variant="h6" color={getScoreColor(characteristics.speed_score)}>
                {(characteristics.speed_score * 100).toFixed(0)}%
              </Typography>
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Consistency</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
              <CheckCircleIcon sx={{ mr: 1, color: getScoreColor(characteristics.consistency_score) }} />
              <Typography variant="h6" color={getScoreColor(characteristics.consistency_score)}>
                {(characteristics.consistency_score * 100).toFixed(0)}%
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Preferred Activity Types
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {characteristics.preferred_activity_types.map((type, index) => (
            <Chip key={index} label={type} size="small" variant="outlined" />
          ))}
        </Box>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Peak Performance Hours
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {characteristics.peak_performance_hours.map((hour, index) => (
            <Chip 
              key={index} 
              label={`${hour}:00`} 
              size="small" 
              icon={<TimeIcon />}
              color="primary" 
            />
          ))}
        </Box>
      </Box>
    </Box>
  );

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={fetchTopPerformers}>
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
        <Typography variant="h5" component="h2">
          Top Performers Analysis
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              label="Category"
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={timePeriod}
              label="Period"
              onChange={(e) => setTimePeriod(e.target.value)}
            >
              {timePeriods.map((period) => (
                <MenuItem key={period.value} value={period.value}>
                  {period.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchTopPerformers} disabled={loading}>
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

      {/* Analysis Results */}
      {data && !loading && (
        <>
          {/* Summary Stats */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {data.total_analyzed}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Performers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {data.top_performers.length > 0 ? 
                      `${data.top_performers[0].overall_score.toFixed(1)}%` : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Top Score
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {data.top_performers.length > 0 ? 
                      `${(data.top_performers[0].completion_rate * 100).toFixed(1)}%` : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Best Completion Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {data.analysis_metadata.time_period}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Analysis Period
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Performers List */}
          <Box>
            {data.top_performers.map((performer) => (
              <Card key={performer.user_id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ 
                        bgcolor: getRankColor(performer.rank), 
                        width: 48, 
                        height: 48,
                        fontSize: '1.2rem'
                      }}>
                        #{performer.rank}
                      </Avatar>
                      
                      <Box>
                        <Typography variant="h6">
                          {performer.user_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {performer.user_email}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="primary">
                          {performer.overall_score.toFixed(1)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Overall Score
                        </Typography>
                      </Box>
                      
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="success.main">
                          {(performer.completion_rate * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Completion
                        </Typography>
                      </Box>
                      
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6">
                          {formatTime(performer.average_time_to_completion)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Avg. Time
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getTrendIcon(performer.performance_trend)}
                        <Typography variant="body2" sx={{ ml: 1, textTransform: 'capitalize' }}>
                          {performer.performance_trend}
                        </Typography>
                      </Box>
                      
                      <IconButton
                        onClick={() => setExpandedPerformer(
                          expandedPerformer === performer.user_id ? null : performer.user_id
                        )}
                      >
                        {expandedPerformer === performer.user_id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  </Box>
                  
                  {/* Progress Indicators */}
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Typography variant="body2" gutterBottom>
                          Activities: {performer.completed_activities}/{performer.total_activities}
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={(performer.completed_activities / performer.total_activities) * 100}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body2" gutterBottom>
                          Average Score: {performer.average_score.toFixed(1)}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={performer.average_score}
                          color="success"
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {performer.strong_categories.slice(0, 2).map((category, index) => (
                            <Chip key={index} label={category} size="small" color="success" />
                          ))}
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                  
                  {/* Expanded Details */}
                  <Collapse in={expandedPerformer === performer.user_id}>
                    {performer.characteristics && renderCharacteristics(performer.characteristics)}
                  </Collapse>
                </CardContent>
              </Card>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default TopPerformersAnalysis;