/**
 * Activities Library Component
 * Displays all activities from the database with unified filtering and search
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Tooltip,
  Paper,
  IconButton,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  Quiz as QuizIcon,
  Games as GamesIcon,
  Assessment as AssessmentIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ViewModule as CardViewIcon,
  TableRows as TableViewIcon
} from '@mui/icons-material';
import { useGameContext } from '../contexts/GameContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { contentApi, ContentItem, ContentFilters } from '../api/content';

interface ContentLibraryProps {
  contentType: 'all' | 'training' | 'survey' | 'game' | 'recent';
}

export const ContentLibrary: React.FC<ContentLibraryProps> = ({ contentType }) => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'view_count' | 'completion_count'>('title');
  const [learningStyleFilter, setLearningStyleFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const { loadScenario } = useGameContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch content from API
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const filters: ContentFilters = {
          state: 'published', // Only show published content
          size: 100, // Get more items to show all content
          sort_by: sortBy,
          sort_order: 'asc'
        };

        // Apply filters
        if (contentType !== 'all' && contentType !== 'recent') {
          filters.content_type = contentType;
        }
        
        if (searchTerm.trim()) {
          filters.search = searchTerm.trim();
        }

        if (typeFilter !== 'all') {
          filters.content_type = typeFilter;
        }

        if (learningStyleFilter !== 'all') {
          filters.learning_style = learningStyleFilter;
        }

        const response = await contentApi.list(filters);
        
        let filteredContent = response.items;
        
        // Handle recent filter
        if (contentType === 'recent') {
          filteredContent = filteredContent
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10);
        }

        setContent(filteredContent);
        setTotal(response.total);
      } catch (err) {
        console.error('Failed to fetch content:', err);
        setError('Failed to load activities. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [contentType, searchTerm, typeFilter, sortBy, learningStyleFilter]);

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'training':
        return <PlayIcon />;
      case 'survey':
        return <AssessmentIcon />;
      case 'game':
        return <GamesIcon />;
      default:
        return <QuizIcon />;
    }
  };

  // Get dark colors for chips and icons (matching Flow Editor colors)
  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'training':
        return '#1565C0'; // Dark blue for training/assessment
      case 'survey':
        return '#F57C00'; // Dark amber for survey
      case 'game':
        return '#AD1457'; // Dark pink for games
      case 'assessment':
        return '#2E7D32'; // Dark green for assessments
      default:
        return '#616161'; // Dark grey for mixed/other types
    }
  };

  // Get icon color (same as chip color for consistency)
  const getIconColor = (type: string) => {
    return getContentTypeColor(type);
  };

  // DataGrid column definitions
  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Title',
      width: 300,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {params.row.title}
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              fontSize: '0.8rem',
              lineHeight: 1.2,
              mt: 0.5
            }}
          >
            {params.row.description}
          </Typography>
        </Box>
      )
    },
    {
      field: 'content_type',
      headerName: 'Type',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ color: getIconColor(params.value) }}>
            {getContentIcon(params.value)}
          </Box>
          <Chip 
            label={params.value} 
            size="small" 
            sx={{
              backgroundColor: getContentTypeColor(params.value),
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-label': {
                textTransform: 'capitalize'
              }
            }}
          />
        </Box>
      )
    },
    {
      field: 'learning_style',
      headerName: 'Learning Style',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value?.replace('_', '/') || 'N/A'} 
          size="small" 
          variant="outlined"
        />
      )
    },
    {
      field: 'template_category',
      headerName: 'Category',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value || 'General'} 
          size="small" 
          variant="outlined"
        />
      )
    },
    {
      field: 'view_count',
      headerName: 'Views',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      type: 'number'
    },
    {
      field: 'completion_count',
      headerName: 'Completed',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      type: 'number'
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 110,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayIcon />}
          onClick={() => handlePlayContent(params.row)}
          sx={{ fontSize: '0.75rem' }}
        >
          {params.row.content_type === 'game' ? 'Play' : 
           params.row.content_type === 'survey' ? 'Take' : 'Start'}
        </Button>
      )
    }
  ];

  const handlePlayContent = (item: ContentItem) => {
    // Store content in localStorage (temporary - will use proper API integration)
    localStorage.setItem(`scenario_${item.id}`, JSON.stringify({
      id: item.id,
      name: item.title,
      ...item.nlj_data
    }));
    
    // Load the scenario in game context
    loadScenario(item.id, 'start');
    navigate('/player');
  };

  const handleCreateActivity = () => {
    // Navigate to Flow Editor for creating new content
    navigate('/editor/flow');
  };

  const getPageTitle = () => {
    return 'Activities';
  };

  const renderLoadingSkeleton = () => (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Activities</Typography>
      <Box 
        sx={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          justifyContent: 'flex-start',
          mt: 2
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} sx={{ width: 340, height: 360, minWidth: 340, maxWidth: 340, flexShrink: 0 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="80%" height={20} />
              <Box display="flex" gap={1} mt={2}>
                <Skeleton variant="rectangular" width={80} height={24} />
                <Skeleton variant="rectangular" width={100} height={24} />
              </Box>
            </CardContent>
            <CardActions>
              <Skeleton variant="rectangular" width="100%" height={36} />
            </CardActions>
          </Card>
        ))}
      </Box>
    </Box>
  );

  if (loading) {
    return renderLoadingSkeleton();
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" action={
          <Button color="inherit" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3} sx={{ position: 'relative' }}>
      {/* Header */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h4" gutterBottom>
              {getPageTitle()}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Browse all activities from the platform library
            </Typography>
          </Box>
          
          {/* View Toggle - Make it more prominent */}
          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
            <Typography variant="caption" color="text.secondary">
              View Mode
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newView) => newView && setViewMode(newView)}
              aria-label="view mode"
              size="small"
              sx={{ 
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              <ToggleButton 
                value="card" 
                aria-label="card view"
                sx={{ 
                  px: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    }
                  }
                }}
              >
                <CardViewIcon sx={{ mr: 0.5 }} />
                Cards
              </ToggleButton>
              <ToggleButton 
                value="table" 
                aria-label="table view"
                sx={{ 
                  px: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    }
                  }
                }}
              >
                <TableViewIcon sx={{ mr: 0.5 }} />
                Table
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Box>

      {/* Filters and Search */}
      <Box mb={3}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="training">Training</MenuItem>
                <MenuItem value="survey">Survey</MenuItem>
                <MenuItem value="assessment">Assessment</MenuItem>
                <MenuItem value="game">Game</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <MenuItem value="title">Title</MenuItem>
                <MenuItem value="created_at">Date Created</MenuItem>
                <MenuItem value="view_count">Most Viewed</MenuItem>
                <MenuItem value="completion_count">Most Completed</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Learning Style</InputLabel>
              <Select
                value={learningStyleFilter}
                label="Learning Style"
                onChange={(e) => setLearningStyleFilter(e.target.value)}
              >
                <MenuItem value="all">All Styles</MenuItem>
                <MenuItem value="visual">Visual</MenuItem>
                <MenuItem value="auditory">Auditory</MenuItem>
                <MenuItem value="kinesthetic">Kinesthetic</MenuItem>
                <MenuItem value="reading_writing">Reading/Writing</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {content.length} of {total} activities
            </Typography>
          </Grid>
        </Grid>
      </Box>

      {/* Content Display */}
      {viewMode === 'card' ? (
        /* Card View */
        <Box 
          sx={{ 
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            justifyContent: 'flex-start'
          }}
        >
          {content.map((item) => (
            <Card 
              key={item.id}
              sx={{ 
                width: 340, // Fixed width for consistency
                height: 360, // Fixed height for consistency
                minWidth: 340, // Prevent shrinking
                maxWidth: 340, // Prevent growing
                flexShrink: 0, // Prevent flex shrinking
                display: 'flex', 
                flexDirection: 'column',
                '&:hover': { 
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
            >
                <CardContent sx={{ 
                  flexGrow: 1, 
                  pb: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 'calc(100% - 64px)', // Reserve space for CardActions
                  overflow: 'hidden'
                }}>
                  {/* Header row with icon, type, and views - Fixed height */}
                  <Box 
                    display="flex" 
                    alignItems="center" 
                    gap={1} 
                    mb={2}
                    sx={{ height: '32px', minHeight: '32px', flexShrink: 0 }}
                  >
                    <Box sx={{ color: getIconColor(item.content_type) }}>
                      {getContentIcon(item.content_type)}
                    </Box>
                    <Chip 
                      label={item.content_type} 
                      size="small" 
                      sx={{
                        backgroundColor: getContentTypeColor(item.content_type),
                        color: 'white',
                        fontWeight: 600,
                        '& .MuiChip-label': {
                          textTransform: 'capitalize'
                        }
                      }}
                    />
                    <Box flexGrow={1} />
                    <Tooltip title={`${item.view_count} views`}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <ViewIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {item.view_count}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Box>

                  {/* Title - Fixed height with truncation */}
                  <Typography 
                    variant="h6" 
                    component="h2" 
                    sx={{
                      fontSize: '1.1rem',
                      lineHeight: 1.3,
                      height: '2.6rem',
                      minHeight: '2.6rem',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      flexShrink: 0,
                      mb: 2
                    }}
                  >
                    {item.title}
                  </Typography>
                  
                  {/* Description - Fixed height with truncation */}
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{
                      height: '4.8rem',
                      minHeight: '4.8rem',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      mb: 2,
                      flexShrink: 0
                    }}
                  >
                    {item.description || 'No description available'}
                  </Typography>

                  {/* Tags - Fixed height */}
                  <Box 
                    display="flex" 
                    gap={1} 
                    mb={2} 
                    sx={{ 
                      height: '24px', 
                      minHeight: '24px', 
                      flexShrink: 0,
                      overflow: 'hidden'
                    }}
                  >
                    <Chip 
                      label={item.learning_style?.replace('_', '/') || 'General'} 
                      size="small" 
                      variant="outlined"
                      sx={{ maxWidth: '100px' }}
                    />
                    <Chip 
                      label={item.template_category || 'Default'} 
                      size="small" 
                      variant="outlined"
                      sx={{ maxWidth: '100px' }}
                    />
                  </Box>

                  {/* Footer stats - Fixed at bottom */}
                  <Box 
                    display="flex" 
                    alignItems="center" 
                    justifyContent="space-between" 
                    mt="auto"
                    sx={{ height: '20px', minHeight: '20px', flexShrink: 0 }}
                  >
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <TrendingIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {item.completion_count} completed
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions sx={{ 
                  pt: 0, 
                  pb: 2, 
                  px: 2,
                  height: '64px',
                  minHeight: '64px',
                  flexShrink: 0
                }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={() => handlePlayContent(item)}
                    sx={{ height: '40px' }}
                  >
                    {item.content_type === 'game' ? 'Play' : 
                     item.content_type === 'survey' ? 'Take Survey' : 'Start Training'}
                  </Button>
                </CardActions>
              </Card>
          ))}
        </Box>
      ) : (
        /* Table View with MUI DataGrid */
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={content}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            checkboxSelection={false}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': {
                padding: '8px 16px',
              },
              '& .MuiDataGrid-row': {
                minHeight: '72px !important',
                '&:hover': {
                  backgroundColor: 'action.hover',
                }
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'grey.50',
                borderBottom: '2px solid',
                borderBottomColor: 'divider',
              },
              '& .MuiDataGrid-columnHeader': {
                fontWeight: 600,
              }
            }}
          />
        </Box>
      )}

      {content.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No activities found
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {searchTerm || typeFilter !== 'all' || learningStyleFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'No activities available yet'
            }
          </Typography>
          {user && (user.role === 'creator' || user.role === 'admin') && (
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={handleCreateActivity}
            >
              Create Your First Activity
            </Button>
          )}
        </Box>
      )}

      {/* Floating Action Button for Creating New Activities */}
      {user && (user.role === 'creator' || user.role === 'admin') && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000
          }}
          onClick={handleCreateActivity}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default ContentLibrary;