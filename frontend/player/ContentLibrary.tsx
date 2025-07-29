/**
 * Activities Library Component
 * Displays all activities from the database with unified filtering and search
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Snackbar,
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
import { 
  DataGrid
} from '@mui/x-data-grid';
import type { 
  GridColDef, 
  GridRenderCellParams,
  GridRowSelectionModel
} from '@mui/x-data-grid';
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
  ChangeCircle as ChangeStatusIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useGameContext } from '../contexts/GameContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { contentApi, ContentItem, ContentFilters } from '../api/content';
import { workflowApi } from '../api/workflow';
import type { WorkflowTemplateType } from '../types/workflow';
import { CreateActivityModal } from '../shared/CreateActivityModal';
import { ImportActivityModal } from '../shared/ImportActivityModal';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error' | 'info'>('success');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkStatusChangeLoading, setBulkStatusChangeLoading] = useState(false);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Helper function to show toast notifications
  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  };
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    // Load view mode from localStorage, default to 'card'
    const saved = localStorage.getItem('nlj-activities-view-mode');
    return (saved === 'card' || saved === 'table') ? saved : 'card';
  });

  // Handle row selection changes
  const handleRowSelectionModelChange = (newRowSelectionModel: GridRowSelectionModel) => {
    console.log('Selected rows:', newRowSelectionModel);
    setRowSelectionModel(newRowSelectionModel);
  };

  const getSelectedItems = (): ContentItem[] => {
    // Handle both array format (v7) and object format (v8)
    let selectedIds: any[] = [];
    
    if (Array.isArray(rowSelectionModel)) {
      selectedIds = rowSelectionModel;
    } else if (rowSelectionModel && typeof rowSelectionModel === 'object' && 'ids' in rowSelectionModel) {
      // MUI DataGrid v8 format: {type: 'include', ids: Set(...)}
      selectedIds = Array.from(rowSelectionModel.ids as Set<any>);
    }
    
    return filteredContent.filter(item => selectedIds.includes(item.id));
  };

  const getSelectedCount = (): number => {
    if (Array.isArray(rowSelectionModel)) {
      return rowSelectionModel.length;
    } else if (rowSelectionModel && typeof rowSelectionModel === 'object' && 'ids' in rowSelectionModel) {
      return (rowSelectionModel.ids as Set<any>).size;
    }
    return 0;
  };

  // Handle submit for review - navigates to dedicated page
  const handleSubmitForReview = () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;
    navigate('/app/submit-review', { state: { contentItems: selectedItems } });
  };

  const handlePublishContent = async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      
      for (const item of selectedItems) {
        // For approved content, we can publish directly
        if (item.state === 'approved') {
          // Find the latest version and publish it
          await workflowApi.publishVersion({
            version_id: item.id // Assuming content has version info
          });
        } else if (item.state === 'draft') {
          // For draft content, create version -> workflow -> approve -> publish
          const version = await workflowApi.createVersion({
            content_id: item.id,
            nlj_data: item.nlj_data || {},
            title: item.title,
            description: item.description
          });
          
          const workflow = await workflowApi.createWorkflow({
            version_id: version.id,
            requires_approval: false, // Skip approval for direct publish
            auto_publish: true
          });
          
          await workflowApi.submitForReview({
            version_id: version.id
          });
        }
      }
      
      console.log(`Successfully published ${selectedItems.length} items`);
      setRowSelectionModel([]);
      
      // Show success toast
      const itemCount = selectedItems.length;
      const itemText = itemCount === 1 ? 'item' : 'items';
      showToast(`Successfully approved and published ${itemCount} ${itemText}`);
      
      window.location.reload();
      
    } catch (error) {
      console.error('Failed to publish content:', error);
      setError('Failed to publish content. Please try again.');
    } finally {
      setBulkStatusChangeLoading(false);
    }
  };

  const handleRejectContent = async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      
      for (const item of selectedItems) {
        // Only reject content that's in review
        if (item.state === 'in_review' || item.state === 'submitted') {
          // Find the workflow and reject it
          // This would require getting the workflow ID - for now use bulk status change
          await workflowApi.bulkChangeStatus([String(item.id)], 'rejected');
        }
      }
      
      console.log(`Successfully rejected ${selectedItems.length} items`);
      setRowSelectionModel([]);
      
      // Show success toast
      const itemCount = selectedItems.length;
      const itemText = itemCount === 1 ? 'item' : 'items';
      showToast(`Successfully rejected ${itemCount} ${itemText}`, 'info');
      
      window.location.reload();
      
    } catch (error) {
      console.error('Failed to reject content:', error);
      setError('Failed to reject content. Please try again.');
    } finally {
      setBulkStatusChangeLoading(false);
    }
  };

  const handleDeleteItems = () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmArchive = async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      setError(null); // Clear any existing errors
      setSuccessMessage(null); // Clear any existing success messages
      
      for (const item of selectedItems) {
        try {
          console.log(`Processing deletion for "${item.title}" (state: ${item.state})`);
          
          // Step 1: Handle all non-draft states using workflow system
          if (item.state !== 'draft' && item.state !== 'archived') {
            console.log(`Item is in ${item.state} state, attempting to change to draft or archive...`);
            try {
              // For published content, try to archive directly first
              if (item.state === 'published') {
                console.log(`Attempting to archive published content ${item.title} directly...`);
                await workflowApi.bulkChangeStatus([String(item.id)], 'archived');
                console.log(`Successfully archived published content ${item.title}`);
                continue; // Skip to next item since this one is now archived
              } else {
                // For other states, try to move to draft first
                await workflowApi.bulkChangeStatus([String(item.id)], 'draft');
                console.log(`Successfully moved ${item.title} to draft state`);
                // Small delay to ensure backend state is updated
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (workflowError: any) {
              console.error(`Failed to change state for ${item.title}:`, workflowError);
              // Continue anyway - maybe we can still delete it or archive it through other means
            }
          }
          
          // Step 2: Try to delete the content
          try {
            await contentApi.delete(item.id);
            console.log(`Successfully deleted ${item.title}`);
          } catch (deleteError: any) {
            console.error(`Direct deletion failed for ${item.title}:`, deleteError);
            
            // Step 3: If deletion still fails, try to archive through content API
            if (deleteError.response?.status === 400 || deleteError.response?.status === 403) {
              try {
                console.log(`Attempting to archive ${item.title} via content API...`);
                await contentApi.update(item.id, { state: 'archived' } as any);
                console.log(`Successfully archived ${item.title}`);
              } catch (archiveError: any) {
                console.error(`Failed to archive ${item.title} via content API:`, archiveError);
                
                // Step 4: Try workflow API for archiving
                try {
                  console.log(`Attempting to archive ${item.title} via workflow API...`);
                  await workflowApi.bulkChangeStatus([String(item.id)], 'archived');
                  console.log(`Successfully archived ${item.title} via workflow API`);
                } catch (workflowArchiveError: any) {
                  console.error(`Failed to archive ${item.title} via workflow API:`, workflowArchiveError);
                  throw new Error(`Cannot process "${item.title}": All deletion and archiving methods failed. Content in state '${item.state}' cannot be processed. ${workflowArchiveError.response?.data?.detail || workflowArchiveError.message}`);
                }
              }
            } else if (deleteError.response?.status === 404) {
              console.warn(`Item ${item.title} not found, may have been already deleted`);
              // Continue since it's already gone from backend
            } else {
              throw new Error(`Failed to delete "${item.title}": ${deleteError.response?.data?.detail || deleteError.message}`);
            }
          }
          
        } catch (itemError: any) {
          console.error(`Failed to process ${item.title}:`, itemError);
          throw itemError; // Re-throw to stop the batch operation
        }
      }
      
      // Remove items from local state (whether deleted or archived, they shouldn't show in main view)
      const processedIds = selectedItems.map(item => item.id);
      setContent(prevContent => prevContent.filter(item => !processedIds.includes(item.id)));
      setTotal(prevTotal => prevTotal - selectedItems.length);
      
      console.log(`Successfully processed ${selectedItems.length} items`);
      setRowSelectionModel([]);
      setDeleteConfirmOpen(false);
      
      // Show success toast
      const itemCount = selectedItems.length;
      const itemText = itemCount === 1 ? 'item' : 'items';
      showToast(`Successfully deleted ${itemCount} ${itemText}`);
      
    } catch (error: any) {
      console.error('Failed to delete/archive content:', error);
      setError(error.message || 'Failed to delete/archive content. Please try again.');
      setSuccessMessage(null); // Clear any existing success messages
      setDeleteConfirmOpen(false);
    } finally {
      setBulkStatusChangeLoading(false);
    }
  };




  const { loadScenario } = useGameContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only clear selection when content array length changes (new data loaded)
    // Don't clear when content items are just updated
    console.log('Content changed, checking if selection should be cleared');
    if (content.length === 0 && rowSelectionModel.length > 0) {
      console.log('Content is empty, clearing row selection');
      setRowSelectionModel([]);
    }
  }, [content.length]);

  // Debug: Log rowSelectionModel changes
  useEffect(() => {
    console.log('rowSelectionModel state updated:', rowSelectionModel);
  }, [rowSelectionModel]);

  // Fetch content from API
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        // Determine which content states to show based on user role
        let allowedStates = ['published']; // Default for players
        
        if (user?.role === 'admin') {
          // Admins can see all content states
          allowedStates = ['published', 'approved', 'rejected', 'in_review', 'submitted', 'draft'];
        } else if (user?.role === 'approver') {
          // Approvers can see content that needs approval plus published and rejected
          allowedStates = ['published', 'approved', 'rejected', 'in_review', 'submitted'];
        } else if (user?.role === 'reviewer') {
          // Reviewers can see content they review plus published and rejected
          allowedStates = ['published', 'rejected', 'in_review', 'submitted'];
        } else if (user?.role === 'creator') {
          // Creators can see their own content in all states plus published content
          allowedStates = ['published', 'approved', 'rejected', 'in_review', 'submitted', 'draft'];
        }

        const filters: ContentFilters = {
          // Role-based state filtering
          ...(user?.role === 'creator' || user?.role === 'reviewer' || user?.role === 'approver' || user?.role === 'admin' 
              ? {} 
              : { state: 'published' }
          ),
          size: 100, // Get all content for client-side filtering
          sort_by: 'title',
          sort_order: 'asc'
        };

        // Apply content type filter if not 'all'
        if (contentType !== 'all' && contentType !== 'recent') {
          filters.content_type = contentType;
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
  }, [contentType, user?.role]); // Simplified dependencies - only contentType and user role

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
      align: 'left',
      headerAlign: 'left',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ py: 1, textAlign: 'left', width: '100%' }}>
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
      field: 'updated_at',
      headerName: 'Last Updated',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {new Date(params.row.updated_at).toLocaleDateString()}
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
        size: 100,
        sort_by: 'title',
        sort_order: 'asc'
      };
      
      // Apply current filters
      if (contentType !== 'all' && contentType !== 'recent') {
        filters.content_type = contentType;
      }
      // Removed old filter logic - now handled by DataGrid

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

  // Memoized filtering to improve performance
  const filteredContent = React.useMemo(() => {
    if (!searchTerm) return content;
    const searchLower = searchTerm.toLowerCase();
    return content.filter(item => (
      item.title.toLowerCase().includes(searchLower) ||
      (item.description && item.description.toLowerCase().includes(searchLower)) ||
      item.content_type.toLowerCase().includes(searchLower) ||
      (item.learning_style && item.learning_style.toLowerCase().includes(searchLower))
    ));
  }, [content, searchTerm]);

  const getPageTitle = () => {
    return 'Activities';
  };

  // Enhanced toolbar with selection-based actions
  const CustomToolbar = React.memo(() => {
    const selectedCount = getSelectedCount();
    console.log('CustomToolbar rendered, selectedCount:', selectedCount);
    
    return (
      <Box
        sx={{ 
          p: 2, 
          backgroundColor: 'grey.50', 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1
        }}
      >
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <TextField
            placeholder="Search activities..."
            size="small"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: '200px' }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {filteredContent.length} of {content.length} activities
          </Typography>
        </Box>
        
        {/* Bulk actions when items are selected */}
        {selectedCount > 0 && user && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) && (
          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
              {selectedCount} selected
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RequestReviewIcon />}
              onClick={handleSubmitForReview}
              disabled={bulkStatusChangeLoading}
              color="primary"
            >
              Submit for Review
            </Button>
            <Button
              variant="contained" 
              size="small"
              startIcon={<ChangeStatusIcon />}
              onClick={handlePublishContent}
              disabled={bulkStatusChangeLoading}
              color="success"
            >
              Publish
            </Button>
            {user && ['reviewer', 'approver', 'admin'].includes(user.role) && (
              <Button
                variant="outlined" 
                size="small"
                onClick={handleRejectContent}
                disabled={bulkStatusChangeLoading}
                color="error"
              >
                Reject
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteItems}
              disabled={bulkStatusChangeLoading}
              color="error"
            >
              Delete
            </Button>
          </Box>
        )}
      </Box>
    );
  });

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

      {/* Success Alert */}
      {successMessage && (
        <Alert 
          severity="success" 
          sx={{ mb: 2 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {/* View Toggle and Results Count */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="body2" color="text.secondary">
          {content.length} of {total} activities
        </Typography>
        
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, newView) => {
            if (newView) {
              setViewMode(newView);
              localStorage.setItem('nlj-activities-view-mode', newView);
              setRowSelectionModel([]);
            }
          }}
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

                  {/* Status row - Show content state for non-published content */}
                  {item.state && item.state !== 'published' && (
                    <Box 
                      display="flex" 
                      justifyContent="flex-end" 
                      mb={1}
                      sx={{ height: '24px', minHeight: '24px', flexShrink: 0 }}
                    >
                      <Chip 
                        label={item.state.replace('_', ' ').toUpperCase()} 
                        size="small" 
                        color={
                          item.state === 'draft' ? 'default' :
                          item.state === 'submitted' ? 'warning' :
                          item.state === 'in_review' ? 'info' :
                          item.state === 'approved' ? 'success' :
                          item.state === 'rejected' ? 'error' :
                          'default'
                        }
                        variant="outlined"
                        sx={{ 
                          fontWeight: 600,
                          fontSize: '0.7rem'
                        }}
                      />
                    </Box>
                  )}

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
          {/* Custom Toolbar Above DataGrid */}
          <CustomToolbar />
          
          {/* Table View with MUI DataGrid */}
          {filteredContent.length > 0 && filteredContent.every(item => item.id) ? (
            <DataGrid
              checkboxSelection 
              rows={filteredContent}
              columns={columns}
              getRowId={(row) => row.id}
              initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 15 },
                },
              }}
              pageSizeOptions={[10, 15, 25, 50]}
              onRowSelectionModelChange={handleRowSelectionModelChange}
              hideFooter={false}
              sx={{
                height: Math.min(filteredContent.length * 80 + 120, window.innerHeight - 200), // Auto-size with max height
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 16px',
                  minHeight: '80px',
                },
                '& .MuiDataGrid-cell--textLeft': {
                  justifyContent: 'flex-start',
                },
                '& .MuiDataGrid-cell--textCenter': {
                  justifyContent: 'center',
                },
                '& .MuiDataGrid-cell--textRight': {
                  justifyContent: 'flex-end',
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
                  minHeight: '56px !important',
                },
                '& .MuiDataGrid-columnHeader': {
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                '& .MuiDataGrid-columnHeader--alignLeft': {
                  justifyContent: 'flex-start',
                },
                '& .MuiDataGrid-columnHeader--alignCenter': {
                  justifyContent: 'center',
                },
                '& .MuiDataGrid-columnHeader--alignRight': {
                  justifyContent: 'flex-end',
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
                Try adjusting your search or filter criteria, or check if any filters are applied.
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
            No activities available yet. Create your first activity to get started!
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete {getSelectedCount() === 1 ? 'Activity' : 'Activities'}
        </DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            {getSelectedCount() === 1 
              ? `Are you sure you want to delete "${getSelectedItems()[0]?.title}"? This will withdraw it from any workflows and remove it permanently.`
              : `Are you sure you want to delete ${getSelectedCount()} activities? This will withdraw them from any workflows and remove them permanently.`
            }
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmArchive} 
            color="error" 
            variant="contained"
            autoFocus
          >
            Delete {getSelectedCount() === 1 ? 'Activity' : `${getSelectedCount()} Activities`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notifications */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setToastOpen(false)} 
          severity={toastSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>

    </Box>
  );
};

export default ContentLibrary;