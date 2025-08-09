/**
 * Training Sessions Page
 * Browse and register for available training sessions
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Event as EventIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { trainingSessionsAPI, registrationAPI, trainingProgramsAPI, type TrainingSession, type Registration, type TrainingProgram } from '../client/training';
import { useAuth } from '../contexts/AuthContext';
import RegistrationModal from '../components/training/RegistrationModal';
import ShareSessionModal from '../components/training/ShareSessionModal';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`training-tabpanel-${index}`}
      aria-labelledby={`training-tab-${index}`}
      style={{ width: '100%' }}
      {...other}
    >
      {value === index && <Box sx={{ width: '100%' }}>{children}</Box>}
    </div>
  );
}

const TrainingSessionsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [shareSessionModalOpen, setShareSessionModalOpen] = useState(false);
  const [sessionToShare, setSessionToShare] = useState<TrainingSession | null>(null);

  // Load training sessions and programs
  const loadSessions = async () => {
    try {
      setLoading(true);
      const [sessionsData, programsData] = await Promise.all([
        trainingSessionsAPI.list({
          published_only: true,
          location: locationFilter || undefined,
        }),
        trainingProgramsAPI.list({
          published_only: true,
        }),
      ]);
      setSessions(sessionsData);
      setPrograms(programsData);
    } catch (err) {
      console.error('Failed to load training sessions:', err);
      setError('Failed to load training sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load user registrations
  const loadMyRegistrations = async () => {
    try {
      const data = await registrationAPI.getMyRegistrations({
        status_filter: statusFilter || undefined,
      });
      setMyRegistrations(data);
    } catch (err) {
      console.error('Failed to load registrations:', err);
      setError('Failed to load your registrations. Please try again.');
    }
  };

  useEffect(() => {
    loadSessions();
  }, [locationFilter]);

  useEffect(() => {
    if (tabValue === 1) {
      loadMyRegistrations();
    }
  }, [tabValue, statusFilter]);

  // Refresh sessions when returning to this page (in case new sessions were created)
  useEffect(() => {
    loadSessions();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRegisterClick = (session: TrainingSession) => {
    setSelectedSession(session);
    setRegistrationModalOpen(true);
  };

  const handleRegistrationSuccess = () => {
    setRegistrationModalOpen(false);
    setSelectedSession(null);
    loadMyRegistrations();
    loadSessions(); // Refresh to update availability
  };

  const handleCreateSession = () => {
    navigate('/app/training/create');
  };

  const handleShareClick = (session: TrainingSession) => {
    setSessionToShare(session);
    setShareSessionModalOpen(true);
  };

  // Check if user can create sessions
  const canCreateSessions = () => {
    return user && ['ADMIN', 'APPROVER', 'CREATOR', 'REVIEWER'].includes(user.role);
  };

  const handleCancelRegistration = async (bookingId: string) => {
    try {
      await registrationAPI.cancel(bookingId);
      loadMyRegistrations();
      loadSessions();
    } catch (err) {
      console.error('Failed to cancel registration:', err);
      setError('Failed to cancel registration. Please try again.');
    }
  };

  // Filter sessions based on search term (search in program title/description)
  const filteredSessions = sessions.filter(session => {
    const program = programs.find(p => p.id === session.program_id);
    if (!program) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return program.title.toLowerCase().includes(searchLower) ||
           (program.description && program.description.toLowerCase().includes(searchLower));
  });

  // Get registration status for a session
  const getRegistrationStatus = (sessionId: string) => {
    return myRegistrations.find(reg => 
      reg.session_id === sessionId && 
      ['confirmed', 'pending', 'waitlisted'].includes(reg.booking_status)
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSessionDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatSessionTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'waitlisted': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  if (loading && sessions.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Training Sessions
        </Typography>
        <Box>
          {canCreateSessions() && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateSession}
            >
              Create Program
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Available Sessions" icon={<EventIcon />} />
          <Tab label="My Registrations" icon={<GroupIcon />} />
        </Tabs>
      </Paper>

      {/* Available Sessions Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Search sessions"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                variant="outlined"
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Filter by location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                variant="outlined"
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon />
                <Typography variant="body2">
                  {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Sessions Grid */}
        <Grid container spacing={3}>
          {filteredSessions.map((session) => {
            const existingRegistration = getRegistrationStatus(session.id);
            const program = programs.find(p => p.id === session.program_id);
            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={session.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {program?.title || 'Unknown Program'}
                    </Typography>
                    
                    {/* Session Date and Time */}
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="body2" fontWeight="medium" color="text.primary">
                        📅 {formatSessionDate(session.start_time)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        🕒 {formatSessionTime(session.start_time)} - {formatSessionTime(session.end_time)}
                      </Typography>
                      {session.timezone !== 'UTC' && (
                        <Typography variant="caption" color="text.secondary">
                          {session.timezone}
                        </Typography>
                      )}
                    </Box>
                    
                    {program?.description && (
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {program.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      <Chip
                        icon={<ScheduleIcon />}
                        label={`${program?.duration_minutes || 0} min`}
                        size="small"
                      />
                      <Chip
                        icon={<GroupIcon />}
                        label={`${session.capacity} max`}
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

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Available spots: {session.available_spots}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Current bookings: {session.total_bookings}
                      </Typography>
                    </Box>

                    {program?.learning_objectives && program.learning_objectives.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Learning Objectives:
                        </Typography>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {program.learning_objectives.slice(0, 3).map((objective, index) => (
                            <li key={index}>
                              <Typography variant="body2" color="text.secondary">
                                {objective}
                              </Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box>
                      {existingRegistration ? (
                        <Chip
                          label={`Registered (${existingRegistration.booking_status})`}
                          color={getStatusColor(existingRegistration.booking_status) as any}
                          variant="filled"
                        />
                      ) : (
                        <Button
                          variant="contained"
                          onClick={() => handleRegisterClick(session)}
                          disabled={session.available_spots <= 0}
                        >
                          {session.available_spots > 0 ? 'Register' : 'Join Waitlist'}
                        </Button>
                      )}
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ShareIcon />}
                      onClick={() => handleShareClick(session)}
                    >
                      Share
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {filteredSessions.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No training sessions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or filter criteria
            </Typography>
          </Box>
        )}
      </TabPanel>

      {/* My Registrations Tab */}
      <TabPanel value={tabValue} index={1}>
        {/* Status Filter */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Filter by status"
                >
                  <MenuItem value="">All statuses</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="waitlisted">Waitlisted</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="body2">
                {myRegistrations.length} registration{myRegistrations.length !== 1 ? 's' : ''} found
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Registrations List */}
        <Grid container spacing={3}>
          {myRegistrations.map((registration) => {
            const session = sessions.find(s => s.id === registration.session_id);
            const program = session ? programs.find(p => p.id === session.program_id) : null;
            return (
              <Grid size={{ xs: 12 }} key={registration.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {program?.title || 'Unknown Program'}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                          <Chip
                            label={registration.booking_status}
                            color={getStatusColor(registration.booking_status) as any}
                            size="small"
                          />
                          {registration.waitlist_position && (
                            <Chip
                              label={`Waitlist #${registration.waitlist_position}`}
                              color="info"
                              size="small"
                            />
                          )}
                        </Box>

                        {/* Session Date and Time */}
                        {session && (
                          <Box sx={{ mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              📅 {formatSessionDate(session.start_time)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              🕒 {formatSessionTime(session.start_time)} - {formatSessionTime(session.end_time)}
                            </Typography>
                            {session.timezone !== 'UTC' && (
                              <Typography variant="caption" color="text.secondary">
                                {session.timezone}
                              </Typography>
                            )}
                          </Box>
                        )}

                        <Typography variant="body2" color="text.secondary">
                          Registered: {formatDateTime(registration.registered_at)}
                        </Typography>

                        {registration.special_requirements?.requirements && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Special requirements: {registration.special_requirements.requirements}
                          </Typography>
                        )}
                      </Box>

                      <Box>
                        {['confirmed', 'pending', 'waitlisted'].includes(registration.booking_status) && (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleCancelRegistration(registration.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {myRegistrations.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No registrations found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Register for training sessions to see them here
            </Typography>
          </Box>
        )}
      </TabPanel>


      {/* Registration Modal */}
      {selectedSession && (
        <RegistrationModal
          open={registrationModalOpen}
          onClose={() => {
            setRegistrationModalOpen(false);
            setSelectedSession(null);
          }}
          session={selectedSession}
          onSuccess={handleRegistrationSuccess}
        />
      )}

      {/* Share Session Modal */}
      {sessionToShare && (
        <ShareSessionModal
          open={shareSessionModalOpen}
          onClose={() => {
            setShareSessionModalOpen(false);
            setSessionToShare(null);
          }}
          session={sessionToShare}
        />
      )}
    </Box>
  );
};

export default TrainingSessionsPage;