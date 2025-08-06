/**
 * Multi-Stage Workflow Panel - Shows workflow progress through multiple review stages
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  Chip,
  Avatar,
  AvatarGroup,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  Schedule as InProgressIcon,
  Person as ReviewerIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  SwapHoriz as DelegateIcon
} from '@mui/icons-material';
import type {
  MultiStageWorkflow,
  WorkflowStageInstance,
  StageReviewerAssignment,
  WorkflowState
} from '../../types/workflow';
import {
  getStageTypeLabel,
  getStageTypeColor,
  getStageProgress,
  isStageComplete,
  getActiveReviewers,
  getWorkflowStateColor,
  getWorkflowStateLabel
} from '../../types/workflow';

interface MultiStageWorkflowPanelProps {
  workflow: MultiStageWorkflow;
  onStageSelect?: (stageInstance: WorkflowStageInstance) => void;
  compact?: boolean;
}

interface StageItemProps {
  stage: WorkflowStageInstance;
  isActive: boolean;
  isCompleted: boolean;
  onSelect?: (stage: WorkflowStageInstance) => void;
  compact?: boolean;
}

const StageItem: React.FC<StageItemProps> = ({
  stage,
  isActive,
  isCompleted,
  onSelect,
  compact = false
}) => {
  const [expanded, setExpanded] = useState(isActive);
  const activeReviewers = getActiveReviewers(stage);
  const completedReviewers = stage.reviewer_assignments.filter(r => r.has_reviewed);
  const progress = getStageProgress(stage);

  const getStageIcon = () => {
    if (isCompleted) {
      return <CompletedIcon sx={{ color: 'success.main' }} />;
    } else if (isActive) {
      return <InProgressIcon sx={{ color: 'primary.main' }} />;
    } else {
      return <PendingIcon sx={{ color: 'grey.400' }} />;
    }
  };

  const handleToggleExpanded = () => {
    if (!compact) {
      setExpanded(!expanded);
    }
  };

  const handleStageClick = () => {
    if (onSelect) {
      onSelect(stage);
    }
  };

  return (
    <Paper 
      elevation={isActive ? 2 : 1} 
      sx={{ 
        p: compact ? 1.5 : 2, 
        mb: 1,
        border: isActive ? 2 : 1,
        borderColor: isActive ? 'primary.main' : 'divider',
        cursor: onSelect ? 'pointer' : 'default'
      }}
      onClick={handleStageClick}
    >
      <Box display="flex" alignItems="center" gap={2}>
        {getStageIcon()}
        
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography variant={compact ? "body2" : "subtitle1"} fontWeight={600}>
              {stage.template_stage.name}
            </Typography>
            <Chip
              label={getStageTypeLabel(stage.template_stage.stage_type)}
              size="small"
              sx={{
                bgcolor: getStageTypeColor(stage.template_stage.stage_type),
                color: 'white',
                fontSize: '0.75rem'
              }}
            />
          </Box>
          
          {!compact && stage.template_stage.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {stage.template_stage.description}
            </Typography>
          )}

          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <Typography variant="caption" color="text.secondary">
              Progress: {stage.approvals_received}/{stage.approvals_required} approvals
            </Typography>
            {progress > 0 && (
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ flex: 1, height: 6, borderRadius: 3 }}
              />
            )}
          </Box>

          {/* Reviewer Avatars */}
          <Box display="flex" alignItems="center" gap={1}>
            {activeReviewers.length > 0 && (
              <Tooltip title={`${activeReviewers.length} active reviewers`}>
                <AvatarGroup max={compact ? 2 : 4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24 } }}>
                  {activeReviewers.map((assignment) => (
                    <Avatar
                      key={assignment.id}
                      sx={{ 
                        bgcolor: 'primary.main',
                        fontSize: '0.75rem'
                      }}
                    >
                      <ReviewerIcon fontSize="small" />
                    </Avatar>
                  ))}
                </AvatarGroup>
              </Tooltip>
            )}
            
            {completedReviewers.length > 0 && (
              <Chip
                label={`${completedReviewers.length} completed`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        {!compact && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpanded();
            }}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        )}
      </Box>

      {/* Expanded Details */}
      {!compact && (
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Review Assignments
            </Typography>
            
            <List dense>
              {stage.reviewer_assignments.map((assignment) => (
                <ListItem key={assignment.id} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      bgcolor: assignment.has_reviewed ? 'success.main' : 'grey.400',
                      width: 32, 
                      height: 32 
                    }}>
                      <ReviewerIcon fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">
                          {assignment.assigned_role || 'Direct Assignment'}
                        </Typography>
                        {assignment.assignment_type === 'delegated' && (
                          <Chip
                            icon={<DelegateIcon />}
                            label="Delegated"
                            size="small"
                            variant="outlined"
                            color="secondary"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      assignment.has_reviewed 
                        ? `Reviewed on ${new Date(assignment.assigned_at).toLocaleDateString()}`
                        : `Assigned on ${new Date(assignment.assigned_at).toLocaleDateString()}`
                    }
                  />
                </ListItem>
              ))}
            </List>

            {stage.started_at && (
              <Typography variant="caption" color="text.secondary">
                Started: {new Date(stage.started_at).toLocaleString()}
              </Typography>
            )}
            
            {stage.completed_at && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                Completed: {new Date(stage.completed_at).toLocaleString()}
              </Typography>
            )}
          </Box>
        </Collapse>
      )}
    </Paper>
  );
};

export const MultiStageWorkflowPanel: React.FC<MultiStageWorkflowPanelProps> = ({
  workflow,
  onStageSelect,
  compact = false
}) => {
  const currentStageOrder = workflow.current_stage_order || 1;
  const sortedStages = [...workflow.stage_instances].sort(
    (a, b) => a.template_stage.stage_order - b.template_stage.stage_order
  );

  return (
    <Paper sx={{ p: compact ? 2 : 3 }}>
      <Typography variant={compact ? "h6" : "h5"} gutterBottom>
        Multi-Stage Review Workflow
      </Typography>
      
      {workflow.template_id && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Following structured review process
        </Typography>
      )}

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Overall Progress
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2">
            Stage {currentStageOrder} of {sortedStages.length}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(currentStageOrder / sortedStages.length) * 100}
            sx={{ flex: 1, height: 8, borderRadius: 4 }}
          />
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Stage List */}
      <Box>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Review Stages
        </Typography>
        
        {sortedStages.map((stage) => {
          const isActive = stage.template_stage.stage_order === currentStageOrder;
          const isCompleted = isStageComplete(stage);
          
          return (
            <StageItem
              key={stage.id}
              stage={stage}
              isActive={isActive}
              isCompleted={isCompleted}
              onSelect={onStageSelect}
              compact={compact}
            />
          );
        })}
      </Box>

      {/* Current Status */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Current Status
        </Typography>
        <Chip
          label={getWorkflowStateLabel(workflow.current_state)}
          sx={{
            bgcolor: getWorkflowStateColor(workflow.current_state),
            color: 'white'
          }}
        />
      </Box>
    </Paper>
  );
};

export default MultiStageWorkflowPanel;