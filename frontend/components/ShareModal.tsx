/**
 * Share Modal Component
 * Consolidated sharing interface with QR code generation and analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  QrCode as QrCodeIcon,
  Share as ShareIcon,
  Analytics as AnalyticsIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
  Visibility as ViewIcon,
  Delete as RevokeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { 
  sharingApi, 
  generateQRCode, 
  canShareContent, 
  formatShareAnalytics,
  validateExpirationDate,
  type SharedToken, 
  type CreateShareRequest,
  type ShareAnalytics 
} from '../api/sharing';
import type { ContentItem } from '../api/content';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  content: ContentItem;
}

export const ShareModal: React.FC<ShareModalProps> = ({ open, onClose, content }) => {
  const [shareDescription, setShareDescription] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const queryClient = useQueryClient();

  // Check if content can be shared
  const canShare = canShareContent(content);

  // Fetch existing shares
  const { data: shares = [], isLoading: sharesLoading, refetch: refetchShares } = useQuery({
    queryKey: ['content-shares', content.id],
    queryFn: () => sharingApi.getContentShares(content.id),
    enabled: open && canShare,
  });

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ['share-analytics', content.id],
    queryFn: () => sharingApi.getShareAnalytics(content.id),
    enabled: open && canShare && shares.length > 0,
  });

  const activeShare = shares.find(share => share.is_active) || null;
  const formattedAnalytics = analytics ? formatShareAnalytics(analytics) : null;

  // Create share mutation
  const createShareMutation = useMutation({
    mutationFn: (request: CreateShareRequest) => sharingApi.createShare(content.id, request),
    onSuccess: () => {
      refetchShares();
      queryClient.invalidateQueries({ queryKey: ['share-analytics', content.id] });
      setShareDescription('');
      setExpirationDate(null);
    },
  });

  // Revoke share mutation
  const revokeShareMutation = useMutation({
    mutationFn: (tokenId: string) => sharingApi.revokeShare(tokenId),
    onSuccess: () => {
      refetchShares();
      queryClient.invalidateQueries({ queryKey: ['share-analytics', content.id] });
      setQrCodeDataUrl(null);
    },
  });

  // Generate QR code when share is active
  useEffect(() => {
    if (activeShare && !qrCodeDataUrl && !isGeneratingQR) {
      setIsGeneratingQR(true);
      generateQRCode(activeShare.public_url, { width: 300, margin: 2 })
        .then(setQrCodeDataUrl)
        .finally(() => setIsGeneratingQR(false));
    }
  }, [activeShare, qrCodeDataUrl, isGeneratingQR]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQrCodeDataUrl(null);
      setCopySuccess(false);
    }
  }, [open]);

  const handleCreateShare = useCallback(() => {
    const request: CreateShareRequest = {
      description: shareDescription || undefined,
      expires_at: expirationDate?.toISOString() || undefined,
    };
    createShareMutation.mutate(request);
  }, [shareDescription, expirationDate, createShareMutation]);

  const handleRevokeShare = useCallback(() => {
    if (activeShare) {
      revokeShareMutation.mutate(activeShare.id);
    }
  }, [activeShare, revokeShareMutation]);

  const handleCopyLink = useCallback(async () => {
    if (activeShare) {
      try {
        await navigator.clipboard.writeText(activeShare.public_url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
    }
  }, [activeShare]);

  if (!canShare) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm">
        <DialogContent>
          <Alert severity="warning">
            This content cannot be shared publicly. Please check the content status or contact an administrator.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <ShareIcon color="primary" />
              <Typography variant="h6">Share "{content.title}"</Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {activeShare ? (
            <Stack spacing={3}>
              <Alert severity="success" icon={<LinkIcon />}>
                Your activity is publicly shared and accessible via the link below.
              </Alert>

              {/* Share Link Section */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Public Share Link
                  </Typography>
                  <Box display="flex" gap={1} alignItems="center">
                    <TextField
                      fullWidth
                      value={activeShare.public_url}
                      variant="outlined"
                      size="small"
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                    <Tooltip title={copySuccess ? "Copied!" : "Copy link"}>
                      <IconButton onClick={handleCopyLink} color={copySuccess ? "success" : "default"}>
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>

              {/* QR Code and Analytics Section - Using Flexbox */}
              <Box display="flex" gap={3} flexWrap="wrap">
                {/* QR Code Section */}
                <Box flex="1" minWidth="300px">
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={1}>
                        <QrCodeIcon />
                        QR Code
                      </Typography>
                      
                      <Box flex="1" display="flex" alignItems="center" justifyContent="center">
                        {qrCodeDataUrl ? (
                          <Box textAlign="center">
                            <img 
                              src={qrCodeDataUrl} 
                              alt="QR Code for shared activity" 
                              style={{ maxWidth: '200px', width: '100%', height: 'auto' }}
                            />
                            <Typography variant="caption" display="block" mt={1} color="text.secondary">
                              Scan to access on mobile
                            </Typography>
                          </Box>
                        ) : (
                          <Box textAlign="center" py={3}>
                            <CircularProgress size={24} />
                            <Typography variant="body2" mt={1}>
                              Generating QR code...
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                {/* Analytics Section */}
                <Box flex="1" minWidth="300px">
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={1}>
                        <AnalyticsIcon />
                        Analytics
                      </Typography>
                      
                      <Stack spacing={2} sx={{ height: '100%' }}>
                        {analytics && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Share Performance
                            </Typography>
                            <Box display="flex" gap={3} flexWrap="wrap" justifyContent="center">
                              <Box textAlign="center">
                                <Typography variant="h5" color="primary" fontWeight="bold">
                                  {formattedAnalytics!.totalViews}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Views
                                </Typography>
                              </Box>
                              <Box textAlign="center">
                                <Typography variant="h5" color="success.main" fontWeight="bold">
                                  {formattedAnalytics!.totalCompletions}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Completions
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        )}
                        
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Share Details
                          </Typography>
                          <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center">
                            <Chip 
                              icon={<ViewIcon />} 
                              label={`${activeShare.access_count} views`} 
                              size="small" 
                              variant="outlined"
                            />
                            <Chip
                              icon={<ScheduleIcon />}
                              label={activeShare.expires_at ? `Expires ${new Date(activeShare.expires_at).toLocaleDateString()}` : 'Never expires'}
                              size="small"
                              color={activeShare.expires_at ? 'warning' : 'success'}
                            />
                            {activeShare.description && (
                              <Chip
                                label={activeShare.description}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={3}>
              <Alert severity="info">
                Create a public share link to allow anyone to access this activity without an account.
              </Alert>

              <Box display="flex" gap={3} flexDirection={{ xs: 'column', md: 'row' }}>
                <Box flex="2">
                  <TextField
                    label="Description (optional)"
                    value={shareDescription}
                    onChange={(e) => setShareDescription(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Add a description for this share..."
                  />
                </Box>
                
                <Box flex="1" minWidth="250px">
                  <Typography variant="subtitle2" gutterBottom>
                    Expiration (optional)
                  </Typography>
                  <DateTimePicker
                    value={expirationDate}
                    onChange={setExpirationDate}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: "Leave empty for permanent share",
                      },
                    }}
                  />
                </Box>
              </Box>

            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Box display="flex" gap={2} alignItems="center" width="100%" justifyContent="flex-end">
            {activeShare ? (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<RevokeIcon />}
                  onClick={handleRevokeShare}
                  disabled={revokeShareMutation.isPending}
                  sx={{ px: 3 }}
                >
                  Revoke Share
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => refetchShares()}
                  sx={{ px: 3 }}
                >
                  Refresh
                </Button>
                <Button onClick={onClose} sx={{ px: 3 }}>
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onClose} sx={{ px: 3 }}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<ShareIcon />}
                  onClick={handleCreateShare}
                  disabled={createShareMutation.isPending}
                  sx={{ px: 4 }}
                >
                  {createShareMutation.isPending ? 'Creating...' : 'Create Share'}
                </Button>
              </>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};