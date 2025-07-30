/**
 * Edit User Modal Component
 * Form for editing existing user details
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  FormControlLabel,
  Switch,
  Typography
} from '@mui/material';
import { usersAPI } from '../../api/users';
import type { User } from '../../api/auth';

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  user: User | null;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  open,
  onClose,
  onSuccess,
  user
}) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'PLAYER' as const,
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when user changes or modal opens
  useEffect(() => {
    if (user && open) {
      // Ensure role is uppercase for compatibility
      const normalizedRole = user.role.toUpperCase() as 'PLAYER' | 'LEARNER' | 'CREATOR' | 'REVIEWER' | 'APPROVER' | 'ADMIN';
      
      setFormData({
        username: user.username,
        email: user.email,
        full_name: user.full_name || '',
        role: normalizedRole,
        is_active: user.is_active
      });
      setError(null);
    } else if (!open) {
      // Reset to default when modal closes
      setFormData({
        username: '',
        email: '',
        full_name: '',
        role: 'PLAYER',
        is_active: true
      });
      setError(null);
    }
  }, [user, open]);

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const updatedUser = await usersAPI.updateUser(user.id, {
        username: formData.username,
        email: formData.email,
        full_name: formData.full_name || null,
        role: formData.role,
        is_active: formData.is_active
      });

      onSuccess(updatedUser);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      let errorMessage = 'Failed to update user. Please try again.';
      
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Handle validation errors array
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message || String(e)).join(', ');
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else {
          errorMessage = String(err.response.data.detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!user) return null;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit
      }}
    >
      <DialogTitle>
        Edit User: {user.full_name || user.username}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            required
            label="Username"
            value={formData.username}
            onChange={handleChange('username')}
            disabled={loading}
            fullWidth
            autoComplete="username"
          />

          <TextField
            required
            type="email"
            label="Email"
            value={formData.email}
            onChange={handleChange('email')}
            disabled={loading}
            fullWidth
            autoComplete="email"
          />

          <TextField
            label="Full Name"
            value={formData.full_name}
            onChange={handleChange('full_name')}
            disabled={loading}
            fullWidth
            autoComplete="name"
          />

          <FormControl fullWidth required>
            <InputLabel>Role</InputLabel>
            <Select
              value={formData.role}
              label="Role"
              onChange={handleChange('role')}
              disabled={loading}
            >
              <MenuItem value="PLAYER">Player</MenuItem>
              <MenuItem value="LEARNER">Learner</MenuItem>
              <MenuItem value="CREATOR">Creator</MenuItem>
              <MenuItem value="REVIEWER">Reviewer</MenuItem>
              <MenuItem value="APPROVER">Approver</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={handleChange('is_active')}
                disabled={loading}
              />
            }
            label="Active User"
          />
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};