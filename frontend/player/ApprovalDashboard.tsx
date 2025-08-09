/**
 * Approval Dashboard - Main interface for content reviewers and approvers
 * Displays pending reviews, workflow status, and review actions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
  Badge,
  Chip,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  RateReview as ReviewIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as RevisionIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Schedule as ClockIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { canManageUsers, canReviewContent } from '../utils/permissions';
import { workflowApi } from '../client/workflow';
import type { 
  PendingReview, 
  WorkflowState, 
  WorkflowReview 
} from '../types/workflow';
import {
  getWorkflowStateColor,
  getWorkflowStateLabel,
  canApprove,
  canRequestRevision,
  canReject
} from '../types/workflow';
import { WorkflowHistoryModal } from './WorkflowHistoryModal';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: '24px' }}>
      {value === index && children}
    </div>
  );
}

export const ApprovalDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [allReviews, setAllReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [historyWorkflowId, setHistoryWorkflowId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<WorkflowState | 'all'>('all');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load pending reviews
  useEffect(() => {
    loadPendingReviews();
    loadAllReviews();
  }, [user]);

  const loadPendingReviews = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const reviews = await workflowApi.getPendingReviews(
        user.role === 'reviewer' || user.role === 'approver' ? user.id : undefined
      );
      setPendingReviews(reviews);
    } catch (err) {
      console.error('Failed to load pending reviews:', err);
      setError('Failed to load pending reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAllReviews = async () => {
    try {
      const reviews = await workflowApi.getPendingReviews(); // All reviews for admins
      setAllReviews(reviews);
    } catch (err) {
      console.error('Failed to load all reviews:', err);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleReviewClick = (review: PendingReview) => {
    // Navigate directly to detailed review page
    navigate(`/app/review/${review.workflow.id}`);
  };

  const handleReviewComplete = () => {
    setSelectedReview(null);
    loadPendingReviews();
    loadAllReviews();
  };

  const handleViewHistory = (workflowId: string) => {
    setHistoryWorkflowId(workflowId);
  };

  const getFilteredReviews = (reviews: PendingReview[]) => {
    if (stateFilter === 'all') return reviews;
    return reviews.filter(review => review.workflow.current_state === stateFilter);
  };

  const renderReviewCard = (review: PendingReview, showAssignee: boolean = false) => {
    const { workflow, content_title, content_description, version_number, creator_name, submitted_at } = review;
    const stateColor = getWorkflowStateColor(workflow.current_state);
    const stateLabel = getWorkflowStateLabel(workflow.current_state);
    
    return (
      <Card 
        key={workflow.id}
        sx={{ 
          mb: 2,
          border: `2px solid ${stateColor}20`,
          '&:hover': { 
            boxShadow: 4,
            transform: 'translateY(-1px)',
            transition: 'all 0.2s ease'
          }
        }}
      >
        <CardContent>
          {/* Header row with title and status */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" component="h3" sx={{ flex: 1, mr: 2 }}>
              {content_title}
            </Typography>
            <Chip 
              label={stateLabel}
              size="small"
              sx={{ 
                backgroundColor: stateColor,
                color: 'white',
                fontWeight: 600
              }}
            />
          </Box>

          {/* Content description */}
          {content_description && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ mb: 2, lineHeight: 1.4 }}
            >
              {content_description}
            </Typography>
          )}

          {/* Metadata row */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item>
              <Box display="flex" alignItems="center" gap={0.5}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  by {creator_name}
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Typography variant="caption" color="text.secondary">
                Version {version_number}
              </Typography>
            </Grid>
            {submitted_at && (
              <Grid item>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <ClockIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(submitted_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Grid>
            )}
            {showAssignee && workflow.assigned_reviewer_id && (
              <Grid item>
                <Chip 
                  label="Assigned" 
                  size="small" 
                  variant="outlined" 
                  color="primary"
                />
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Action buttons */}
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" gap={1}>
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<ReviewIcon />}
                onClick={() => handleReviewClick(review)}
              >
                Review Content
              </Button>
            </Box>
            
            <Tooltip title="View Workflow History">
              <IconButton 
                size="small"
                onClick={() => handleViewHistory(workflow.id)}
              >
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>
    );
  };

  if (!canReviewContent(user)) {
    return (
      <Box p={3}>
        <Alert severity="warning">
          You don't have permission to access the approval dashboard.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading reviews...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" action={
          <Button color="inherit" onClick={loadPendingReviews}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  const filteredPendingReviews = getFilteredReviews(pendingReviews);
  const filteredAllReviews = getFilteredReviews(allReviews);

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          Approval Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review and approve content submissions from creators
        </Typography>
      </Box>

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <FilterIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={stateFilter}
              label="Filter by Status"
              onChange={(e) => setStateFilter(e.target.value as WorkflowState | 'all')}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="submitted_for_review">Submitted for Review</MenuItem>
              <MenuItem value="in_review">In Review</MenuItem>
              <MenuItem value="revision_requested">Revision Requested</MenuItem>
              <MenuItem value="approved_pending_publish">Approved</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            {filteredPendingReviews.length} of {pendingReviews.length} items shown
          </Typography>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange}
          sx={{ px: 2, pt: 1 }}
        >
          <Tab 
            label={
              <Badge badgeContent={filteredPendingReviews.length} color="primary">
                My Reviews
              </Badge>
            }
          />
          {canManageUsers(user) && (
            <Tab 
              label={
                <Badge badgeContent={filteredAllReviews.length} color="secondary">
                  All Reviews
                </Badge>
              }
            />
          )}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={currentTab} index={0}>
        {filteredPendingReviews.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <ReviewIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No pending reviews
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stateFilter === 'all' 
                ? "You're all caught up! No content is waiting for your review."
                : `No items found with status: ${getWorkflowStateLabel(stateFilter as WorkflowState)}`
              }
            </Typography>
          </Paper>
        ) : (
          <Box>
            {filteredPendingReviews.map((review) => renderReviewCard(review))}
          </Box>
        )}
      </TabPanel>

      {user.role === 'admin' && (
        <TabPanel value={currentTab} index={1}>
          {filteredAllReviews.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <ReviewIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No reviews in system
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No content is currently in the review process.
              </Typography>
            </Paper>
          ) : (
            <Box>
              {filteredAllReviews.map((review) => renderReviewCard(review, true))}
            </Box>
          )}
        </TabPanel>
      )}

      {/* Keep modal for workflow history only - review modal no longer needed */}

      {/* Workflow History Modal */}
      {historyWorkflowId && (
        <WorkflowHistoryModal
          open={!!historyWorkflowId}
          workflowId={historyWorkflowId}
          onClose={() => setHistoryWorkflowId(null)}
        />
      )}
    </Box>
  );
};

export default ApprovalDashboard;