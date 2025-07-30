/**
 * Toolbar component for ContentLibrary
 * Handles search, bulk actions, and selection state display
 * Optimized with memoization to prevent unnecessary re-renders
 */

import React, { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button
} from '@mui/material';
import {
  FileUpload as ImportIcon,
  RateReview as RequestReviewIcon,
  MoreHoriz as MoreActionsIcon
} from '@mui/icons-material';
import { BulkActionsMenu } from './BulkActionsMenu';
import { canPerformBulkActions } from '../../utils/permissions';
import type { User } from '../../api/auth';

interface ContentLibraryToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
  selectedCount: number;
  user?: User | null;
  bulkStatusChangeLoading: boolean;
  onSubmitForReview: () => void;
  onPublishContent: () => void;
  onUnpublishContent: () => void;
  onRejectContent: () => void;
  onDeleteItems: () => void;
}

export const ContentLibraryToolbar = React.memo(({
  searchTerm,
  onSearchChange,
  filteredCount,
  totalCount,
  selectedCount,
  user,
  bulkStatusChangeLoading,
  onSubmitForReview,
  onPublishContent,
  onUnpublishContent,
  onRejectContent,
  onDeleteItems
}: ContentLibraryToolbarProps) => {
  const [moreActionsAnchor, setMoreActionsAnchor] = useState<HTMLElement | null>(null);
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const handleMoreActionsClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMoreActionsAnchor(event.currentTarget);
  }, []);

  const handleMoreActionsClose = useCallback(() => {
    setMoreActionsAnchor(null);
  }, []);

  const canPerformBulk = canPerformBulkActions(user);

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
      {selectedCount > 0 && canPerformBulk && (
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
            {selectedCount} selected
          </Typography>
          
          {/* Primary Action: Submit for Review */}
          <Button
            variant="contained"
            size="small"
            startIcon={<RequestReviewIcon />}
            onClick={onSubmitForReview}
            disabled={bulkStatusChangeLoading}
            color="primary"
          >
            Review
          </Button>
          
          {/* Secondary Actions: More Menu */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<MoreActionsIcon />}
            onClick={handleMoreActionsClick}
            disabled={bulkStatusChangeLoading}
            color="primary"
            sx={{
              minWidth: 'auto',
              px: 2
            }}
          >
            More
          </Button>
          
          <BulkActionsMenu
            anchorEl={moreActionsAnchor}
            open={Boolean(moreActionsAnchor)}
            onClose={handleMoreActionsClose}
            user={user}
            selectedCount={selectedCount}
            loading={bulkStatusChangeLoading}
            onPublishContent={onPublishContent}
            onUnpublishContent={onUnpublishContent}
            onRejectContent={onRejectContent}
            onDeleteItems={onDeleteItems}
          />
        </Box>
      )}
    </Box>
  );
});