/**
 * Create Training Session Page
 * Schedule a new training session for an existing program
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Paper,
  Container,
  AppBar,
  Toolbar,
  IconButton,
  Autocomplete,
  FormControlLabel,
  Switch,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { trainingProgramsAPI, type TrainingProgram, type EventResponse } from '../client/training';
import { useAuth } from '../contexts/AuthContext';
import { StatusIndicator, useProgramStatusPolling } from '../components/training';

// Common training locations for autocomplete
const COMMON_LOCATIONS = [
  'Corporate Headquarters - Main Training Room',
  'Corporate Headquarters - Conference Room A',
  'Corporate Headquarters - Conference Room B',
  'Training Center North - Room 101',  
  'Training Center North - Room 102',
  'Training Center South - Main Hall',
  'Training Center South - Workshop Space',
  'Regional Office - Downtown',
  'Regional Office - Midtown',
  'Dealer Training Facility - East',
  'Dealer Training Facility - West',
  'Virtual/Online Session',
  'Customer Site Visit',
  'Hotel Conference Room',
  'Convention Center',
];

interface SessionFormData {
  start_time: Date;
  end_time: Date;
  timezone: string;
  location: string;
  capacity: number;
  instructor_id?: string;
  session_notes: string;
}

const CreateSessionPage: React.FC = () => {
  const { programId } = useParams<{ programId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [eventResponse, setEventResponse] = useState<EventResponse | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Form data state
  const [formData, setFormData] = useState<SessionFormData>({
    start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: '',
    capacity: 20,
    session_notes: '',
  });

  // Status polling for session creation
  const statusPolling = useProgramStatusPolling(currentSessionId, {
    intervalMs: 1000,
    maxAttempts: 20,
    onComplete: (session) => {
      setSuccess(true);
      setTimeout(() => {
        navigate(`/app/training/programs/${programId}`);
      }, 2000);
    },
    onError: (err) => {
      setError('Session creation submitted but status check failed. Please check the program sessions.');
    },
  });

  // Load program details
  const loadProgram = async () => {
    if (!programId) return;
    
    try {
      setLoading(true);
      const data = await trainingProgramsAPI.get(programId);
      setProgram(data);
      
      // Set default end time based on program duration
      const defaultEndTime = new Date(formData.start_time.getTime() + data.duration_minutes * 60 * 1000);
      setFormData(prev => ({ ...prev, end_time: defaultEndTime }));
    } catch (err) {
      console.error('Failed to load program:', err);
      setError('Failed to load program details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgram();
  }, [programId]);

  // Update end time when start time or program changes
  useEffect(() => {
    if (program) {
      const newEndTime = new Date(formData.start_time.getTime() + program.duration_minutes * 60 * 1000);
      setFormData(prev => ({ ...prev, end_time: newEndTime }));
    }
  }, [formData.start_time, program]);

  const handleInputChange = (field: keyof SessionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!program || !programId) {
      setError('Program not found');
      return;
    }

    // Validation
    if (formData.start_time >= formData.end_time) {
      setError('End time must be after start time');
      return;
    }

    if (formData.start_time < new Date()) {
      setError('Session cannot be scheduled in the past');
      return;
    }

    if (formData.capacity < 1 || formData.capacity > 1000) {
      setError('Capacity must be between 1 and 1000');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Submit session creation request (event-driven)
      const response: EventResponse = await trainingProgramsAPI.createSession(programId, {
        start_time: formData.start_time.toISOString(),
        end_time: formData.end_time.toISOString(),
        timezone: formData.timezone,
        location: formData.location || undefined,
        capacity: formData.capacity,
        instructor_id: formData.instructor_id || undefined,
        session_notes: formData.session_notes || undefined,
      });

      setEventResponse(response);
      setCurrentSessionId(response.resource_id);
      
      // Start real-time status polling
      statusPolling.startPolling();
    } catch (err: any) {
      console.error('Failed to create session:', err);
      setError(err.response?.data?.detail || 'Failed to create training session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/app/training/programs/${programId}`);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ pt: 8, textAlign: 'center' }}>
        <Box sx={{ p: 4 }}>
          <EventIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="success.main">
            Session Scheduled!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            The training session has been successfully scheduled.
          </Typography>
          {eventResponse && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Event ID: {eventResponse.event_id}<br />
              Session ID: {eventResponse.resource_id}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Returning to program details...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Top Navigation Bar */}
        <AppBar position="static" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              onClick={handleBack}
              disabled={loading || statusPolling.isPolling}
              color="inherit"
            >
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
              <EventIcon color="inherit" />
              <Typography variant="h6" color="inherit">
                Schedule Training Session
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Container maxWidth="md" sx={{ py: 3 }}>
          <Stack spacing={4}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Program Info */}
            {program && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventIcon color="primary" />
                    {program.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {program.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Default Duration:</strong> {formatDuration(program.duration_minutes)}
                    </Typography>
                    <Typography variant="body2" sx={{ ml: 2 }}>
                      <strong>Sessions:</strong> {program.total_sessions} total, {program.upcoming_sessions} upcoming
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Date & Time */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Date & Time
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="Start Time"
                    value={formData.start_time}
                    onChange={(newValue) => newValue && handleInputChange('start_time', newValue)}
                    disabled={loading || statusPolling.isPolling}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="End Time"
                    value={formData.end_time}
                    onChange={(newValue) => newValue && handleInputChange('end_time', newValue)}
                    disabled={loading || statusPolling.isPolling}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                      }
                    }}
                  />
                </Grid>
              </Grid>
              {formData.start_time && formData.end_time && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Duration: {formatDuration(Math.round((formData.end_time.getTime() - formData.start_time.getTime()) / (1000 * 60)))}
                </Typography>
              )}
            </Paper>

            {/* Location & Capacity */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationIcon color="primary" />
                Session Details
              </Typography>
              <Stack spacing={3}>
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={COMMON_LOCATIONS}
                  value={formData.location}
                  onChange={(event, newValue) => {
                    handleInputChange('location', newValue || '');
                  }}
                  onInputChange={(event, newInputValue) => {
                    handleInputChange('location', newInputValue);
                  }}
                  disabled={loading || statusPolling.isPolling}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Location"
                      placeholder="e.g., Training Center A, Room 101"
                      helperText="Physical location where the training will take place"
                    />
                  )}
                />
                
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <TextField
                    label="Capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => handleInputChange('capacity', parseInt(e.target.value) || 20)}
                    InputProps={{ inputProps: { min: 1, max: 1000 } }}
                    disabled={loading || statusPolling.isPolling}
                    sx={{ minWidth: 150 }}
                    helperText="Maximum number of attendees"
                  />
                </Box>

                <TextField
                  fullWidth
                  label="Session Notes"
                  multiline
                  rows={3}
                  value={formData.session_notes}
                  onChange={(e) => handleInputChange('session_notes', e.target.value)}
                  disabled={loading || statusPolling.isPolling}
                  placeholder="Any special notes or instructions for this session..."
                />
              </Stack>
            </Paper>

            {/* Real-time Creation Status */}
            {(statusPolling.isPolling || statusPolling.data || statusPolling.error) && eventResponse && (
              <Box sx={{ mb: 3 }}>
                <StatusIndicator
                  status={statusPolling.data ? 'confirmed' : (statusPolling.isPolling ? 'processing' : null)}
                  message={eventResponse.message}
                  attempts={statusPolling.attempts}
                  maxAttempts={20}
                  error={statusPolling.error}
                  data={{
                    ...statusPolling.data,
                    event_id: eventResponse.event_id,
                    session_id: eventResponse.resource_id,
                  }}
                  showProgress={true}
                />
              </Box>
            )}

            {/* Submit Button */}
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={loading || statusPolling.isPolling || !program}
                startIcon={(loading || statusPolling.isPolling) ? <LoadingSpinner size={20} /> : <SaveIcon />}
                sx={{ minWidth: 200, py: 1.5 }}
              >
                {loading ? 'Scheduling...' : 
                 statusPolling.isPolling ? 'Confirming...' : 
                 'Schedule Session'}
              </Button>
            </Box>
          </Stack>
        </Container>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateSessionPage;