/**
 * Submit for Review Page - Full-screen interface for submitting content for review
 * Handles both single-stage and multi-stage review workflows
 */

import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
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
  Divider,
  Autocomplete,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Breadcrumbs,
  Link,
  Card,
  CardContent
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Send as SubmitIcon,
  Person as PersonIcon,
  Assignment as ReviewIcon,
  Approval as SingleStageIcon,
  AccountTree as MultiStageIcon,
  CheckCircle as StageIcon,
  CheckCircle,
  Home as HomeIcon,
  Folder as ContentIcon,
  NavigateNext as NextIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { workflowApi } from '../api/workflow';
import { usersAPI } from '../api/users';
import { contentApi, type ContentItem } from '../api/content';
import type { User } from '../api/auth';
import type { WorkflowTemplate, WorkflowTemplateType } from '../types/workflow';

type ReviewFlowType = 'single' | 'multi';


export const SubmitForReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get content items from navigation state
  const contentItems: ContentItem[] = location.state?.contentItems || [];
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Review flow selection
  const [reviewFlowType, setReviewFlowType] = useState<ReviewFlowType>('single');
  
  // Single-stage review fields
  const [reviewerType, setReviewerType] = useState('admin');
  const [reviewAssignmentType, setReviewAssignmentType] = useState<'all' | 'specific'>('all');
  const [selectedReviewer, setSelectedReviewer] = useState<User | null>(null);
  const [availableReviewers, setAvailableReviewers] = useState<User[]>([]);
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  
  // Multi-stage workflow fields
  const [availableTemplates, setAvailableTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Common fields
  const [comments, setComments] = useState('');

  // Redirect if no content items provided
  useEffect(() => {
    if (contentItems.length === 0) {
      navigate('/activities', { replace: true });
    }
  }, [contentItems, navigate]);

  // Load reviewers when reviewer type changes (for single-stage)
  useEffect(() => {
    if (reviewFlowType === 'single' && reviewAssignmentType === 'specific' && reviewerType) {
      loadReviewers();
    }
  }, [reviewFlowType, reviewAssignmentType, reviewerType]);

  // Load workflow templates (for multi-stage)
  useEffect(() => {
    if (reviewFlowType === 'multi') {
      loadWorkflowTemplates();
    }
  }, [reviewFlowType]);

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
          assigned_reviewer_id: reviewAssignmentType === 'specific' ? selectedReviewer?.id : undefined
        });

        // Step 3: Submit the workflow for review
        await workflowApi.submitForReview({
          version_id: version.id,
          reviewer_id: reviewAssignmentType === 'specific' ? selectedReviewer?.id : undefined
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
      console.log('Review submission successful, showing success state');

    } catch (err: any) {
      console.error('Failed to submit for review:', err);
      setError(err.message || 'Failed to submit content for review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    if (reviewFlowType === 'single') {
      // For single-stage, we need either 'all' assignment or a specific reviewer selected
      return reviewAssignmentType === 'all' || (reviewAssignmentType === 'specific' && selectedReviewer);
    }
    return reviewFlowType === 'multi' && selectedTemplate;
  };

  if (contentItems.length === 0) {
    return null; // Will redirect in useEffect
  }

  const isMultiple = contentItems.length > 1;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs separator={<NextIcon fontSize="small" />} sx={{ mb: 2 }}>
          <Link 
            color="inherit" 
            href="/home" 
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}
            onClick={(e) => { e.preventDefault(); navigate('/home'); }}
          >
            <HomeIcon fontSize="small" />
            Home
          </Link>
          <Link 
            color="inherit" 
            href="/activities"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}
            onClick={(e) => { e.preventDefault(); navigate('/activities'); }}
          >
            <ContentIcon fontSize="small" />
            Activities
          </Link>
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ReviewIcon fontSize="small" />
            Submit for Review
          </Typography>
        </Breadcrumbs>

        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" gutterBottom>
              Submit for Review
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isMultiple 
                ? `Submit ${contentItems.length} content items for review`
                : `Submit "${contentItems[0]?.title}" for review`
              }
            </Typography>
          </Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/activities')}
            variant="outlined"
          >
            Back to Activities
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Paper sx={{ p: 3 }}>
        {success ? (
          <Box textAlign="center" py={6}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Alert severity="success" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Review {isMultiple ? 'requests' : 'request'} submitted successfully!
              </Typography>
              <Typography variant="body2">
                Your {isMultiple ? `${contentItems.length} content items have` : 'content has'} been submitted for review. You'll be notified when the review is complete.
              </Typography>
            </Alert>
            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={() => navigate('/activities')}
              >
                Back to Activities
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/reviews')}
              >
                View My Reviews
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 4 }}>
                {error}
              </Alert>
            )}

            {/* Content Overview */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Content to Review
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {contentItems.map((contentItem) => (
                  <Box key={contentItem.id} sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '300px' }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Chip 
                            label={contentItem.content_type} 
                            size="small" 
                            color="primary"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>
                        <Typography variant="h6" gutterBottom>
                          {contentItem.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {contentItem.description || 'No description available'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Review Process Selection */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Choose Review Process
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Select how you'd like your content to be reviewed and approved.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
                <Box 
                  onClick={() => setReviewFlowType('single')}
                  sx={{ 
                    flex: 1,
                    p: 2,
                    border: 1,
                    borderRadius: 1,
                    borderColor: reviewFlowType === 'single' ? 'primary.main' : 'divider',
                    backgroundColor: reviewFlowType === 'single' ? 'primary.50' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.50'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Radio checked={reviewFlowType === 'single'} size="small" />
                    <SingleStageIcon color="primary" sx={{ fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Single-Stage Review
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Assign to one reviewer or reviewer group for straightforward approval
                  </Typography>
                </Box>
                
                <Box 
                  onClick={() => availableTemplates.length > 0 && setReviewFlowType('multi')}
                  sx={{ 
                    flex: 1,
                    p: 2,
                    border: 1,
                    borderRadius: 1,
                    borderColor: reviewFlowType === 'multi' ? 'secondary.main' : 'divider',
                    backgroundColor: reviewFlowType === 'multi' ? 'secondary.50' : 'transparent',
                    cursor: availableTemplates.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: availableTemplates.length === 0 ? 0.6 : 1,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': availableTemplates.length > 0 ? {
                      borderColor: 'secondary.main',
                      backgroundColor: 'secondary.50'
                    } : {}
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Radio checked={reviewFlowType === 'multi'} disabled={availableTemplates.length === 0} size="small" />
                    <MultiStageIcon color="secondary" sx={{ fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Multi-Stage Workflow
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Use predefined workflow templates with multiple review stages
                  </Typography>
                  {availableTemplates.length === 0 && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                      No templates available
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {reviewFlowType && <Divider sx={{ my: 3 }} />}

            {/* Configuration Section */}
            {reviewFlowType === 'single' && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom>
                  Review Configuration
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Configure who will review your content.
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Review Role</InputLabel>
                    <Select
                      value={reviewerType}
                      label="Review Role"
                      onChange={(e) => {
                        setReviewerType(e.target.value);
                        setSelectedReviewer(null);
                        setReviewAssignmentType('all');
                      }}
                    >
                      <MenuItem value="admin">Platform Administrators</MenuItem>
                      <MenuItem value="reviewer">Content Reviewers</MenuItem>
                      <MenuItem value="approver">Content Approvers</MenuItem>
                    </Select>
                  </FormControl>

                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Assignment Type
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 2, width: '100%', mb: 3 }}>
                    <Box 
                      onClick={() => {
                        setReviewAssignmentType('all');
                        setSelectedReviewer(null);
                      }}
                      sx={{ 
                        flex: 1,
                        p: 2,
                        border: 1,
                        borderRadius: 1,
                        borderColor: reviewAssignmentType === 'all' ? 'primary.main' : 'divider',
                        backgroundColor: reviewAssignmentType === 'all' ? 'primary.50' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <Radio checked={reviewAssignmentType === 'all'} size="small" />
                        <Typography variant="subtitle1" fontWeight={600}>
                          All {reviewerType === 'admin' ? 'Administrators' : reviewerType === 'reviewer' ? 'Reviewers' : 'Approvers'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Any user with {reviewerType} role can pick up and review this content
                      </Typography>
                    </Box>
                    
                    <Box 
                      onClick={() => setReviewAssignmentType('specific')}
                      sx={{ 
                        flex: 1,
                        p: 2,
                        border: 1,
                        borderRadius: 1,
                        borderColor: reviewAssignmentType === 'specific' ? 'primary.main' : 'divider',
                        backgroundColor: reviewAssignmentType === 'specific' ? 'primary.50' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <Radio checked={reviewAssignmentType === 'specific'} size="small" />
                        <Typography variant="subtitle1" fontWeight={600}>
                          Specific {reviewerType === 'admin' ? 'Administrator' : reviewerType === 'reviewer' ? 'Reviewer' : 'Approver'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Assign to a specific person for dedicated review
                      </Typography>
                    </Box>
                  </Box>

                  {reviewAssignmentType === 'specific' && (
                    <Box sx={{ mb: 3 }}>
                      <Autocomplete
                        options={availableReviewers}
                        getOptionLabel={(option) => `${option.full_name} (${option.email})`}
                        value={selectedReviewer}
                        onChange={(event, newValue) => setSelectedReviewer(newValue)}
                        loading={loadingReviewers}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={`Select ${reviewerType === 'admin' ? 'Administrator' : reviewerType === 'reviewer' ? 'Reviewer' : 'Approver'}`}
                            placeholder="Choose a specific person for this review"
                            fullWidth
                          />
                        )}
                        renderOption={(props, option) => {
                          const { key, ...otherProps } = props;
                          return (
                            <Box component="li" key={key} {...otherProps}>
                              <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.main' }}>
                                <PersonIcon sx={{ fontSize: 18 }} />
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
                        fullWidth
                        sx={{ maxWidth: '100%' }}
                      />
                    </Box>
                  )}
                </Box>

                <Alert severity="info">
                  {reviewAssignmentType === 'all' 
                    ? `Review will be available to all ${reviewerType}s. Any ${reviewerType} can pick up and complete this review.`
                    : selectedReviewer
                      ? `Review will be assigned specifically to ${selectedReviewer.full_name}`
                      : `Please select a specific ${reviewerType} to assign this review to.`
                  }
                </Alert>
              </Box>
            )}

            {reviewFlowType === 'multi' && availableTemplates.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom>
                  Workflow Template
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Select a predefined workflow template for your multi-stage review.
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
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
                  <Card sx={{ bgcolor: 'grey.50', p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {selectedTemplate.name}
                    </Typography>
                    {selectedTemplate.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {selectedTemplate.description}
                      </Typography>
                    )}
                    
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Review Stages:
                    </Typography>
                    <List>
                      {selectedTemplate.stages?.map((stage, index) => (
                        <ListItem key={index} sx={{ py: 1 }}>
                          <ListItemIcon>
                            <StageIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={
                              <Typography variant="body1" fontWeight={500} sx={{ flex: 1 }}>
                                {stage.name}
                              </Typography>
                            }
                            secondary={stage.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Card>
                )}
              </Box>
            )}

            {/* Comments Section */}
            {reviewFlowType && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h5" gutterBottom>
                    Additional Comments
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Provide any specific instructions or context for the reviewers.
                  </Typography>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Comments (Optional)"
                    placeholder="Add any specific feedback requests or notes for the reviewers..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Provide context about what kind of review you're looking for
                  </Typography>
                </Box>
              </>
            )}

            {/* Submit Button */}
            {reviewFlowType && (
              <Box display="flex" justifyContent="space-between" alignItems="center" pt={2}>
                <Button
                  onClick={() => navigate('/activities')}
                  startIcon={<BackIcon />}
                  size="large"
                >
                  Back to Activities
                </Button>
                
                <Button
                  variant="contained"
                  onClick={handleSubmitForReview}
                  disabled={!canSubmit() || loading}
                  startIcon={<SubmitIcon />}
                  size="large"
                >
                  {loading ? 'Submitting...' : 'Submit for Review'}
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default SubmitForReviewPage;