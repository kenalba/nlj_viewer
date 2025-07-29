/**
 * Toolbar component for ContentLibrary
 * Handles search, bulk actions, and selection state display
 * Optimized with memoization to prevent unnecessary re-renders
 */

import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button
} from '@mui/material';
import {
  FileUpload as ImportIcon,
  RateReview as RequestReviewIcon,
  ChangeCircle as ChangeStatusIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

interface ContentLibraryToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
  selectedCount: number;
  userRole?: string;
  bulkStatusChangeLoading: boolean;
  onSubmitForReview: () => void;
  onPublishContent: () => void;
  onRejectContent: () => void;
  onDeleteItems: () => void;
}

export const ContentLibraryToolbar = React.memo(({
  searchTerm,
  onSearchChange,
  filteredCount,
  totalCount,
  selectedCount,
  userRole,
  bulkStatusChangeLoading,
  onSubmitForReview,
  onPublishContent,
  onRejectContent,
  onDeleteItems
}: ContentLibraryToolbarProps) => {
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const canPerformBulkActions = userRole && ['creator', 'reviewer', 'approver', 'admin'].includes(userRole);
  const canReject = userRole && ['reviewer', 'approver', 'admin'].includes(userRole);

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
          onChange={handleSearchChange}
          sx={{ minWidth: '200px' }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {filteredCount} of {totalCount} activities
        </Typography>
      </Box>
      
      {/* Bulk actions when items are selected */}
      {selectedCount > 0 && canPerformBulkActions && (
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
            {selectedCount} selected
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RequestReviewIcon />}
            onClick={onSubmitForReview}
            disabled={bulkStatusChangeLoading}
            color="primary"
          >
            Submit for Review
          </Button>
          <Button
            variant="contained" 
            size="small"
            startIcon={<ChangeStatusIcon />}
            onClick={onPublishContent}
            disabled={bulkStatusChangeLoading}
            color="success"
          >
            Publish
          </Button>
          {canReject && (
            <Button
              variant="outlined" 
              size="small"
              onClick={onRejectContent}
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
            onClick={onDeleteItems}
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