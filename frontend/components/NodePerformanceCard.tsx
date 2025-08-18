/**
 * NodePerformanceCard Component
 * Displays key performance metrics for a node in a compact card format
 */

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Avatar,
  Grid,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  AccountTree as NodeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Speed as PerformanceIcon,
  Schedule as TimeIcon,
  People as UsersIcon,
  Assessment as StatsIcon,
  MoreVert as MoreVertIcon,
  Lightbulb as OptimizeIcon,
} from '@mui/icons-material';
import { NodePerformanceMetrics } from '../services/nodeService';

interface NodePerformanceCardProps {
  nodeData: NodePerformanceMetrics;
  onClick?: () => void;
  onMenuClick?: (event: React.MouseEvent<HTMLElement>) => void;
  showOptimizationHints?: boolean;
  compact?: boolean;
}

export const NodePerformanceCard: React.FC<NodePerformanceCardProps> = ({
  nodeData,
  onClick,
  onMenuClick,
  showOptimizationHints = true,
  compact = false,
}) => {
  const { node_info, performance_metrics, interaction_stats } = nodeData;
  
  const getPerformanceLevel = (successRate: number | null): {
    level: 'excellent' | 'good' | 'fair' | 'poor';
    color: 'success' | 'info' | 'warning' | 'error';
  } => {
    if (!successRate) return { level: 'poor', color: 'error' };
    const rate = successRate * 100;
    if (rate >= 85) return { level: 'excellent', color: 'success' };
    if (rate >= 70) return { level: 'good', color: 'info' };
    if (rate >= 60) return { level: 'fair', color: 'warning' };
    return { level: 'poor', color: 'error' };
  };

  const getTrendDirection = (successRate: number | null): 'up' | 'down' | 'flat' | null => {
    // This would be enhanced with actual trend data from the API
    if (!successRate) return null;
    const rate = successRate * 100;
    if (rate >= 80) return 'up';
    if (rate >= 60) return 'flat';
    return 'down';
  };

  const getTrendIcon = (direction: string | null, size: 'small' | 'medium' = 'small') => {
    const iconProps = { fontSize: size as 'small' | 'medium' };
    switch (direction) {
      case 'up':
        return <TrendingUpIcon {...iconProps} sx={{ color: 'success.main' }} />;
      case 'down':
        return <TrendingDownIcon {...iconProps} sx={{ color: 'error.main' }} />;
      case 'flat':
        return <TrendingFlatIcon {...iconProps} sx={{ color: 'warning.main' }} />;
      default:
        return null;
    }
  };

  const formatSuccessRate = (rate: number | null) => {
    if (rate === null || rate === undefined) return 'N/A';
    return `${(rate * 100).toFixed(1)}%`;
  };

  const formatTime = (milliseconds: number | null) => {
    if (!milliseconds) return 'N/A';
    if (milliseconds < 1000) return `${milliseconds}ms`;
    if (milliseconds < 60000) return `${Math.round(milliseconds / 1000)}s`;
    return `${Math.round(milliseconds / 60000)}m`;
  };

  const formatNodeType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getOptimizationStatus = () => {
    const successRate = performance_metrics.success_rate;
    const engagementScore = performance_metrics.engagement_score;
    const interactions = interaction_stats.total_interactions;

    if (!successRate || interactions < 10) {
      return { level: 'insufficient_data', message: 'Need more data', color: 'default' };
    }
    if (successRate < 0.6) {
      return { level: 'needs_improvement', message: 'Needs optimization', color: 'error' };
    }
    if (successRate > 0.9) {
      return { level: 'excellent', message: 'Performing excellently', color: 'success' };
    }
    return { level: 'good', message: 'Performing well', color: 'success' };
  };

  const performanceLevel = getPerformanceLevel(performance_metrics.success_rate);
  const trendDirection = getTrendDirection(performance_metrics.success_rate);
  const optimizationStatus = getOptimizationStatus();

  return (
    <Card
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          boxShadow: 6,
          transform: 'translateY(-2px)',
        } : {},
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: compact ? 2 : 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              <NodeIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" noWrap sx={{ maxWidth: 200 }}>
                {node_info.title || 'Untitled Node'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatNodeType(node_info.node_type)}
              </Typography>
            </Box>
          </Box>
          {onMenuClick && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick(e);
              }}
            >
              <MoreVertIcon />
            </IconButton>
          )}
        </Box>

        {/* Performance Level Indicator */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Performance Level
            </Typography>
            {getTrendIcon(trendDirection)}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={(performance_metrics.success_rate || 0) * 100}
              color={performanceLevel.color}
              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
            />
            <Chip
              label={performanceLevel.level}
              size="small"
              color={performanceLevel.color}
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={compact ? 1 : 2}>
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color={performanceLevel.color}>
                {formatSuccessRate(performance_metrics.success_rate)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Success Rate
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                <TimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="h6">
                  {formatTime(performance_metrics.avg_completion_time_ms)}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Avg. Time
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Additional Metrics */}
        {!compact && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <StatsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2" fontWeight="medium">
                      {interaction_stats.total_interactions}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Interactions
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <UsersIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2" fontWeight="medium">
                      {interaction_stats.unique_users}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Users
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" fontWeight="medium">
                    {node_info.difficulty_level || 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Difficulty
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Optimization Hints */}
        {showOptimizationHints && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <OptimizeIcon fontSize="small" sx={{ color: optimizationStatus.color + '.main' }} />
              <Typography variant="caption" color="text.secondary">
                Optimization Status
              </Typography>
            </Box>
            <Chip
              label={optimizationStatus.message}
              size="small"
              color={optimizationStatus.color as 'default' | 'success' | 'error'}
              variant="outlined"
            />
          </Box>
        )}

        {/* Engagement Score */}
        {performance_metrics.engagement_score && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Engagement: {(performance_metrics.engagement_score * 100).toFixed(0)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={performance_metrics.engagement_score * 100}
              color="info"
              sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default NodePerformanceCard;