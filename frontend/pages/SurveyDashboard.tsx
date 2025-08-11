/**
 * Survey Dashboard Page
 * Main dashboard for survey management with Live/Complete/All tabs
 * Supports card-based view with survey-specific actions
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
  alpha,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Send as SendIcon,
  Analytics as AnalyticsIcon,
  MoreVert as MoreVertIcon,
  Poll as PollIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { contentApi, type ContentItem, type ContentFilters } from '../client/content';
import { useAuth } from '../contexts/AuthContext';
import { canEditContent, canReviewContent } from '../utils/permissions';
import { CreateActivityModal } from '../shared/CreateActivityModal';
import { ShareModal } from '../components/ShareModal';
import { formatDistanceToNow } from 'date-fns';

interface SurveyStats {
  totalQuestions: number;
  totalResponses: number;
  completionRate: number;
  responseRate: number;
}

interface SurveyCardProps {
  survey: ContentItem;
  stats?: SurveyStats;
  onSend: (survey: ContentItem) => void;
  onViewResults: (survey: ContentItem) => void;
  onEdit?: (survey: ContentItem) => void;
  onDelete?: (survey: ContentItem) => void;
  onShare?: (survey: ContentItem) => void;
}

const SurveyCard: React.FC<SurveyCardProps> = ({
  survey,
  stats,
  onSend,
  onViewResults,
  onEdit,
  onDelete,
  onShare
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      case 'in_review':
      case 'in review':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (state: string) => {
    switch (state.toLowerCase()) {
      case 'published':
        return 'Live';
      case 'draft':
        return 'Draft';
      case 'in_review':
      case 'in review':
        return 'In Review';
      case 'archived':
        return 'Archived';
      default:
        return state;
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, mr: 1 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1 }}>
              {survey.title}
            </Typography>
            <Chip
              label={getStatusLabel(survey.state)}
              color={getStatusColor(survey.state) as any}
              size="small"
              sx={{ mb: 1 }}
            />
          </Box>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreVertIcon />
          </IconButton>
        </Box>

        {survey.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {survey.description}
          </Typography>
        )}

        {/* Survey Statistics */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 2 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Questions
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {stats?.totalQuestions || 0}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.success.main, 0.05),
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Responses
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
              {stats?.totalResponses || 0}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.info.main, 0.05),
              border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Response Rate
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
              {stats?.responseRate || 0}%
            </Typography>
          </Box>
        </Box>

        {stats && stats.totalResponses > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Completion Rate: {stats.completionRate}%
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary">
          Updated {formatDistanceToNow(new Date(survey.updated_at))} ago
        </Typography>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
          {survey.state.toLowerCase() === 'published' && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AnalyticsIcon />}
                onClick={() => onViewResults(survey)}
                sx={{ flex: 1 }}
              >
                Details
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayIcon />}
                onClick={() => window.open(`/app/play/${survey.id}`, '_blank')}
                sx={{ flex: 1 }}
              >
                Preview
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<SendIcon />}
                onClick={() => onSend(survey)}
                sx={{ flex: 1 }}
              >
                Send
              </Button>
            </>
          )}
          {survey.state.toLowerCase() === 'draft' && onEdit && (
            <Button
              size="small"
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => onEdit(survey)}
              sx={{ flex: 1 }}
            >
              Continue Editing
            </Button>
          )}
        </Stack>
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {onShare && (
          <MenuItem onClick={() => { onShare(survey); handleMenuClose(); }}>
            <ShareIcon sx={{ mr: 1 }} />
            Share
          </MenuItem>
        )}
        <MenuItem onClick={() => { navigator.clipboard.writeText(survey.id); handleMenuClose(); }}>
          <CopyIcon sx={{ mr: 1 }} />
          Copy ID
        </MenuItem>
        {onEdit && (
          <MenuItem onClick={() => { onEdit(survey); handleMenuClose(); }}>
            <EditIcon sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={() => { onDelete(survey); handleMenuClose(); }}>
            <DeleteIcon sx={{ mr: 1, color: 'error.main' }} />
            Delete
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export const SurveyDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'live');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<ContentItem | null>(null);

  const canEdit = canEditContent(user);
  const canReview = canReviewContent(user);

  // Update URL params when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (activeTab === 'live') {
      params.delete('tab');
    } else {
      params.set('tab', activeTab);
    }
    setSearchParams(params, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  // Build content filters based on active tab
  const contentFilters = useMemo<ContentFilters>(() => {
    const baseFilters: ContentFilters = {
      content_type: 'survey',
      limit: 50,
    };

    switch (activeTab) {
      case 'live':
        return { ...baseFilters, state: 'published' };
      case 'complete':
        return { ...baseFilters, state: 'archived' };
      case 'all':
      default:
        return baseFilters;
    }
  }, [activeTab]);

  // Fetch surveys
  const {
    data: surveysResponse,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['surveys', contentFilters],
    queryFn: () => contentApi.list(contentFilters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Delete survey mutation
  const deleteMutation = useMutation({
    mutationFn: contentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
    },
    onError: (error) => {
      console.error('Failed to delete survey:', error);
    },
  });

  const surveys = surveysResponse?.items || [];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

  const handleCreateSurvey = () => {
    setCreateModalOpen(true);
  };

  const handleSendSurvey = (survey: ContentItem) => {
    navigate(`/app/surveys/${survey.id}/send`);
  };

  const handleViewResults = (survey: ContentItem) => {
    navigate(`/app/surveys/${survey.id}`);
  };

  const handleEditSurvey = (survey: ContentItem) => {
    navigate(`/app/flow/edit/${survey.id}`);
  };

  const handleDeleteSurvey = (survey: ContentItem) => {
    if (window.confirm(`Are you sure you want to delete "${survey.title}"?`)) {
      deleteMutation.mutate(survey.id);
    }
  };

  const handleShareSurvey = (survey: ContentItem) => {
    setSelectedSurvey(survey);
    setShareModalOpen(true);
  };

  const getTabCounts = () => {
    // TODO: Implement real-time tab counts
    return {
      live: surveys.filter(s => s.state.toLowerCase() === 'published').length,
      complete: surveys.filter(s => s.state.toLowerCase() === 'archived').length,
      all: surveys.length
    };
  };

  const tabCounts = getTabCounts();

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load surveys. Please try again.
        </Alert>
        <Button variant="outlined" onClick={() => refetch()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Surveys
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create, distribute, and analyze survey responses
          </Typography>
        </Box>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateSurvey}
            size="large"
            sx={{ borderRadius: 2 }}
          >
            New Survey
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minWidth: 120,
            },
          }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon sx={{ fontSize: '1.2rem' }} />
                <span>Live</span>
                {tabCounts.live > 0 && (
                  <Chip
                    label={tabCounts.live}
                    size="small"
                    color="success"
                    sx={{ minWidth: 20, height: 20, fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            }
            value="live"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ fontSize: '1.2rem' }} />
                <span>Complete</span>
                {tabCounts.complete > 0 && (
                  <Chip
                    label={tabCounts.complete}
                    size="small"
                    color="default"
                    sx={{ minWidth: 20, height: 20, fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            }
            value="complete"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PollIcon sx={{ fontSize: '1.2rem' }} />
                <span>All</span>
                {tabCounts.all > 0 && (
                  <Chip
                    label={tabCounts.all}
                    size="small"
                    color="primary"
                    sx={{ minWidth: 20, height: 20, fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            }
            value="all"
          />
        </Tabs>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && surveys.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PollIcon sx={{ fontSize: '4rem', color: 'text.disabled', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 500 }}>
            {activeTab === 'live' ? 'No live surveys' : 
             activeTab === 'complete' ? 'No completed surveys' : 'No surveys found'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {activeTab === 'live' 
              ? 'Create and publish surveys to start collecting responses'
              : activeTab === 'complete'
              ? 'Completed surveys will appear here'
              : 'Get started by creating your first survey'
            }
          </Typography>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateSurvey}
              size="large"
            >
              Create Your First Survey
            </Button>
          )}
        </Box>
      )}

      {/* Survey Cards Flexbox Layout */}
      {!isLoading && surveys.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            '& > *': {
              flex: '1 1 400px', // Flexible width with preferred size
              minWidth: 320,
              maxWidth: 500,
              '@media (max-width: 768px)': {
                flex: '1 1 100%',
                maxWidth: 'none',
              },
            },
          }}
        >
          {surveys.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              // TODO: Implement real survey stats
              stats={{
                totalQuestions: 5, // Placeholder
                totalResponses: 0, // Placeholder
                completionRate: 0, // Placeholder
                responseRate: 0, // Placeholder
              }}
              onSend={handleSendSurvey}
              onViewResults={handleViewResults}
              onEdit={canEdit ? handleEditSurvey : undefined}
              onDelete={canEdit ? handleDeleteSurvey : undefined}
              onShare={handleShareSurvey}
            />
          ))}
        </Box>
      )}

      {/* Create Activity Modal */}
      <CreateActivityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultTemplate="survey"
      />

      {/* Share Modal */}
      {selectedSurvey && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedSurvey(null);
          }}
          activity={selectedSurvey}
        />
      )}
    </Box>
  );
};

export default SurveyDashboard;