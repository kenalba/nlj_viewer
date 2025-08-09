/**
 * Program Detail Page
 * Detailed view of a training program with session management
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Alert,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Event as EventIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  MoreVert as MoreVertIcon,
  School as SchoolIcon,
  Cancel as CancelIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { trainingProgramsAPI, trainingSessionsAPI, type TrainingProgram, type TrainingSession, type EventResponse } from '../client/training';
import { useAuth } from '../contexts/AuthContext';
import { StatusIndicator, useProgramStatusPolling } from '../components/training';

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
      id={`program-tabpanel-${index}`}
      aria-labelledby={`program-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ProgramDetailPage: React.FC = () => {
  const { programId } = useParams<{ programId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Load program details
  const loadProgram = async () => {
    if (!programId) return;
    
    try {
      setLoading(true);
      const data = await trainingProgramsAPI.get(programId);
      setProgram(data);
    } catch (err) {
      console.error('Failed to load program:', err);
      setError('Failed to load training program details.');
    } finally {
      setLoading(false);
    }
  };

  // Load program sessions
  const loadSessions = async () => {
    if (!programId) return;
    
    try {
      const data = await trainingProgramsAPI.getSessions(programId, true); // Include past sessions
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load program sessions.');
    }
  };

  useEffect(() => {
    loadProgram();
    loadSessions();
  }, [programId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleBack = () => {
    navigate('/app/training');
  };

  const handleEdit = () => {
    navigate(`/app/training/programs/${programId}/edit`);
  };

  const handleCreateSession = () => {
    navigate(`/app/training/programs/${programId}/create-session`);
  };

  const handleSessionAction = (event: React.MouseEvent<HTMLElement>, session: TrainingSession) => {
    setSelectedSession(session);
    setActionMenuAnchor(event.currentTarget);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setSelectedSession(null);
  };

  const handleDeleteProgram = async () => {
    if (!program || deleteConfirmText !== program.title) return;
    
    try {
      await trainingProgramsAPI.delete(program.id);
      navigate('/app/training');
    } catch (err) {
      console.error('Failed to delete program:', err);
      setError('Failed to delete program. Please try again.');
    }
    setDeleteDialogOpen(false);
    setDeleteConfirmText('');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'success';
      case 'cancelled': return 'error';
      case 'completed': return 'info';
      default: return 'default';
    }
  };

  const canManageProgram = () => {
    return user && (
      ['ADMIN', 'APPROVER'].includes(user.role) ||
      (program && program.created_by_id === user.id)
    );
  };

  const canCreateSessions = () => {
    return user && ['ADMIN', 'APPROVER', 'CREATOR', 'REVIEWER'].includes(user.role);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && !program) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button onClick={handleBack} startIcon={<ArrowBackIcon />}>
          Back to Training Programs
        </Button>
      </Box>
    );
  }

  if (!program) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Training program not found.
        </Alert>
        <Button onClick={handleBack} startIcon={<ArrowBackIcon />}>
          Back to Training Programs
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {program.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={program.is_published ? 'Published' : 'Draft'}
              color={program.is_published ? 'success' : 'warning'}
              size="small"
            />
            <Chip
              label={program.is_active ? 'Active' : 'Inactive'}
              color={program.is_active ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
            <Chip
              icon={<ScheduleIcon />}
              label={`${program.duration_minutes} min`}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={<EventIcon />}
              label={`${program.upcoming_sessions} upcoming sessions`}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>
        {canManageProgram() && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </Box>
        )}
        {canCreateSessions() && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateSession}
            sx={{ ml: 2 }}
          >
            Schedule Session
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Overview" icon={<SchoolIcon />} />
          <Tab label="Sessions" icon={<EventIcon />} />
          <Tab label="Analytics" icon={<GroupIcon />} />
        </Tabs>
      </Paper>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body1" paragraph>
                  {program.description || 'No description provided.'}
                </Typography>

                {program.learning_objectives && program.learning_objectives.length > 0 && (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Learning Objectives
                    </Typography>
                    <List>
                      {program.learning_objectives.map((objective, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <SchoolIcon />
                          </ListItemIcon>
                          <ListItemText primary={objective} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Program Details
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Duration"
                      secondary={`${program.duration_minutes} minutes`}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Total Sessions"
                      secondary={program.total_sessions}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Upcoming Sessions"
                      secondary={program.upcoming_sessions}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Total Bookings"
                      secondary={program.total_bookings}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Requires Approval"
                      secondary={program.requires_approval ? 'Yes' : 'No'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Auto Approve"
                      secondary={program.auto_approve ? 'Yes' : 'No'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Created"
                      secondary={formatDateTime(program.created_at)}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Sessions Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Training Sessions ({sessions.length})
          </Typography>
          {canCreateSessions() && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateSession}
            >
              Schedule New Session
            </Button>
          )}
        </Box>

        <Grid container spacing={3}>
          {sessions.map((session) => (
            <Grid item xs={12} md={6} lg={4} key={session.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h3">
                      Session
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleSessionAction(e, session)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="primary" gutterBottom>
                    {formatDateTime(session.start_time)}
                  </Typography>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    <Chip
                      label={session.status}
                      color={getSessionStatusColor(session.status) as any}
                      size="small"
                    />
                    <Chip
                      icon={<GroupIcon />}
                      label={`${session.confirmed_bookings}/${session.capacity}`}
                      size="small"
                      variant="outlined"
                    />
                    {session.waitlist_count > 0 && (
                      <Chip
                        label={`${session.waitlist_count} waitlisted`}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {session.location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocationIcon fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        {session.location}
                      </Typography>
                    </Box>
                  )}

                  {session.session_notes && (
                    <Typography variant="body2" color="text.secondary">
                      {session.session_notes}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {sessions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No sessions scheduled
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Create the first training session for this program
            </Typography>
            {canCreateSessions() && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateSession}
              >
                Schedule First Session
              </Button>
            )}
          </Box>
        )}
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>
          Program Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Analytics features will be available in a future update.
        </Typography>
      </TabPanel>

      {/* Session Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
      >
        <MenuItem onClick={() => {
          navigate(`/app/training/sessions/${selectedSession?.id}`);
          handleCloseActionMenu();
        }}>
          <EventIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        {canManageProgram() && selectedSession?.status === 'scheduled' && (
          <MenuItem onClick={handleCloseActionMenu}>
            <EditIcon sx={{ mr: 1 }} />
            Edit Session
          </MenuItem>
        )}
        <MenuItem onClick={handleCloseActionMenu}>
          <ShareIcon sx={{ mr: 1 }} />
          Share Session
        </MenuItem>
        {canManageProgram() && selectedSession?.status === 'scheduled' && (
          <MenuItem onClick={handleCloseActionMenu}>
            <CancelIcon sx={{ mr: 1 }} />
            Cancel Session
          </MenuItem>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Training Program</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete this training program? This action cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Please type the program title to confirm deletion:
          </Typography>
          <Typography variant="body2" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
            {program.title}
          </Typography>
          <TextField
            fullWidth
            label="Confirm program title"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialogOpen(false);
            setDeleteConfirmText('');
          }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteProgram}
            disabled={deleteConfirmText !== program.title}
          >
            Delete Program
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProgramDetailPage;