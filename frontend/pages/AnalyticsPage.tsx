/**
 * Analytics Page - Main analytics router with tab-based navigation
 * Handles routing between different analytics views
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
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
  Stack,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  BarChart as BarChartIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Timeline as TimelineIcon,
  Star as StarIcon,
  AutoAwesome as AIIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

import { AnalyticsOverview } from '../components/analytics/AnalyticsOverview';
import { PeopleAnalytics } from '../components/analytics/PeopleAnalytics';
import { ContentPerformance } from '../components/analytics/ContentPerformance';
import { ComplianceDashboard } from '../components/analytics/ComplianceDashboard';
import { AuditTrail } from '../components/analytics/AuditTrail';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { useAuth } from '../contexts/AuthContext';

const tabs = [
  { id: 'overview', label: 'Overview', icon: <BarChartIcon />, path: '/app/analytics/overview' },
  { id: 'people', label: 'People Analytics', icon: <PeopleIcon />, path: '/app/analytics/people' },
  { id: 'content', label: 'Content & Performance', icon: <AssessmentIcon />, path: '/app/analytics/content' },
  { id: 'compliance', label: 'Compliance', icon: <SecurityIcon />, path: '/app/analytics/compliance' },
  { id: 'audit', label: 'Audit Trail', icon: <TimelineIcon />, path: '/app/analytics/audit' },
];

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState('7d');

  // Determine current tab based on URL
  const currentPath = location.pathname;
  const currentTab = tabs.find(tab => currentPath.startsWith(tab.path)) || tabs[0];
  const tabIndex = tabs.indexOf(currentTab);

  // Use custom hook for analytics data
  const { 
    data: analyticsData, 
    isLoading, 
    error, 
    lastRefresh, 
    refetch 
  } = useAnalyticsData(timePeriod);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const selectedTab = tabs[newValue];
    navigate(selectedTab.path);
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

  // Redirect to overview if on base analytics path
  useEffect(() => {
    if (location.pathname === '/app/analytics' || location.pathname === '/app/analytics/') {
      navigate('/app/analytics/overview', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }>
          {error instanceof Error ? error.message : 'Failed to load analytics data'}
        </Alert>
      </Box>
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
            Real-time insights from FastStream event processing and direct Elasticsearch integration
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
            <IconButton onClick={() => refetch()} disabled={isLoading} size="small">
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
            <strong> FastStream:</strong> {analyticsData.healthStatus.faststream?.success ? 'Operational' : 'Degraded'} | 
            <strong> Elasticsearch:</strong> {analyticsData.healthStatus.elasticsearch.success ? 'Connected' : 'Disconnected'}
          </Typography>
        </Alert>
      )}

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {tabs.map((tab) => (
            <Tab key={tab.id} label={tab.label} icon={tab.icon} />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {currentTab.id === 'overview' && <AnalyticsOverview data={analyticsData} />}
          {currentTab.id === 'people' && <PeopleAnalytics userId={user?.id} showAllUsers={user?.role === 'admin'} />}
          {currentTab.id === 'content' && <ContentPerformance data={analyticsData} />}
          {currentTab.id === 'compliance' && <ComplianceDashboard userId={user?.id} showAllUsers={user?.role === 'admin'} />}
          {currentTab.id === 'audit' && <AuditTrail />}
        </Box>
      )}
    </Box>
  );
};

export default AnalyticsPage;