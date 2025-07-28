/**
 * Review Detail Modal - Detailed view for reviewing content with approve/reject/revision actions
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
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as RevisionIcon,
  ExpandMore as ExpandIcon,
  Close as CloseIcon,
  PlayArrow as PreviewIcon,
  PlayArrow as PlayIcon,
  QrCode as QrCodeIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Schedule as ClockIcon,
  Smartphone as MobileIcon,
  OpenInFull as DetailedReviewIcon
} from '@mui/icons-material';
import QRCode from 'qrcode';
import { useAuth } from '../contexts/AuthContext';
import { workflowApi } from '../api/workflow';
import type { 
  PendingReview, 
  WorkflowReview,
  ApproveContentRequest,
  RequestRevisionRequest,
  RejectContentRequest
} from '../types/workflow';
import {
  getWorkflowStateColor,
  getWorkflowStateLabel,
  getReviewDecisionColor,
  getReviewDecisionLabel,
  canApprove,
  canRequestRevision,
  canReject
} from '../types/workflow';

interface ReviewDetailModalProps {
  open: boolean;
  review: PendingReview;
  onClose: () => void;
  onReviewComplete: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: '16px' }}>
      {value === index && children}
    </div>
  );
}

export const ReviewDetailModal: React.FC<ReviewDetailModalProps> = ({
  open,
  review,
  onClose,
  onReviewComplete
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowReview[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const { workflow, content_id, content_title, content_description, version_number, creator_name, submitted_at } = review;
  const stateColor = getWorkflowStateColor(workflow.current_state);
  const stateLabel = getWorkflowStateLabel(workflow.current_state);

  // Load workflow history when modal opens
  useEffect(() => {
    if (open) {
      loadWorkflowHistory();
      generateQRCode();
    }
  }, [open, workflow.id]);

  // Generate QR code for mobile review access
  const generateQRCode = async () => {
    try {
      // Use current location to preserve base path
      const currentUrl = new URL(window.location.href);
      const reviewUrl = `${currentUrl.origin}${currentUrl.pathname.includes('/nlj_viewer/') ? '/nlj_viewer' : ''}/app/play/${content_id}?review_mode=true`;
      const qrDataUrl = await QRCode.toDataURL(reviewUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const loadWorkflowHistory = async () => {
    try {
      setHistoryLoading(true);
      const history = await workflowApi.getWorkflowHistory(workflow.id);
      setWorkflowHistory(history);
    } catch (err) {
      console.error('Failed to load workflow history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

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

  const handleClose = () => {
    setComments('');
    setAutoPublish(false);
    setError(null);
    setCurrentTab(0);
    onClose();
  };

  const handlePlayContent = () => {
    // Use current location to preserve base path
    const currentUrl = new URL(window.location.href);
    const basePath = currentUrl.pathname.includes('/nlj_viewer/') ? '/nlj_viewer' : '';
    const reviewUrl = `${basePath}/app/play/${content_id}?review_mode=true`;
    window.open(reviewUrl, '_blank');
  };

  const handleDetailedReview = () => {
    // Navigate to the detailed review page
    navigate(`/app/review/${workflow.id}`);
  };

  const renderContentPreview = () => {
    return (
      <Box>
        {/* Review Actions */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayIcon color="primary" />
            Interactive Preview
          </Typography>
          
          <Grid container spacing={3}>
            {/* Play Button */}
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Desktop Review
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayIcon />}
                  onClick={handlePlayContent}
                  fullWidth
                  sx={{ mb: 1 }}
                >
                  Play Activity
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Opens the activity in a new tab for interactive review
                </Typography>
              </Box>
            </Grid>

            {/* QR Code */}
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MobileIcon fontSize="small" />
                  Mobile Review
                </Typography>
                {qrCodeDataUrl ? (
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code for mobile review" 
                      style={{ width: 120, height: 120, border: '1px solid #ddd', borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
                      Scan with your mobile device to review on-the-go
                    </Typography>
                  </Box>
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: 120 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Content Information */}
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Content Overview
          </Typography>
          <Box sx={{ ml: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Title:</strong> {content_title}
            </Typography>
            {content_description && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Description:</strong> {content_description}
              </Typography>
            )}
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Version:</strong> {version_number}
            </Typography>
            <Typography variant="body2">
              <strong>Status:</strong> {stateLabel}
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  };

  const renderWorkflowHistory = () => {
    if (historyLoading) {
      return (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ ml: 1 }}>
            Loading history...
          </Typography>
        </Box>
      );
    }

    if (workflowHistory.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          No review history yet.
        </Typography>
      );
    }

    return (
      <Box>
        {workflowHistory.map((historyItem, index) => {
          const decisionColor = getReviewDecisionColor(historyItem.decision);
          const decisionLabel = getReviewDecisionLabel(historyItem.decision);
          
          return (
            <Card key={historyItem.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2">
                      Reviewer {index + 1}
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
                    <Typography variant="caption" color="text.secondary">
                      {new Date(historyItem.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
                
                {historyItem.comments && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {historyItem.comments}
                  </Typography>
                )}
                
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  State changed: {getWorkflowStateLabel(historyItem.previous_state)} → {getWorkflowStateLabel(historyItem.new_state)}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: '900px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5" component="div">
              Review Content
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {content_title} - Version {version_number}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip 
              label={stateLabel}
              size="small"
              sx={{ 
                backgroundColor: stateColor,
                color: 'white',
                fontWeight: 600
              }}
            />
            <IconButton onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Content Metadata */}
        <Box sx={{ p: 3, pb: 0 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={1}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  <strong>Creator:</strong> {creator_name}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              {submitted_at && (
                <Box display="flex" alignItems="center" gap={1}>
                  <ClockIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>Submitted:</strong> {new Date(submitted_at).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>

          {content_description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {content_description}
            </Typography>
          )}
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label="Content Preview" />
            <Tab label="Review History" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ p: 3, pt: 0, flex: 1, overflow: 'auto' }}>
          <TabPanel value={currentTab} index={0}>
            {renderContentPreview()}
          </TabPanel>
          
          <TabPanel value={currentTab} index={1}>
            {renderWorkflowHistory()}
          </TabPanel>
        </Box>

        {/* Review Form */}
        <Box sx={{ p: 3, pt: 0 }}>
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            Your Review
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Comments"
            placeholder={
              canApprove(workflow.current_state) 
                ? "Add any feedback or comments (optional for approval)..."
                : "Explain what changes are needed or why this is being rejected..."
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            sx={{ mb: 2 }}
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
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          variant="outlined"
          startIcon={<DetailedReviewIcon />}
          onClick={handleDetailedReview}
          disabled={loading}
          sx={{ mr: 'auto' }}
        >
          Detailed Review
        </Button>
        
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        
        <Box display="flex" gap={1}>
          {canReject(workflow.current_state) && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => handleAction('reject')}
              disabled={loading}
            >
              Reject
            </Button>
          )}
          
          {canRequestRevision(workflow.current_state) && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RevisionIcon />}
              onClick={() => handleAction('revision')}
              disabled={loading}
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
            >
              Approve
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ReviewDetailModal;