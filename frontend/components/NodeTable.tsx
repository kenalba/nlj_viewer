/**
 * NodeTable Component
 * Reusable table component for displaying nodes with performance metrics and actions
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Checkbox,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  AccountTree as NodeIcon,
  MoreVert as MoreVertIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Speed as PerformanceIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';
import { Node } from '../services/nodeService';

interface NodeTableProps {
  nodes: Node[];
  onNodeClick?: (node: Node) => void;
  onMenuClick?: (event: React.MouseEvent<HTMLElement>, node: Node) => void;
  loading?: boolean;
  selectable?: boolean;
  selectedNodes?: string[];
  onSelectionChange?: (nodeIds: string[]) => void;
  showPerformanceIndicators?: boolean;
  compact?: boolean;
}

export const NodeTable: React.FC<NodeTableProps> = ({
  nodes,
  onNodeClick,
  onMenuClick,
  loading = false,
  selectable = false,
  selectedNodes = [],
  onSelectionChange,
  showPerformanceIndicators = true,
  compact = false,
}) => {
  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? nodes.map(node => node.id) : []);
    }
  };

  const handleSelectNode = (nodeId: string, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedNodes, nodeId]
        : selectedNodes.filter(id => id !== nodeId);
      onSelectionChange(newSelection);
    }
  };

  const isAllSelected = nodes.length > 0 && selectedNodes.length === nodes.length;
  const isIndeterminate = selectedNodes.length > 0 && selectedNodes.length < nodes.length;

  const getPerformanceColor = (successRate: number | null): 'success' | 'warning' | 'error' | 'default' => {
    if (!successRate) return 'default';
    const rate = successRate * 100;
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'warning';
    return 'error';
  };

  const getPerformanceTrend = (node: Node) => {
    // This would be enhanced with actual trend data from the API
    const rate = node.success_rate;
    if (!rate) return null;
    
    // Mock trend logic based on success rate
    if (rate >= 0.8) return 'up';
    if (rate >= 0.6) return 'stable';
    return 'down';
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
      case 'down':
        return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
      case 'stable':
        return <TrendingFlatIcon fontSize="small" sx={{ color: 'warning.main' }} />;
      default:
        return null;
    }
  };

  const formatSuccessRate = (rate: number | null) => {
    if (rate === null || rate === undefined) return 'N/A';
    return `${(rate * 100).toFixed(1)}%`;
  };

  const formatDifficultyLevel = (level: number | null) => {
    if (level === null || level === undefined) return 'N/A';
    return `Level ${level}`;
  };

  const formatNodeType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatCompletionTime = (time: number | null) => {
    if (!time) return 'N/A';
    if (time < 1000) return `${time}ms`;
    return `${Math.round(time / 1000)}s`;
  };

  return (
    <Paper>
      {loading && <LinearProgress />}
      <TableContainer>
        <Table size={compact ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
              )}
              <TableCell>Node</TableCell>
              <TableCell align="center">Type</TableCell>
              {!compact && <TableCell align="center">Difficulty</TableCell>}
              {showPerformanceIndicators && (
                <>
                  <TableCell align="center">Success Rate</TableCell>
                  {!compact && <TableCell align="center">Avg. Time</TableCell>}
                  <TableCell align="center">Performance</TableCell>
                </>
              )}
              <TableCell align="center">Updated</TableCell>
              {onMenuClick && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {nodes.map((node) => (
              <TableRow
                key={node.id}
                hover
                onClick={() => onNodeClick?.(node)}
                sx={{ 
                  cursor: onNodeClick ? 'pointer' : 'default',
                  '&:hover': {
                    backgroundColor: onNodeClick ? 'action.hover' : 'transparent',
                  },
                }}
              >
                {selectable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedNodes.includes(node.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectNode(node.id, e.target.checked);
                      }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: 'primary.main', 
                        width: compact ? 24 : 32, 
                        height: compact ? 24 : 32 
                      }}
                    >
                      <NodeIcon fontSize={compact ? 'small' : 'medium'} />
                    </Avatar>
                    <Box>
                      <Typography 
                        variant={compact ? 'body2' : 'subtitle2'} 
                        noWrap 
                        sx={{ maxWidth: 200 }}
                      >
                        {node.title || 'Untitled Node'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        ID: {node.id.slice(0, 8)}...
                      </Typography>
                      {!compact && node.description && (
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          noWrap
                          sx={{ maxWidth: 200 }}
                        >
                          {node.description.slice(0, 50)}...
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip 
                    label={formatNodeType(node.node_type)} 
                    size="small" 
                    variant="outlined"
                  />
                </TableCell>
                {!compact && (
                  <TableCell align="center">
                    <Typography variant="body2">
                      {formatDifficultyLevel(node.difficulty_level)}
                    </Typography>
                  </TableCell>
                )}
                {showPerformanceIndicators && (
                  <>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {formatSuccessRate(node.success_rate)}
                        </Typography>
                        <Chip
                          label=""
                          size="small"
                          color={getPerformanceColor(node.success_rate)}
                          sx={{ 
                            width: 8, 
                            height: 8, 
                            minHeight: 8, 
                            '& .MuiChip-label': { display: 'none' } 
                          }}
                        />
                      </Box>
                    </TableCell>
                    {!compact && (
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <TimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {formatCompletionTime(node.avg_completion_time)}
                          </Typography>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="Performance trend">
                          {getTrendIcon(getPerformanceTrend(node)) || (
                            <PerformanceIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                          )}
                        </Tooltip>
                        {node.engagement_score && (
                          <Tooltip title={`Engagement: ${(node.engagement_score * 100).toFixed(0)}%`}>
                            <Typography variant="caption" color="text.secondary">
                              {(node.engagement_score * 100).toFixed(0)}%
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </>
                )}
                <TableCell align="center">
                  <Typography variant="body2">
                    {new Date(node.updated_at).toLocaleDateString()}
                  </Typography>
                </TableCell>
                {onMenuClick && (
                  <TableCell align="center">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onMenuClick(e, node);
                      }}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {nodes.length === 0 && !loading && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <NodeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            No nodes to display
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default NodeTable;