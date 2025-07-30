/**
 * Bulk Actions Menu Component
 * Provides a clean dropdown interface for bulk content operations
 * Implements progressive disclosure pattern to reduce UI clutter
 */

import React, { useState, useCallback } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Publish as PublishIcon,
  Unpublished as UnpublishIcon,
  Cancel as RejectIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

interface BulkActionsMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  userRole?: string;
  selectedCount: number;
  loading: boolean;
  onPublishContent: () => void;
  onUnpublishContent: () => void;
  onRejectContent: () => void;
  onDeleteItems: () => void;
}

export const BulkActionsMenu: React.FC<BulkActionsMenuProps> = ({
  anchorEl,
  open,
  onClose,
  userRole,
  selectedCount,
  loading,
  onPublishContent,
  onUnpublishContent,
  onRejectContent,
  onDeleteItems
}) => {
  const canReject = userRole && ['reviewer', 'approver', 'admin'].includes(userRole.toLowerCase());
  const canPublish = userRole && ['creator', 'reviewer', 'approver', 'admin'].includes(userRole.toLowerCase());

  const handleAction = useCallback((action: () => void) => {
    onClose();
    action();
  }, [onClose]);

  if (selectedCount === 0) return null;

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      PaperProps={{
        sx: {
          minWidth: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          border: '1px solid',
          borderColor: 'divider'
        }
      }}
    >
      {/* Publishing Actions */}
      {canPublish && (
        <>
          <MenuItem 
            onClick={() => handleAction(onPublishContent)}
            disabled={loading}
          >
            <ListItemIcon>
              {loading ? <CircularProgress size={20} /> : <PublishIcon color="success" />}
            </ListItemIcon>
            <ListItemText 
              primary="Publish"
              secondary={`Make ${selectedCount} items public`}
            />
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleAction(onUnpublishContent)}
            disabled={loading}
          >
            <ListItemIcon>
              {loading ? <CircularProgress size={20} /> : <UnpublishIcon color="warning" />}
            </ListItemIcon>
            <ListItemText 
              primary="Unpublish"
              secondary={`Return ${selectedCount} items to draft`}
            />
          </MenuItem>
        </>
      )}

      {/* Review Actions */}
      {canReject && (
        <>
          {canPublish && <Divider />}
          <MenuItem 
            onClick={() => handleAction(onRejectContent)}
            disabled={loading}
          >
            <ListItemIcon>
              {loading ? <CircularProgress size={20} /> : <RejectIcon color="error" />}
            </ListItemIcon>
            <ListItemText 
              primary="Reject"
              secondary={`Reject ${selectedCount} submissions`}
            />
          </MenuItem>
        </>
      )}

      {/* Management Actions */}
      <Divider />
      <MenuItem 
        onClick={() => handleAction(onDeleteItems)}
        disabled={loading}
        sx={{ 
          color: 'error.main',
          '&:hover': {
            backgroundColor: 'error.50'
          }
        }}
      >
        <ListItemIcon>
          {loading ? <CircularProgress size={20} /> : <DeleteIcon color="error" />}
        </ListItemIcon>
        <ListItemText 
          primary="Delete"
          secondary={`Permanently remove ${selectedCount} items`}
        />
      </MenuItem>
    </Menu>
  );
};