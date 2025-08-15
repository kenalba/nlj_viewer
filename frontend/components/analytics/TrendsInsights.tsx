/**
 * Trends & Insights Component
 * Advanced analytics trends and predictive insights
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Paper,
  useTheme,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import { BarChart } from '@mui/x-charts';
import { AnalyticsData } from '../../hooks/useAnalyticsData';
import { PlaceholderCard } from './PlaceholderCard';

interface TrendsInsightsProps {
  data: AnalyticsData | null;
}

export const TrendsInsights: React.FC<TrendsInsightsProps> = ({ data }) => {
  const theme = useTheme();
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📈 Platform Trends & Insights
      </Typography>

      {/* Trends Chart */}
      <Card sx={{ mb: 3 }}>
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
                  color: theme.palette.success.main,
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
              bgcolor: 'action.hover',
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider'
            }}>
              <BarChartIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Trend Data Available
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={400}>
                Once users complete more learning activities, trend analysis will appear here.
                Generate sample data to see charts in action.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data?.trends.summary && (
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          mb: 3,
          flexDirection: { xs: 'column', sm: 'row' }
        }}>
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {data.trends.summary.total_statements.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Events
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {data.trends.summary.unique_learners.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Active Learners
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {data.trends.summary.completion_rate}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Completion Rate
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: 1 }}>
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
          </Box>
        </Box>
      )}

      {/* Placeholder for Advanced Insights */}
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
    </Box>
  );
};