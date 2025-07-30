/**
 * Item Actions Menu Component
 * Provides a dropdown menu for individual activity actions
 * Contextually shows actions based on content state and user permissions
 */

import React, { useCallback } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  Analytics as AnalyticsIcon,
  FolderOpen as MoveIcon,
  GetApp as ExportIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import type { ContentItem } from '../../api/content';

interface ItemActionsMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  item: ContentItem;
  userRole?: string;
  onEdit: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
}

export const ItemActionsMenu: React.FC<ItemActionsMenuProps> = ({
  anchorEl,
  open,
  onClose,
  item,
  userRole,
  onEdit,
  onDelete
}) => {
  const canEdit = userRole && ['creator', 'reviewer', 'approver', 'admin'].includes(userRole.toLowerCase());
  const canDelete = userRole && ['creator', 'admin'].includes(userRole.toLowerCase());
  const canViewAnalytics = userRole && ['creator', 'reviewer', 'approver', 'admin'].includes(userRole.toLowerCase());

  const handleAction = useCallback((action: () => void) => {
    onClose();
    action();
  }, [onClose]);

  const handleEdit = useCallback(() => {
    handleAction(() => onEdit(item));
  }, [handleAction, onEdit, item]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      handleAction(() => onDelete(item));
    }
  }, [handleAction, onDelete, item]);

  const handleDuplicate = useCallback(() => {
    handleAction(() => {
      // TODO: Implement duplicate functionality
      console.log('Duplicating:', item.title);
    });
  }, [handleAction, item]);

  const handleViewAnalytics = useCallback(() => {
    handleAction(() => {
      // TODO: Navigate to analytics view
      console.log('Viewing analytics for:', item.title);
    });
  }, [handleAction, item]);

  const handleExport = useCallback(() => {
    handleAction(() => {
      // TODO: Implement export functionality
      console.log('Exporting:', item.title);
    });
  }, [handleAction, item]);

  const handleMove = useCallback(() => {
    handleAction(() => {
      // TODO: Implement move to category functionality
      console.log('Moving:', item.title);
    });
  }, [handleAction, item]);

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          minWidth: 180,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          border: '1px solid',
          borderColor: 'divider'
        }
      }}
    >
      {/* Content Actions */}
      {canEdit && (
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon color="primary" />
          </ListItemIcon>
          <ListItemText primary="Edit Activity" />
        </MenuItem>
      )}

      <MenuItem onClick={handleDuplicate}>
        <ListItemIcon>
          <DuplicateIcon />
        </ListItemIcon>
        <ListItemText primary="Duplicate" />
      </MenuItem>

      {canEdit && (
        <MenuItem onClick={handleMove}>
          <ListItemIcon>
            <MoveIcon />
          </ListItemIcon>
          <ListItemText primary="Move to Category" />
        </MenuItem>
      )}

      {/* Analytics & Export */}
      <Divider />
      
      {canViewAnalytics && (
        <MenuItem onClick={handleViewAnalytics}>
          <ListItemIcon>
            <AnalyticsIcon color="info" />
          </ListItemIcon>
          <ListItemText primary="View Analytics" />
        </MenuItem>
      )}

      <MenuItem onClick={handleExport}>
        <ListItemIcon>
          <ExportIcon />
        </ListItemIcon>
        <ListItemText primary="Export" />
      </MenuItem>

      {/* Destructive Actions */}
      {canDelete && onDelete && (
        <>
          <Divider />
          <MenuItem 
            onClick={handleDelete}
            sx={{ 
              color: 'error.main',
              '&:hover': {
                backgroundColor: 'error.50'
              }
            }}
          >
            <ListItemIcon>
              <DeleteIcon color="error" />
            </ListItemIcon>
            <ListItemText primary="Delete" />
          </MenuItem>
        </>
      )}
    </Menu>
  );
};