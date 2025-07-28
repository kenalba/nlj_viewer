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
  Grid2 as Grid,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
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
  TableRows as TableViewIcon,
  FileUpload as ImportIcon,
  RateReview as RequestReviewIcon,
  ChangeCircle as ChangeStatusIcon
} from '@mui/icons-material';
import { useGameContext } from '../contexts/GameContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { contentApi, ContentItem, ContentFilters } from '../api/content';
import { CreateActivityModal } from '../shared/CreateActivityModal';
import { ImportActivityModal } from '../shared/ImportActivityModal';
import { RequestReviewModal } from '../shared/RequestReviewModal';
import type { ActivityTemplate } from '../utils/activityTemplates';
import type { NLJScenario } from '../types/nlj';

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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [requestReviewModalOpen, setRequestReviewModalOpen] = useState(false);
  const [bulkStatusChangeLoading, setBulkStatusChangeLoading] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    // Load view mode from localStorage, default to 'card'
    const saved = localStorage.getItem('nlj-activities-view-mode');
    return (saved === 'card' || saved === 'table') ? saved : 'card';
  });

  const { loadScenario } = useGameContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Clear selection when content changes
  useEffect(() => {
    setSelectedRowIds([]);
  }, [content]);

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

  // Clear row selection when content changes to prevent stale references
  useEffect(() => {
    setSelectedRowIds([]);
  }, [content]);

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
      headerName: 'Title & Description',
      flex: 1,
      minWidth: 300,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ py: 1 }}>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 600, 
              lineHeight: 1.2,
              mb: 0.5
            }}
          >
            {params.row.title}
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              fontSize: '0.85rem',
              lineHeight: 1.3,
              wordBreak: 'break-word',
              maxHeight: '4rem'
            }}
          >
            {params.row.description || 'No description available'}
          </Typography>
        </Box>
      )
    },
    {
      field: 'content_type',
      headerName: 'Type',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          <Box sx={{ color: getIconColor(params.value), fontSize: '1.1rem' }}>
            {getContentIcon(params.value)}
          </Box>
          <Chip 
            label={params.value} 
            size="small" 
            sx={{
              backgroundColor: getContentTypeColor(params.value),
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem',
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
      width: 120,
      align: 'center',
      headerAlign: 'center',
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
      width: 100,
      align: 'center',
      headerAlign: 'center',
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
      width: 90,
      align: 'center',
      headerAlign: 'center',
      type: 'number'
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      )
    },
    {
      field: 'workflow_status',
      headerName: 'Review Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        const status = params.row.state || 'published';
        const getStatusColor = (status: string) => {
          switch (status) {
            case 'draft': return 'default';
            case 'submitted': return 'warning';
            case 'in_review': return 'info';
            case 'approved': return 'success';
            case 'published': return 'success';
            case 'rejected': return 'error';
            default: return 'default';
          }
        };
        return (
          <Chip 
            label={status.replace('_', ' ').toUpperCase()} 
            size="small" 
            color={getStatusColor(status) as any}
            variant="outlined"
          />
        );
      }
    },
    {
      field: 'version',
      headerName: 'Version',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          v1.0
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
        user && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) ? (
          <Box display="flex" gap={0.5} justifyContent="center">
            <Tooltip title={
              params.row.content_type === 'game' ? 'Play Game' : 
              params.row.content_type === 'survey' ? 'Take Survey' : 'Start Training'
            }>
              <IconButton
                size="small"
                onClick={() => handlePlayContent(params.row)}
                sx={{ 
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark'
                  }
                }}
              >
                <PlayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Activity">
              <IconButton
                size="small"
                onClick={() => handleEditContent(params.row)}
                sx={{ 
                  backgroundColor: 'grey.100',
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.50',
                    color: 'primary.dark'
                  }
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Tooltip title={
            params.row.content_type === 'game' ? 'Play Game' : 
            params.row.content_type === 'survey' ? 'Take Survey' : 'Start Training'
          }>
            <IconButton
              size="small"
              onClick={() => handlePlayContent(params.row)}
              sx={{ 
                backgroundColor: 'primary.main',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'primary.dark'
                }
              }}
            >
              <PlayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      )
    }
  ];

  const handlePlayContent = async (item: ContentItem) => {
    console.log('🎯 PLAY BUTTON CLICKED! Item ID:', item.id);
    
    try {
      // Fetch the full content item with nlj_data (list endpoint only returns ContentSummary)
      console.log('🔍 Fetching full content item from API...');
      const fullContentItem = await contentApi.get(item.id);
      console.log('🔍 Full content item:', fullContentItem);
      console.log('🔍 nlj_data:', fullContentItem.nlj_data);
      
      // Reconstruct the full scenario structure from the database format
      const fullScenario = {
        id: fullContentItem.id,
        name: fullContentItem.title,
        description: fullContentItem.description || '',
        nodes: fullContentItem.nlj_data?.nodes || [],
        links: fullContentItem.nlj_data?.links || [],
        variableDefinitions: fullContentItem.nlj_data?.variableDefinitions || []
      };
      
      console.log('🔍 Reconstructed scenario:', fullScenario);
      console.log('🔍 Scenario nodes:', fullScenario.nodes);
      console.log('🔍 Start node:', fullScenario.nodes.find(n => n.type === 'start'));
      
      // Store content in localStorage for game state persistence
      localStorage.setItem(`scenario_${fullScenario.id}`, JSON.stringify(fullScenario));
      
      // Load the scenario in game context with the complete scenario object
      loadScenario(fullScenario);
      
      // Navigate to content-aware play URL
      navigate(`/app/play/${item.id}`);
      
    } catch (error) {
      console.error('🚨 Failed to fetch full content item:', error);
      // TODO: Show user-friendly error message
    }
  };

  const handleEditContent = (item: ContentItem) => {
    // Navigate to Flow Editor with the selected content for editing using proper routing
    navigate(`/app/flow/edit/${item.id}`);
  };

  const handleRequestReview = () => {
    if (selectedRowIds.length > 0) {
      setRequestReviewModalOpen(true);
    }
  };

  const handleReviewRequested = () => {
    // Clear selection and refresh the content list
    setSelectedRowIds([]);
    setSearchTerm(searchTerm); // Trigger refresh
  };

  const getSelectedItems = (): ContentItem[] => {
    if (!Array.isArray(selectedRowIds)) {
      return [];
    }
    return content.filter(item => selectedRowIds.includes(item.id));
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedRowIds.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      
      const result = await workflowApi.bulkChangeStatus(selectedRowIds, newStatus);
      
      // Show success message and refresh content
      console.log(`Successfully updated ${result.updated_count} items to ${newStatus}`);
      
      if (result.skipped_count > 0) {
        console.warn(`${result.skipped_count} items were skipped due to invalid status transitions`);
      }
      
      // Clear selection and refresh content
      setSelectedRowIds([]);
      setSearchTerm(searchTerm); // Trigger refresh
      
    } catch (error) {
      console.error('Failed to change status:', error);
      setError('Failed to change content status. Please try again.');
    } finally {
      setBulkStatusChangeLoading(false);
    }
  };

  const handleCreateActivity = () => {
    setCreateModalOpen(true);
  };

  const handleImportActivity = () => {
    setImportModalOpen(true);
  };

  const handleActivityCreated = (template: ActivityTemplate, name: string, description?: string) => {
    if (template.category === 'blank') {
      // For blank templates, navigate directly to flow editor
      navigate('/app/flow/new');
    } else {
      // For other templates, we could either navigate to flow editor with template data
      // or create the content directly via API. For now, navigate to flow editor
      navigate('/app/flow/new', { 
        state: { 
          template: template.template, 
          name, 
          description 
        } 
      });
    }
  };

  const handleActivityImported = async (scenario: NLJScenario, fileName: string) => {
    try {
      // Create the content item in the database
      const contentData = {
        title: scenario.name,
        description: scenario.description || `Imported from ${fileName}`,
        nlj_data: {
          nodes: scenario.nodes,
          links: scenario.links,
          variableDefinitions: scenario.variableDefinitions
        },
        content_type: 'training' as const, // Default to training for imported content
        learning_style: 'visual' as const, // Default to visual
        is_template: false,
        template_category: 'Imported'
      };

      const createdContent = await contentApi.create(contentData);
      
      console.log('Successfully imported activity:', createdContent.id);
      
      // Refresh the content list to show the new imported activity
      const filters: ContentFilters = {
        state: 'published',
        size: 100,
        sort_by: sortBy,
        sort_order: 'asc'
      };
      
      // Apply current filters
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
      
      if (contentType === 'recent') {
        filteredContent = filteredContent
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);
      }

      setContent(filteredContent);
      setTotal(response.total);
      
      // TODO: Show success notification
      console.log('Activity imported and content list refreshed');
      
    } catch (error) {
      console.error('Failed to import activity:', error);
      // TODO: Show error notification
      alert('Failed to import activity. Please try again.');
    }
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
      {/* Header Row 1: Title and Action Buttons */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {getPageTitle()}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse all activities from the platform library
          </Typography>
        </Box>
        
        {/* Action Buttons for creators/admins */}
        {user && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) && (
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<ImportIcon />}
              onClick={handleImportActivity}
              size="medium"
            >
              Import Activity
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateActivity}
              size="medium"
            >
              New Activity
            </Button>
          </Box>
        )}
      </Box>

      {/* Header Row 2: Search, Filters, and View Toggle */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {/* Left side: Search and Filters */}
          <Box display="flex" alignItems="center" gap={2} flex={1} flexWrap="wrap">
            {/* Search Field */}
            <TextField
              size="small"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />

            {/* Type Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
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
            
            {/* Sort Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
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

            {/* Learning Style Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
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

            {/* Results Count */}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {content.length} of {total} activities
            </Typography>
          </Box>

          {/* Middle: Selection Actions */}
          {selectedRowIds.length > 0 && (
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {selectedRowIds.length} selected
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<RequestReviewIcon />}
                onClick={handleRequestReview}
                sx={{ minWidth: 'auto' }}
              >
                Request Review
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ChangeStatusIcon />}
                onClick={() => handleBulkStatusChange('draft')}
                disabled={bulkStatusChangeLoading}
                sx={{ minWidth: 'auto' }}
              >
                Set to Draft
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ChangeStatusIcon />}
                onClick={() => handleBulkStatusChange('published')}
                disabled={bulkStatusChangeLoading}
                sx={{ minWidth: 'auto' }}
              >
                Set to Published
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => setSelectedRowIds([])}
                sx={{ minWidth: 'auto' }}
              >
                Clear
              </Button>
            </Box>
          )}

          {/* Right side: View Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newView) => {
                if (newView) {
                  setViewMode(newView);
                  localStorage.setItem('nlj-activities-view-mode', newView);
                  // Clear selection when switching views
                  setSelectedRowIds([]);
                }
              }}
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
                  px: 1.5,
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
                  px: 1.5,
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
                  {/* Role-based button display */}
                  {user && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) ? (
                    <Box display="flex" gap={1} width="100%">
                      <Button
                        variant="contained"
                        startIcon={<PlayIcon />}
                        onClick={() => handlePlayContent(item)}
                        sx={{ height: '40px', flex: 1 }}
                      >
                        {item.content_type === 'game' ? 'Play' : 
                         item.content_type === 'survey' ? 'Take' : 'Start'}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditContent(item)}
                        sx={{ height: '40px', minWidth: '80px' }}
                      >
                        Edit
                      </Button>
                    </Box>
                  ) : (
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
                  )}
                </CardActions>
              </Card>
          ))}
        </Box>
      ) : (
        <Box>
          {/* Table View with Simplified MUI DataGrid */}
          {content.length > 0 && content.every(item => item.id) ? (
            <DataGrid
              rows={content}
              columns={columns}
              initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 15 },
                },
              }}
              pageSizeOptions={[10, 15, 25, 50]}
              checkboxSelection={true}
              disableRowSelectionOnClick={false}
              onRowSelectionModelChange={(newSelection) => {
                if (Array.isArray(newSelection)) {
                  setSelectedRowIds(newSelection as string[]);
                } else if (newSelection && typeof newSelection === 'object' && 'ids' in newSelection) {
                  // Handle the {type: 'include', ids: Set(...)} format
                  const ids = Array.from(newSelection.ids as Set<string>);
                  setSelectedRowIds(ids);
                } else {
                  setSelectedRowIds([]);
                }
              }}
              autoHeight
              sx={{
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                },
                '& .MuiDataGrid-row': {
                  minHeight: '80px !important',
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
                },
                // Ensure action buttons align with table edge
                '& .MuiDataGrid-cell:last-child': {
                  paddingRight: '16px',
                },
                '& .MuiDataGrid-columnHeader:last-child': {
                  paddingRight: '16px',
                }
              }}
            />
          ) : content.length > 0 ? (
            <Box textAlign="center" py={8}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Some activity data is malformed. Please contact support.
                </Typography>
              </Alert>
            </Box>
          ) : (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No activities found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchTerm || typeFilter !== 'all' || learningStyleFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'No activities available yet'
                }
              </Typography>
            </Box>
          )}
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


      {/* Create Activity Modal */}
      <CreateActivityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onActivityCreated={handleActivityCreated}
      />

      {/* Import Activity Modal */}
      <ImportActivityModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onActivityImported={handleActivityImported}
      />

      {/* Request Review Modal */}
      <RequestReviewModal
        open={requestReviewModalOpen}
        contentItems={getSelectedItems()}
        onClose={() => {
          setRequestReviewModalOpen(false);
        }}
        onReviewRequested={handleReviewRequested}
      />
    </Box>
  );
};

export default ContentLibrary;