/**
 * Create Training Program Page
 * Full-screen page for creating new training programs
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  Alert,
  Divider,
  Stack,
  Paper,
  Container,
  AppBar,
  Toolbar,
  Autocomplete,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  School as SchoolIcon,
  LocationOn as LocationIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { trainingProgramsAPI, type TrainingProgramCreate, type EventResponse } from '../client/training';
import { useProgramStatusPolling } from '../hooks/useStatusPolling';
import { StatusIndicator } from '../components/training';

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

const CreateProgramPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [eventResponse, setEventResponse] = useState<EventResponse | null>(null);
  const [currentProgramId, setCurrentProgramId] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Real-time status polling
  const statusPolling = useProgramStatusPolling(currentProgramId, {
    intervalMs: 1000,
    maxAttempts: 20,
    onComplete: (program) => {
      setSuccess(true);
      setTimeout(() => {
        navigate('/app/training');
      }, 2000);
    },
    onError: (err) => {
      setError('Program creation submitted but status check failed. Please check the training programs list.');
    },
  });
  const [formData, setFormData] = useState<TrainingProgramCreate>({
    title: '',
    description: '',
    duration_minutes: 120,
    prerequisites: [],
    content_items: [],
    learning_objectives: [],
    instructor_requirements: {},
    requires_approval: false,
    auto_approve: true,
    is_published: false,
  });
  
  const [newObjective, setNewObjective] = useState('');

  const handleInputChange = (field: keyof TrainingProgramCreate, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddObjective = () => {
    if (newObjective.trim()) {
      setFormData(prev => ({
        ...prev,
        learning_objectives: [...(prev.learning_objectives || []), newObjective.trim()]
      }));
      setNewObjective('');
    }
  };

  const handleRemoveObjective = (index: number) => {
    setFormData(prev => ({
      ...prev,
      learning_objectives: prev.learning_objectives?.filter((_, i) => i !== index) || []
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setError('Program title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Submit program creation request (event-driven)
      const response: EventResponse = await trainingProgramsAPI.create(formData);
      setEventResponse(response);
      setCurrentProgramId(response.resource_id);
      
      // Step 2: Start real-time status polling
      statusPolling.startPolling();
    } catch (err: any) {
      console.error('Failed to create training program:', err);
      setError(err.response?.data?.detail || 'Failed to create training program. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/app/training');
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Simple reverse geocoding using a free service
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          
          if (response.ok) {
            const data = await response.json();
            const locationString = `${data.locality || data.city || 'Unknown City'}, ${data.principalSubdivision || data.countryName || ''}`.trim().replace(/,$/, '');
            handleInputChange('location', locationString);
          } else {
            // Fallback to coordinates if reverse geocoding fails
            handleInputChange('location', `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
          }
        } catch (err) {
          console.error('Failed to get location name:', err);
          setError('Failed to get location name. Please enter manually.');
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        setGettingLocation(false);
        let errorMessage = 'Failed to get your location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enter location manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ pt: 8, textAlign: 'center' }}>
        <Box sx={{ p: 4 }}>
          <SchoolIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="success.main">
            Training Program Created!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Your training program has been successfully created.
          </Typography>
          {eventResponse && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Event ID: {eventResponse.event_id}<br />
              Program ID: {eventResponse.resource_id}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Redirecting to training sessions...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Box>
      {/* Top Navigation Bar */}
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleBack}
            disabled={loading}
            color="inherit"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <SchoolIcon color="inherit" />
            <Typography variant="h6" color="inherit">
              Create Training Program
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

          {/* Basic Information */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon color="primary" />
              Basic Information
            </Typography>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Program Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
                disabled={loading}
                placeholder="e.g., Advanced Product Training - Level 2"
              />
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={4}
                disabled={loading}
                placeholder="Provide a detailed description of what participants will learn in this session..."
              />
            </Stack>
          </Paper>

          {/* Program Configuration */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationIcon color="primary" />
              Program Configuration
            </Typography>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <TextField
                  label="Duration (minutes)"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => handleInputChange('duration_minutes', parseInt(e.target.value) || 120)}
                  InputProps={{ inputProps: { min: 15, max: 480 } }}
                  disabled={loading}
                  sx={{ minWidth: 200 }}
                  helperText="Standard session length for this program"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Location will be specified when creating individual training sessions for this program.
              </Typography>
            </Stack>
          </Paper>

          {/* Learning Objectives */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Learning Objectives
            </Typography>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Add Learning Objective"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddObjective();
                    }
                  }}
                  disabled={loading}
                  placeholder="e.g., Understand advanced product features and benefits"
                />
                <Button
                  variant="outlined"
                  onClick={handleAddObjective}
                  disabled={!newObjective.trim() || loading}
                  startIcon={<AddIcon />}
                  sx={{ whiteSpace: 'nowrap', minWidth: 120 }}
                >
                  Add
                </Button>
              </Box>
              {formData.learning_objectives && formData.learning_objectives.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Current objectives:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {formData.learning_objectives.map((objective, index) => (
                      <Chip
                        key={index}
                        label={objective}
                        onDelete={() => handleRemoveObjective(index)}
                        deleteIcon={<DeleteIcon />}
                        variant="outlined"
                        disabled={loading}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Stack>
          </Paper>

          {/* Settings */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Program Settings
            </Typography>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.requires_approval}
                        onChange={(e) => handleInputChange('requires_approval', e.target.checked)}
                        disabled={loading}
                      />
                    }
                    label="Requires Approval"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.auto_approve}
                        onChange={(e) => handleInputChange('auto_approve', e.target.checked)}
                        disabled={loading}
                      />
                    }
                    label="Auto Approve"
                  />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_published}
                        onChange={(e) => handleInputChange('is_published', e.target.checked)}
                        disabled={loading || statusPolling.isPolling}
                      />
                    }
                    label="Publish Immediately"
                  />
                </Box>
              </Box>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Settings Guide:</strong><br />
                  • <strong>Requires Approval:</strong> Manager must approve registrations<br />
                  • <strong>Auto Approve:</strong> Automatically confirm eligible learners<br />
                  • <strong>Publish Immediately:</strong> Make visible to learners right away
                </Typography>
              </Box>
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
                  program_id: eventResponse.resource_id,
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
              disabled={loading || statusPolling.isPolling || !formData.title.trim()}
              startIcon={(loading || statusPolling.isPolling) ? <LoadingSpinner size={20} /> : <SaveIcon />}
              sx={{ minWidth: 200, py: 1.5 }}
            >
              {loading ? 'Submitting...' : statusPolling.isPolling ? 'Confirming Creation...' : 'Create Training Program'}
            </Button>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
};

export default CreateProgramPage;