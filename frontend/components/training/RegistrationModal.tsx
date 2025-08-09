/**
 * Registration Modal
 * Modal for registering for training sessions with availability checking
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Card,
  CardContent,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
} from '@mui/material';
import {
  Event as EventIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Group as GroupIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { registrationAPI, type TrainingSession, type RegistrationRequest, type BookingResponse, type BookingStatusResponse } from '../../client/training';
import { useBookingStatusPolling } from '../../hooks/useStatusPolling';
import StatusIndicator from './StatusIndicator';

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
  session: TrainingSession;
  onSuccess: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({
  open,
  onClose,
  session,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registrationMethod, setRegistrationMethod] = useState('online');
  const [specialRequirements, setSpecialRequirements] = useState<Record<string, any>>({});
  const [registrationNotes, setRegistrationNotes] = useState('');
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [bookingResponse, setBookingResponse] = useState<BookingResponse | null>(null);

  // Real-time status polling
  const statusPolling = useBookingStatusPolling(currentBookingId, {
    intervalMs: 1000,
    maxAttempts: 20,
    onBookingConfirmed: (status) => {
      setTimeout(() => {
        onSuccess();
      }, 2000);
    },
    onBookingWaitlisted: (status) => {
      setTimeout(() => {
        onSuccess();
      }, 2000);
    },
    onBookingFailed: (status) => {
      setError(status.message || 'Registration failed');
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMessage(null);
      setCurrentBookingId(null);
      setBookingResponse(null);
      setRegistrationNotes('');
      setSpecialRequirements({});
      statusPolling.resetPolling();
    }
  }, [open, statusPolling.resetPolling]);

  const handleRegister = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const registrationRequest: RegistrationRequest = {
        session_id: session.id,
        registration_method: registrationMethod,
        special_requirements: Object.keys(specialRequirements).length > 0 ? specialRequirements : undefined,
        registration_notes: registrationNotes || undefined,
      };

      // Step 1: Submit registration request (event-driven)
      const response: BookingResponse = await registrationAPI.register(registrationRequest);
      setCurrentBookingId(response.booking_id);
      setBookingResponse(response);
      setSuccessMessage(response.message);

      // Step 2: Start real-time status polling
      statusPolling.startPolling();
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(
        err.response?.data?.detail || 
        'Registration failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircleIcon color="success" />;
      case 'waitlisted':
        return <WarningIcon color="warning" />;
      case 'processing':
        return <CircularProgress size={20} />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <EventIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'waitlisted': return 'warning';
      case 'processing': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const canRegister = !statusPolling.data && !statusPolling.isPolling && session.status === 'scheduled' && session.available_spots >= 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EventIcon />
          Register for Training Session
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Session Information */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Training Session
                </Typography>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Chip
                    icon={<ScheduleIcon />}
                    label={formatDateTime(session.start_time)}
                    size="small"
                  />
                  <Chip
                    icon={<GroupIcon />}
                    label={`${session.available_spots} of ${session.capacity} spots available`}
                    size="small"
                    color={session.available_spots > 0 ? 'success' : 'warning'}
                  />
                  {session.location && (
                    <Chip
                      icon={<LocationIcon />}
                      label={session.location}
                      size="small"
                    />
                  )}
                </Box>

                {session.session_notes && (
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {session.session_notes}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Real-time Status Display */}
            {(statusPolling.isPolling || statusPolling.data || statusPolling.error) && (
              <Box sx={{ mb: 3 }}>
                <StatusIndicator
                  status={statusPolling.data?.status || (statusPolling.isPolling ? 'processing' : null)}
                  message={successMessage || statusPolling.data?.message}
                  attempts={statusPolling.attempts}
                  maxAttempts={20}
                  error={statusPolling.error}
                  data={{
                    ...statusPolling.data,
                    booking_id: currentBookingId,
                    event_id: bookingResponse?.event_id,
                    session_id: bookingResponse?.session_id,
                  }}
                  showProgress={true}
                />
              </Box>
            )}

            {/* Session Availability Status */}
            {!statusPolling.data && !statusPolling.isPolling && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {session.available_spots > 0 ? 
                      <CheckCircleIcon color="success" /> : 
                      <WarningIcon color="warning" />
                    }
                    <Typography variant="h6">
                      Availability
                    </Typography>
                    <Chip
                      label={session.available_spots > 0 ? 'Available' : 'Waitlist Only'}
                      color={session.available_spots > 0 ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {session.available_spots > 0 ? 
                      `${session.available_spots} spots remaining out of ${session.capacity}` :
                      'This session is full, but you can join the waitlist'
                    }
                  </Typography>

                  {session.available_spots === 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      This session is full, but you can join the waitlist. You'll be notified if a spot becomes available.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}


            {/* Registration Form */}
            {canRegister && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Registration Details
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth>
                      <InputLabel>Registration Method</InputLabel>
                      <Select
                        value={registrationMethod}
                        onChange={(e) => setRegistrationMethod(e.target.value)}
                        label="Registration Method"
                      >
                        <MenuItem value="online">Online</MenuItem>
                        <MenuItem value="phone">Phone</MenuItem>
                        <MenuItem value="in_person">In Person</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      fullWidth
                      label="Registration Notes"
                      multiline
                      rows={2}
                      value={registrationNotes}
                      onChange={(e) => setRegistrationNotes(e.target.value)}
                      placeholder="Any additional notes or comments..."
                      variant="outlined"
                    />

                    <TextField
                      fullWidth
                      label="Dietary Restrictions"
                      value={specialRequirements.dietary || ''}
                      onChange={(e) => setSpecialRequirements({...specialRequirements, dietary: e.target.value})}
                      placeholder="Any dietary restrictions or allergies"
                      variant="outlined"
                    />

                    <TextField
                      fullWidth
                      label="Accessibility Needs"
                      value={specialRequirements.accessibility || ''}
                      onChange={(e) => setSpecialRequirements({...specialRequirements, accessibility: e.target.value})}
                      placeholder="Any accessibility accommodations needed"
                      variant="outlined"
                    />

                    {session.available_spots === 0 && (
                      <Alert severity="info">
                        By registering, you'll be added to the waitlist. We'll notify you if a spot becomes available.
                      </Alert>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting || statusPolling.isPolling}>
          Cancel
        </Button>
        {canRegister && (
          <Button
            variant="contained"
            onClick={handleRegister}
            disabled={submitting || loading || statusPolling.isPolling}
            startIcon={(submitting || statusPolling.isPolling) ? <CircularProgress size={20} /> : null}
          >
            {submitting ? 'Submitting...' : 
             statusPolling.isPolling ? 'Processing...' :
             session.available_spots === 0 ? 'Join Waitlist' : 'Register'}
          </Button>
        )}
        {(statusPolling.data?.status === 'confirmed' || statusPolling.data?.status === 'waitlisted') && (
          <Button
            variant="contained"
            color={statusPolling.data?.status === 'confirmed' ? 'success' : 'warning'}
            onClick={onClose}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RegistrationModal;