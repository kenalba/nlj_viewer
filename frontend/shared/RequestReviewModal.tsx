/**
 * Request Review Modal - Allows users to submit content for approval workflow
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Avatar,
  Chip,
  IconButton,
  Divider,
  Autocomplete
} from '@mui/material';
import {
  Send as SubmitIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Assignment as ReviewIcon
} from '@mui/icons-material';
import { workflowApi } from '../api/workflow';
import { usersAPI } from '../api/users';
import { contentApi, type ContentItem } from '../api/content';
import type { User } from '../api/auth';

interface RequestReviewModalProps {
  open: boolean;
  contentItems: ContentItem[];
  onClose: () => void;
  onReviewRequested?: () => void;
}

export const RequestReviewModal: React.FC<RequestReviewModalProps> = ({
  open,
  contentItems,
  onClose,
  onReviewRequested
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [reviewerType, setReviewerType] = useState('admin');
  const [selectedReviewer, setSelectedReviewer] = useState<User | null>(null);
  const [availableReviewers, setAvailableReviewers] = useState<User[]>([]);
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  const [comments, setComments] = useState('');

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setComments('');
    setReviewerType('admin');
    setSelectedReviewer(null);
    setAvailableReviewers([]);
    onClose();
  };

  // Load reviewers when modal opens or reviewer type changes
  useEffect(() => {
    if (open && reviewerType) {
      loadReviewers();
    }
  }, [open, reviewerType]);

  const loadReviewers = async () => {
    try {
      setLoadingReviewers(true);
      const response = await usersAPI.getUsers({
        role: reviewerType,
        is_active: true,
        per_page: 100
      });
      setAvailableReviewers(response.users);
    } catch (err) {
      console.error('Failed to load reviewers:', err);
      setAvailableReviewers([]);
    } finally {
      setLoadingReviewers(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (contentItems.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Process each content item
      for (const contentItem of contentItems) {
        try {
          console.log('Creating version for:', contentItem.title);
          
          // Step 0: Get full content item with nlj_data (list view only returns summary)
          const fullContentItem = await contentApi.get(contentItem.id);
          console.log('Full content item:', fullContentItem);
          
          if (!fullContentItem.nlj_data) {
            throw new Error('Content item has no scenario data (nlj_data)');
          }

          console.log('Request data:', {
            content_id: fullContentItem.id,
            nlj_data: fullContentItem.nlj_data,
            title: fullContentItem.title,
            description: fullContentItem.description || '',
            change_summary: `Review requested: ${comments || 'No additional comments'}`
          });

          // Step 1: Create version
          const version = await workflowApi.createVersion({
            content_id: fullContentItem.id,
            nlj_data: fullContentItem.nlj_data,
            title: fullContentItem.title,
            description: fullContentItem.description || '',
            change_summary: `Review requested: ${comments || 'No additional comments'}`
          });

          console.log('Version created:', version);

          // Step 2: Create workflow
          const workflow = await workflowApi.createWorkflow({
            version_id: version.id,
            requires_approval: true,
            auto_publish: false,
            assigned_reviewer_id: selectedReviewer?.id
          });

          console.log('Workflow created:', workflow);

          // Step 3: Submit the workflow for review
          await workflowApi.submitForReview({
            version_id: version.id,
            reviewer_id: selectedReviewer?.id
          });

          console.log('Submitted for review successfully');
        } catch (itemError) {
          console.error(`Failed to submit ${contentItem.title} for review:`, itemError);
          throw new Error(`Failed to submit "${contentItem.title}" for review: ${itemError instanceof Error ? itemError.message : String(itemError)}`);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
        onReviewRequested?.();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to submit for review:', err);
      setError(err.message || 'Failed to submit content for review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (contentItems.length === 0) return null;

  const isMultiple = contentItems.length > 1;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <ReviewIcon color="primary" />
            <Typography variant="h6">
              Request Review {isMultiple ? `(${contentItems.length} items)` : ''}
            </Typography>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {success ? (
          <Box textAlign="center" py={4}>
            <Alert severity="success" sx={{ mb: 3 }}>
              Review {isMultiple ? 'requests' : 'request'} submitted successfully!
            </Alert>
            <Typography variant="body1" color="text.secondary">
              Your {isMultiple ? `${contentItems.length} content items have` : 'content has'} been submitted for review. You'll be notified when the review is complete.
            </Typography>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Content Overview */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Content to Review:
              </Typography>
              <Box 
                sx={{ 
                  maxHeight: isMultiple ? '200px' : 'auto',
                  overflowY: isMultiple ? 'auto' : 'visible'
                }}
              >
                {contentItems.map((contentItem, index) => (
                  <Box 
                    key={contentItem.id}
                    sx={{ 
                      p: 2, 
                      backgroundColor: 'grey.50', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      mb: isMultiple && index < contentItems.length - 1 ? 2 : 0
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Chip 
                        label={contentItem.content_type} 
                        size="small" 
                        color="primary"
                        sx={{ textTransform: 'capitalize' }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {contentItem.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {contentItem.description || 'No description available'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Reviewer Selection */}
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Review Role</InputLabel>
                <Select
                  value={reviewerType}
                  label="Review Role"
                  onChange={(e) => {
                    setReviewerType(e.target.value);
                    setSelectedReviewer(null); // Clear selection when role changes
                  }}
                >
                  <MenuItem value="admin">Platform Administrators</MenuItem>
                  <MenuItem value="reviewer">Content Reviewers</MenuItem>
                  <MenuItem value="approver">Content Approvers</MenuItem>
                </Select>
              </FormControl>
              
              <Autocomplete
                options={availableReviewers}
                getOptionLabel={(option) => `${option.full_name} (${option.email})`}
                value={selectedReviewer}
                onChange={(event, newValue) => setSelectedReviewer(newValue)}
                loading={loadingReviewers}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Specific Reviewer (Optional)"
                    size="small"
                    placeholder="Choose a specific reviewer or leave blank for any"
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Avatar sx={{ width: 24, height: 24, mr: 2, bgcolor: 'primary.main' }}>
                        <PersonIcon sx={{ fontSize: 14 }} />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {option.full_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email} • {option.role}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }}
                size="small"
                fullWidth
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {selectedReviewer 
                  ? `Review will be assigned specifically to ${selectedReviewer.full_name}`
                  : `Review will be available to all ${reviewerType}s`
                }
              </Typography>
            </Box>

            {/* Comments */}
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Comments (Optional)"
                placeholder="Add any specific feedback requests or notes for the reviewers..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                size="small"
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Provide context about what kind of review you're looking for
              </Typography>
            </Box>

            {/* Review Process Info */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Review Process:</strong> Once submitted, reviewers will be able to approve, request revisions, or reject your {isMultiple ? 'selected content items' : 'content'}. You'll receive notifications about the review status.
              </Typography>
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button
            variant="contained"
            onClick={handleSubmitForReview}
            disabled={loading}
            startIcon={<SubmitIcon />}
          >
            {loading ? 'Submitting...' : 'Submit for Review'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RequestReviewModal;