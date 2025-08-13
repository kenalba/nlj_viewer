/**
 * Survey Detail Page
 * Comprehensive survey management hub with overview, analytics, links, and actions
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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Poll as SurveyIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Tag as TagIcon,
  Analytics as AnalyticsIcon,
  Link as LinkIcon,
  QrCode as QrCodeIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  CheckCircle as CompletedIcon,
  Schedule as TimeIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Assessment as ResponsesIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';

import { contentApi, type ContentItem } from '../client/content';
import { surveysApi, type SurveyStats, type SurveyLink, formatCompletionRate, formatCompletionTime, getLinkStatus } from '../client/surveys';
import { useAuth } from '../contexts/AuthContext';
import { canEditContent, canReviewContent } from '../utils/permissions';
import { SurveyAnalyticsSection } from '../components/survey/SurveyAnalyticsSection';

// Using types from surveys API client

export const SurveyDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentTab, setCurrentTab] = useState(0);

  // Extract survey ID from URL path
  const surveyId = React.useMemo(() => {
    const pathSegments = location.pathname.split('/');
    const surveysIndex = pathSegments.indexOf('surveys');
    if (surveysIndex !== -1 && pathSegments[surveysIndex + 1]) {
      return pathSegments[surveysIndex + 1];
    }
    return null;
  }, [location.pathname]);

  const canEdit = canEditContent(user);
  const canReview = canReviewContent(user);

  // Fetch survey details
  const {
    data: survey,
    isLoading: isSurveyLoading,
    error: surveyError,
  } = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => contentApi.get(surveyId!),
    enabled: !!surveyId,
  });

  // Fetch survey statistics
  const {
    data: surveyStats,
    isLoading: isStatsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['survey-stats', surveyId],
    queryFn: () => surveysApi.getStats(surveyId!),
    enabled: !!surveyId,
    select: (response) => response.data,
  });

  // Fetch generated links
  const {
    data: surveyLinksData,
    isLoading: isLinksLoading,
    error: linksError,
  } = useQuery({
    queryKey: ['survey-links', surveyId],
    queryFn: () => surveysApi.getLinks(surveyId!),
    enabled: !!surveyId,
  });

  const generatedLinks = surveyLinksData?.data.links || [];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleBack = () => {
    navigate('/app/surveys');
  };

  const handleEdit = () => {
    if (survey) {
      navigate(`/app/flow/edit/${survey.id}`);
    }
  };

  const handleSend = () => {
    if (survey) {
      navigate(`/app/surveys/${survey.id}/send`);
    }
  };

  const handlePlay = () => {
    if (survey) {
      window.open(`/app/play/${survey.id}`, '_blank');
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
    console.log('Link copied to clipboard:', url);
  };

  if (isSurveyLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (surveyError || !survey) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load survey. Please try again.
        </Alert>
        <Button variant="outlined" onClick={handleBack} sx={{ mt: 2 }}>
          Back to Surveys
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={handleBack}>
          <BackIcon />
        </IconButton>
        <SurveyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            {survey.title}
          </Typography>
          {survey.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              {survey.description}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Left Column - Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}
            >
              <Tab 
                icon={<AnalyticsIcon />} 
                label="Analytics" 
                iconPosition="start"
                sx={{ textTransform: 'none' }}
              />
              <Tab 
                icon={<LinkIcon />} 
                label="Generated Links" 
                iconPosition="start"
                sx={{ textTransform: 'none' }}
              />
              <Tab 
                icon={<ResponsesIcon />} 
                label="Responses" 
                iconPosition="start"
                sx={{ textTransform: 'none' }}
              />
            </Tabs>
            
            <Box sx={{ p: 3 }}>
              {/* Analytics Tab */}
              {currentTab === 0 && (
                <SurveyAnalyticsSection
                  surveyId={surveyId!}
                  surveyName={survey.title}
                />
              )}

              {/* Generated Links Tab */}
              {currentTab === 1 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Generated Survey Links
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<LinkIcon />}
                      onClick={handleSend}
                      size="small"
                    >
                      Generate New Link
                    </Button>
                  </Box>

                  {isLinksLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : linksError ? (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      Failed to load survey links
                    </Alert>
                  ) : generatedLinks.length === 0 ? (
                    <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover' }}>
                      <LinkIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No links generated yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Create a public link to share this survey with respondents
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<SendIcon />}
                        onClick={handleSend}
                      >
                        Generate Survey Link
                      </Button>
                    </Paper>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Link</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Expires</TableCell>
                            <TableCell>Views</TableCell>
                            <TableCell>Completions</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {generatedLinks.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  sx={{ 
                                    fontFamily: 'monospace',
                                    maxWidth: 200,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {link.url}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {format(new Date(link.created_at), 'MMM d, yyyy')}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {link.expires_at 
                                    ? format(new Date(link.expires_at), 'MMM d, yyyy')
                                    : 'Never'
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell>{link.views}</TableCell>
                              <TableCell>{link.completions}</TableCell>
                              <TableCell>
                                {(() => {
                                  const status = getLinkStatus(link);
                                  return (
                                    <Chip
                                      label={status.text}
                                      color={status.color}
                                      size="small"
                                    />
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyLink(link.url)}
                                    title="Copy link"
                                  >
                                    <CopyIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => window.open(link.url, '_blank')}
                                    title="Open link"
                                  >
                                    <ViewIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      // TODO: Generate QR code
                                      console.log('Generate QR code for:', link.url);
                                    }}
                                    title="QR Code"
                                  >
                                    <QrCodeIcon fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* Responses Tab */}
              {currentTab === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                    Survey Responses
                  </Typography>
                  
                  <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover' }}>
                    <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      Response Data Coming Soon
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Individual responses and verbatim feedback will be displayed here
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          </Card>
        </Box>

        {/* Right Column - Metadata Sidebar */}
        <Box sx={{ width: { xs: '100%', md: '350px' }, flexShrink: 0 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Survey Information
            </Typography>
            
            <Stack spacing={2} divider={<Divider />}>
              {/* Basic Info */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon fontSize="small" />
                  Basic Information
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Created by:</Typography>
                    <Typography variant="body2">{survey.created_by || 'Unknown'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Status:</Typography>
                    <Chip 
                      label={survey.state.charAt(0).toUpperCase() + survey.state.slice(1)} 
                      size="small"
                      color={survey.state === 'published' ? 'success' : 'default'}
                    />
                  </Box>
                </Stack>
              </Box>

              {/* Quick Stats */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AnalyticsIcon fontSize="small" />
                  Survey Statistics
                </Typography>
                {isStatsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : surveyStats ? (
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Total Responses:</Typography>
                      <Typography variant="body2">{surveyStats.total_responses}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Completion Rate:</Typography>
                      <Typography variant="body2">{formatCompletionRate(surveyStats.completion_rate)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Unique Respondents:</Typography>
                      <Typography variant="body2">{surveyStats.unique_respondents}</Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Statistics unavailable
                  </Typography>
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
                      {format(new Date(survey.created_at), 'MMM d, yyyy')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Updated:</Typography>
                    <Typography variant="body2">
                      {format(new Date(survey.updated_at), 'MMM d, yyyy')}
                    </Typography>
                  </Box>
                  {surveyStats?.last_response_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Last Response:</Typography>
                      <Typography variant="body2">
                        {formatDistanceToNow(new Date(surveyStats.last_response_at), { addSuffix: true })}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Actions */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Actions
                </Typography>
                <Stack spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    onClick={handleSend}
                    fullWidth
                    size="small"
                  >
                    Send Survey
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<PlayIcon />}
                    onClick={handlePlay}
                    fullWidth
                    size="small"
                  >
                    Preview Survey
                  </Button>
                  
                  {canEdit && (
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={handleEdit}
                      fullWidth
                      size="small"
                    >
                      Edit Survey
                    </Button>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default SurveyDetailPage;