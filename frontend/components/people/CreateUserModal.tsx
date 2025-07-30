/**
 * Create User Modal
 * Form for creating new users with role assignment
 */

import React, { useState, useCallback } from 'react';
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
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Badge as BadgeIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import type { User } from '../../api/auth';
import { usersAPI } from '../../api/users';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

interface FormData {
  username: string;
  email: string;
  full_name: string;
  password: string;
  confirmPassword: string;
  role: 'PLAYER' | 'LEARNER' | 'CREATOR' | 'REVIEWER' | 'APPROVER' | 'ADMIN';
}

interface FormErrors {
  username?: string;
  email?: string;
  full_name?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
  general?: string;
}

const INITIAL_FORM_DATA: FormData = {
  username: '',
  email: '',
  full_name: '',
  password: '',
  confirmPassword: '',
  role: 'PLAYER'
};

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset form when modal opens/closes
  const handleClose = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  }, [onClose]);

  // Form field handlers
  const handleFieldChange = useCallback((field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    const value = event.target.value as string;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm the password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        password: formData.password,
        role: formData.role
      };

      const newUser = await usersAPI.createUser(userData);
      onSuccess(newUser);
      handleClose();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      
      // Handle specific API errors
      if (error.response?.data?.detail) {
        if (error.response.data.detail.includes('username')) {
          setErrors({ username: 'Username already exists' });
        } else if (error.response.data.detail.includes('email')) {
          setErrors({ email: 'Email already exists' });
        } else {
          setErrors({ general: error.response.data.detail });
        }
      } else {
        setErrors({ general: 'Failed to create user. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, onSuccess, handleClose]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loading) {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, loading]);

  const canSubmit = Object.values(formData).every(value => value.trim() !== '') && !loading;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        onKeyPress: handleKeyPress
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon color="primary" />
          <Typography variant="h6">Create New User</Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        {errors.general && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.general}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Username */}
          <TextField
            label="Username"
            value={formData.username}
            onChange={handleFieldChange('username')}
            error={!!errors.username}
            helperText={errors.username}
            required
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
            placeholder="johndoe"
          />

          {/* Email */}
          <TextField
            label="Email"
            type="email"
            value={formData.email}
            onChange={handleFieldChange('email')}
            error={!!errors.email}
            helperText={errors.email}
            required
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
            placeholder="john@example.com"
          />

          {/* Full Name */}
          <TextField
            label="Full Name"
            value={formData.full_name}
            onChange={handleFieldChange('full_name')}
            error={!!errors.full_name}
            helperText={errors.full_name}
            required
            fullWidth
            placeholder="John Doe"
          />

          {/* Role */}
          <FormControl fullWidth>
            <InputLabel id="role-select-label">Role</InputLabel>
            <Select
              labelId="role-select-label"
              value={formData.role}
              label="Role"
              onChange={handleFieldChange('role')}
              startAdornment={
                <InputAdornment position="start" sx={{ ml: 1 }}>
                  <BadgeIcon />
                </InputAdornment>
              }
            >
              <MenuItem value="PLAYER">Player</MenuItem>
              <MenuItem value="LEARNER">Learner</MenuItem>
              <MenuItem value="CREATOR">Creator</MenuItem>
              <MenuItem value="REVIEWER">Reviewer</MenuItem>
              <MenuItem value="APPROVER">Approver</MenuItem>
              <MenuItem value="ADMIN">Administrator</MenuItem>
            </Select>
          </FormControl>

          {/* Password */}
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleFieldChange('password')}
            error={!!errors.password}
            helperText={errors.password || 'Minimum 8 characters'}
            required
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Confirm Password */}
          <TextField
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={handleFieldChange('confirmPassword')}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            required
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit}
          startIcon={loading ? undefined : <PersonAddIcon />}
        >
          {loading ? 'Creating...' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};