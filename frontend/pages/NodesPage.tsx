/**
 * Nodes Management Page
 * Browse, filter, and manage individual learning nodes with performance insights
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Alert,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Pagination,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  AccountTree as NodeIcon,
  FilterList as FilterIcon,
  ViewModule as CardViewIcon,
  TableRows as TableViewIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingIcon,
  Speed as PerformanceIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Compare as CompareIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { useNodes } from '../hooks/useNodes';
import { useTrendingNodes } from '../hooks/useNodeAnalytics';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { Node } from '../services/nodeService';

const NodesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeType, setSelectedNodeType] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [selectedPerformance, setSelectedPerformance] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('nlj-nodes-view-mode');
    return (saved === 'card' || saved === 'table') ? saved : 'table';
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  const pageSize = 20;
  
  // Use nodes hook with filters
  const {
    nodes,
    total,
    isLoading,
    error,
    updateParams,
    removeNode,
    searchNodesQuery,
    clearSearch,
    isSearchMode,
  } = useNodes({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    node_type: selectedNodeType || undefined,
    search: searchQuery || undefined,
    sort_by: 'updated_at',
    sort_order: 'desc',
  });

  // Get trending nodes for insights
  const { 
    data: trendingData, 
    isLoading: trendingLoading 
  } = useTrendingNodes(7, 5);

  const handleNodeClick = (node: Node) => {
    console.log('NodesPage: handleNodeClick called with node:', node);
    console.log('NodesPage: Navigating to:', `/app/nodes/${node.id}`);
    navigate(`/app/nodes/${node.id}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchNodesQuery(query, {
        node_types: selectedNodeType ? [selectedNodeType] : undefined,
        min_success_rate: selectedPerformance === 'high' ? 80 : 
                         selectedPerformance === 'medium' ? 60 : undefined,
        max_difficulty: selectedDifficulty ? parseInt(selectedDifficulty) : undefined,
      });
    } else {
      clearSearch();
    }
    setCurrentPage(1);
  };

  const handleFilterChange = () => {
    updateParams({
      node_type: selectedNodeType || undefined,
      offset: 0, // Reset to first page
    });
    setCurrentPage(1);
  };

  useEffect(() => {
    if (!isSearchMode) {
      handleFilterChange();
    }
  }, [selectedNodeType, selectedDifficulty, selectedPerformance, isSearchMode]);

  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newView: 'card' | 'table' | null) => {
    if (newView) {
      setViewMode(newView);
      localStorage.setItem('nlj-nodes-view-mode', newView);
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    updateParams({
      offset: (page - 1) * pageSize,
    });
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, node: Node) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedNode(node);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedNode(null);
  };

  const handleViewNode = () => {
    if (selectedNode) {
      navigate(`/app/nodes/${selectedNode.id}`);
    }
    handleMenuClose();
  };

  const handleEditNode = () => {
    if (selectedNode) {
      navigate(`/app/nodes/${selectedNode.id}/edit`);
    }
    handleMenuClose();
  };

  const handleDeleteNode = async () => {
    if (selectedNode && window.confirm(`Are you sure you want to delete this node? This action cannot be undone.`)) {
      try {
        await removeNode(selectedNode.id);
        setSuccessMessage('Node deleted successfully!');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete node');
      }
    }
    handleMenuClose();
  };

  const handleCompareNodes = () => {
    if (selectedNodes.length > 1) {
      navigate(`/app/nodes/compare?nodes=${selectedNodes.join(',')}`);
    }
  };

  const getPerformanceColor = (successRate: number | null) => {
    if (!successRate) return 'default';
    const rate = successRate * 100;
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'warning';
    return 'error';
  };

  const formatSuccessRate = (rate: number | null) => {
    if (rate === null || rate === undefined) return 'N/A';
    return `${(rate * 100).toFixed(1)}%`;
  };

  const formatDifficultyLevel = (level: number | null) => {
    if (level === null || level === undefined) return 'N/A';
    return `Level ${level}`;
  };

  const nodeTypes = ['true_false', 'multiple_choice', 'likert_scale', 'rating', 'text_area', 'slider', 'matrix', 'short_answer'];
  const difficultyLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading && nodes.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Failed to load nodes. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Learning Nodes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage individual learning components with performance insights
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedNodes.length > 1 && (
            <Button
              variant="outlined"
              startIcon={<CompareIcon />}
              onClick={handleCompareNodes}
            >
              Compare ({selectedNodes.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/app/nodes/create')}
            sx={{ height: 'fit-content' }}
          >
            Create Node
          </Button>
        </Box>
      </Box>

      {/* Trending Nodes Insight */}
      {!trendingLoading && trendingData && trendingData.trending_nodes.length > 0 && (
        <Card sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TrendingIcon color="primary" />
            <Typography variant="h6">Trending Nodes (Last 7 Days)</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {trendingData.trending_nodes.slice(0, 3).map((node) => (
              <Chip
                key={node.node_id}
                label={`${node.title || 'Untitled'} (${node.recent_interactions} interactions)`}
                size="small"
                clickable
                onClick={() => navigate(`/app/nodes/${node.node_id}`)}
              />
            ))}
          </Box>
        </Card>
      )}

      {/* Search and Filters */}
      <Card sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search nodes by title, type, or content..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth>
              <InputLabel>Node Type</InputLabel>
              <Select
                value={selectedNodeType}
                onChange={(e) => setSelectedNodeType(e.target.value)}
                label="Node Type"
              >
                <MenuItem value="">All Types</MenuItem>
                {nodeTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                label="Difficulty"
              >
                <MenuItem value="">All Levels</MenuItem>
                {difficultyLevels.map((level) => (
                  <MenuItem key={level} value={level.toString()}>
                    Level {level}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {total} nodes {isSearchMode && '(filtered)'}
              </Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewModeChange}
                aria-label="view mode"
                size="small"
              >
                <ToggleButton value="card" aria-label="card view">
                  <CardViewIcon sx={{ mr: 0.5 }} />
                  Cards
                </ToggleButton>
                <ToggleButton value="table" aria-label="table view">
                  <TableViewIcon sx={{ mr: 0.5 }} />
                  Table
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Loading indicator during background loading */}
      {isLoading && nodes.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Nodes Display */}
      {nodes.length === 0 && !isLoading ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <NodeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No nodes found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || selectedNodeType || selectedDifficulty
              ? 'Try adjusting your search or filters'
              : 'Create your first node to get started with node-level analytics'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/app/nodes/create')}
          >
            Create Node
          </Button>
        </Card>
      ) : viewMode === 'card' ? (
        <Grid container spacing={3}>
          {nodes.map((node) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={node.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 6 }
                }}
                onClick={() => handleNodeClick(node)}
              >
                <Box sx={{ p: 2, flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                      <NodeIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="subtitle2" noWrap sx={{ flexGrow: 1 }}>
                      {node.title || 'Untitled Node'}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, node)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Chip 
                      label={node.node_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      size="small" 
                      sx={{ mb: 1 }}
                    />
                    {node.difficulty_level && (
                      <Chip
                        label={formatDifficultyLevel(node.difficulty_level)}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 1, mb: 1 }}
                      />
                    )}
                  </Box>

                  {node.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {node.description}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ p: 2, pt: 0, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Success Rate
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {formatSuccessRate(node.success_rate)}
                        </Typography>
                        <Chip
                          label=""
                          size="small"
                          color={getPerformanceColor(node.success_rate)}
                          sx={{ width: 8, height: 8, minHeight: 8, '& .MuiChip-label': { display: 'none' } }}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Last Updated
                      </Typography>
                      <Typography variant="body2">
                        {new Date(node.updated_at).toLocaleDateString()}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Node</TableCell>
                  <TableCell align="center">Type</TableCell>
                  <TableCell align="center">Difficulty</TableCell>
                  <TableCell align="center">Success Rate</TableCell>
                  <TableCell align="center">Avg. Time</TableCell>
                  <TableCell align="center">Updated</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {nodes.map((node) => (
                  <TableRow
                    key={node.id}
                    hover
                    onClick={() => handleNodeClick(node)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                          <NodeIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" noWrap>
                            {node.title || 'Untitled Node'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {node.id.slice(0, 8)}...
                          </Typography>
                          {node.description && (
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {node.description.slice(0, 50)}...
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={node.node_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {formatDifficultyLevel(node.difficulty_level)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Typography variant="body2">
                          {formatSuccessRate(node.success_rate)}
                        </Typography>
                        <Chip
                          label=""
                          size="small"
                          color={getPerformanceColor(node.success_rate)}
                          sx={{ width: 8, height: 8, minHeight: 8, '& .MuiChip-label': { display: 'none' } }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {node.avg_completion_time ? 
                          `${Math.round(node.avg_completion_time / 1000)}s` : 
                          'N/A'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {new Date(node.updated_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        onClick={(e) => handleMenuClick(e, node)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleViewNode}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleViewNode}>
          <ListItemIcon>
            <AnalyticsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Analytics</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEditNode}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Node</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteNode} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete Node</ListItemText>
        </MenuItem>
      </Menu>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
      >
        <Alert severity="success" onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
      >
        <Alert severity="error" onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NodesPage;