/**
 * Public Activity Player
 * Simplified player for publicly shared activities that doesn't require authentication
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Paper,
  Container,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Home as HomeIcon,
  PlayArrow as PlayIcon,
  School as TrainingIcon,
  Games as GameIcon,
  Assessment as AssessmentIcon,
  Poll as SurveyIcon,
  Quiz as QuizIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';

import { sharingApi, type PublicActivity } from '../client/sharing';
import { GameView } from '../player/GameView';
import { GameProvider, useGameContext } from '../contexts/GameContext';
import type { NLJScenario } from '../types/nlj';

// Content type icon mapping
const getContentTypeIcon = (contentType: string) => {
  switch (contentType) {
    case 'training':
      return <TrainingIcon />;
    case 'survey':
      return <SurveyIcon />;
    case 'assessment':
      return <AssessmentIcon />;
    case 'game':
      return <GameIcon />;
    default:
      return <QuizIcon />;
  }
};

const getContentTypeColor = (contentType: string) => {
  switch (contentType) {
    case 'training':
      return 'primary';
    case 'survey':
      return 'secondary';
    case 'assessment':
      return 'warning';
    case 'game':
      return 'success';
    default:
      return 'default';
  }
};

// Main player component wrapped in GameProvider
const PublicActivityPlayerContent: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { state, loadScenario, reset } = useGameContext();
  
  const [activity, setActivity] = useState<PublicActivity | null>(null);
  const [scenario, setScenario] = useState<NLJScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Load activity data
  useEffect(() => {
    const loadActivity = async () => {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const activityData = await sharingApi.getSharedActivity(token);
        setActivity(activityData);

        // Convert to NLJ scenario format
        const nlj: NLJScenario = {
          id: activityData.id,
          name: activityData.title,
          description: activityData.description || '',
          ...activityData.nlj_data
        };

        setScenario(nlj);
        setError(null);
      } catch (err) {
        console.error('Failed to load shared activity:', err);
        console.error('Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined,
          full: err
        });
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [token]);

  // Start the activity
  const handleStart = () => {
    if (scenario && loadScenario) {
      console.log('Starting scenario:', scenario.id);
      loadScenario(scenario);
      setHasStarted(true);
    } else {
      console.error('Cannot start activity:', { scenario: !!scenario, loadScenario: !!loadScenario });
    }
  };

  // Handle completion
  const handleComplete = async () => {
    if (token) {
      try {
        await sharingApi.recordPublicCompletion(token);
      } catch (error) {
        console.error('Failed to record completion:', error);
      }
    }
    setHasStarted(false);
  };

  // Handle return to start screen
  const handleHome = () => {
    if (reset) {
      reset();
    }
    setHasStarted(false);
  };

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          minHeight="50vh"
          gap={2}
        >
          <CircularProgress size={48} />
          <Typography variant="h6">Loading activity...</Typography>
        </Box>
      </Container>
    );
  }

  if (error || !activity || !scenario) {
    return (
      <Container maxWidth="sm">
        <Box py={4}>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Activity Not Found
            </Typography>
            <Typography variant="body2">
              {error || 'This shared activity link is invalid or has expired.'}
            </Typography>
          </Alert>
          <Button
            variant="outlined"
            onClick={() => window.close()}
            startIcon={<HomeIcon />}
          >
            Close
          </Button>
        </Box>
      </Container>
    );
  }

  // Show game view if activity has started
  if (hasStarted && state.scenarioId && state.currentNodeId) {
    return (
      <GameView 
        scenario={scenario} 
        onHome={handleHome}
        onComplete={handleComplete}
        reviewMode={false}
        isPublicView={true}
      />
    );
  }

  // Show activity start screen
  return (
    <Box>
      {/* Minimal header for public view */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Shared Activity
          </Typography>
          {/* Simple branding */}
          <Typography variant="body2" color="text.secondary">
            Powered by NLJ Platform
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md">
        <Box py={4}>
          {/* Activity Info */}
          <Paper elevation={2} sx={{ p: 4, mb: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <Box sx={{ color: `${getContentTypeColor(activity.content_type)}.main` }}>
                {getContentTypeIcon(activity.content_type)}
              </Box>
              <Box>
                <Typography variant="h4" gutterBottom>
                  {activity.title}
                </Typography>
                <Chip
                  label={activity.content_type.toUpperCase()}
                  color={getContentTypeColor(activity.content_type) as any}
                  size="small"
                />
              </Box>
            </Box>

            {activity.description && (
              <Typography variant="body1" paragraph>
                {activity.description}
              </Typography>
            )}

            <Box display="flex" justifyContent="center" mt={4}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayIcon />}
                onClick={handleStart}
                sx={{ px: 4, py: 1.5 }}
              >
                Start Activity
              </Button>
            </Box>
          </Paper>

          {/* Usage Stats (optional) */}
          <Box display="flex" justifyContent="center" gap={4}>
            <Box textAlign="center">
              <Typography variant="h6" color="primary">
                {activity.view_count}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Views
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography variant="h6" color="success.main">
                {activity.completion_count}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completions
              </Typography>
            </Box>
          </Box>

          {/* Footer info */}
          <Box mt={4} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              This activity is shared publicly. No account required.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

// Wrapper component with GameProvider
export const PublicActivityPlayer: React.FC = () => {
  return (
    <GameProvider>
      <PublicActivityPlayerContent />
    </GameProvider>
  );
};