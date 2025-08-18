/**
 * Node Detail Page
 * Comprehensive analytics dashboard for individual learning nodes
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Avatar,
  Tabs,
  Tab,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemAvatar,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AccountTree as NodeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as TimeIcon,
  People as UsersIcon,
  Assessment as StatsIcon,
  Lightbulb as OptimizeIcon,
  School as ActivityIcon,
  Tag as ConceptIcon,
  Analytics as AnalyticsIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

import { useNode } from '../hooks/useNodes';
import { 
  useNodeAnalytics, 
  useContentOptimization, 
  useNodePerformanceTrends, 
  useNodeInsights 
} from '../hooks/useNodeAnalytics';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import NodePerformanceCard from '../components/NodePerformanceCard';
import { SettingsProvider } from '../contexts/SettingsContext';
import { TrueFalseNode } from '../player/TrueFalseNode';
import { UnifiedQuestionNode } from '../player/UnifiedQuestionNode';
import { ShortAnswerNode } from '../player/ShortAnswerNode';
import { LikertScaleNode } from '../player/LikertScaleNode';
import { RatingNode } from '../player/RatingNode';
import { MatrixNode } from '../player/MatrixNode';
import { SliderNode } from '../player/SliderNode';
import { TextAreaNode } from '../player/TextAreaNode';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const NodeDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(0);

  // Extract nodeId from the path manually (since we use custom routing in App.tsx)
  const pathSegments = location.pathname.split('/');
  const nodesIndex = pathSegments.indexOf('nodes');
  const nodeId = nodesIndex !== -1 && pathSegments[nodesIndex + 1] ? pathSegments[nodesIndex + 1] : null;

  console.log('NodeDetailPage: Component rendered with path:', location.pathname);
  console.log('NodeDetailPage: Extracted nodeId:', nodeId);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Fetch node data and analytics
  const { node, isLoading: nodeLoading, error: nodeError } = useNode(nodeId || null);
  const { 
    data: analytics, 
    isLoading: analyticsLoading, 
    refetch: refetchAnalytics 
  } = useNodeAnalytics(nodeId || null);
  const { 
    data: optimization, 
    getHighPrioritySuggestions 
  } = useContentOptimization(nodeId || null);
  const { 
    data: trends 
  } = useNodePerformanceTrends(nodeId || null, '30d');
  
  // Derive insights from analytics
  const insights = useNodeInsights(analytics);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    navigate(`/app/nodes/${nodeId}/edit`);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this node? This action cannot be undone.')) {
      // TODO: Implement delete functionality
      navigate('/app/nodes');
    }
    handleMenuClose();
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

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'low_success_rate':
      case 'high_success_rate':
        return <StatsIcon />;
      case 'slow_completion':
        return <TimeIcon />;
      case 'low_engagement':
        return <UsersIcon />;
      default:
        return <OptimizeIcon />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <ErrorIcon color="error" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <SuccessIcon color="success" />;
      default:
        return <OptimizeIcon />;
    }
  };

  if (nodeLoading && !node) {
    return <LoadingSpinner />;
  }

  if (nodeError || !node) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {nodeError || 'Node not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <IconButton onClick={() => navigate('/app/nodes')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" component="h1">
            NODE DETAILS
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<ShareIcon />} size="small">
            Share
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} size="small">
            Export
          </Button>
          <IconButton onClick={handleMenuClick} size="small">
            <MoreVertIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Main Node Info Card */}
      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, mt: 0.5 }}>
            <NodeIcon />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            {/* Node Header */}
            <Typography variant="h5" gutterBottom>
              {node.title || 'Untitled Node'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {node.description || 'No description available'}
            </Typography>
            
            {/* Metadata Chips */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip label={formatNodeType(node.node_type)} color="primary" size="small" />
              <Chip label={`ID: ${node.id.slice(0, 8)}...`} variant="outlined" size="small" />
              {node.difficulty_level && (
                <Chip label={`Level ${node.difficulty_level}`} variant="outlined" size="small" />
              )}
              <Chip 
                label={`Created ${new Date(node.created_at).toLocaleDateString()}`} 
                variant="outlined" 
                size="small"
              />
              <Chip 
                label={`Updated ${new Date(node.updated_at).toLocaleDateString()}`} 
                variant="outlined" 
                size="small"
              />
            </Box>

            {/* Performance Summary Cards */}
            {analyticsLoading ? (
              <LinearProgress sx={{ mt: 2 }} />
            ) : analytics ? (
              <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                <Paper sx={{ p: 2, minWidth: 120, textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">
                    {formatSuccessRate(analytics.performance_metrics.success_rate)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Success Rate
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 120, textAlign: 'center' }}>
                  <Typography variant="h6">
                    {formatTime(analytics.performance_metrics.avg_completion_time_ms)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg. Time
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 120, textAlign: 'center' }}>
                  <Typography variant="h6">
                    {analytics.interaction_stats.total_interactions}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Interactions
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 120, textAlign: 'center' }}>
                  <Typography variant="h6">
                    {analytics.interaction_stats.unique_users}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Users
                  </Typography>
                </Paper>
                {insights && (
                  <Paper sx={{ p: 2, minWidth: 120, textAlign: 'center' }}>
                    <Chip
                      label={insights.performance_rating}
                      color={getPerformanceColor(insights.performance_rating) as any}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                    <Typography variant="caption" color="text.secondary" display="block">
                      Rating
                    </Typography>
                  </Paper>
                )}
              </Box>
            ) : null}
          </Box>
        </Box>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Content Preview" />
          <Tab label="Analytics" />
          <Tab label="Optimization" />
          <Tab label="Usage" />
          <Tab label="Raw Data" />
        </Tabs>
      </Box>

      {/* Content Preview Tab */}
      <TabPanel value={currentTab} index={0}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NodeIcon />
              Content Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Interactive preview of how this node appears to learners
            </Typography>
            <Box 
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 3,
                bgcolor: 'background.default',
                minHeight: 300,
              }}
            >
              {node.content ? (
                (() => {
                  // Create a properly formatted NLJ node for the renderer
                  const nljNode = {
                    // Ensure all required BaseNode properties
                    id: node.content.id || node.id,
                    type: node.content.type || node.node_type,
                    x: 0,
                    y: 0,
                    width: 400,
                    height: 200,
                    // Copy all content properties
                    ...node.content,
                    // Add optional properties that might be expected
                    title: node.title,
                    description: node.description,
                  };
                  
                  // Create a minimal scenario for SettingsProvider (same as AssessmentPreview)
                  const previewScenario = {
                    id: 'preview',
                    name: 'Node Preview',
                    nodes: [nljNode],
                    links: [],
                    variableDefinitions: []
                  };
                  
                  // Common props for all components (same as AssessmentPreview)
                  const commonProps = {
                    disabled: true, // Always disabled in preview
                    onAnswer: () => {}, // No-op
                    onChoiceSelect: () => {}, // No-op
                    onContinue: () => {}, // No-op
                  };
                  
                  // Render the appropriate component based on node type
                  const renderPreview = () => {
                    try {
                      switch (node.node_type) {
                        case 'true_false':
                          return (
                            <TrueFalseNode
                              question={nljNode as any}
                              {...commonProps}
                            />
                          );
                        
                        case 'multiple_choice':
                        case 'question':
                          return (
                            <UnifiedQuestionNode
                              question={nljNode as any}
                              choices={node.content.choices || []}
                              {...commonProps}
                            />
                          );
                        
                        case 'short_answer':
                          return (
                            <ShortAnswerNode
                              question={nljNode as any}
                              {...commonProps}
                            />
                          );
                          
                        case 'likert_scale':
                          return (
                            <LikertScaleNode
                              question={nljNode as any}
                              {...commonProps}
                            />
                          );
                          
                        case 'rating':
                          return (
                            <RatingNode
                              question={nljNode as any}
                              {...commonProps}
                            />
                          );
                          
                        case 'matrix':
                          return (
                            <MatrixNode
                              question={nljNode as any}
                              {...commonProps}
                            />
                          );
                          
                        case 'slider':
                          return (
                            <SliderNode
                              question={nljNode as any}
                              {...commonProps}
                            />
                          );
                          
                        case 'text_area':
                          return (
                            <TextAreaNode
                              question={nljNode as any}
                              {...commonProps}
                            />
                          );
                        
                        default:
                          return (
                            <Alert severity="info">
                              <Typography variant="body2">
                                Preview not available for node type: {node.node_type}
                              </Typography>
                            </Alert>
                          );
                      }
                    } catch (error) {
                      console.error('Error rendering preview:', error);
                      return (
                        <Alert severity="error">
                          <Typography variant="body2">
                            Error rendering preview: {(error as Error).message}
                          </Typography>
                        </Alert>
                      );
                    }
                  };
                  
                  return (
                    <SettingsProvider scenario={previewScenario}>
                      {renderPreview()}
                    </SettingsProvider>
                  );
                })()
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No content available for preview
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={currentTab} index={1}>
        {analytics && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Performance Trends */}
            {trends && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Trends (Last 30 Days)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Chip
                      icon={trends.summary.trend_direction === 'improving' ? 
                        <TrendingUpIcon /> : <TrendingDownIcon />}
                      label={`${trends.summary.trend_direction.toUpperCase()} Trend`}
                      color={trends.summary.trend_direction === 'improving' ? 'success' : 'error'}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Success rate changed by {trends.summary.period_comparison.success_rate_change > 0 ? '+' : ''}
                      {trends.summary.period_comparison.success_rate_change.toFixed(1)}%
                    </Typography>
                  </Box>
                  {/* TODO: Add chart component here */}
                  <Alert severity="info">
                    Chart visualization will be implemented in future iterations
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Key Insights and Learning Concepts - Side by Side */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
              {/* Key Insights */}
              {insights && (
                <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '400px' } }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Key Insights
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Strengths
                        </Typography>
                        <List dense>
                          {insights.key_strengths.map((strength, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <SuccessIcon color="success" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={strength} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Areas for Improvement
                        </Typography>
                        <List dense>
                          {insights.improvement_areas.map((area, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <WarningIcon color="warning" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={area} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Learning Concepts */}
              <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '400px' } }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Learning Concepts
                    </Typography>
                    {analytics.learning_concepts.has_concepts ? (
                      <Box>
                        {analytics.learning_concepts.learning_objectives.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Learning Objectives
                            </Typography>
                            {analytics.learning_concepts.learning_objectives.map((objective) => (
                              <Chip
                                key={objective.id}
                                label={objective.text}
                                size="small"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        )}
                        {analytics.learning_concepts.keywords.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Keywords
                            </Typography>
                            {analytics.learning_concepts.keywords.map((keyword) => (
                              <Chip
                                key={keyword.id}
                                label={keyword.text}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No learning concepts tagged for this node yet.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        )}
      </TabPanel>

      {/* Optimization Tab */}
      <TabPanel value={currentTab} index={2}>
        {optimization && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Optimization Score: {(optimization.optimization_score * 100).toFixed(0)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={optimization.optimization_score * 100}
                  color={optimization.optimization_score > 0.7 ? 'success' : 
                         optimization.optimization_score > 0.5 ? 'warning' : 'error'}
                  sx={{ height: 8, borderRadius: 4, mb: 2 }}
                />
              </CardContent>
            </Card>

            {/* High Priority Suggestions */}
            {getHighPrioritySuggestions().length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="error">
                    High Priority Issues
                  </Typography>
                  <List>
                    {getHighPrioritySuggestions().map((suggestion, index) => (
                      <ListItem key={index}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'error.main' }}>
                            {getSuggestionIcon(suggestion.type)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={suggestion.title}
                          secondary={suggestion.description}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* All Suggestions */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  All Optimization Suggestions
                </Typography>
                <List>
                  {optimization.suggestions.map((suggestion, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        {getSeverityIcon(suggestion.severity)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">
                              {suggestion.title}
                            </Typography>
                            <Chip
                              label={suggestion.severity}
                              size="small"
                              color={suggestion.severity === 'high' ? 'error' : 
                                     suggestion.severity === 'medium' ? 'warning' : 'success'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              {suggestion.description}
                            </Typography>
                            <Typography variant="subtitle2" gutterBottom>
                              Recommendations:
                            </Typography>
                            <ul>
                              {suggestion.recommendations.map((rec, recIndex) => (
                                <li key={recIndex}>
                                  <Typography variant="body2">{rec}</Typography>
                                </li>
                              ))}
                            </ul>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Box>
        )}
      </TabPanel>

      {/* Usage Tab */}
      <TabPanel value={currentTab} index={3}>
        {analytics && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activity Usage
              </Typography>
              {analytics.activity_usage.activities.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Activity</TableCell>
                        <TableCell align="center">Position</TableCell>
                        <TableCell align="center">Interactions</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.activity_usage.activities.map((activity) => (
                        <TableRow key={activity.activity_id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ActivityIcon />
                              <Typography variant="subtitle2">
                                {activity.activity_title}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            Position {activity.position_in_activity}
                          </TableCell>
                          <TableCell align="center">
                            {activity.interactions}
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              onClick={() => navigate(`/app/activities/${activity.activity_id}`)}
                            >
                              View Activity
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  This node is not currently used in any activities.
                </Typography>
              )}
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* Raw Content Tab */}
      <TabPanel value={currentTab} index={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Raw Node Data
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                fontSize: '0.875rem',
                margin: 0,
                fontFamily: 'monospace',
                color: 'inherit',
                backgroundColor: 'transparent'
              }}>
                {JSON.stringify(node, null, 2)}
              </pre>
            </Paper>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit Node
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          Delete Node
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default NodeDetailPage;