/**
 * Unified Submit for Review Modal - Handles both single-stage and multi-stage review submissions
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
  Snackbar,
  Avatar,
  Chip,
  IconButton,
  Divider,
  Autocomplete,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Send as SubmitIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Assignment as ReviewIcon,
  Approval as SingleStageIcon,
  AccountTree as MultiStageIcon,
  CheckCircle as StageIcon
} from '@mui/icons-material';
import { workflowApi } from '../client/workflow';
import { usersAPI } from '../client/users';
import { contentApi, type ContentItem } from '../client/content';
import type { User } from '../client/auth';
import type { WorkflowTemplate, WorkflowTemplateType } from '../types/workflow';

interface SubmitForReviewModalProps {
  open: boolean;
  contentItems: ContentItem[];
  onClose: () => void;
  onReviewSubmitted?: () => void;
}

type ReviewFlowType = 'single' | 'multi';

export const SubmitForReviewModal: React.FC<SubmitForReviewModalProps> = ({
  open,
  contentItems,
  onClose,
  onReviewSubmitted
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Helper function to show toast notifications
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  };
  
  // Review flow selection
  const [reviewFlowType, setReviewFlowType] = useState<ReviewFlowType>('single');
  
  // Single-stage review fields
  const [reviewerType, setReviewerType] = useState('admin');
  const [selectedReviewer, setSelectedReviewer] = useState<User | null>(null);
  const [availableReviewers, setAvailableReviewers] = useState<User[]>([]);
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  
  // Multi-stage workflow fields
  const [availableTemplates, setAvailableTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Common fields
  const [comments, setComments] = useState('');

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setComments('');
    setReviewFlowType('single');
    setReviewerType('admin');
    setSelectedReviewer(null);
    setAvailableReviewers([]);
    setSelectedTemplate(null);
    setAvailableTemplates([]);
    onClose();
  };

  // Load reviewers when modal opens or reviewer type changes (for single-stage)
  useEffect(() => {
    if (open && reviewFlowType === 'single' && reviewerType) {
      loadReviewers();
    }
  }, [open, reviewFlowType, reviewerType]);

  // Load workflow templates when modal opens (for multi-stage)
  useEffect(() => {
    if (open && reviewFlowType === 'multi') {
      loadWorkflowTemplates();
    }
  }, [open, reviewFlowType]);

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

  const loadWorkflowTemplates = async () => {
    try {
      setLoadingTemplates(true);
      // Determine content type for template filtering
      const contentType = contentItems.length === 1 ? contentItems[0].content_type as WorkflowTemplateType : 'content';
      const templates = await workflowApi.getWorkflowTemplates({ content_type: contentType });
      setAvailableTemplates(templates);
    } catch (err) {
      console.error('Failed to load workflow templates:', err);
      setAvailableTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSubmitSingleStage = async () => {
    for (const contentItem of contentItems) {
      try {
        console.log('Creating version for:', contentItem.title);
        
        // Get full content item with nlj_data
        const fullContentItem = await contentApi.get(contentItem.id);
        
        if (!fullContentItem.nlj_data) {
          throw new Error('Content item has no scenario data (nlj_data)');
        }

        // Step 1: Create version
        const version = await workflowApi.createVersion({
          content_id: fullContentItem.id,
          nlj_data: fullContentItem.nlj_data,
          title: fullContentItem.title,
          description: fullContentItem.description || '',
          change_summary: `Review requested: ${comments || 'No additional comments'}`
        });

        // Step 2: Create workflow
        const workflow = await workflowApi.createWorkflow({
          version_id: version.id,
          requires_approval: true,
          auto_publish: false,
          assigned_reviewer_id: selectedReviewer?.id
        });

        // Step 3: Submit the workflow for review
        await workflowApi.submitForReview({
          version_id: version.id,
          reviewer_id: selectedReviewer?.id
        });

      } catch (itemError) {
        console.error(`Failed to submit ${contentItem.title} for review:`, itemError);
        throw new Error(`Failed to submit "${contentItem.title}" for review: ${itemError instanceof Error ? itemError.message : String(itemError)}`);
      }
    }
  };

  const handleSubmitMultiStage = async () => {
    if (!selectedTemplate) {
      throw new Error('Please select a workflow template');
    }

    for (const contentItem of contentItems) {
      try {
        console.log('Creating multi-stage workflow for:', contentItem.title);
        
        // Get full content item with nlj_data
        const fullContentItem = await contentApi.get(contentItem.id);
        
        if (!fullContentItem.nlj_data) {
          throw new Error('Content item has no scenario data (nlj_data)');
        }

        // Step 1: Create version
        const version = await workflowApi.createVersion({
          content_id: fullContentItem.id,
          nlj_data: fullContentItem.nlj_data,
          title: fullContentItem.title,
          description: fullContentItem.description || '',
          change_summary: `Multi-stage review requested: ${comments || 'No additional comments'}`
        });

        // Step 2: Submit for multi-stage workflow
        await workflowApi.submitForMultiStageReview({
          version_id: version.id,
          template_id: selectedTemplate.id,
          initial_comments: comments || undefined
        });

      } catch (itemError) {
        console.error(`Failed to submit ${contentItem.title} for multi-stage review:`, itemError);
        throw new Error(`Failed to submit "${contentItem.title}" for multi-stage review: ${itemError instanceof Error ? itemError.message : String(itemError)}`);
      }
    }
  };

  const handleSubmitForReview = async () => {
    if (contentItems.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      if (reviewFlowType === 'single') {
        await handleSubmitSingleStage();
      } else {
        await handleSubmitMultiStage();
      }

      setSuccess(true);
      
      // Show success toast
      const itemCount = contentItems.length;
      const itemText = itemCount === 1 ? 'item' : 'items';
      const flowText = reviewFlowType === 'single' ? 'single-stage' : 'multi-stage';
      showToast(`Successfully submitted ${itemCount} ${itemText} for ${flowText} review`);
      
      setTimeout(() => {
        handleClose();
        onReviewSubmitted?.();
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
  const canSubmit = reviewFlowType === 'single' || (reviewFlowType === 'multi' && selectedTemplate);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <ReviewIcon color="primary" />
            <Typography variant="h6">
              Submit for Review {isMultiple ? `(${contentItems.length} items)` : ''}
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
                  maxHeight: isMultiple ? '150px' : 'auto',
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

            {/* Review Flow Type Selection */}
            <Box sx={{ mb: 3 }}>
              <FormLabel component="legend">
                <Typography variant="h6" gutterBottom>
                  Select Review Process
                </Typography>
              </FormLabel>
              <RadioGroup
                value={reviewFlowType}
                onChange={(e) => setReviewFlowType(e.target.value as ReviewFlowType)}
              >
                <FormControlLabel 
                  value="single" 
                  control={<Radio />} 
                  label={
                    <Box display="flex" alignItems="center" gap={2}>
                      <SingleStageIcon color="primary" />
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          Single-Stage Review
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Assign to one reviewer or reviewer group for approval
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                <FormControlLabel 
                  value="multi" 
                  control={<Radio />} 
                  label={
                    <Box display="flex" alignItems="center" gap={2}>
                      <MultiStageIcon color="secondary" />
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          Multi-Stage Workflow
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Use a predefined workflow template with multiple review stages
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
              </RadioGroup>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Single-Stage Configuration */}
            {reviewFlowType === 'single' && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Single-Stage Review Configuration
                </Typography>
                
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Review Role</InputLabel>
                  <Select
                    value={reviewerType}
                    label="Review Role"
                    onChange={(e) => {
                      setReviewerType(e.target.value);
                      setSelectedReviewer(null);
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
            )}

            {/* Multi-Stage Configuration */}
            {reviewFlowType === 'multi' && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Multi-Stage Workflow Configuration
                </Typography>
                
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Workflow Template</InputLabel>
                  <Select
                    value={selectedTemplate?.id || ''}
                    label="Workflow Template"
                    onChange={(e) => {
                      const template = availableTemplates.find(t => t.id === e.target.value);
                      setSelectedTemplate(template || null);
                    }}
                    disabled={loadingTemplates}
                  >
                    {availableTemplates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedTemplate && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {selectedTemplate.name}
                    </Typography>
                    {selectedTemplate.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {selectedTemplate.description}
                      </Typography>
                    )}
                    
                    <Typography variant="body2" fontWeight={500} gutterBottom>
                      Review Stages:
                    </Typography>
                    <List dense>
                      {selectedTemplate.stages?.map((stage, index) => (
                        <ListItem key={index} sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <StageIcon fontSize="small" color="primary" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={stage.name}
                            secondary={stage.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}

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
            disabled={loading || !canSubmit}
            startIcon={<SubmitIcon />}
          >
            {loading ? 'Submitting...' : 'Submit for Review'}
          </Button>
        )}
      </DialogActions>

      {/* Toast Notifications */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setToastOpen(false)} 
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default SubmitForReviewModal;