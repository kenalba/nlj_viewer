/**
 * People Tab - Main user management interface
 * Based on ContentLibraryContainer pattern for consistency
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { usersAPI, type UserFilters } from '../../api/users';
import type { User } from '../../api/auth';
import { UserTable } from './UserTable';
import { CreateUserModal } from './CreateUserModal';

export const PeopleTab: React.FC = () => {
  // State management
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Toast notifications
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error' | 'info'>('success');

  const { user: currentUser } = useAuth();
  const canManageUsers = currentUser?.role === 'admin';

  // Toast notification helper
  const showToast = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  }, []);


  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        
        const filters: UserFilters = {
          page,
          per_page: rowsPerPage,
          ...(searchTerm && { search: searchTerm })
        };

        const response = await usersAPI.getUsers(filters);
        setUsers(response.users);
        setTotal(response.total);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    }, searchTerm ? 300 : 0); // Immediate load for initial, 300ms debounce for search

    return () => clearTimeout(timeoutId);
  }, [page, rowsPerPage, searchTerm]); // Depend on the actual values, not fetchUsers

  // Search handler - this will trigger fetchUsers via useEffect
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1); // Reset to first page when searching
    setSelectedUsers(new Set()); // Clear selection when searching
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setPage(1); // Reset to first page when changing page size
  }, []);

  // Action handlers
  const handleCreateUser = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters: UserFilters = {
        page,
        per_page: rowsPerPage,
        ...(searchTerm && { search: searchTerm })
      };

      const response = await usersAPI.getUsers(filters);
      setUsers(response.users);
      setTotal(response.total);
      showToast('User list refreshed');
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, showToast]);

  const handleUserUpdated = useCallback((updatedUser: User, previousUser?: User) => {
    setUsers(prevUsers => {
      const updatedUsers = prevUsers.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      );
      
      // If we don't have previous user data, find it from the current users
      const prevUser = previousUser || prevUsers.find(user => user.id === updatedUser.id);
      
      // Generate specific notification message
      let message = `${updatedUser.full_name || updatedUser.username}`;
      
      if (prevUser) {
        if (prevUser.is_active !== updatedUser.is_active) {
          message += updatedUser.is_active ? ' Activated!' : ' Deactivated!';
        } else if (prevUser.role !== updatedUser.role) {
          const roleNames = {
            'ADMIN': 'Admin',
            'APPROVER': 'Approver', 
            'REVIEWER': 'Reviewer',
            'CREATOR': 'Creator',
            'LEARNER': 'Learner',
            'PLAYER': 'Player'
          };
          message += ` role changed to ${roleNames[updatedUser.role] || updatedUser.role}!`;
        } else {
          message += ' updated successfully!';
        }
      } else {
        message += ' updated successfully!';
      }
      
      showToast(message);
      return updatedUsers;
    });
  }, [showToast]);

  const handleUserDeleted = useCallback((deletedUserId: string) => {
    setUsers(prevUsers => prevUsers.filter(user => user.id !== deletedUserId));
    setTotal(prevTotal => Math.max(0, prevTotal - 1));
    showToast('User deleted successfully');
  }, [showToast]);

  // Statistics
  const userStats = useMemo(() => {
    const activeUsers = users.filter(user => user.is_active).length;
    const roleCount = users.reduce((acc, user) => {
      const normalizedRole = user.role.toLowerCase();
      acc[normalizedRole] = (acc[normalizedRole] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: users.length,
      active: activeUsers,
      inactive: users.length - activeUsers,
      roles: roleCount
    };
  }, [users]);

  return (
    <Box p={3} sx={{ position: 'relative' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            People
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage users and their permissions across the platform
          </Typography>
        </Box>
        
        {canManageUsers && (
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
              size="medium"
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateUser}
              disabled={loading}
              size="medium"
            >
              Create Person
            </Button>
          </Box>
        )}
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {total.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Users
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {userStats.active}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Users
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="warning.main" fontWeight="bold">
                  {userStats.roles.admin || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Administrators
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="info.main" fontWeight="bold">
                  {(userStats.roles.creator || 0) + (userStats.roles.reviewer || 0) + (userStats.roles.approver || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Content Team
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>


      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* User Table */}
      <UserTable
        users={users}
        total={total}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        onRefresh={handleRefresh}
        userRole={currentUser?.role}
        loading={loading}
        onUserUpdated={handleUserUpdated}
        onUserDeleted={handleUserDeleted}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedUsers={selectedUsers}
        onSelectionChange={setSelectedUsers}
      />

      {/* Create User Modal */}
      <CreateUserModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(user) => {
          setCreateModalOpen(false);
          fetchUsers();
          showToast(`User ${user.full_name || user.username} created successfully`);
        }}
      />

      {/* Toast Notifications */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setToastOpen(false)} 
          severity={toastSeverity}
          variant="filled"
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};