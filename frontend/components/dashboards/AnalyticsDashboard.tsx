/**
 * Analytics Dashboard
 * Comprehensive learning analytics dashboard with Ralph LRS + Elasticsearch integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Avatar,
  Chip,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip
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
  DateRange as DateRangeIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import { LineChart, BarChart, PieChart } from '@mui/x-charts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface AnalyticsData {
  platformOverview: {
    total_statements: number;
    unique_learners: number;
    unique_activities: number;
    completion_rate: number;
    average_score: number | null;
    daily_activity: Array<{
      date: string;
      count: number;
    }>;
  };
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
  loading?: boolean;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`analytics-tabpanel-${index}`}
    aria-labelledby={`analytics-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const MetricCard: React.FC<MetricCardProps> = ({ 
  icon, 
  title, 
  value, 
  subtitle, 
  color, 
  trend, 
  loading = false 
}) => (
  <Card elevation={2} sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Avatar sx={{ bgcolor: color, mr: 2 }}>
          {loading ? <CircularProgress size={24} color="inherit" /> : icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography color="textSecondary" variant="caption" display="block">
            {title}
          </Typography>
          <Typography variant="h4" component="div" fontWeight="bold">
            {loading ? '...' : value}
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="textSecondary">
        {subtitle}
      </Typography>
      {trend && !loading && (
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

export const AnalyticsDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState('7d');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch platform overview
      const overviewResponse = await fetch('/api/analytics/overview', { headers });
      if (!overviewResponse.ok) {
        throw new Error(`Failed to fetch overview: ${overviewResponse.statusText}`);
      }
      const overviewData = await overviewResponse.json();

      // Fetch health status
      const healthResponse = await fetch('/api/analytics/health', { headers });
      if (!healthResponse.ok) {
        throw new Error(`Failed to fetch health: ${healthResponse.statusText}`);
      }
      const healthData = await healthResponse.json();

      // Fetch trends
      const trendsResponse = await fetch(`/api/analytics/trends?period=${timePeriod}&metric=activity`, { headers });
      if (!trendsResponse.ok) {
        throw new Error(`Failed to fetch trends: ${trendsResponse.statusText}`);
      }
      const trendsData = await trendsResponse.json();

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleTimePeriodChange = (event: any) => {
    setTimePeriod(event.target.value);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/analytics/export/${format}?data_type=overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

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

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchAnalyticsData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            📊 Learning Analytics Dashboard
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Real-time insights from Ralph LRS and Elasticsearch
          </Typography>
          {lastRefresh && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Time Period Selector */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={timePeriod}
              label="Time Period"
              onChange={handleTimePeriodChange}
            >
              <MenuItem value="1d">Last Day</MenuItem>
              <MenuItem value="7d">Last Week</MenuItem>
              <MenuItem value="30d">Last Month</MenuItem>
              <MenuItem value="90d">Last 3 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          {/* Action Buttons */}
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchAnalyticsData} disabled={loading}>
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
        </Box>
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

      {/* Key Metrics Cards */}
      {analyticsData?.platformOverview && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<SchoolIcon />}
              title="Total Learners"
              value={analyticsData.platformOverview.unique_learners.toLocaleString()}
              subtitle="Active learners in platform"
              color="#059669"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<AssessmentIcon />}
              title="Activities"
              value={analyticsData.platformOverview.unique_activities.toLocaleString()}
              subtitle="Learning activities available"
              color="#dc2626"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<TrophyIcon />}
              title="Completion Rate"
              value={`${analyticsData.platformOverview.completion_rate}%`}
              subtitle="Platform-wide completion"
              color="#d97706"
              trend={{ value: "+5.2% this period", positive: true }}
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<SpeedIcon />}
              title="xAPI Statements"
              value={analyticsData.platformOverview.total_statements.toLocaleString()}
              subtitle="Learning events tracked"
              color="#7c3aed"
              loading={loading}
            />
          </Grid>
        </Grid>
      )}

      {/* Main Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
          <Tab label="Overview" icon={<BarChartIcon />} />
          <Tab label="Activity Trends" icon={<TrendingUpIcon />} />
          <Tab label="Learner Analytics" icon={<PeopleIcon />} />
          <Tab label="Performance Metrics" icon={<SpeedIcon />} />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Activity Timeline */}
          <Grid item xs={12} lg={8}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  📈 Daily Activity Timeline
                </Typography>
                {analyticsData?.platformOverview.daily_activity && (
                  <Box sx={{ width: '100%', height: 300, mt: 2 }}>
                    <LineChart
                      dataset={analyticsData.platformOverview.daily_activity}
                      xAxis={[{
                        dataKey: 'date',
                        scaleType: 'time',
                        valueFormatter: (value) => new Date(value).toLocaleDateString(),
                      }]}
                      series={[{
                        dataKey: 'count',
                        label: 'Daily Activity',
                        color: '#059669',
                      }]}
                      width={undefined}
                      height={300}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Stats */}
          <Grid item xs={12} lg={4}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  📊 Quick Stats
                </Typography>
                {analyticsData?.platformOverview && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography variant="body2">Average Score</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {analyticsData.platformOverview.average_score 
                          ? `${(analyticsData.platformOverview.average_score * 100).toFixed(1)}%`
                          : 'N/A'
                        }
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography variant="body2">Total Events</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {analyticsData.platformOverview.total_statements.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography variant="body2">Activities per Learner</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {analyticsData.platformOverview.unique_learners > 0 
                          ? Math.round(analyticsData.platformOverview.unique_activities / analyticsData.platformOverview.unique_learners)
                          : 0
                        }
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography variant="body2">Engagement Rate</Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {analyticsData.platformOverview.completion_rate}%
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Activity Trends Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  📊 Activity Trends Over Time
                </Typography>
                {analyticsData?.trends.daily_activity && analyticsData.trends.daily_activity.length > 0 ? (
                  <Box sx={{ width: '100%', height: 400, mt: 2 }}>
                    <BarChart
                      dataset={analyticsData.trends.daily_activity}
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
                      width={undefined}
                      height={400}
                    />
                  </Box>
                ) : (
                  <Box sx={{ 
                    width: '100%', 
                    height: 400, 
                    mt: 2, 
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
                      No Activity Data Yet
                    </Typography>
                    <Typography variant="body2" color="grey.500" textAlign="center" maxWidth={400}>
                      Once users start completing learning activities, you'll see activity trends and patterns here.
                      Try completing some activities or generate sample data to see charts in action.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Summary Cards */}
          {analyticsData?.trends.summary && (
            <Grid item xs={12}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {analyticsData.trends.summary.total_statements.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Events
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main" fontWeight="bold">
                      {analyticsData.trends.summary.unique_learners.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Active Learners
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main" fontWeight="bold">
                      {analyticsData.trends.summary.completion_rate}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Completion Rate
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main" fontWeight="bold">
                      {analyticsData.trends.summary.average_score 
                        ? `${(analyticsData.trends.summary.average_score * 100).toFixed(1)}%`
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
        </Grid>
      </TabPanel>

      {/* Learner Analytics Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  👥 Learner Analytics
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Individual learner analytics require specific learner selection. 
                  Use the search functionality in the main Activities page to view detailed learner progress.
                </Typography>
                <Button variant="outlined" href="/app/activities">
                  Go to Activities
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Performance Metrics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  🚀 System Performance
                </Typography>
                {analyticsData?.healthStatus && (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Service</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Description</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>Ralph LRS</TableCell>
                          <TableCell>
                            <Chip 
                              label={analyticsData.healthStatus.ralph_lrs.success ? 'Connected' : 'Disconnected'}
                              color={analyticsData.healthStatus.ralph_lrs.success ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>Standards-compliant xAPI Learning Record Store</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Elasticsearch</TableCell>
                          <TableCell>
                            <Chip 
                              label={analyticsData.healthStatus.elasticsearch.success ? 'Connected' : 'Disconnected'}
                              color={analyticsData.healthStatus.elasticsearch.success ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>Analytics engine for learning data</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Analytics System</TableCell>
                          <TableCell>
                            <Chip 
                              label={analyticsData.healthStatus.analytics_system}
                              color={analyticsData.healthStatus.analytics_system === 'operational' ? 'success' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>Overall analytics system health</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};