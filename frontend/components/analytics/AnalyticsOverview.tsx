/**
 * Analytics Overview Component
 * Main dashboard view with key metrics and charts
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
} from '@mui/material';
import {
  School as SchoolIcon,
  Assessment as AssessmentIcon,
  EmojiEvents as TrophyIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts';
import { AnalyticsData } from '../../hooks/useAnalyticsData';

interface AnalyticsOverviewProps {
  data: AnalyticsData | null;
}

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

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({ data }) => {
  if (!data) return null;

  // Debug: Log the data to see what we're getting
  console.log('AnalyticsOverview data:', data);
  console.log('daily_activity:', data.platformOverview.daily_activity);

  return (
    <Box>
      {/* Key Metrics Cards */}
      <Box sx={{ 
        display: 'flex', 
        gap: 3, 
        mb: 4,
        flexDirection: { xs: 'column', sm: 'row' }
      }}>
        <Box sx={{ flex: 1 }}>
          <MetricCard
            icon={<SchoolIcon />}
            title="Total Learners"
            value={data.platformOverview.unique_learners.toLocaleString()}
            subtitle="Active learners"
            color="success.main"
            trend="+12% this month"
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <MetricCard
            icon={<AssessmentIcon />}
            title="Activities"
            value={data.platformOverview.unique_activities.toLocaleString()}
            subtitle="Available content"
            color="primary.main"
            trend="+3 new this week"
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <MetricCard
            icon={<TrophyIcon />}
            title="Completion Rate"
            value={`${data.platformOverview.completion_rate}%`}
            subtitle="Overall completion"
            color="warning.main"
            trend="+5.2% improvement"
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <MetricCard
            icon={<SpeedIcon />}
            title="xAPI Events"
            value={data.platformOverview.total_statements.toLocaleString()}
            subtitle="Learning interactions"
            color="info.main"
            trend="+847 this week"
          />
        </Box>
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Main Chart */}
        <Box sx={{ flex: 2, minWidth: 0 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📈 Daily Activity Timeline
              </Typography>
              {(() => {
                const dailyActivity = data.platformOverview.daily_activity;
                console.log('Rendering chart with daily_activity:', dailyActivity);
                
                if (dailyActivity && Array.isArray(dailyActivity) && dailyActivity.length > 0) {
                  // Ensure data has proper structure for the chart
                  const chartData = dailyActivity.map((item, index) => ({
                    x: new Date(item.date).getTime(), // Convert to timestamp for proper rendering
                    y: typeof item.count === 'number' && !isNaN(item.count) ? item.count : 0,
                    label: new Date(item.date).toLocaleDateString()
                  })).filter(item => !isNaN(item.x) && !isNaN(item.y));
                  
                  console.log('Chart data processed:', chartData);
                  
                  if (chartData.length === 0) {
                    return (
                      <Box sx={{ 
                        height: 300, 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        border: '1px dashed',
                        borderColor: 'grey.300'
                      }}>
                        <Typography variant="h6" color="grey.600" gutterBottom>
                          Invalid Chart Data
                        </Typography>
                        <Typography color="text.secondary" textAlign="center">
                          Unable to render chart due to invalid date/count values.
                        </Typography>
                      </Box>
                    );
                  }
                  
                  return (
                    <Box sx={{ height: 300, mt: 2 }}>
                      <LineChart
                        dataset={chartData}
                        xAxis={[{
                          dataKey: 'x',
                          scaleType: 'time',
                          valueFormatter: (value) => new Date(value).toLocaleDateString(),
                        }]}
                        series={[{
                          dataKey: 'y',
                          label: 'Daily Events',
                          color: '#2563eb',
                        }]}
                        height={300}
                      />
                    </Box>
                  );
                }
                
                return (
                  <Box sx={{ 
                    height: 300, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: 'grey.300'
                  }}>
                    <Typography variant="h6" color="grey.600" gutterBottom>
                      No Activity Data Available
                    </Typography>
                    <Typography color="text.secondary" textAlign="center">
                      Daily activity will appear here once users complete learning activities.
                      {dailyActivity === undefined && ' (Data structure: undefined)'}
                      {dailyActivity === null && ' (Data structure: null)'}
                      {Array.isArray(dailyActivity) && dailyActivity.length === 0 && ' (Empty array)'}
                    </Typography>
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Box>

        {/* Quick Stats */}
        <Box sx={{ flex: 1, minWidth: 300 }}>
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
        </Box>
      </Box>
    </Box>
  );
};