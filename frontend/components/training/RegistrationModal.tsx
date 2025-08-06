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
import { registrationAPI, type TrainingSession, type AvailabilityInfo, type RegistrationRequest } from '../../api/training';

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
  const [availability, setAvailability] = useState<AvailabilityInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Load availability when modal opens
  useEffect(() => {
    if (open && session) {
      loadAvailability();
    }
  }, [open, session]);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await registrationAPI.checkAvailability(session.id);
      setAvailability(data);
      
      // Auto-select first available instance if only one
      if (data.available_instances.length === 1) {
        setSelectedInstanceId(data.available_instances[0].id);
      }
    } catch (err) {
      console.error('Failed to load availability:', err);
      setError('Failed to check availability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!availability) return;

    try {
      setSubmitting(true);
      setError(null);

      const registrationRequest: RegistrationRequest = {
        session_id: session.id,
        instance_id: selectedInstanceId || undefined,
        special_requirements: specialRequirements || undefined,
        emergency_contact: emergencyContact || undefined,
      };

      await registrationAPI.register(registrationRequest);
      onSuccess();
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
      case 'available':
        return <CheckCircleIcon color="success" />;
      case 'waitlist':
        return <WarningIcon color="warning" />;
      case 'full':
      case 'not_eligible':
        return <ErrorIcon color="error" />;
      default:
        return <EventIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'waitlist': return 'warning';
      case 'full': return 'error';
      case 'not_eligible': return 'error';
      default: return 'default';
    }
  };

  const canRegister = availability && ['available', 'waitlist'].includes(availability.registration_status);

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
                  {session.title}
                </Typography>
                
                {session.description && (
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {session.description}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Chip
                    icon={<ScheduleIcon />}
                    label={`${session.duration_minutes} minutes`}
                    size="small"
                  />
                  <Chip
                    icon={<GroupIcon />}
                    label={`Max ${session.capacity} participants`}
                    size="small"
                  />
                  {session.location && (
                    <Chip
                      icon={<LocationIcon />}
                      label={session.location}
                      size="small"
                    />
                  )}
                </Box>

                {session.learning_objectives && session.learning_objectives.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Learning Objectives:
                    </Typography>
                    <List dense>
                      {session.learning_objectives.map((objective, index) => (
                        <ListItem key={index} sx={{ py: 0 }}>
                          <ListItemText primary={objective} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {availability && (
              <>
                {/* Registration Status */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      {getStatusIcon(availability.registration_status)}
                      <Typography variant="h6">
                        Registration Status
                      </Typography>
                      <Chip
                        label={availability.registration_status.replace('_', ' ')}
                        color={getStatusColor(availability.registration_status) as any}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total remaining spots: {availability.remaining_spots}
                    </Typography>

                    {availability.registration_status === 'not_eligible' && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        You do not meet the prerequisites for this training session.
                      </Alert>
                    )}

                    {availability.registration_status === 'full' && !availability.waitlist_enabled && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        This training session is full and waitlist is not available.
                      </Alert>
                    )}

                    {availability.registration_status === 'waitlist' && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        This session is full, but you can join the waitlist. You'll be notified if a spot becomes available.
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Available Instances */}
                {availability.available_instances.length > 0 && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Available Sessions
                      </Typography>

                      {availability.available_instances.length > 1 && (
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Select a session time</InputLabel>
                          <Select
                            value={selectedInstanceId}
                            onChange={(e) => setSelectedInstanceId(e.target.value)}
                            label="Select a session time"
                          >
                            <MenuItem value="">Any available time</MenuItem>
                            {availability.available_instances.map((instance) => (
                              <MenuItem key={instance.id} value={instance.id}>
                                {formatDateTime(instance.start_time)} - {instance.remaining_spots} spots left
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}

                      <List>
                        {availability.available_instances.map((instance) => (
                          <ListItem key={instance.id} divider>
                            <ListItemIcon>
                              <ScheduleIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary={formatDateTime(instance.start_time)}
                              secondary={
                                <Box>
                                  <Typography variant="body2" component="span">
                                    {instance.remaining_spots} of {instance.capacity} spots available
                                  </Typography>
                                  {instance.location && instance.location !== session.location && (
                                    <Typography variant="body2" component="span" sx={{ ml: 2 }}>
                                      • {instance.location}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            <Chip
                              label={instance.status}
                              color={instance.remaining_spots > 0 ? 'success' : 'warning'}
                              size="small"
                            />
                          </ListItem>
                        ))}
                      </List>
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
                        <TextField
                          fullWidth
                          label="Special Requirements"
                          multiline
                          rows={3}
                          value={specialRequirements}
                          onChange={(e) => setSpecialRequirements(e.target.value)}
                          placeholder="Any special accommodations, dietary restrictions, or accessibility needs..."
                          variant="outlined"
                        />

                        <TextField
                          fullWidth
                          label="Emergency Contact"
                          value={emergencyContact}
                          onChange={(e) => setEmergencyContact(e.target.value)}
                          placeholder="Name and phone number of emergency contact"
                          variant="outlined"
                        />

                        {availability.registration_status === 'waitlist' && (
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
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        {canRegister && (
          <Button
            variant="contained"
            onClick={handleRegister}
            disabled={submitting || loading}
            startIcon={submitting ? <CircularProgress size={20} /> : null}
          >
            {submitting ? 'Registering...' : 
             availability?.registration_status === 'waitlist' ? 'Join Waitlist' : 'Register'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RegistrationModal;