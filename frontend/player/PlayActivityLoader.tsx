/**
 * Play Activity Loader - Loads content for playing with review mode support
 * Handles permission bypass for reviewers in review mode
 */

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { contentApi } from '../api/content';
import { useGameContext } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import type { NLJScenario } from '../types/nlj';

interface PlayActivityLoaderProps {
  contentId: string;
  isReviewMode: boolean;
  canReview: boolean;
}

export const PlayActivityLoader: React.FC<PlayActivityLoaderProps> = ({
  contentId,
  isReviewMode,
  canReview
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loadScenario } = useGameContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadActivity = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check permissions - allow review mode for reviewers even on draft/submitted content
        if (isReviewMode && !canReview) {
          throw new Error('You do not have permission to review this content.');
        }

        // If not in review mode and no user, redirect to login
        if (!isReviewMode && !user) {
          navigate('/login');
          return;
        }

        // Load the content item
        const contentItem = await contentApi.get(contentId);

        // // Check if content is published or if user has review permissions
        // const isPublished = contentItem.state === 'published';
        // const hasAccessToNonPublished = isReviewMode && canReview;

        // if (!isPublished && !hasAccessToNonPublished) {
        //   throw new Error('This content is not published and cannot be accessed.');
        // }

        // Convert ContentItem to NLJScenario format
        const scenario: NLJScenario = {
          id: contentItem.id,
          name: contentItem.title,
          description: contentItem.description,
          ...contentItem.nlj_data
        };

        // Load the scenario into the game context
        loadScenario(scenario);

      } catch (err: any) {
        console.error('Failed to load activity:', err);
        setError(err.message || 'Failed to load the activity. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [contentId, isReviewMode, canReview, user, loadScenario, navigate]);

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="60vh" gap={2}>
        <CircularProgress size={48} />
        <Typography variant="h6">
          {isReviewMode ? 'Loading activity for review...' : 'Loading activity...'}
        </Typography>
        {isReviewMode && (
          <Typography variant="body2" color="text.secondary">
            Review Mode Active
          </Typography>
        )}
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="60vh" gap={2}>
        <Alert 
          severity="error" 
          sx={{ maxWidth: 500 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/app/activities')}
        >
          Back to Activities
        </Button>
      </Box>
    );
  }

  // If we get here, the scenario should be loading or loaded
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="60vh" gap={2}>
      <CircularProgress />
      <Typography>Starting activity...</Typography>
    </Box>
  );
};

export default PlayActivityLoader;