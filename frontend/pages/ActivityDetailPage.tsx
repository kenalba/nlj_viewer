/**
 * Activity Detail Page
 * Detailed view of an activity with metadata, content preview, and actions
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Description as ActivityIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Folder as FolderIcon,
  Tag as TagIcon,
  Preview as PreviewIcon,
  Analytics as AnalyticsIcon,
  Quiz as QuizIcon,
  School as TrainingIcon,
  Games as GameIcon,
  Assessment as AssessmentIcon,
  Poll as SurveyIcon,
  Visibility as ViewIcon,
  CheckCircle as CompletedIcon,
  Schedule as TimeIcon,
  AccountTree as NodesIcon,
  Link as LinksIcon,
  Code as VariablesIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { 
  contentApi,
  type ContentItem 
} from '../client/content';
import { workflowApi, type ContentVersion } from '../client/workflow';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { formatDistanceToNow } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { canEditContent, canDeleteContent, canReviewContent } from '../utils/permissions';
import { ShareModal } from '../components/ShareModal';
import type { NLJScenario } from '../types/nlj';

// Activity Preview Component
const ActivityPreview: React.FC<{ activity: ContentItem }> = ({ activity }) => {
  const nljData = activity.nlj_data as NLJScenario;
  
  if (!nljData || !nljData.nodes) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No preview available for this activity.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The activity data may be invalid or corrupted.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, height: '600px', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Box sx={{ textAlign: 'center' }}>
          <PreviewIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Activity Preview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Interactive preview functionality will be implemented soon
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<PlayIcon />}
            onClick={() => window.open(`/app/play/${activity.id}`, '_blank')}
          >
            Play Activity
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

const ActivityDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);

  // Extract ID from URL path since we're not using proper route parameters
  const pathSegments = window.location.pathname.split('/');
  const activitiesIndex = pathSegments.indexOf('activities');
  const id = activitiesIndex !== -1 ? pathSegments[activitiesIndex + 1] : null;

  // Debug logging
  console.log('ActivityDetailPage rendered with ID:', id);
  console.log('Current pathname:', window.location.pathname);
  console.log('Path segments:', pathSegments);

  // Fetch activity
  const { data: activity, isLoading, error } = useQuery({
    queryKey: ['content', id],
    queryFn: () => {
      console.log('Fetching activity with ID:', id);
      return contentApi.get(id!);
    },
    enabled: !!id,
  });

  // Fetch versions
  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['content-versions', id],
    queryFn: () => workflowApi.getContentVersions(id!),
    enabled: !!id,
  });

  // Log error if it occurs
  React.useEffect(() => {
    if (error) {
      console.error('Failed to fetch activity:', error);
    }
  }, [error]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: contentApi.delete,
    onSuccess: () => {
      navigate('/app/activities');
    },
    onError: (error) => {
      console.error('Failed to delete activity:', error);
    },
  });

  const handleBack = () => {
    navigate('/app/activities');
  };

  const handlePlay = () => {
    if (activity) {
      navigate(`/app/play/${activity.id}`);
    }
  };

  const handleEdit = () => {
    if (activity) {
      navigate(`/app/flow/edit/${activity.id}`);
    }
  };

  const handleDelete = () => {
    if (!activity) return;
    
    if (window.confirm(`Are you sure you want to delete "${activity.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(activity.id);
    }
  };

  const [shareModalOpen, setShareModalOpen] = useState(false);

  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

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

  const getStateColor = (state: string) => {
    switch (state) {
      case 'published':
        return 'success';
      case 'approved':
        return 'info';
      case 'in_review':
      case 'submitted':
        return 'warning';
      case 'rejected':
        return 'error';
      case 'draft':
      default:
        return 'default';
    }
  };

  const canEdit = canEditContent(user);
  const canDelete = canDeleteContent(user);
  const canReview = canReviewContent(user);

  if (isLoading) {
    return <LoadingSpinner message="Loading activity..." />;
  }

  if (error || (!isLoading && !activity)) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load activity. Please try again.'}
        </Alert>
        <Box mt={2}>
          <Button variant="outlined" onClick={handleBack}>
            Back to Activities
          </Button>
        </Box>
      </Box>
    );
  }

  const nljData = activity?.nlj_data as NLJScenario;
  const nodeCount = nljData?.nodes?.length || 0;
  const linkCount = nljData?.links?.length || 0;
  const variableCount = nljData?.variableDefinitions?.length || 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header - Compact */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, minHeight: '60px' }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h1" sx={{ mb: 0.5, lineHeight: 1.2 }}>
            {activity?.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Activity Details
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {canDelete && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              size="small"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={handleShare}
            size="small"
          >
            Share
          </Button>
          {canEdit && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
              size="small"
            >
              Edit
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={handlePlay}
            size="small"
          >
            Play
          </Button>
        </Stack>
      </Box>

      {/* Activity Info Card */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: `${getContentTypeColor(activity?.content_type || 'default')}.main`, mr: 2 }}>
            {getContentTypeIcon(activity?.content_type || 'mixed')}
          </Avatar>
          <Box>
            <Typography variant="h6">
              {activity?.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {activity?.content_type?.charAt(0).toUpperCase() + activity?.content_type?.slice(1)} Activity
            </Typography>
          </Box>
        </Box>

        {/* Status and Type Info */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            label={activity?.state?.replace('_', ' ').toUpperCase()}
            color={getStateColor(activity?.state || 'draft') as any}
            size="small"
          />
          <Chip
            label={activity?.content_type?.toUpperCase()}
            color={getContentTypeColor(activity?.content_type || 'default') as any}
            size="small"
            variant="outlined"
          />
          {activity?.learning_style && (
            <Chip
              label={activity.learning_style.replace('_', ' ').toUpperCase()}
              size="small"
              variant="outlined"
            />
          )}
          {activity?.is_template && (
            <Chip
              label="TEMPLATE"
              color="info"
              size="small"
            />
          )}
        </Box>

        {/* Activity Description */}
        {activity?.description && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Description
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {activity.description}
            </Typography>
          </Box>
        )}

        {/* Template Category */}
        {activity?.template_category && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TagIcon fontSize="small" />
              Category
            </Typography>
            <Chip 
              label={activity.template_category} 
              size="small" 
              variant="outlined" 
            />
          </Box>
        )}
      </Card>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Left Column - Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <Card sx={{ mb: 3 }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}
            >
              <Tab 
                icon={<AnalyticsIcon />} 
                label="Analytics" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
              <Tab 
                icon={<PreviewIcon />} 
                label="Preview" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
            </Tabs>
            
            <Box sx={{ p: 3 }}>
              {/* Analytics Tab */}
              {currentTab === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                    Activity Analytics
                  </Typography>
                  
                  {/* Top Row - Usage and Structure Stats */}
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 3, 
                    mb: 3,
                    flexDirection: { xs: 'column', md: 'row' }
                  }}>
                    {/* Usage Statistics */}
                    <Paper sx={{ p: 3, flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        mb: 2,
                        fontWeight: 600
                      }}>
                        <ViewIcon fontSize="small" color="primary" />
                        Usage Statistics
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Total Views:</Typography>
                          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                            {activity?.view_count || 0}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Completions:</Typography>
                          <Typography variant="h6" color="success.main" sx={{ fontWeight: 600 }}>
                            {activity?.completion_count || 0}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Completion Rate:</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {activity?.view_count && activity.view_count > 0 
                              ? Math.round((activity.completion_count / activity.view_count) * 100) 
                              : 0}%
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>

                    {/* Content Structure */}
                    <Paper sx={{ p: 3, flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        mb: 2,
                        fontWeight: 600
                      }}>
                        <NodesIcon fontSize="small" color="primary" />
                        Content Structure
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            backgroundColor: 'primary.50'
                          }}>
                            <NodesIcon fontSize="small" color="primary" />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {nodeCount} nodes
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Interactive content elements
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            backgroundColor: 'success.50'
                          }}>
                            <LinksIcon fontSize="small" color="success" />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {linkCount} connections
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Node relationships
                            </Typography>
                          </Box>
                        </Box>

                        {variableCount > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              backgroundColor: 'warning.50'
                            }}>
                              <VariablesIcon fontSize="small" color="warning" />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {variableCount} variables
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Dynamic content variables
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </Box>

                  {/* Bottom Row - Recent Activity */}
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      mb: 2,
                      fontWeight: 600
                    }}>
                      <AnalyticsIcon fontSize="small" color="info" />
                      Recent Activity
                    </Typography>
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 120,
                      backgroundColor: 'grey.50',
                      borderRadius: 1,
                      border: '1px dashed',
                      borderColor: 'grey.300'
                    }}>
                      <Typography variant="body2" color="text.secondary" sx={{ 
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        Detailed activity logs and engagement metrics will be available in a future update.
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              )}

              {/* Preview Tab */}
              {currentTab === 1 && activity && (
                <ActivityPreview activity={activity} />
              )}
            </Box>
          </Card>
        </Box>

        {/* Right Column - Metadata */}
        <Box sx={{ width: { xs: '100%', md: '350px' }, flexShrink: 0 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Activity Metadata
            </Typography>
            
            <Stack spacing={2} divider={<Divider />}>
              {/* Content Information */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon fontSize="small" />
                  Content Information
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Type:</Typography>
                    <Typography variant="body2">{activity?.content_type?.toUpperCase()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Learning Style:</Typography>
                    <Typography variant="body2">
                      {activity?.learning_style?.replace('_', ' ').toUpperCase() || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Status:</Typography>
                    <Typography variant="body2">{activity?.state?.replace('_', ' ').toUpperCase()}</Typography>
                  </Box>
                  {activity?.template_category && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Category:</Typography>
                      <Typography variant="body2">{activity.template_category}</Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Author Information */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon fontSize="small" />
                  Author
                </Typography>
                <Typography variant="body2">{activity?.created_by || 'Unknown'}</Typography>
              </Box>

              {/* Version Information */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Version Information
                </Typography>
                {versionsLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">Loading...</Typography>
                  </Box>
                ) : versions && versions.length > 0 ? (
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Current Version:</Typography>
                      <Typography variant="body2">v{versions[0]?.version_number || '1.0'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Total Versions:</Typography>
                      <Typography variant="body2">{versions.length}</Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">No version history</Typography>
                )}
              </Box>

              {/* Timestamps */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon fontSize="small" />
                  Timestamps
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Created:</Typography>
                    <Typography variant="body2">
                      {activity?.created_at ? formatDistanceToNow(new Date(activity.created_at)) : 'Unknown'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Modified:</Typography>
                    <Typography variant="body2">
                      {activity?.updated_at ? formatDistanceToNow(new Date(activity.updated_at)) : 'Unknown'}
                    </Typography>
                  </Box>
                  {activity?.published_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Published:</Typography>
                      <Typography variant="body2">
                        {formatDistanceToNow(new Date(activity.published_at))}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Activity Actions */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Quick Actions
                </Typography>
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<PlayIcon />}
                    onClick={() => window.open(`/app/play/${activity?.id}`, '_blank')}
                  >
                    Play in New Tab
                  </Button>
                  {canReview && (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<PlayIcon />}
                      onClick={() => window.open(`/app/play/${activity?.id}?review_mode=true`, '_blank')}
                    >
                      Review Mode
                    </Button>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Box>
      </Box>

      {/* Share Modal */}
      {activity && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          content={activity}
        />
      )}
    </Box>
  );
};

export default ActivityDetailPage;