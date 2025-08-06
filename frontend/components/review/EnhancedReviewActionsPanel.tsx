/**
 * Enhanced Review Actions Panel - Visually refactored review form and action buttons
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as RevisionIcon,
  RateReview as ReviewIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
  Publish as PublishIcon
} from '@mui/icons-material';
import { workflowApi } from '../../api/workflow';
import type { 
  PendingReview,
  ApproveContentRequest,
  RequestRevisionRequest,
  RejectContentRequest
} from '../../types/workflow';
import {
  canApprove,
  canRequestRevision,
  canReject,
  getWorkflowStateLabel,
  getWorkflowStateColor
} from '../../types/workflow';

interface EnhancedReviewActionsPanelProps {
  review: PendingReview;
  onReviewComplete: () => void;
  /** Whether to show as a compact version (e.g., for modals) */
  compact?: boolean;
}

export const EnhancedReviewActionsPanel: React.FC<EnhancedReviewActionsPanelProps> = ({
  review,
  onReviewComplete,
  compact = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error' | 'info'>('success');

  // Helper function to show toast notifications
  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  };

  const { workflow } = review;
  const currentState = workflow.current_state;
  const stateColor = getWorkflowStateColor(currentState);
  const stateLabel = getWorkflowStateLabel(currentState);

  const handleAction = async (action: 'approve' | 'revision' | 'reject') => {
    if (!comments.trim() && (action === 'revision' || action === 'reject')) {
      setError('Comments are required for revision requests and rejections.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      switch (action) {
        case 'approve':
          const approveRequest: ApproveContentRequest = {
            comments: comments.trim() || 'Content approved',
            auto_publish: autoPublish
          };
          await workflowApi.approveContent(workflow.id, approveRequest);
          break;

        case 'revision':
          const revisionRequest: RequestRevisionRequest = {
            comments: comments.trim()
          };
          await workflowApi.requestRevision(workflow.id, revisionRequest);
          break;

        case 'reject':
          const rejectRequest: RejectContentRequest = {
            comments: comments.trim()
          };
          await workflowApi.rejectContent(workflow.id, rejectRequest);
          break;
      }

      // Show success toast based on action
      switch (action) {
        case 'approve':
          showToast(autoPublish ? 'Content approved and published successfully!' : 'Content approved successfully!');
          break;
        case 'revision':
          showToast('Revision requested successfully', 'info');
          break;
        case 'reject':
          showToast('Content rejected', 'info');
          break;
      }

      onReviewComplete();
    } catch (err: any) {
      console.error('Failed to process review:', err);
      setError(err.message || 'Failed to process review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setComments('');
    setAutoPublish(false);
    setError(null);
  };

  const isCommentsRequired = canRequestRevision(currentState) || canReject(currentState);
  const commentsLength = comments.length;
  const hasValidComments = !isCommentsRequired || comments.trim().length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Current Status Card */}
      <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Current Status
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip 
              label={stateLabel}
              size="small"
              sx={{ 
                backgroundColor: stateColor,
                color: 'white',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}
            />
            <Tooltip title="Workflow information">
              <IconButton size="small" color="primary">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Review Form */}
      <Card sx={{ display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReviewIcon color="primary" />
              Your Review
            </Typography>
            {comments && (
              <Tooltip title="Clear form">
                <IconButton size="small" onClick={resetForm} disabled={loading}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide your assessment of this content. Your review will be recorded in the workflow history.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={compact ? 3 : 5}
            label="Comments"
            placeholder={
              canApprove(currentState) 
                ? "Add any feedback or comments (optional for approval)..."
                : "Explain what changes are needed or why this is being rejected..."
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            sx={{ mb: 2 }}
            variant="outlined"
            helperText={
              isCommentsRequired 
                ? `Required for rejection/revision requests (${commentsLength} characters)`
                : `Optional feedback (${commentsLength} characters)`
            }
            error={isCommentsRequired && !hasValidComments}
          />

          {canApprove(currentState) && (
            <Card variant="outlined" sx={{ mb: 2, bgcolor: 'success.50' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={autoPublish}
                      onChange={(e) => setAutoPublish(e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <PublishIcon fontSize="small" />
                      <Typography variant="body2">
                        Automatically publish after approval
                      </Typography>
                    </Box>
                  }
                />
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          
          <Stack spacing={1.5}>
            {/* Primary Actions Row */}
            <Box display="flex" gap={1}>
              {canApprove(currentState) && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ApproveIcon />}
                  onClick={() => handleAction('approve')}
                  disabled={loading}
                  fullWidth
                  sx={{ 
                    fontWeight: 600,
                    py: 1.5,
                    textTransform: 'none',
                    fontSize: '1rem'
                  }}
                >
                  Approve{autoPublish ? ' & Publish' : ''}
                </Button>
              )}
              
              {canReject(currentState) && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={loading ? <CircularProgress size={16} /> : <RejectIcon />}
                  onClick={() => handleAction('reject')}
                  disabled={loading || !hasValidComments}
                  fullWidth
                  sx={{ 
                    py: 1.5,
                    textTransform: 'none',
                    fontSize: '1rem'
                  }}
                >
                  Reject
                </Button>
              )}
            </Box>
            
            {/* Secondary Action */}
            {canRequestRevision(currentState) && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={loading ? <CircularProgress size={16} /> : <RevisionIcon />}
                onClick={() => handleAction('revision')}
                disabled={loading || !hasValidComments}
                fullWidth
                sx={{ 
                  py: 1.5,
                  textTransform: 'none',
                  fontSize: '1rem'
                }}
              >
                Request Changes
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Toast Notifications */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setToastOpen(false)} 
          severity={toastSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EnhancedReviewActionsPanel;