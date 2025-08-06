/**
 * Unified Review Overview and Preview Tab - Combined content information, metadata, and interactive preview
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  Person as PersonIcon,
  Schedule as ClockIcon,
  Info as InfoIcon,
  Tag as VersionIcon,
  PlayArrow as PlayIcon,
  Smartphone as MobileIcon,
  OpenInNew as ExternalIcon,
  QrCode as QrCodeIcon
} from '@mui/icons-material';
import QRCode from 'qrcode';
import type { PendingReview } from '../../types/workflow';
import {
  getWorkflowStateColor,
  getWorkflowStateLabel
} from '../../types/workflow';

interface ReviewOverviewAndPreviewTabProps {
  review: PendingReview;
}

export const ReviewOverviewAndPreviewTab: React.FC<ReviewOverviewAndPreviewTabProps> = ({ review }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [qrCodeLoading, setQrCodeLoading] = useState(true);
  
  const { workflow, content_title, content_description, version_number, creator_name, submitted_at, content_id } = review;
  const stateColor = getWorkflowStateColor(workflow.current_state);
  const stateLabel = getWorkflowStateLabel(workflow.current_state);

  // Generate QR code on component mount
  useEffect(() => {
    generateQRCode();
  }, [content_id]);

  const generateQRCode = async () => {
    try {
      setQrCodeLoading(true);
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
    } finally {
      setQrCodeLoading(false);
    }
  };

  const handlePlayContent = () => {
    const currentUrl = new URL(window.location.href);
    const basePath = currentUrl.pathname.includes('/nlj_viewer/') ? '/nlj_viewer' : '';
    const reviewUrl = `${basePath}/app/play/${content_id}?review_mode=true`;
    window.open(reviewUrl, '_blank');
  };

  return (
    <Box>
      {/* Content Title and Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
          <Box flex={1}>
            <Typography variant="h4" gutterBottom>
              {content_title}
            </Typography>
            {content_description && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {content_description}
              </Typography>
            )}
          </Box>
          <Chip 
            label={stateLabel}
            size="medium"
            sx={{ 
              backgroundColor: stateColor,
              color: 'white',
              fontWeight: 600,
              ml: 2
            }}
          />
        </Box>

        {/* Metadata Cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <PersonIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Creator
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {creator_name}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <VersionIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Version
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  v{version_number}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <ClockIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Submitted
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {submitted_at ? new Date(submitted_at).toLocaleDateString() : 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <InfoIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Workflow ID
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {workflow.id.slice(0, 8)}...
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* Interactive Preview Section */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayIcon color="primary" />
          Interactive Preview
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Test the content interactively to understand the learner experience before approving.
        </Typography>

        <Grid container spacing={3}>
          {/* Desktop Preview */}
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ExternalIcon />
                  Desktop Review
                </Typography>
                
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayIcon />}
                    onClick={handlePlayContent}
                    sx={{ 
                      px: 4, 
                      py: 2, 
                      fontSize: '1.1rem',
                      mb: 2,
                      minWidth: 200
                    }}
                  >
                    Play Activity
                  </Button>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mx: 'auto' }}>
                    Opens "{content_title}" in a new tab with review mode enabled.
                  </Typography>
                </Box>

                <Alert severity="info" icon={<PlayIcon />}>
                  <Typography variant="body2">
                    <strong>Review Mode Features:</strong><br />
                    • Full interactive experience<br />
                    • All questions and games functional<br />
                    • Progress tracking enabled<br />
                    • Special review mode banner
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          {/* Mobile Preview */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                  <MobileIcon />
                  Mobile Review
                </Typography>
                
                <Box sx={{ py: 2 }}>
                  {qrCodeLoading ? (
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                      <CircularProgress size={32} />
                      <Typography variant="body2" color="text.secondary">
                        Generating QR code...
                      </Typography>
                    </Box>
                  ) : qrCodeDataUrl ? (
                    <Box>
                      <Box sx={{ 
                        display: 'inline-block', 
                        p: 1.5, 
                        bgcolor: 'white', 
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        mb: 2
                      }}>
                        <img 
                          src={qrCodeDataUrl} 
                          alt="QR Code for mobile review" 
                          style={{ width: 140, height: 140, display: 'block' }}
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Scan with your mobile device to test mobile experience.
                      </Typography>
                    </Box>
                  ) : (
                    <Alert severity="warning" sx={{ textAlign: 'left' }}>
                      Failed to generate QR code.
                    </Alert>
                  )}
                </Box>

                <Alert severity="info" icon={<QrCodeIcon />} sx={{ textAlign: 'left' }}>
                  <Typography variant="body2">
                    <strong>Mobile Benefits:</strong><br />
                    • Test touch interactions<br />
                    • Verify responsiveness<br />
                    • Check mobile UX
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Additional Details */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon />
          Workflow Details
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Requires Approval
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {workflow.requires_approval ? 'Yes' : 'No'}
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Auto Publish
            </Typography>
            <Typography variant="body2">
              {workflow.auto_publish ? 'Yes' : 'No'}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Created
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {new Date(workflow.created_at).toLocaleString()}
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Last Updated
            </Typography>
            <Typography variant="body2">
              {new Date(workflow.updated_at).toLocaleString()}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Review Tips */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>
          Review Tips
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              🎯 Focus Areas
            </Typography>
            <Typography variant="body2">
              Check content accuracy, learning objectives alignment, and overall quality.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              🔍 What to Test
            </Typography>
            <Typography variant="body2">
              Try all interactions, verify correct answers, and test edge cases.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              📱 Cross-Device
            </Typography>
            <Typography variant="body2">
              Use both desktop and mobile to ensure consistent experience across devices.
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ReviewOverviewAndPreviewTab;