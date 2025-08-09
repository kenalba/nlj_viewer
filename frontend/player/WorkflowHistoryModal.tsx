/**
 * Workflow History Modal - Shows complete history of a workflow with all review actions
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
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Avatar,
  IconButton,
  Divider
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot
} from '@mui/lab';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as RevisionIcon,
  Send as SubmitIcon,
  Publish as PublishIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { workflowApi } from '../client/workflow';
import type { WorkflowReview, ReviewDecision, WorkflowState } from '../types/workflow';
import {
  getReviewDecisionColor,
  getReviewDecisionLabel,
  getWorkflowStateColor,
  getWorkflowStateLabel
} from '../types/workflow';

interface WorkflowHistoryModalProps {
  open: boolean;
  workflowId: string;
  onClose: () => void;
}

interface TimelineEventProps {
  review: WorkflowReview;
  isLast: boolean;
}

const getTimelineIcon = (decision: ReviewDecision) => {
  switch (decision) {
    case 'approve':
      return <ApproveIcon />;
    case 'request_revision':
      return <RevisionIcon />;
    case 'reject':
      return <RejectIcon />;
    default:
      return <SubmitIcon />;
  }
};

const TimelineEvent: React.FC<TimelineEventProps> = ({ review, isLast }) => {
  const decisionColor = getReviewDecisionColor(review.decision);
  const decisionLabel = getReviewDecisionLabel(review.decision);
  const previousStateLabel = getWorkflowStateLabel(review.previous_state);
  const newStateLabel = getWorkflowStateLabel(review.new_state);

  return (
    <TimelineItem>
      <TimelineSeparator>
        <TimelineDot 
          sx={{ 
            backgroundColor: decisionColor,
            color: 'white'
          }}
        >
          {getTimelineIcon(review.decision)}
        </TimelineDot>
        {!isLast && <TimelineConnector />}
      </TimelineSeparator>
      <TimelineContent>
        <Paper sx={{ p: 2, mb: 2 }}>
          {/* Header with decision and timestamp */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}>
                <PersonIcon sx={{ fontSize: 14 }} />
              </Avatar>
              <Typography variant="subtitle2">
                Reviewer
              </Typography>
              <Chip 
                label={decisionLabel}
                size="small"
                sx={{ 
                  backgroundColor: decisionColor,
                  color: 'white',
                  fontWeight: 600
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {new Date(review.created_at).toLocaleString()}
            </Typography>
          </Box>

          {/* State transition */}
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="caption" color="text.secondary">
              Status changed:
            </Typography>
            <Chip 
              label={previousStateLabel}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
            <Typography variant="caption" color="text.secondary">
              →
            </Typography>
            <Chip 
              label={newStateLabel}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>

          {/* Comments */}
          {review.comments && (
            <Box>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2">
                {review.comments}
              </Typography>
            </Box>
          )}

          {/* Feedback areas (if any) */}
          {review.feedback_areas && Object.keys(review.feedback_areas).length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Detailed Feedback:
              </Typography>
              <Box component="pre" sx={{ 
                fontSize: '0.75rem',
                backgroundColor: 'grey.50',
                p: 1,
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 100
              }}>
                {JSON.stringify(review.feedback_areas, null, 2)}
              </Box>
            </Box>
          )}
        </Paper>
      </TimelineContent>
    </TimelineItem>
  );
};

export const WorkflowHistoryModal: React.FC<WorkflowHistoryModalProps> = ({
  open,
  workflowId,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowReview[]>([]);

  useEffect(() => {
    if (open && workflowId) {
      loadWorkflowHistory();
    }
  }, [open, workflowId]);

  const loadWorkflowHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const history = await workflowApi.getWorkflowHistory(workflowId);
      setWorkflowHistory(history);
    } catch (err: any) {
      console.error('Failed to load workflow history:', err);
      setError(err.message || 'Failed to load workflow history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setWorkflowHistory([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', maxHeight: '700px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">
              Workflow History
            </Typography>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" p={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading workflow history...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && workflowHistory.length === 0 && (
          <Box textAlign="center" py={4}>
            <HistoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No History Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This workflow hasn't had any review actions yet.
            </Typography>
          </Box>
        )}

        {!loading && !error && workflowHistory.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Complete timeline of all review actions and state changes for this workflow.
            </Typography>

            <Timeline sx={{ p: 0 }}>
              {workflowHistory.map((review, index) => (
                <TimelineEvent
                  key={review.id}
                  review={review}
                  isLast={index === workflowHistory.length - 1}
                />
              ))}
            </Timeline>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Close
        </Button>
        {!loading && !error && workflowHistory.length > 0 && (
          <Button 
            variant="outlined" 
            onClick={loadWorkflowHistory}
            startIcon={<HistoryIcon />}
          >
            Refresh
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowHistoryModal;