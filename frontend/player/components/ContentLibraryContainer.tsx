/**
 * Main container for ContentLibrary with optimized state management
 * Uses Set-based selection and memoized components for optimal performance
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
// Removed DataGrid dependency
import {
  Add as AddIcon,
  FileUpload as ImportIcon,
  ViewModule as CardViewIcon,
  TableRows as TableViewIcon
} from '@mui/icons-material';
import { useGameContext } from '../../contexts/GameContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { contentApi } from '../../api/content';
import type { ContentItem, ContentFilters } from '../../api/content';
import { getAllowedContentStates, canEditContent, canCreateContent, canPerformBulkActions } from '../../utils/permissions';
import { workflowApi } from '../../api/workflow';
import { CreateActivityModal } from '../../shared/CreateActivityModal';
import { ImportActivityModal } from '../../shared/ImportActivityModal';
import type { ActivityTemplate } from '../../utils/activityTemplates';
import type { NLJScenario } from '../../types/nlj';
import { ContentTable } from './ContentTable';
import { ContentCardGrid } from './ContentCardGrid';
import { ContentLibraryToolbar } from './ContentLibraryToolbar';

interface ContentLibraryContainerProps {
  contentType: 'all' | 'training' | 'survey' | 'game' | 'recent';
}

export const ContentLibraryContainer: React.FC<ContentLibraryContainerProps> = ({ contentType }) => {
  // State management with Set-based selection for optimal performance
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Optimized selection state using Set for O(1) lookups
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('nlj-activities-view-mode');
    return (saved === 'card' || saved === 'table') ? saved : 'table';
  });

  const { loadScenario } = useGameContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Toast notification helper
  const showToast = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  }, []);

  // Memoized filtering for optimal performance
  const filteredContent = useMemo(() => {
    if (!searchTerm) return content;
    const searchLower = searchTerm.toLowerCase();
    return content.filter(item => {
      // Ensure item has required properties before filtering
      if (!item || !item.id || !item.title || !item.content_type) {
        return false;
      }
      
      return (
        item.title.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        item.content_type.toLowerCase().includes(searchLower) ||
        (item.learning_style && item.learning_style.toLowerCase().includes(searchLower))
      );
    });
  }, [content, searchTerm]);

  // Optimized selection handler for simple Table
  const handleSelectionChange = useCallback((newSelectedIds: Set<string>) => {
    setSelectedIds(newSelectedIds);
  }, []);

  // Memoized selection utilities for optimal performance
  const getSelectedItems = useCallback((): ContentItem[] => {
    return filteredContent.filter(item => selectedIds.has(String(item.id)));
  }, [filteredContent, selectedIds]);

  const getSelectedCount = useCallback((): number => {
    return selectedIds.size;
  }, [selectedIds]);

  // Clear selection when content changes
  useEffect(() => {
    if (content.length === 0 && selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  }, [content.length, selectedIds.size]);

  // Optimized content handlers
  const handlePlayContent = useCallback(async (item: ContentItem) => {
    try {
      const fullContentItem = await contentApi.get(item.id);
      
      const fullScenario = {
        id: fullContentItem.id.toString(),
        name: fullContentItem.title,
        description: fullContentItem.description || '',
        nodes: fullContentItem.nlj_data?.nodes || [],
        links: fullContentItem.nlj_data?.links || [],
        variableDefinitions: fullContentItem.nlj_data?.variableDefinitions || [],
        orientation: 'portrait' as const,
        activityType: 'training' as const
      };
      
      localStorage.setItem(`scenario_${fullScenario.id}`, JSON.stringify(fullScenario));
      loadScenario(fullScenario);
      navigate(`/app/play/${item.id}`);
      
    } catch (error) {
      console.error('Failed to fetch full content item:', error);
      showToast('Failed to load activity. Please try again.', 'error');
    }
  }, [loadScenario, navigate, showToast]);

  const handleEditContent = useCallback((item: ContentItem) => {
    navigate(`/app/flow/edit/${item.id}`);
  }, [navigate]);

  // Bulk action handlers
  const handleSubmitForReview = useCallback(() => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;
    navigate('/app/submit-review', { state: { contentItems: selectedItems } });
  }, [getSelectedItems, navigate]);

  const handlePublishContent = useCallback(async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      
      let publishedCount = 0;
      let skippedCount = 0;
      const results = [];
      
      for (const item of selectedItems) {
        try {
          if (item.state === 'approved') {
            // Use proper publish API for approved content
            await workflowApi.publishVersion({ version_id: item.id });
            publishedCount++;
            results.push({ id: item.id, title: item.title, action: 'published', success: true });
          } else if (item.state === 'draft') {
            // Use bulk status change to publish draft content directly for admin users
            // This maintains the workflow integrity while allowing admin override
            await workflowApi.bulkChangeStatus([String(item.id)], 'published');
            publishedCount++;
            results.push({ id: item.id, title: item.title, action: 'published', success: true });
          } else {
            // Skip items that can't be published
            skippedCount++;
            results.push({ 
              id: item.id, 
              title: item.title, 
              action: 'skipped', 
              success: false, 
              reason: `Cannot publish from ${item.state} state` 
            });
          }
        } catch (itemError) {
          console.error(`Failed to publish ${item.title}:`, itemError);
          skippedCount++;
          results.push({ 
            id: item.id, 
            title: item.title, 
            action: 'failed', 
            success: false, 
            reason: itemError.message || 'Unknown error' 
          });
        }
      }
      
      // Update local state optimistically for successful items
      const successfulIds = results.filter(r => r.success).map(r => r.id);
      if (successfulIds.length > 0) {
        setContent(prevContent => 
          prevContent.map(item => 
            successfulIds.includes(item.id) 
              ? { ...item, state: 'published' as const, published_at: new Date().toISOString() }
              : item
          )
        );
      }
      
      setSelectedIds(new Set());
      
      // Show detailed success/error messages
      if (publishedCount > 0 && skippedCount === 0) {
        showToast(`Successfully published ${publishedCount} items`);
      } else if (publishedCount > 0 && skippedCount > 0) {
        showToast(`Published ${publishedCount} items, skipped ${skippedCount} items`, 'info');
      } else if (skippedCount > 0) {
        showToast(`Unable to publish ${skippedCount} items. Check their current status.`, 'error');
      }
      
    } catch (error) {
      console.error('Failed to publish content:', error);
      showToast('Failed to publish content. Please try again.', 'error');
    } finally {
      setBulkStatusChangeLoading(false);
    }
  }, [getSelectedItems, showToast]);

  const handleRejectContent = useCallback(async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      
      let rejectedCount = 0;
      let skippedCount = 0;
      const results = [];
      
      for (const item of selectedItems) {
        try {
          if (item.state === 'in_review' || item.state === 'submitted') {
            await workflowApi.bulkChangeStatus([String(item.id)], 'rejected');
            rejectedCount++;
            results.push({ id: item.id, title: item.title, success: true });
          } else {
            // Skip items that can't be rejected
            skippedCount++;
            results.push({ 
              id: item.id, 
              title: item.title, 
              success: false, 
              reason: `Cannot reject from ${item.state} state` 
            });
          }
        } catch (itemError) {
          console.error(`Failed to reject ${item.title}:`, itemError);
          skippedCount++;
          results.push({ 
            id: item.id, 
            title: item.title, 
            success: false, 
            reason: itemError.message || 'Unknown error' 
          });
        }
      }
      
      // Update local state optimistically for successful items
      const successfulIds = results.filter(r => r.success).map(r => r.id);
      if (successfulIds.length > 0) {
        setContent(prevContent => 
          prevContent.map(item => 
            successfulIds.includes(item.id) 
              ? { ...item, state: 'rejected' as const }
              : item
          )
        );
      }
      
      setSelectedIds(new Set());
      
      // Show detailed success/error messages
      if (rejectedCount > 0 && skippedCount === 0) {
        showToast(`Successfully rejected ${rejectedCount} items`, 'info');
      } else if (rejectedCount > 0 && skippedCount > 0) {
        showToast(`Rejected ${rejectedCount} items, skipped ${skippedCount} items`, 'info');
      } else if (skippedCount > 0) {
        showToast(`Unable to reject ${skippedCount} items. Check their current status.`, 'error');
      }
      
    } catch (error) {
      console.error('Failed to reject content:', error);
      showToast('Failed to reject content. Please try again.', 'error');
    } finally {
      setBulkStatusChangeLoading(false);
    }
  }, [getSelectedItems, showToast]);

  const handleUnpublishContent = useCallback(async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      
      let unpublishedCount = 0;
      let skippedCount = 0;
      const results = [];
      
      for (const item of selectedItems) {
        try {
          if (item.state === 'published') {
            await workflowApi.bulkChangeStatus([String(item.id)], 'draft');
            unpublishedCount++;
            results.push({ id: item.id, title: item.title, success: true });
          } else {
            // Skip items that can't be unpublished
            skippedCount++;
            results.push({ 
              id: item.id, 
              title: item.title, 
              success: false, 
              reason: `Cannot unpublish from ${item.state} state` 
            });
          }
        } catch (itemError) {
          console.error(`Failed to unpublish ${item.title}:`, itemError);
          skippedCount++;
          results.push({ 
            id: item.id, 
            title: item.title, 
            success: false, 
            reason: itemError.message || 'Unknown error' 
          });
        }
      }
      
      // Update local state optimistically for successful items
      const successfulIds = results.filter(r => r.success).map(r => r.id);
      if (successfulIds.length > 0) {
        setContent(prevContent => 
          prevContent.map(item => 
            successfulIds.includes(item.id) 
              ? { ...item, state: 'draft' as const, published_at: null }
              : item
          )
        );
      }
      
      setSelectedIds(new Set());
      
      // Show detailed success/error messages
      if (unpublishedCount > 0 && skippedCount === 0) {
        showToast(`Successfully unpublished ${unpublishedCount} items`);
      } else if (unpublishedCount > 0 && skippedCount > 0) {
        showToast(`Unpublished ${unpublishedCount} items, skipped ${skippedCount} items`, 'info');
      } else if (skippedCount > 0) {
        showToast(`Unable to unpublish ${skippedCount} items. Only published content can be unpublished.`, 'error');
      }
      
    } catch (error) {
      console.error('Failed to unpublish content:', error);
      showToast('Failed to unpublish content. Please try again.', 'error');
    } finally {
      setBulkStatusChangeLoading(false);
    }
  }, [getSelectedItems, showToast]);

  const handleDeleteItems = useCallback(() => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;
    setDeleteConfirmOpen(true);
  }, [getSelectedItems]);

  const handleDeleteSingleItem = useCallback((item: ContentItem) => {
    // Set the item to be deleted and open confirmation dialog
    setSelectedIds(new Set([String(item.id)]));
    setDeleteConfirmOpen(true);
  }, []);

  const handleSubmitSingleItemForReview = useCallback((item: ContentItem) => {
    // Navigate to the submit for review page with this single item
    navigate('/app/submit-review', { state: { contentItems: [item] } });
  }, [navigate]);

  const handleConfirmArchive = useCallback(async () => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      setBulkStatusChangeLoading(true);
      
      for (const item of selectedItems) {
        try {
          if (item.state !== 'draft' && item.state !== 'archived') {
            if (item.state === 'published') {
              await workflowApi.bulkChangeStatus([String(item.id)], 'archived');
              continue;
            } else {
              await workflowApi.bulkChangeStatus([String(item.id)], 'draft');
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          try {
            await contentApi.delete(item.id);
          } catch (deleteError: any) {
            if (deleteError.response?.status === 400 || deleteError.response?.status === 403) {
              try {
                await contentApi.update(item.id, { state: 'archived' } as any);
              } catch (archiveError: any) {
                await workflowApi.bulkChangeStatus([String(item.id)], 'archived');
              }
            } else if (deleteError.response?.status !== 404) {
              throw deleteError;
            }
          }
        } catch (itemError: any) {
          console.error(`Failed to process ${item.title}:`, itemError);
          throw itemError;
        }
      }
      
      const processedIds = selectedItems.map(item => item.id);
      setContent(prevContent => prevContent.filter(item => !processedIds.includes(item.id)));
      setTotal(prevTotal => prevTotal - selectedItems.length);
      
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      showToast(`Successfully deleted ${selectedItems.length} items`);
      
    } catch (error: any) {
      console.error('Failed to delete/archive content:', error);
      setError(error.message || 'Failed to delete/archive content. Please try again.');
      setDeleteConfirmOpen(false);
    } finally {
      setBulkStatusChangeLoading(false);
    }
  }, [getSelectedItems, showToast]);

  // Modal handlers
  const handleCreateActivity = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const handleImportActivity = useCallback(() => {
    setImportModalOpen(true);
  }, []);

  const handleActivityCreated = useCallback((template: ActivityTemplate, name: string, description?: string) => {
    if (template.category === 'blank') {
      navigate('/app/flow/new');
    } else {
      navigate('/app/flow/new', { 
        state: { 
          template: template.template, 
          name, 
          description 
        } 
      });
    }
  }, [navigate]);

  const handleActivityImported = useCallback(async (scenario: NLJScenario, fileName: string) => {
    try {
      const contentData = {
        title: scenario.name,
        description: `Imported from ${fileName}`,
        nlj_data: {
          nodes: scenario.nodes,
          links: scenario.links,
          variableDefinitions: scenario.variableDefinitions
        },
        content_type: 'training' as const,
        learning_style: 'visual' as const,
        is_template: false,
        template_category: 'Imported'
      };

      await contentApi.create(contentData);
      
      // Refresh content list
      const filters: ContentFilters = {
        size: 100,
        sort_by: 'title',
        sort_order: 'asc'
      };
      
      if (contentType !== 'all' && contentType !== 'recent') {
        filters.content_type = contentType;
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
      showToast('Activity imported successfully');
      
    } catch (error) {
      console.error('Failed to import activity:', error);
      showToast('Failed to import activity. Please try again.', 'error');
    }
  }, [contentType, showToast]);

  const handleViewModeChange = useCallback((event: React.MouseEvent<HTMLElement>, newView: 'card' | 'table' | null) => {
    if (newView) {
      setViewMode(newView);
      localStorage.setItem('nlj-activities-view-mode', newView);
      setSelectedIds(new Set());
    }
  }, []);

  // Extract fetchContent function so it can be reused for retry
  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null); // Clear any previous errors
    try {
      const allowedStates = getAllowedContentStates(user);

      const filters: ContentFilters = {
        ...(canEditContent(user) ? {} : { state: 'published' }),
        size: 100,
        sort_by: 'title',
        sort_order: 'asc'
      };

      if (contentType !== 'all' && contentType !== 'recent') {
        filters.content_type = contentType;
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
    } catch (err) {
      console.error('Failed to fetch content:', err);
      setError('Failed to load activities. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [contentType, user?.role]);

  // Fetch content from API
  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

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
          <Box key={index} sx={{ width: 340, height: 360 }}>
            <Skeleton variant="rectangular" width="100%" height="100%" />
          </Box>
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
          <Button color="inherit" onClick={fetchContent}>
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
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {getPageTitle()}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse all activities from the platform library
          </Typography>
        </Box>
        
        {canEditContent(user) && (
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


      {/* Search and view controls */}
      <ContentLibraryToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filteredCount={filteredContent.length}
        totalCount={content.length}
        selectedCount={getSelectedCount()}
        user={user}
        bulkStatusChangeLoading={bulkStatusChangeLoading}
        onSubmitForReview={handleSubmitForReview}
        onPublishContent={handlePublishContent}
        onUnpublishContent={handleUnpublishContent}
        onRejectContent={handleRejectContent}
        onDeleteItems={handleDeleteItems}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Content Display */}
      {viewMode === 'card' ? (
        <ContentCardGrid
          content={filteredContent}
          user={user}
          onPlayContent={handlePlayContent}
          onEditContent={handleEditContent}
        />
      ) : (
        <Box>
          
          {filteredContent.length > 0 ? (
            filteredContent.every(item => item.id) ? (
              <ContentTable
                content={filteredContent}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                user={user}
                onPlayContent={handlePlayContent}
                onEditContent={handleEditContent}
                onDeleteContent={handleDeleteSingleItem}
                onSubmitForReview={handleSubmitSingleItemForReview}
              />
            ) : (
              <Box textAlign="center" py={8}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Some activity data is malformed. Please contact support.
                  </Typography>
                </Alert>
              </Box>
            )
          ) : (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No activities found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search or filter criteria.
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
          {canCreateContent(user) && (
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

      {/* Modals */}
      <CreateActivityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onActivityCreated={handleActivityCreated}
      />

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