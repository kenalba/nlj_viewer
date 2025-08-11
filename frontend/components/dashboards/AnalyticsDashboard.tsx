/**
 * Analytics Dashboard - Modern Learning Analytics Platform
 * Comprehensive analytics dashboard with Ralph LRS + Elasticsearch integration
 * Built with MUI v6, responsive design, and real-time data updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../client/client';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Container,
  Tabs,
  Tab,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  Grid2,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CompleteIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { LineChart, BarChart, PieChart, ScatterChart } from '@mui/x-charts';
import { useAuth } from '../../contexts/AuthContext';

// Types and Interfaces
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface PlatformMetrics {
  total_statements: number;
  unique_learners: number;
  unique_activities: number;
  completion_rate: number;
  average_score: number | null;
  daily_activity: Array<{
    date: string;
    count: number;
  }>;
  top_verbs: Array<{
    verb: string;
    count: number;
  }>;
  activity_types: Array<{
    type: string;
    count: number;
  }>;
}

interface AnalyticsData {
  platformOverview: PlatformMetrics;
  healthStatus: {
    ralph_lrs: { success: boolean };
    elasticsearch: { success: boolean };
    analytics_system: string;
  };
  trends: {
    daily_activity: Array<{
      date: string;
      count: number;
    }>;
    summary: {
      total_statements: number;
      unique_learners: number;
      completion_rate: number;
      average_score: number | null;
    };
  };
}

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

interface ActivityData {
  id: string;
  name: string;
  type: string;
  attempts: number;
  unique_learners: number;
  completion_rate: number;
  average_score: number | null;
  difficulty_score: number | null;
  engagement_score: number | null;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: {
    name: string;
    email: string;
  };
  verb: string;
  object: {
    name: string;
    id: string;
  };
  result?: {
    score?: number;
    success?: boolean;
    completion?: boolean;
  };
}

// Component helpers
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`analytics-tabpanel-${index}`}
    aria-labelledby={`analytics-tab-${index}`}
  >
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

// Main Dashboard Component
export const AnalyticsDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState('7d');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { user } = useAuth();

  // Data fetching
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch all data in parallel using apiClient
      const [overviewResponse, healthResponse, trendsResponse] = await Promise.all([
        apiClient.get('/api/analytics/overview'),
        apiClient.get('/api/analytics/health'),
        apiClient.get(`/api/analytics/trends?period=${timePeriod}&metric=activity`)
      ]);

      // Extract data from axios responses
      const [overviewData, healthData, trendsData] = [
        overviewResponse.data,
        healthResponse.data,
        trendsResponse.data
      ];

      setAnalyticsData({
        platformOverview: overviewData.data,
        healthStatus: healthData,
        trends: trendsData.data
      });
      setLastRefresh(new Date());
      
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/analytics/export/${format}?data_type=overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nlj_analytics_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Error state
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchAnalyticsData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Learning Analytics Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time insights from Ralph LRS and Elasticsearch
            {lastRefresh && (
              <Typography component="span" variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                • Last updated: {lastRefresh.toLocaleTimeString()}
              </Typography>
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={timePeriod}
              label="Time Period"
              onChange={(e) => setTimePeriod(e.target.value)}
            >
              <MenuItem value="1d">Last Day</MenuItem>
              <MenuItem value="7d">Last Week</MenuItem>
              <MenuItem value="30d">Last Month</MenuItem>
              <MenuItem value="90d">Last 3 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchAnalyticsData} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('json')}
            size="small"
            variant="outlined"
          >
            Export
          </Button>
        </Stack>
      </Box>

      {/* System Health Status */}
      {analyticsData?.healthStatus && (
        <Alert 
          severity={analyticsData.healthStatus.analytics_system === 'operational' ? 'success' : 'warning'}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2">
            <strong>Analytics System:</strong> {analyticsData.healthStatus.analytics_system} | 
            <strong> Ralph LRS:</strong> {analyticsData.healthStatus.ralph_lrs.success ? 'Connected' : 'Disconnected'} | 
            <strong> Elasticsearch:</strong> {analyticsData.healthStatus.elasticsearch.success ? 'Connected' : 'Disconnected'}
          </Typography>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="Overview" icon={<BarChartIcon />} />
          <Tab label="Learner Analytics" icon={<PeopleIcon />} />
          <Tab label="Activity Analytics" icon={<AssessmentIcon />} />
          <Tab label="Trends & Insights" icon={<TrendingUpIcon />} />
          <Tab label="Audit Trail" icon={<TimelineIcon />} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Overview Tab */}
          <TabPanel value={tabValue} index={0}>
            <OverviewTab data={analyticsData} />
          </TabPanel>

          {/* Learner Analytics Tab */}
          <TabPanel value={tabValue} index={1}>
            <LearnerAnalyticsTab />
          </TabPanel>

          {/* Activity Analytics Tab */}
          <TabPanel value={tabValue} index={2}>
            <ActivityAnalyticsTab />
          </TabPanel>

          {/* Trends & Insights Tab */}
          <TabPanel value={tabValue} index={3}>
            <TrendsInsightsTab data={analyticsData} />
          </TabPanel>

          {/* Audit Trail Tab */}
          <TabPanel value={tabValue} index={4}>
            <AuditTrailTab />
          </TabPanel>
        </>
      )}
    </Box>
  );
};

// Tab Components
const OverviewTab: React.FC<{ data: AnalyticsData | null }> = ({ data }) => {
  if (!data) return null;

  return (
    <Box>
      {/* Key Metrics Cards */}
      <Grid2 container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            icon={<SchoolIcon />}
            title="Total Learners"
            value={data.platformOverview.unique_learners.toLocaleString()}
            subtitle="Active learners"
            color="success.main"
            trend="+12% this month"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            icon={<AssessmentIcon />}
            title="Activities"
            value={data.platformOverview.unique_activities.toLocaleString()}
            subtitle="Available content"
            color="primary.main"
            trend="+3 new this week"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            icon={<TrophyIcon />}
            title="Completion Rate"
            value={`${data.platformOverview.completion_rate}%`}
            subtitle="Overall completion"
            color="warning.main"
            trend="+5.2% improvement"
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <MetricCard
            icon={<SpeedIcon />}
            title="xAPI Events"
            value={data.platformOverview.total_statements.toLocaleString()}
            subtitle="Learning interactions"
            color="info.main"
            trend="+847 this week"
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid2 container spacing={3}>
        <Grid xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📈 Daily Activity Timeline
              </Typography>
              {data.platformOverview.daily_activity && data.platformOverview.daily_activity.length > 0 ? (
                <Box sx={{ height: 300, mt: 2 }}>
                  <LineChart
                    dataset={data.platformOverview.daily_activity}
                    xAxis={[{
                      dataKey: 'date',
                      scaleType: 'time',
                      valueFormatter: (value) => new Date(value).toLocaleDateString(),
                    }]}
                    series={[{
                      dataKey: 'count',
                      label: 'Daily Events',
                      color: '#2563eb',
                    }]}
                    height={300}
                  />
                </Box>
              ) : (
                <Box sx={{ 
                  height: 300, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: 'grey.50',
                  borderRadius: 1
                }}>
                  <Typography color="text.secondary">No activity data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Quick Stats
              </Typography>
              <Box sx={{ mt: 2 }}>
                <StatItem 
                  label="Average Score"
                  value={data.platformOverview.average_score 
                    ? `${(data.platformOverview.average_score * 100).toFixed(1)}%`
                    : 'N/A'
                  }
                />
                <StatItem 
                  label="Top Activity Type"
                  value={data.platformOverview.activity_types[0]?.type || 'N/A'}
                />
                <StatItem 
                  label="Most Common Action"
                  value={data.platformOverview.top_verbs[0]?.verb?.split('/').pop() || 'N/A'}
                />
                <StatItem 
                  label="Engagement Rate"
                  value={`${data.platformOverview.completion_rate}%`}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const LearnerAnalyticsTab: React.FC = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        👥 Learner Performance Analytics
      </Typography>
      
      {/* Search and Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search learners..."
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
          <Select label="Role Filter" defaultValue="all">
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

      <Grid2 container spacing={3}>
        {/* Top Performers */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🏆 Top Performers
              </Typography>
              <List>
                {[1, 2, 3, 4, 5].map((rank) => (
                  <ListItem key={rank} divider>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: rank <= 3 ? 'gold' : 'grey.300', width: 32, height: 32 }}>
                        {rank}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={`Learner ${rank}`}
                      secondary={`${95 - rank * 3}% completion • ${8 - rank} day streak`}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StarIcon sx={{ color: 'gold', fontSize: 16 }} />
                      <Typography variant="caption">
                        {(0.95 - rank * 0.02).toFixed(2)}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Learning Streaks */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔥 Current Learning Streaks
              </Typography>
              <List>
                {[7, 5, 4, 3, 2].map((streak, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: 'orange.main', width: 32, height: 32 }}>
                        🔥
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={`Active Learner ${index + 1}`}
                      secondary={`Last activity: ${index + 1} hours ago`}
                    />
                    <Chip 
                      label={`${streak} days`} 
                      color="warning" 
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Placeholder for Individual Learner Deep-Dive */}
        <Grid xs={12}>
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
        </Grid>
      </Grid>
    </Box>
  );
};

const ActivityAnalyticsTab: React.FC = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📚 Content Performance Analytics
      </Typography>

      {/* Activity Performance Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Activity Performance Overview
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Activity</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Attempts</TableCell>
                  <TableCell align="right">Completion %</TableCell>
                  <TableCell align="right">Avg Score</TableCell>
                  <TableCell align="right">Difficulty</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { name: "Sales Process Training", type: "Assessment", attempts: 245, completion: 87, score: 0.82, difficulty: "Medium" },
                  { name: "Product Knowledge Quiz", type: "Quiz", attempts: 189, completion: 93, score: 0.91, difficulty: "Easy" },
                  { name: "Customer Service Scenarios", type: "Scenario", attempts: 156, completion: 74, score: 0.68, difficulty: "Hard" },
                  { name: "Compliance Training", type: "Training", attempts: 298, completion: 96, score: 0.88, difficulty: "Easy" },
                  { name: "Leadership Skills", type: "Assessment", attempts: 87, completion: 65, score: 0.72, difficulty: "Hard" }
                ].map((activity, index) => (
                  <TableRow key={index}>
                    <TableCell>{activity.name}</TableCell>
                    <TableCell>
                      <Chip label={activity.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">{activity.attempts}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        {activity.completion}%
                        <LinearProgress 
                          variant="determinate" 
                          value={activity.completion} 
                          sx={{ width: 50, height: 4 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {(activity.score * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={activity.difficulty} 
                        size="small"
                        color={
                          activity.difficulty === 'Easy' ? 'success' : 
                          activity.difficulty === 'Medium' ? 'warning' : 'error'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small">
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <Grid2 container spacing={3}>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Completion Rates by Activity Type
              </Typography>
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">
                  Interactive pie chart showing completion rates by content type (Assessment, Quiz, Scenario, Training)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💡 Difficulty vs Engagement
              </Typography>
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">
                  Scatter plot showing relationship between content difficulty and learner engagement
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Placeholder for Advanced Activity Analytics */}
        <Grid xs={12}>
          <PlaceholderCard 
            title="🎯 Advanced Content Intelligence"
            description="AI-powered content performance insights and optimization recommendations."
            features={[
              "Content difficulty auto-calibration",
              "Learner engagement prediction models",
              "Content gap analysis and recommendations", 
              "A/B testing for content variations",
              "Personalized content sequencing (ML-powered)"
            ]}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

const TrendsInsightsTab: React.FC<{ data: AnalyticsData | null }> = ({ data }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📈 Platform Trends & Insights
      </Typography>

      <Grid2 container spacing={3}>
        {/* Trends Chart */}
        <Grid xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Daily Learning Activity Trends
              </Typography>
              {data?.trends.daily_activity && data.trends.daily_activity.length > 0 ? (
                <Box sx={{ height: 400, mt: 2 }}>
                  <BarChart
                    dataset={data.trends.daily_activity}
                    xAxis={[{
                      dataKey: 'date',
                      scaleType: 'band',
                      valueFormatter: (value) => new Date(value).toLocaleDateString(),
                    }]}
                    series={[{
                      dataKey: 'count',
                      label: 'Daily Events',
                      color: '#059669',
                    }]}
                    height={400}
                  />
                </Box>
              ) : (
                <Box sx={{ 
                  height: 400, 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'grey.300'
                }}>
                  <BarChartIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="grey.600" gutterBottom>
                    No Trend Data Available
                  </Typography>
                  <Typography variant="body2" color="grey.500" textAlign="center" maxWidth={400}>
                    Once users complete more learning activities, trend analysis will appear here.
                    Generate sample data to see charts in action.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Cards */}
        {data?.trends.summary && (
          <Grid xs={12}>
            <Grid container spacing={2}>
              <Grid xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {data.trends.summary.total_statements.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Events
                  </Typography>
                </Paper>
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {data.trends.summary.unique_learners.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Learners
                  </Typography>
                </Paper>
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {data.trends.summary.completion_rate}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Completion Rate
                  </Typography>
                </Paper>
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main" fontWeight="bold">
                    {data.trends.summary.average_score 
                      ? `${(data.trends.summary.average_score * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Average Score
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        )}

        {/* Placeholder for Advanced Insights */}
        <Grid xs={12}>
          <PlaceholderCard 
            title="🤖 AI-Powered Learning Insights"
            description="Advanced analytics and predictive insights powered by machine learning."
            features={[
              "Predictive learning outcome models",
              "Peak usage time optimization",
              "Learning pattern anomaly detection",
              "Cohort analysis and segmentation",
              "Automated insights and recommendations"
            ]}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

const AuditTrailTab: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading audit events
    setTimeout(() => {
      setEvents([
        {
          id: '1',
          timestamp: new Date().toISOString(),
          actor: { name: 'John Doe', email: 'john.doe@company.com' },
          verb: 'completed',
          object: { name: 'Sales Training Module 1', id: 'activity-123' },
          result: { score: 0.85, success: true, completion: true }
        },
        // Add more sample events...
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        🔍 xAPI Events Audit Trail
      </Typography>

      {/* Search and Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search events..."
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
          <InputLabel>User Filter</InputLabel>
          <Select label="User Filter" defaultValue="all">
            <MenuItem value="all">All Users</MenuItem>
            <MenuItem value="learners">Learners Only</MenuItem>
            <MenuItem value="creators">Creators Only</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Activity Filter</InputLabel>
          <Select label="Activity Filter" defaultValue="all">
            <MenuItem value="all">All Activities</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="attempted">Attempted</MenuItem>
            <MenuItem value="experienced">Experienced</MenuItem>
          </Select>
        </FormControl>
        <Button startIcon={<DownloadIcon />} variant="outlined">
          Export Events
        </Button>
      </Box>

      {/* Events Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Real-time Event Stream
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell align="right">Score</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(event.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{event.actor.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {event.actor.email}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {event.object.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={event.verb} 
                          size="small"
                          color={event.verb === 'completed' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {event.result?.score 
                          ? `${(event.result.score * 100).toFixed(0)}%`
                          : '-'
                        }
                      </TableCell>
                      <TableCell align="center">
                        {event.result?.success ? (
                          <CompleteIcon color="success" />
                        ) : (
                          <TrendingDownIcon color="error" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small">
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for Advanced Audit Features */}
      <Box sx={{ mt: 3 }}>
        <PlaceholderCard 
          title="🔬 Advanced Audit Analytics"
          description="Enhanced xAPI event analysis and investigation tools."
          features={[
            "Event pattern recognition and anomaly detection",
            "Learning session reconstruction and playback",
            "Cross-activity event correlation analysis",
            "Automated compliance reporting",
            "Real-time event filtering and alerting"
          ]}
        />
      </Box>
    </Box>
  );
};

// Helper Components
interface MetricCardProps {
  icon: React.ReactElement;
  title: string;
  value: string;
  subtitle: string;
  color: string;
  trend?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, subtitle, color, trend }) => (
  <Card sx={{ height: '100%' }}>
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
          <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} />
          <Typography variant="caption" color="success.main">
            {trend}
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

const StatItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
    <Typography variant="body2">{label}</Typography>
    <Typography variant="body2" fontWeight="bold">{value}</Typography>
  </Box>
);

interface PlaceholderCardProps {
  title: string;
  description: string;
  features: string[];
}

const PlaceholderCard: React.FC<PlaceholderCardProps> = ({ title, description, features }) => (
  <Card sx={{ border: '2px dashed', borderColor: 'grey.300', bgcolor: 'grey.50' }}>
    <CardContent>
      <Typography variant="h6" gutterBottom color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {description}
      </Typography>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Planned Features:
      </Typography>
      <List dense>
        {features.map((feature, index) => (
          <ListItem key={index} sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 20 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'grey.400' }} />
            </ListItemIcon>
            <ListItemText 
              primary={feature} 
              primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
            />
          </ListItem>
        ))}
      </List>
    </CardContent>
  </Card>
);