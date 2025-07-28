/**
 * Review Play Tab - Interactive preview with Play button and QR code
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Smartphone as MobileIcon,
  OpenInNew as ExternalIcon,
  QrCode as QrCodeIcon
} from '@mui/icons-material';
import QRCode from 'qrcode';
import type { PendingReview } from '../../types/workflow';

interface ReviewPlayTabProps {
  review: PendingReview;
}

export const ReviewPlayTab: React.FC<ReviewPlayTabProps> = ({ review }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [qrCodeLoading, setQrCodeLoading] = useState(true);
  const { content_id, content_title } = review;

  // Generate QR code on component mount
  useEffect(() => {
    generateQRCode();
  }, [content_id]);

  const generateQRCode = async () => {
    try {
      setQrCodeLoading(true);
      // Use current location to preserve base path
      const currentUrl = new URL(window.location.href);
      const reviewUrl = `${currentUrl.origin}${currentUrl.pathname.includes('/nlj_viewer/') ? '/nlj_viewer' : ''}/app/play/${content_id}?review_mode=true`;
      const qrDataUrl = await QRCode.toDataURL(reviewUrl, {
        width: 250,
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
    // Use current location to preserve base path
    const currentUrl = new URL(window.location.href);
    const basePath = currentUrl.pathname.includes('/nlj_viewer/') ? '/nlj_viewer' : '';
    const reviewUrl = `${basePath}/app/play/${content_id}?review_mode=true`;
    window.open(reviewUrl, '_blank');
  };

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayIcon color="primary" />
          Interactive Preview
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Test the content interactively to understand the learner experience before approving.
        </Typography>
      </Paper>

      <Grid container spacing={4}>
        {/* Desktop Preview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ExternalIcon />
              Desktop Review
            </Typography>
            
            <Box sx={{ textAlign: 'center', py: 4 }}>
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
                You'll see all content as learners would, with special review indicators.
              </Typography>
            </Box>

            <Alert severity="info" icon={<PlayIcon />} sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Review Mode Features:</strong><br />
                • Full interactive experience<br />
                • All questions and games functional<br />
                • Progress tracking enabled<br />
                • Special review mode banner
              </Typography>
            </Alert>
          </Paper>
        </Grid>

        {/* Mobile Preview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MobileIcon />
              Mobile Review
            </Typography>
            
            <Box sx={{ textAlign: 'center', py: 2 }}>
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
                    p: 2, 
                    bgcolor: 'white', 
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    mb: 2
                  }}>
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code for mobile review" 
                      style={{ width: 180, height: 180, display: 'block' }}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mx: 'auto', mb: 2 }}>
                    Scan with your mobile device to review this content on-the-go. 
                    Perfect for testing mobile responsiveness and touch interactions.
                  </Typography>
                </Box>
              ) : (
                <Alert severity="warning">
                  Failed to generate QR code. Use the desktop preview instead.
                </Alert>
              )}
            </Box>

            <Alert severity="info" icon={<QrCodeIcon />}>
              <Typography variant="body2">
                <strong>Mobile Review Benefits:</strong><br />
                • Test touch interactions<br />
                • Verify mobile responsiveness<br />
                • Check readability on small screens<br />
                • Assess mobile user experience
              </Typography>
            </Alert>
          </Paper>
        </Grid>
      </Grid>

      {/* Tips */}
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

export default ReviewPlayTab;