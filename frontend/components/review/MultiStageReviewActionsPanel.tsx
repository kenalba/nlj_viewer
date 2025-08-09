/**
 * Multi-Stage Review Actions Panel - Handles stage-specific review actions
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as RevisionIcon,
  RateReview as ReviewIcon,
  Person as AssignIcon,
  SwapHoriz as DelegateIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { workflowApi } from '../../client/workflow';
import type {
  MultiStageWorkflow,
  WorkflowStageInstance,
  StageReviewerAssignment,
  ReviewDecision,
  SubmitStageReviewRequest,
  AssignStageReviewersRequest,
  DelegateReviewerRequest
} from '../../types/workflow';
import {
  getStageTypeLabel,
  getStageTypeColor,
  getActiveReviewers,
  isStageComplete
} from '../../types/workflow';

interface MultiStageReviewActionsPanelProps {
  workflow: MultiStageWorkflow;
  currentUserId: string;
  onReviewComplete: () => void;
  compact?: boolean;
}

interface AssignReviewersDialogProps {
  open: boolean;
  stage: WorkflowStageInstance;
  onClose: () => void;
  onAssign: (reviewerIds: string[]) => Promise<void>;
}

interface DelegateReviewDialogProps {
  open: boolean;
  assignment: StageReviewerAssignment;
  onClose: () => void;
  onDelegate: (newReviewerId: string, reason?: string) => Promise<void>;
}

const AssignReviewersDialog: React.FC<AssignReviewersDialogProps> = ({
  open,
  stage,
  onClose,
  onAssign
}) => {
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // This would typically fetch from a users API
  const availableReviewers = [
    { id: '1', name: 'John Doe', role: 'reviewer' },
    { id: '2', name: 'Jane Smith', role: 'approver' },
    { id: '3', name: 'Bob Johnson', role: 'admin' }
  ];

  const handleAssign = async () => {
    if (selectedReviewers.length === 0) return;
    
    setLoading(true);
    try {
      await onAssign(selectedReviewers);
      setSelectedReviewers([]);
      onClose();
    } catch (error) {
      console.error('Failed to assign reviewers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Reviewers to {stage.template_stage.name}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Select Reviewers</InputLabel>
          <Select
            multiple
            value={selectedReviewers}
            onChange={(e) => setSelectedReviewers(e.target.value as string[])}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const reviewer = availableReviewers.find(r => r.id === value);
                  return (
                    <Chip key={value} label={reviewer?.name} size="small" />
                  );
                })}
              </Box>
            )}
          >
            {availableReviewers.map((reviewer) => (
              <MenuItem key={reviewer.id} value={reviewer.id}>
                {reviewer.name} ({reviewer.role})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleAssign} 
          variant="contained"
          disabled={loading || selectedReviewers.length === 0}
          startIcon={loading ? <CircularProgress size={16} /> : <AssignIcon />}
        >
          Assign Reviewers
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DelegateReviewDialog: React.FC<DelegateReviewDialogProps> = ({
  open,
  assignment,
  onClose,
  onDelegate
}) => {
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [delegationReason, setDelegationReason] = useState('');
  const [loading, setLoading] = useState(false);

  // This would typically fetch from a users API
  const availableReviewers = [
    { id: '1', name: 'John Doe', role: 'reviewer' },
    { id: '2', name: 'Jane Smith', role: 'approver' },
    { id: '3', name: 'Bob Johnson', role: 'admin' }
  ];

  const handleDelegate = async () => {
    if (!selectedReviewer) return;
    
    setLoading(true);
    try {
      await onDelegate(selectedReviewer, delegationReason);
      setSelectedReviewer('');
      setDelegationReason('');
      onClose();
    } catch (error) {
      console.error('Failed to delegate review:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delegate Review Assignment</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
          <InputLabel>Select New Reviewer</InputLabel>
          <Select
            value={selectedReviewer}
            onChange={(e) => setSelectedReviewer(e.target.value)}
          >
            {availableReviewers
              .filter(r => r.id !== assignment.reviewer_id)
              .map((reviewer) => (
                <MenuItem key={reviewer.id} value={reviewer.id}>
                  {reviewer.name} ({reviewer.role})
                </MenuItem>
              ))}
          </Select>
        </FormControl>
        
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Delegation Reason (Optional)"
          value={delegationReason}
          onChange={(e) => setDelegationReason(e.target.value)}
          placeholder="Explain why you're delegating this review..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleDelegate} 
          variant="contained"
          disabled={loading || !selectedReviewer}
          startIcon={loading ? <CircularProgress size={16} /> : <DelegateIcon />}
        >
          Delegate Review
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const MultiStageReviewActionsPanel: React.FC<MultiStageReviewActionsPanelProps> = ({
  workflow,
  currentUserId,
  onReviewComplete,
  compact = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [delegateDialogOpen, setDelegateDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<WorkflowStageInstance | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<StageReviewerAssignment | null>(null);

  // Get current stage
  const currentStage = workflow.stage_instances.find(
    stage => stage.template_stage.stage_order === workflow.current_stage_order
  );

  // Check if current user can review this stage
  const userAssignment = currentStage?.reviewer_assignments.find(
    assignment => assignment.reviewer_id === currentUserId && assignment.is_active && !assignment.has_reviewed
  );

  const canReview = !!userAssignment;
  const activeReviewers = currentStage ? getActiveReviewers(currentStage) : [];

  const handleStageReview = async (decision: ReviewDecision) => {
    if (!currentStage || !userAssignment) return;

    if (!comments.trim() && (decision === 'request_revision' || decision === 'reject')) {
      setError('Comments are required for revision requests and rejections.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request: SubmitStageReviewRequest = {
        decision,
        comments: comments.trim() || undefined,
      };

      await workflowApi.submitStageReview(currentStage.id, request);
      onReviewComplete();
    } catch (err: any) {
      console.error('Failed to submit stage review:', err);
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignReviewers = async (reviewerIds: string[]) => {
    if (!selectedStage) return;

    const request: AssignStageReviewersRequest = { reviewer_ids: reviewerIds };
    await workflowApi.assignStageReviewers(selectedStage.id, request);
    onReviewComplete();
  };

  const handleDelegateReview = async (newReviewerId: string, reason?: string) => {
    if (!selectedAssignment) return;

    const request: DelegateReviewerRequest = {
      assignment_id: selectedAssignment.id,
      new_reviewer_id: newReviewerId,
      delegation_reason: reason,
    };

    await workflowApi.delegateReviewerAssignment(request);
    onReviewComplete();
  };

  const openAssignDialog = (stage: WorkflowStageInstance) => {
    setSelectedStage(stage);
    setAssignDialogOpen(true);
  };

  const openDelegateDialog = (assignment: StageReviewerAssignment) => {
    setSelectedAssignment(assignment);
    setDelegateDialogOpen(true);
  };

  if (!currentStage) {
    return (
      <Paper sx={{ p: compact ? 2 : 3 }}>
        <Alert severity="info">
          No active stage found in this workflow.
        </Alert>
      </Paper>
    );
  }

  const isStageCompleted = isStageComplete(currentStage);

  return (
    <Paper sx={{ p: compact ? 2 : 3 }}>
      <Typography variant={compact ? "h6" : "h5"} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReviewIcon color="primary" />
        Stage Review Actions
      </Typography>

      {/* Current Stage Info */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>
            {currentStage.template_stage.name}
          </Typography>
          <Chip
            label={getStageTypeLabel(currentStage.template_stage.stage_type)}
            size="small"
            sx={{
              bgcolor: getStageTypeColor(currentStage.template_stage.stage_type),
              color: 'white'
            }}
          />
        </Box>
        
        {currentStage.template_stage.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {currentStage.template_stage.description}
          </Typography>
        )}

        <Typography variant="body2" color="text.secondary">
          Progress: {currentStage.approvals_received}/{currentStage.approvals_required} approvals received
        </Typography>
      </Box>

      {/* Stage Status */}
      {isStageCompleted ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          This stage has been completed and approved.
        </Alert>
      ) : canReview ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are assigned to review this stage. Please provide your assessment.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={compact ? 3 : 4}
            label="Review Comments"
            placeholder="Provide your feedback and assessment..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            sx={{ mb: 2 }}
            variant="outlined"
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!compact && <Divider sx={{ my: 2 }} />}

          {/* Review Action Buttons */}
          <Box display="flex" flexDirection="column" gap={1}>
            {/* Top row: Reject and Approve */}
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                color="error"
                startIcon={loading ? <CircularProgress size={16} /> : <RejectIcon />}
                onClick={() => handleStageReview('reject')}
                disabled={loading}
                fullWidth
              >
                Reject
              </Button>
              
              <Button
                variant="contained"
                color="success"
                startIcon={loading ? <CircularProgress size={16} /> : <ApproveIcon />}
                onClick={() => handleStageReview('approve')}
                disabled={loading}
                fullWidth
                sx={{ fontWeight: 600 }}
              >
                Approve
              </Button>
            </Box>
            
            {/* Bottom row: Request Changes (full width) */}
            <Button
              variant="outlined"
              color="warning"
              startIcon={loading ? <CircularProgress size={16} /> : <RevisionIcon />}
              onClick={() => handleStageReview('request_revision')}
              disabled={loading}
              fullWidth
            >
              Request Changes
            </Button>
          </Box>

          {/* Delegation Option */}
          {userAssignment && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="text"
                startIcon={<DelegateIcon />}
                onClick={() => openDelegateDialog(userAssignment)}
                size="small"
              >
                Delegate This Review
              </Button>
            </Box>
          )}
        </Box>
      ) : (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            You are not currently assigned to review this stage.
          </Alert>

          {/* Show Active Reviewers */}
          {activeReviewers.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Current Reviewers
              </Typography>
              <List dense>
                {activeReviewers.map((assignment) => (
                  <ListItem key={assignment.id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={assignment.assigned_role || 'Direct Assignment'}
                      secondary={`Assigned ${new Date(assignment.assigned_at).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Management Actions (if user has permissions) */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => openAssignDialog(currentStage)}
              size="small"
            >
              Assign More Reviewers
            </Button>
          </Box>
        </Box>
      )}

      {/* Dialogs */}
      {selectedStage && (
        <AssignReviewersDialog
          open={assignDialogOpen}
          stage={selectedStage}
          onClose={() => {
            setAssignDialogOpen(false);
            setSelectedStage(null);
          }}
          onAssign={handleAssignReviewers}
        />
      )}

      {selectedAssignment && (
        <DelegateReviewDialog
          open={delegateDialogOpen}
          assignment={selectedAssignment}
          onClose={() => {
            setDelegateDialogOpen(false);
            setSelectedAssignment(null);
          }}
          onDelegate={handleDelegateReview}
        />
      )}
    </Paper>
  );
};

export default MultiStageReviewActionsPanel;