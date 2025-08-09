/**
 * Share Training Session Modal
 * Modal for sharing training session registration links
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  InputAdornment,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  QrCode as QrCodeIcon,
  Link as LinkIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { type TrainingSession } from '../../client/training';

interface ShareSessionModalProps {
  open: boolean;
  onClose: () => void;
  session: TrainingSession;
}

const ShareSessionModal: React.FC<ShareSessionModalProps> = ({
  open,
  onClose,
  session,
}) => {
  const [shareLink, setShareLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enableExpiration, setEnableExpiration] = useState(false);
  const [expirationDays, setExpirationDays] = useState(30);

  // Generate share link when modal opens
  useEffect(() => {
    if (open && session) {
      generateShareLink();
    }
  }, [open, session]);

  const generateShareLink = async () => {
    setLoading(true);
    setError(null);

    try {
      // For now, create a simple registration link
      // In a full implementation, this would create a secure share token
      const baseUrl = window.location.origin;
      const registrationLink = `${baseUrl}/app/training/register/${session.id}`;
      setShareLink(registrationLink);
      
      // Generate QR code URL (using a QR code service or library)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registrationLink)}`;
      setQrCodeUrl(qrUrl);
    } catch (err) {
      console.error('Failed to generate share link:', err);
      setError('Failed to generate share link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      setError('Failed to copy link to clipboard.');
    }
  };

  const handleClose = () => {
    onClose();
    setCopied(false);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShareIcon />
          Share Training Session
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {session.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Share this link to allow others to register for this training session.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LoadingSpinner />
          </Box>
        ) : (
          <>
            {/* Share Link */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Registration Link
              </Typography>
              <TextField
                fullWidth
                value={shareLink}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
                        <IconButton onClick={handleCopyLink} edge="end">
                          {copied ? <CheckIcon color="success" /> : <CopyIcon />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                variant="outlined"
                size="small"
              />
            </Box>

            {/* QR Code */}
            {qrCodeUrl && (
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="subtitle2" gutterBottom>
                  QR Code
                </Typography>
                <Box sx={{ display: 'inline-block', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <img
                    src={qrCodeUrl}
                    alt="QR Code for registration link"
                    style={{ display: 'block', maxWidth: '200px', height: 'auto' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Scan to open registration link
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Share Options */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Share Options
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={enableExpiration}
                    onChange={(e) => setEnableExpiration(e.target.checked)}
                  />
                }
                label="Set link expiration"
              />
              
              {enableExpiration && (
                <Box sx={{ mt: 2, ml: 4 }}>
                  <TextField
                    label="Expires in (days)"
                    type="number"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(parseInt(e.target.value) || 30)}
                    size="small"
                    sx={{ width: 150 }}
                    InputProps={{ inputProps: { min: 1, max: 365 } }}
                  />
                </Box>
              )}
            </Box>

            {/* Session Details */}
            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Session Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Capacity:</strong> {session.capacity} attendees
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Duration:</strong> {session.duration_minutes} minutes
              </Typography>
              {session.location && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Location:</strong> {session.location}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                <strong>Upcoming Sessions:</strong> {session.upcoming_instances}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleCopyLink}
          disabled={loading || !shareLink}
          startIcon={copied ? <CheckIcon /> : <CopyIcon />}
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareSessionModal;