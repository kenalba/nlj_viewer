/**
 * Review Actions Panel - Reusable review form and action buttons
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
  CircularProgress,
  Divider
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as RevisionIcon,
  RateReview as ReviewIcon
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
  canReject
} from '../../types/workflow';

interface ReviewActionsPanelProps {
  review: PendingReview;
  onReviewComplete: () => void;
  /** Whether to show as a compact version (e.g., for modals) */
  compact?: boolean;
}

export const ReviewActionsPanel: React.FC<ReviewActionsPanelProps> = ({
  review,
  onReviewComplete,
  compact = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);

  const { workflow } = review;

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

  return (
    <Paper sx={{ p: compact ? 2 : 3 }}>
      <Typography variant={compact ? "h6" : "h5"} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReviewIcon color="primary" />
        Your Review
      </Typography>
      
      {!compact && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Provide your assessment of this content. Your review will be recorded in the workflow history.
        </Typography>
      )}

      <TextField
        fullWidth
        multiline
        rows={compact ? 3 : 4}
        label="Comments"
        placeholder={
          canApprove(workflow.current_state) 
            ? "Add any feedback or comments (optional for approval)..."
            : "Explain what changes are needed or why this is being rejected..."
        }
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        sx={{ mb: 2 }}
        variant="outlined"
      />

      {canApprove(workflow.current_state) && (
        <FormControlLabel
          control={
            <Checkbox
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
            />
          }
          label="Automatically publish after approval"
          sx={{ mb: 2 }}
        />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!compact && <Divider sx={{ my: 2 }} />}

      {/* Action Buttons */}
      <Box display="flex" flexDirection={compact ? "column" : "row"} gap={compact ? 1 : 2} justifyContent="flex-end">
        {canReject(workflow.current_state) && (
          <Button
            variant="outlined"
            color="error"
            startIcon={loading ? <CircularProgress size={16} /> : <RejectIcon />}
            onClick={() => handleAction('reject')}
            disabled={loading}
            fullWidth={compact}
          >
            Reject Content
          </Button>
        )}
        
        {canRequestRevision(workflow.current_state) && (
          <Button
            variant="outlined"
            color="warning"
            startIcon={loading ? <CircularProgress size={16} /> : <RevisionIcon />}
            onClick={() => handleAction('revision')}
            disabled={loading}
            fullWidth={compact}
          >
            Request Changes
          </Button>
        )}
        
        {canApprove(workflow.current_state) && (
          <Button
            variant="contained"
            color="success"
            startIcon={loading ? <CircularProgress size={16} /> : <ApproveIcon />}
            onClick={() => handleAction('approve')}
            disabled={loading}
            fullWidth={compact}
            sx={{ fontWeight: 600 }}
          >
            Approve Content
          </Button>
        )}
      </Box>

      {!compact && (
        <Box sx={{ mt: 2 }}>
          <Button 
            variant="text" 
            color="secondary" 
            onClick={resetForm}
            disabled={loading}
            size="small"
          >
            Clear Form
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default ReviewActionsPanel;