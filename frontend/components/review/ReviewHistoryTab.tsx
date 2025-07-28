/**
 * Review History Tab - Workflow history and previous reviews
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  Divider
} from '@mui/material';
import {
  History as HistoryIcon,
  Person as PersonIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Edit as RevisionIcon,
  Schedule as ClockIcon
} from '@mui/icons-material';
import { workflowApi } from '../../api/workflow';
import type { PendingReview, WorkflowReview } from '../../types/workflow';
import {
  getWorkflowStateColor,
  getWorkflowStateLabel,
  getReviewDecisionColor,
  getReviewDecisionLabel
} from '../../types/workflow';

interface ReviewHistoryTabProps {
  review: PendingReview;
}

export const ReviewHistoryTab: React.FC<ReviewHistoryTabProps> = ({ review }) => {
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { workflow } = review;

  useEffect(() => {
    loadWorkflowHistory();
  }, [workflow.id]);

  const loadWorkflowHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const history = await workflowApi.getWorkflowHistory(workflow.id);
      setWorkflowHistory(history);
    } catch (err: any) {
      console.error('Failed to load workflow history:', err);
      setError('Failed to load review history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'approve':
        return <ApprovedIcon sx={{ color: '#4CAF50' }} />;
      case 'request_revision':
        return <RevisionIcon sx={{ color: '#FF9800' }} />;
      case 'reject':
        return <RejectedIcon sx={{ color: '#F44336' }} />;
      default:
        return <HistoryIcon sx={{ color: '#9E9E9E' }} />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8}>
        <CircularProgress size={40} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading review history...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.50' }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          Review History
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track all reviews and state changes for this content version.
        </Typography>
      </Paper>

      {/* Current State Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Current Status
        </Typography>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Chip 
            label={getWorkflowStateLabel(workflow.current_state)}
            sx={{ 
              backgroundColor: getWorkflowStateColor(workflow.current_state),
              color: 'white',
              fontWeight: 600
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Last updated: {new Date(workflow.updated_at).toLocaleString()}
          </Typography>
        </Box>
      </Paper>

      {/* History Timeline */}
      {workflowHistory.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            No review history yet. This content is awaiting its first review.
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Review Timeline
          </Typography>
          
          <List sx={{ width: '100%' }}>
            {workflowHistory.map((historyItem, index) => {
              const decisionColor = getReviewDecisionColor(historyItem.decision);
              const decisionLabel = getReviewDecisionLabel(historyItem.decision);
              const isLast = index === workflowHistory.length - 1;
              
              return (
                <React.Fragment key={historyItem.id}>
                  <ListItem sx={{ px: 0, pb: 3 }}>
                    <Box sx={{ width: '100%' }}>
                      <Card variant="outlined" sx={{ position: 'relative' }}>
                        {/* Timeline dot */}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: -15,
                            top: 20,
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            backgroundColor: decisionColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '3px solid white',
                            boxShadow: 1
                          }}
                        >
                          {getDecisionIcon(historyItem.decision)}
                        </Box>
                        
                        {/* Timeline connector */}
                        {!isLast && (
                          <Box
                            sx={{
                              position: 'absolute',
                              left: -3,
                              top: 50,
                              bottom: -20,
                              width: 2,
                              backgroundColor: 'grey.300'
                            }}
                          />
                        )}
                        
                        <CardContent sx={{ ml: 2 }}>
                          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <PersonIcon fontSize="small" color="action" />
                              <Typography variant="subtitle1" fontWeight={600}>
                                Review #{index + 1}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
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
                          </Box>
                          
                          {historyItem.comments && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Reviewer Comments:
                              </Typography>
                              <Typography variant="body2" sx={{ 
                                bgcolor: 'grey.50', 
                                p: 2, 
                                borderRadius: 1,
                                fontStyle: 'italic'
                              }}>
                                "{historyItem.comments}"
                              </Typography>
                            </Box>
                          )}
                          
                          <Box display="flex" alignItems="center" justifyContent="between" gap={2}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <ClockIcon fontSize="small" color="action" />
                              <Typography variant="caption" color="text.secondary">
                                {new Date(historyItem.created_at).toLocaleString()}
                              </Typography>
                            </Box>
                            
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                              {getWorkflowStateLabel(historyItem.previous_state)} → {getWorkflowStateLabel(historyItem.new_state)}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        </Paper>
      )}

      {/* Statistics */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>
          Review Statistics
        </Typography>
        <Box display="flex" gap={4}>
          <Box>
            <Typography variant="h4" color="primary.main" fontWeight="bold">
              {workflowHistory.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Reviews
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" color="success.main" fontWeight="bold">
              {workflowHistory.filter(h => h.decision === 'approve').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approvals
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" color="warning.main" fontWeight="bold">
              {workflowHistory.filter(h => h.decision === 'request_revision').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Revisions
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" color="error.main" fontWeight="bold">
              {workflowHistory.filter(h => h.decision === 'reject').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rejections
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ReviewHistoryTab;