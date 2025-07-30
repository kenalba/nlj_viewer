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
  GetApp as ExportIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Send as SubmitIcon
} from '@mui/icons-material';
import type { ContentItem } from '../../api/content';
import { canEditContent, canDeleteContent, canViewAnalytics } from '../../utils/permissions';
import type { User } from '../../api/auth';

interface ItemActionsMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  item: ContentItem;
  user?: User | null;
  onEdit: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
  onSubmitForReview?: (item: ContentItem) => void;
}

export const ItemActionsMenu: React.FC<ItemActionsMenuProps> = ({
  anchorEl,
  open,
  onClose,
  item,
  user,
  onEdit,
  onDelete,
  onSubmitForReview
}) => {
  const canEdit = canEditContent(user);
  const canDelete = canDeleteContent(user);
  const canView = canViewAnalytics(user);

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


  const handleSubmitForReview = useCallback(() => {
    if (onSubmitForReview) {
      handleAction(() => onSubmitForReview(item));
    }
  }, [handleAction, onSubmitForReview, item]);

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
          minWidth: 160, // Reduced from 180
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          border: '1px solid',
          borderColor: 'divider',
          '& .MuiMenuItem-root': {
            py: 0.75, // Reduced padding
            minHeight: 36, // Reduced from default 48
            fontSize: '0.875rem', // Smaller font
          },
          '& .MuiListItemIcon-root': {
            minWidth: 32, // Reduced from 40
          },
          '& .MuiSvgIcon-root': {
            fontSize: '1.1rem', // Smaller icons
          }
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

      {/* Submit for Review - show for any item that can be edited */}
      {canEdit && onSubmitForReview && (
        <MenuItem onClick={handleSubmitForReview}>
          <ListItemIcon>
            <SubmitIcon color="info" />
          </ListItemIcon>
          <ListItemText primary="Submit for Review" />
        </MenuItem>
      )}

      <MenuItem onClick={handleDuplicate}>
        <ListItemIcon>
          <DuplicateIcon />
        </ListItemIcon>
        <ListItemText primary="Duplicate" />
      </MenuItem>

      {/* Analytics & Export */}
      <Divider />
      
      {canView && (
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