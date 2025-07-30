/**
 * User Table Toolbar Component
 * Provides bulk actions and search functionality for the user table
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Paper,
  Chip
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as ActivateIcon,
  Block as BlockIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

interface UserTableToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCount: number;
  totalCount: number;
  userRole?: string;
  bulkActionLoading: boolean;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
  onBulkDelete: () => void;
}

export const UserTableToolbar: React.FC<UserTableToolbarProps> = ({
  searchTerm,
  onSearchChange,
  selectedCount,
  totalCount,
  userRole,
  bulkActionLoading,
  onBulkActivate,
  onBulkDeactivate,
  onBulkDelete
}) => {
  const canPerformBulkActions = userRole === 'admin' && selectedCount > 0;

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Search users by name, username, or email..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1 }}
          size="small"
        />
        
        <Typography variant="body2" color="text.secondary">
          {totalCount} users total
        </Typography>
      </Box>

      {canPerformBulkActions && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            label={`${selectedCount} selected`}
            color="primary"
            size="small"
          />
          
          <Button
            variant="outlined"
            startIcon={<ActivateIcon />}
            onClick={onBulkActivate}
            disabled={bulkActionLoading}
            size="small"
          >
            Activate
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<BlockIcon />}
            onClick={onBulkDeactivate}
            disabled={bulkActionLoading}
            size="small"
          >
            Deactivate
          </Button>
          
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onBulkDelete}
            disabled={bulkActionLoading}
            size="small"
          >
            Delete
          </Button>
        </Box>
      )}
    </Paper>
  );
};