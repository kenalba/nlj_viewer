/**
 * Status Indicator Component
 * Shows real-time status updates for event-driven operations
 */

import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

export interface StatusIndicatorProps {
  status: 'processing' | 'confirmed' | 'waitlisted' | 'failed' | 'timeout' | null;
  message?: string;
  attempts?: number;
  maxAttempts?: number;
  error?: string | null;
  data?: any;
  compact?: boolean;
  showProgress?: boolean;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  attempts = 0,
  maxAttempts = 30,
  error,
  data,
  compact = false,
  showProgress = true,
  className,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <CircularProgress size={compact ? 16 : 20} />;
      case 'confirmed':
        return <CheckCircleIcon color="success" fontSize={compact ? "small" : "medium"} />;
      case 'waitlisted':
        return <WarningIcon color="warning" fontSize={compact ? "small" : "medium"} />;
      case 'failed':
      case 'timeout':
        return <ErrorIcon color="error" fontSize={compact ? "small" : "medium"} />;
      default:
        return <ScheduleIcon color="action" fontSize={compact ? "small" : "medium"} />;
    }
  };

  const getStatusColor = (): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'waitlisted':
        return 'warning';
      case 'failed':
      case 'timeout':
        return 'error';
      case 'processing':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'processing':
        return 'Processing...';
      case 'confirmed':
        return 'Confirmed';
      case 'waitlisted':
        return 'Waitlisted';
      case 'failed':
        return 'Failed';
      case 'timeout':
        return 'Timed Out';
      default:
        return 'Unknown';
    }
  };

  const getProgressValue = () => {
    if (!status || status === 'processing') {
      return (attempts / maxAttempts) * 100;
    }
    return status === 'confirmed' || status === 'waitlisted' ? 100 : 0;
  };

  if (compact) {
    return (
      <Box className={className} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {getStatusIcon()}
        <Chip
          label={getStatusLabel()}
          color={getStatusColor()}
          size="small"
          variant={status === 'processing' ? 'outlined' : 'filled'}
        />
        {status === 'waitlisted' && data?.waitlist_position && (
          <Chip
            label={`#${data.waitlist_position}`}
            color="info"
            size="small"
            variant="outlined"
          />
        )}
      </Box>
    );
  }

  return (
    <Card className={className} sx={{ width: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          {getStatusIcon()}
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h6">
                Operation Status
              </Typography>
              <Chip
                label={getStatusLabel()}
                color={getStatusColor()}
                size="small"
                variant={status === 'processing' ? 'outlined' : 'filled'}
              />
            </Box>
            
            {message && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {message}
              </Typography>
            )}

            {/* Processing details */}
            {status === 'processing' && attempts > 0 && (
              <Typography variant="caption" color="text.secondary">
                Checking status... (attempt {attempts}/{maxAttempts})
              </Typography>
            )}

            {/* Waitlist position */}
            {status === 'waitlisted' && data?.waitlist_position && (
              <Alert severity="info" sx={{ mt: 2 }}>
                You are position {data.waitlist_position} on the waitlist.
                You'll be notified if a spot becomes available.
              </Alert>
            )}

            {/* Success details */}
            {status === 'confirmed' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Your registration has been confirmed!
              </Alert>
            )}

            {/* Error details */}
            {(status === 'failed' || status === 'timeout' || error) && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error || 
                 (status === 'timeout' ? 'Operation timed out. Please check manually.' : 'Operation failed. Please try again.')}
              </Alert>
            )}
          </Box>
        </Box>

        {/* Progress bar */}
        <Collapse in={showProgress && (status === 'processing' || attempts > 0)}>
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress 
              variant={status === 'processing' ? 'determinate' : 'indeterminate'}
              value={getProgressValue()}
              color={getStatusColor()}
              sx={{ height: 6, borderRadius: 3 }}
            />
            {status === 'processing' && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(getProgressValue())}%
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>

        {/* Additional data display */}
        {data && Object.keys(data).length > 0 && status !== 'processing' && (
          <Collapse in={true}>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Details:
              </Typography>
              {data.booking_id && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Booking ID: {data.booking_id}
                </Typography>
              )}
              {data.event_id && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Event ID: {data.event_id}
                </Typography>
              )}
              {data.session_id && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Session ID: {data.session_id}
                </Typography>
              )}
            </Box>
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
};

export default StatusIndicator;