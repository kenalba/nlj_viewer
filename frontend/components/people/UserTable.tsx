/**
 * User Table Component
 * Simple MUI table for displaying users with pagination and actions
 * Based on ContentTable.tsx pattern but optimized for user management
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Checkbox,
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../../client/users';
import type { User } from '../../client/auth';
import type { UserListResponse } from '../../client/users';
import { EditUserModal } from './EditUserModal';
import { UserTableToolbar } from './UserTableToolbar';

interface UserTableProps {
  users: User[];
  total: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onRefresh: () => void;
  userRole?: string;
  loading?: boolean;
  onUserUpdated?: (user: User, previousUser?: User) => void;
  onUserDeleted?: (userId: string) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  selectedUsers?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

// Memoized table row component to prevent cascading re-renders
interface UserTableRowProps {
  user: User;
  isSelected: boolean;
  onRowSelect: (id: string, isSelected: boolean) => void;
  onEdit: (user: User) => void;
  onToggleActive: (user: User) => void;
  onDelete: (user: User) => void;
  currentUserRole?: string;
}

const UserTableRow = React.memo(({ 
  user, 
  isSelected, 
  onRowSelect, 
  onEdit,
  onToggleActive,
  onDelete,
  currentUserRole
}: UserTableRowProps) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleCheckboxChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onRowSelect(user.id, event.target.checked);
  }, [user.id, onRowSelect]);

  const handleMenuClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleRowClick = useCallback(() => {
    navigate(`/app/people/${user.id}`);
  }, [navigate, user.id]);

  const handleEdit = useCallback(() => {
    handleMenuClose();
    onEdit(user);
  }, [user, onEdit, handleMenuClose]);

  const handleToggleActive = useCallback(() => {
    handleMenuClose();
    onToggleActive(user);
  }, [user, onToggleActive, handleMenuClose]);

  const handleDelete = useCallback(() => {
    handleMenuClose();
    onDelete(user);
  }, [user, onDelete, handleMenuClose]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'error';
      case 'APPROVER': return 'warning';
      case 'REVIEWER': return 'info';
      case 'CREATOR': return 'success';
      case 'LEARNER': return 'secondary';
      case 'PLAYER': return 'default';
      default: return 'default';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canEdit = currentUserRole === 'admin';
  const canDelete = currentUserRole === 'admin' && user.role !== 'admin';

  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{
        height: '56px',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
      onClick={handleRowClick}
    >
      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          color="primary"
          checked={isSelected}
          onChange={handleCheckboxChange}
          inputProps={{
            'aria-labelledby': `user-table-checkbox-${user.id}`,
          }}
        />
      </TableCell>
      
      <TableCell sx={{ py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
            {getInitials(user.full_name || user.username)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="medium" sx={{ lineHeight: 1.2 }}>
              {user.full_name || user.username}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              @{user.username}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      
      <TableCell sx={{ py: 1 }}>
        <Typography variant="body2">
          {user.email}
        </Typography>
      </TableCell>
      
      <TableCell align="center" sx={{ py: 1 }}>
        <Chip
          label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          color={getRoleColor(user.role)}
          size="small"
          variant="outlined"
          sx={{ height: 24, fontSize: '0.75rem' }}
        />
      </TableCell>
      
      <TableCell align="center" sx={{ py: 1 }}>
        <Chip
          label={user.is_active ? 'Active' : 'Inactive'}
          color={user.is_active ? 'success' : 'default'}
          size="small"
          variant={user.is_active ? 'filled' : 'outlined'}
          sx={{ height: 24, fontSize: '0.75rem' }}
        />
      </TableCell>
      
      <TableCell align="center" sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {new Date(user.created_at).toLocaleDateString()}
        </Typography>
      </TableCell>
      
      <TableCell align="center" sx={{ py: 1 }} onClick={(e) => e.stopPropagation()}>
        {(canEdit || canDelete) && (
          <>
            <IconButton
              size="small"
              onClick={handleMenuClick}
              aria-label="User actions"
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              {canEdit && (
                <MenuItem onClick={handleEdit}>
                  <EditIcon sx={{ mr: 1 }} />
                  Edit User
                </MenuItem>
              )}
              {canEdit && (
                <MenuItem onClick={handleToggleActive}>
                  {user.is_active ? (
                    <>
                      <BlockIcon sx={{ mr: 1 }} />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <ActivateIcon sx={{ mr: 1 }} />
                      Activate
                    </>
                  )}
                </MenuItem>
              )}
              {canDelete && (
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon sx={{ mr: 1 }} />
                  Delete User
                </MenuItem>
              )}
            </Menu>
          </>
        )}
      </TableCell>
    </TableRow>
  );
});

UserTableRow.displayName = 'UserTableRow';

export const UserTable: React.FC<UserTableProps> = ({
  users,
  total,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onRefresh,
  userRole,
  loading = false,
  onUserUpdated,
  onUserDeleted,
  searchTerm = '',
  onSearchChange,
  selectedUsers: externalSelectedUsers,
  onSelectionChange
}) => {
  const [internalSelectedUsers, setInternalSelectedUsers] = useState<Set<string>>(new Set());
  const selectedUsers = externalSelectedUsers || internalSelectedUsers;
  const setSelectedUsers = onSelectionChange || setInternalSelectedUsers;
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedUsers(new Set(users.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  }, [users]);

  const handleRowSelect = useCallback((userId: string, isSelected: boolean) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return newSet;
    });
  }, []);

  const handleEdit = useCallback((user: User) => {
    setEditingUser(user);
    setEditModalOpen(true);
  }, []);

  const handleToggleActive = useCallback(async (user: User) => {
    setActionLoading(true);
    try {
      const updatedUser = await usersAPI.updateUser(user.id, {
        is_active: !user.is_active
      });
      onUserUpdated?.(updatedUser, user);
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      // TODO: Show error toast
    } finally {
      setActionLoading(false);
    }
  }, [onUserUpdated, onRefresh]);

  const handleDelete = useCallback((user: User) => {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingUser) return;
    
    setActionLoading(true);
    try {
      await usersAPI.deleteUser(deletingUser.id);
      onUserDeleted?.(deletingUser.id);
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete user:', error);
      // TODO: Show error toast
    } finally {
      setActionLoading(false);
    }
  }, [deletingUser, onUserDeleted, onRefresh]);

  const handleEditSuccess = useCallback((updatedUser: User) => {
    const previousUser = editingUser;
    setEditModalOpen(false);
    setEditingUser(null);
    onUserUpdated?.(updatedUser, previousUser || undefined);
    onRefresh();
  }, [editingUser, onUserUpdated, onRefresh]);

  // Bulk action handlers
  const handleBulkActivate = useCallback(async () => {
    if (selectedUsers.size === 0) return;
    
    setActionLoading(true);
    try {
      const selectedUserList = users.filter(user => selectedUsers.has(user.id));
      
      for (const user of selectedUserList) {
        if (!user.is_active) {
          await usersAPI.updateUser(user.id, { is_active: true });
        }
      }
      
      setSelectedUsers(new Set());
      onRefresh();
    } catch (error) {
      console.error('Failed to activate users:', error);
    } finally {
      setActionLoading(false);
    }
  }, [selectedUsers, users, onRefresh]);

  const handleBulkDeactivate = useCallback(async () => {
    if (selectedUsers.size === 0) return;
    
    setActionLoading(true);
    try {
      const selectedUserList = users.filter(user => selectedUsers.has(user.id));
      
      for (const user of selectedUserList) {
        if (user.is_active) {
          await usersAPI.updateUser(user.id, { is_active: false });
        }
      }
      
      setSelectedUsers(new Set());
      onRefresh();
    } catch (error) {
      console.error('Failed to deactivate users:', error);
    } finally {
      setActionLoading(false);
    }
  }, [selectedUsers, users, onRefresh]);

  const handleBulkDelete = useCallback(() => {
    if (selectedUsers.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedUsers]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedUsers.size === 0) return;
    
    setActionLoading(true);
    try {
      const selectedUserList = users.filter(user => selectedUsers.has(user.id));
      
      for (const user of selectedUserList) {
        await usersAPI.deleteUser(user.id);
        onUserDeleted?.(user.id);
      }
      
      setSelectedUsers(new Set());
      setBulkDeleteDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete users:', error);
    } finally {
      setActionLoading(false);
    }
  }, [selectedUsers, users, onUserDeleted, onRefresh]);

  const handleChangePage = useCallback((_: unknown, newPage: number) => {
    onPageChange(newPage + 1); // MUI uses 0-based, our API uses 1-based
  }, [onPageChange]);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onRowsPerPageChange(parseInt(event.target.value, 10));
  }, [onRowsPerPageChange]);

  const isAllSelected = users.length > 0 && selectedUsers.size === users.length;
  const isIndeterminate = selectedUsers.size > 0 && selectedUsers.size < users.length;

  return (
    <Box>
      {/* Toolbar */}
      {onSearchChange && (
        <UserTableToolbar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          selectedCount={selectedUsers.size}
          totalCount={total}
          userRole={userRole}
          bulkActionLoading={actionLoading}
          onBulkActivate={handleBulkActivate}
          onBulkDeactivate={handleBulkDeactivate}
          onBulkDelete={handleBulkDelete}
        />
      )}

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  inputProps={{
                    'aria-label': 'select all users',
                  }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" fontWeight="medium">
                  Name
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" fontWeight="medium">
                  Email
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="subtitle2" fontWeight="medium">
                  Role
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="subtitle2" fontWeight="medium">
                  Status
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="subtitle2" fontWeight="medium">
                  Created
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="subtitle2" fontWeight="medium">
                  Actions
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Loading users...</Typography>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No users found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  isSelected={selectedUsers.has(user.id)}
                  onRowSelect={handleRowSelect}
                  onEdit={handleEdit}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                  currentUserRole={userRole}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={total}
        rowsPerPage={rowsPerPage}
        page={Math.max(0, page - 1)} // Convert from 1-based to 0-based for MUI
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Users per page:"
      />

      {/* Edit User Modal */}
      <EditUserModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={handleEditSuccess}
        user={editingUser}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!actionLoading) {
            setDeleteDialogOpen(false);
            setDeletingUser(null);
          }
        }}
      >
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deletingUser?.full_name || deletingUser?.username}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeletingUser(null);
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={actionLoading}
          >
            {actionLoading ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => {
          if (!actionLoading) {
            setBulkDeleteDialogOpen(false);
          }
        }}
      >
        <DialogTitle>Delete Multiple Users</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedUsers.size} selected users? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setBulkDeleteDialogOpen(false)}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmBulkDelete}
            color="error"
            variant="contained"
            disabled={actionLoading}
          >
            {actionLoading ? 'Deleting...' : `Delete ${selectedUsers.size} Users`}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
    </Box>
  );
};