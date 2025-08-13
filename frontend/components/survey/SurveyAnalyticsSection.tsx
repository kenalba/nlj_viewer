/**
 * SurveyAnalyticsSection Component
 * Phase 2C: Integrated analytics display using Phase 1 components with Phase 2B data
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

import { surveysApi, type SurveyAnalyticsResponse } from '../../client/surveys';
import {
  HorizontalBarChart,
  TableSwatches,
  RankWidget,
  type ResponseDistribution,
  type QuestionScale,
  type RankData,
} from './index';

interface SurveyAnalyticsSectionProps {
  surveyId: string;
  surveyName: string;
}

// Validation functions for data integrity
const validateAnalyticsData = (data: SurveyAnalyticsResponse): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data || !data.success) {
    errors.push('Analytics request was not successful');
    return { isValid: false, errors };
  }

  if (!data.data) {
    errors.push('Analytics data is missing');
    return { isValid: false, errors };
  }

  const { overview, questions } = data.data;

  // Validate overview data
  if (!overview) {
    errors.push('Overview data is missing');
  } else {
    if (typeof overview.total_responses !== 'number' || overview.total_responses < 0) {
      errors.push('Invalid total_responses in overview');
    }
    if (typeof overview.unique_respondents !== 'number' || overview.unique_respondents < 0) {
      errors.push('Invalid unique_respondents in overview');
    }
    // completion_rate is optional in simplified overview
    if (overview.completion_rate !== undefined && (typeof overview.completion_rate !== 'number' || overview.completion_rate < 0 || overview.completion_rate > 100)) {
      errors.push('Invalid completion_rate in overview');
    }
    if (overview.total_answers !== undefined && (typeof overview.total_answers !== 'number' || overview.total_answers < 0)) {
      errors.push('Invalid total_answers in overview');
    }
    if (overview.avg_completion_time !== undefined && (typeof overview.avg_completion_time !== 'number' || overview.avg_completion_time < 0)) {
      errors.push('Invalid avg_completion_time in overview');
    }
  }

  // Validate questions data
  if (!questions || typeof questions !== 'object') {
    errors.push('Questions data is missing or invalid');
  } else {
    const questionIds = Object.keys(questions);
    if (questionIds.length === 0) {
      errors.push('No question data available');
    }

    questionIds.forEach(questionId => {
      const question = questions[questionId];
      if (!question) {
        errors.push(`Question ${questionId} data is missing`);
        return;
      }

      if (!question.question_title || typeof question.question_title !== 'string') {
        errors.push(`Question ${questionId} title is missing or invalid`);
      }

      if (typeof question.response_count !== 'number' || question.response_count < 0) {
        errors.push(`Question ${questionId} response_count is invalid`);
      }

      if (question.scale_info && typeof question.scale_info !== 'object') {
        errors.push(`Question ${questionId} scale_info is invalid`);
      }
    });
  }

  return { isValid: errors.length === 0, errors };
};

const validateQuestionDistribution = (distribution: any[]): boolean => {
  if (!Array.isArray(distribution)) return false;
  
  return distribution.every(item => 
    item && 
    typeof item.label === 'string' &&
    typeof item.count === 'number' && item.count >= 0 &&
    typeof item.percentage === 'number' && item.percentage >= 0 && item.percentage <= 100
  );
};

const safeGetScaleInfo = (question: any): QuestionScale => {
  const scale = question?.scale_info || {};
  
  return {
    id: scale.type || 'unknown',
    type: scale.type || 'categorical',
    labels: Array.isArray(scale.labels) ? scale.labels : ['Response'],
    values: Array.isArray(question.distribution) ? question.distribution.map((d: any) => d.value || 0) : [0],
    semanticMapping: scale.semantic_mapping || 'custom',
    colorScheme: scale.color_scheme || 'custom',
    valueCount: Array.isArray(scale.labels) ? scale.labels.length : 1,
  };
};

const safeGetResponseDistribution = (question: any): ResponseDistribution => {
  if (!question.distribution || !validateQuestionDistribution(question.distribution)) {
    return [];
  }

  return question.distribution.map((item: any) => ({
    label: String(item.label || 'Unknown'),
    value: item.value || 0,
    count: Math.max(0, Number(item.count) || 0),
    percentage: Math.max(0, Math.min(100, Number(item.percentage) || 0)),
    colorKey: item.color_key || 'default',
  }));
};

export const SurveyAnalyticsSection: React.FC<SurveyAnalyticsSectionProps> = ({
  surveyId,
  surveyName,
}) => {
  const [selectedGroupBy, setSelectedGroupBy] = useState<string>('department');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('30d');

  // Fetch survey analytics data
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['survey-analytics', surveyId, selectedGroupBy, selectedTimeframe],
    queryFn: () => surveysApi.getAnalytics(surveyId, {
      groupBy: selectedGroupBy,
      timeframe: selectedTimeframe,
    }),
    enabled: !!surveyId,
    retry: 2,
    retryDelay: 1000,
  });

  // Validate analytics data
  const validation = analyticsData ? validateAnalyticsData(analyticsData) : null;

  const handleGroupByChange = (event: any) => {
    setSelectedGroupBy(event.target.value);
  };

  const handleTimeframeChange = (event: any) => {
    setSelectedTimeframe(event.target.value);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Handle network/API errors
  if (error) {
    return (
      <Box>
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              <RefreshIcon sx={{ mr: 1 }} />
              Retry
            </Button>
          }
        >
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Failed to load survey analytics
            </Typography>
            <Typography variant="body2">
              {error instanceof Error ? error.message : 'Network error occurred'}
            </Typography>
          </Stack>
        </Alert>
      </Box>
    );
  }

  // Handle validation errors
  if (validation && !validation.isValid) {
    return (
      <Box>
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          icon={<WarningIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              <RefreshIcon sx={{ mr: 1 }} />
              Reload
            </Button>
          }
        >
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Analytics data validation failed
            </Typography>
            {validation.errors.slice(0, 3).map((error, index) => (
              <Typography key={index} variant="body2">
                • {error}
              </Typography>
            ))}
            {validation.errors.length > 3 && (
              <Typography variant="body2" color="text.secondary">
                ...and {validation.errors.length - 3} more issues
              </Typography>
            )}
          </Stack>
        </Alert>
      </Box>
    );
  }

  // Handle no data scenario
  if (analyticsData?.success && analyticsData.data && Object.keys(analyticsData.data.questions).length === 0) {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              No analytics data available
            </Typography>
            <Typography variant="body2">
              This survey hasn't received any responses yet, or the responses don't contain analyzable data.
            </Typography>
          </Stack>
        </Alert>
      </Box>
    );
  }

  const { data: analytics } = analyticsData;
  const questions = Object.values(analytics.questions);
  const trends = analytics.trends;

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssessmentIcon />
        Survey Analytics - {surveyName}
      </Typography>

      {/* Controls */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel>Group By</InputLabel>
          <Select
            value={selectedGroupBy}
            label="Group By"
            onChange={handleGroupByChange}
          >
            <MenuItem value="department">Department</MenuItem>
            <MenuItem value="location">Location</MenuItem>
            <MenuItem value="tenure">Tenure</MenuItem>
            <MenuItem value="role">Role</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 160 }} size="small">
          <InputLabel>Timeframe</InputLabel>
          <Select
            value={selectedTimeframe}
            label="Timeframe"
            onChange={handleTimeframeChange}
          >
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
            <MenuItem value="90d">Last 90 Days</MenuItem>
            <MenuItem value="180d">Last 6 Months</MenuItem>
            <MenuItem value="365d">Last Year</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Responses
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Surveys Answered
              </Typography>
              <Typography variant="h4" component="div" color="primary.main">
                {analytics.overview.total_responses.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Answers
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Questions Answered
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {analytics.overview.total_answers?.toLocaleString() || '0'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Unique Respondents
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Individual People
              </Typography>
              <Typography variant="h4" component="div" color="info.main">
                {analytics.overview.unique_respondents.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Avg. Completion Time
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Time to Complete
              </Typography>
              <Typography variant="h4" component="div" color="warning.main">
                {Math.round((analytics.overview.avg_completion_time || 0) / 60)}m
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Completion Timeline */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon />
            Survey Completions Over Time
          </Typography>
          <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Timeline Chart - Coming Soon
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Question-Level Analytics */}
      <Typography variant="h6" gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PeopleIcon />
        Question Analysis
      </Typography>

      {questions.map((question) => {
        try {
          // Use safe transformation functions
          const questionScale = safeGetScaleInfo(question);
          const responseDistribution = safeGetResponseDistribution(question);

          // Create rank data if available - use safe calculation
          const rankData: RankData | undefined = question.average_score && questionScale.labels.length > 1 ? {
            percentile: Math.max(0, Math.min(100, Math.round((question.average_score / (questionScale.labels.length - 1)) * 100))),
            benchmark: 'industry' as const,
            description: `Average: ${Number(question.average_score).toFixed(1)}`,
          } : undefined;

          return (
          <Accordion key={question.question_id} sx={{ mb: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`question-${question.question_id}-content`}
              id={`question-${question.question_id}-header`}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {question.question_title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {question.response_count} responses • {question.skip_rate}% skip rate
                </Typography>
              </Box>
            </AccordionSummary>
            
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* Response Distribution Chart */}
                <Grid item xs={12} md={8}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Response Distribution
                    </Typography>
                    <HorizontalBarChart
                      variant="3-colors"
                      data={responseDistribution}
                      scale={questionScale}
                      showLabels={true}
                      interactive={true}
                    />
                  </Box>
                </Grid>

                {/* Scale Legend and Metrics */}
                <Grid item xs={12} md={4}>
                  <Stack spacing={2}>
                    {/* Color Scale Legend */}
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Response Scale
                      </Typography>
                      <TableSwatches
                        scale={questionScale}
                        size="medium"
                        showLabels={true}
                      />
                    </Box>

                    {/* Performance Ranking */}
                    {rankData && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Performance Ranking
                        </Typography>
                        <RankWidget
                          rankData={rankData}
                          size="medium"
                        />
                      </Box>
                    )}

                    {/* Question Type Info */}
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Question Details
                      </Typography>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Type:</Typography>
                          <Typography variant="body2">{question.question_type}</Typography>
                        </Box>
                        {question.average_score !== undefined && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Average:</Typography>
                            <Typography variant="body2">{question.average_score.toFixed(2)}</Typography>
                          </Box>
                        )}
                        {question.nps_score !== undefined && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">NPS Score:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {question.nps_score}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Grid>

                {/* Question Text */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Question:</strong> {question.question_text}
                  </Typography>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
          );
        } catch (error) {
          console.error('Error rendering question:', question.question_id, error);
          return (
            <Alert key={`error-${question.question_id}`} severity="warning" sx={{ mb: 2 }}>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Error displaying question: {question.question_title || question.question_id}
                </Typography>
                <Typography variant="body2">
                  This question's data could not be displayed due to formatting issues.
                </Typography>
              </Stack>
            </Alert>
          );
        }
      })}

      {/* No Data State */}
      {questions.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No analytics data available for this survey. Make sure the survey has received responses.
        </Alert>
      )}
    </Box>
  );
};

export default SurveyAnalyticsSection;