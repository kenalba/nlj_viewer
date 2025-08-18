/**
 * RecommendedContent Component
 * 
 * Displays intelligent content recommendations with performance insights.
 * Used in dashboards, content browsers, and Flow Editor for content discovery.
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Avatar,
  LinearProgress,
  Alert,
  Button,
  Divider,
  Badge,
  Grid
} from '@mui/material';
import {
  AutoAwesome as RecommendationIcon,
  TrendingUp as TrendingIcon,
  Speed as PerformanceIcon,
  Psychology as ObjectiveIcon,
  Tag as KeywordIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Schedule as TimeIcon,
  Check as SuccessIcon,
  QuestionMark as DifficultyIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { 
  ContentRecommendation, 
  NodeRecommendation, 
  ConceptSuggestion,
  useContentRecommendations,
  useNodeRecommendations,
  useConceptRecommendations
} from '../services/recommendationService';

interface RecommendedContentProps {
  /** Source content ID for related content recommendations */
  contentId?: string;
  /** Source node ID for related node recommendations */
  nodeId?: string;
  /** Concept-based search options */
  conceptOptions?: {
    keywords?: string[];
    objectives?: string[];
  };
  /** Maximum number of recommendations to show */
  limit?: number;
  /** Component variant */
  variant?: 'content' | 'nodes' | 'concepts';
  /** Show performance metrics */
  showPerformance?: boolean;
  /** Callback when recommendation is selected */
  onSelect?: (recommendation: ContentRecommendation | NodeRecommendation | ConceptSuggestion) => void;
  /** Callback when recommendation is played */
  onPlay?: (recommendation: ContentRecommendation) => void;
  /** Callback when recommendation is edited */
  onEdit?: (recommendation: ContentRecommendation | NodeRecommendation | ConceptSuggestion) => void;
  /** Custom title */
  title?: string;
  /** Show as compact list */
  compact?: boolean;
}

export const RecommendedContent: React.FC<RecommendedContentProps> = ({
  contentId,
  nodeId,
  conceptOptions,
  limit = 8,
  variant = 'content',
  showPerformance = true,
  onSelect,
  onPlay,
  onEdit,
  title,
  compact = false
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(!compact);
  
  // Use appropriate hook based on variant
  const contentRecommendations = useContentRecommendations(
    contentId || null,
    { limit, includePerformance: showPerformance },
    variant === 'content' && !!contentId
  );
  
  const nodeRecommendations = useNodeRecommendations(
    nodeId || null,
    { limit, includeDifferentTypes: true, performanceWeight: 0.4 },
    variant === 'nodes' && !!nodeId
  );
  
  const conceptRecommendations = useConceptRecommendations(
    { ...conceptOptions, limit },
    variant === 'concepts' && !!(conceptOptions?.keywords?.length || conceptOptions?.objectives?.length)
  );

  // Get data based on variant
  const getRecommendationData = () => {
    switch (variant) {
      case 'content':
        return {
          recommendations: contentRecommendations.recommendations,
          loading: contentRecommendations.loading,
          error: contentRecommendations.error,
          processingTime: contentRecommendations.processingTime,
          refetch: contentRecommendations.refetch
        };
      case 'nodes':
        return {
          recommendations: nodeRecommendations.recommendations,
          loading: nodeRecommendations.loading,
          error: nodeRecommendations.error,
          processingTime: nodeRecommendations.processingTime,
          refetch: nodeRecommendations.refetch
        };
      case 'concepts':
        return {
          recommendations: conceptRecommendations.recommendations,
          loading: conceptRecommendations.loading,
          error: conceptRecommendations.error,
          processingTime: conceptRecommendations.processingTime,
          refetch: conceptRecommendations.refetch
        };
      default:
        return { recommendations: [], loading: false, error: null, processingTime: 0, refetch: () => {} };
    }
  };

  const { recommendations, loading, error, processingTime, refetch } = getRecommendationData();

  const getVariantIcon = () => {
    switch (variant) {
      case 'content':
        return <RecommendationIcon color="primary" />;
      case 'nodes':
        return <Psychology color="primary" />;
      case 'concepts':
        return <TrendingIcon color="primary" />;
      default:
        return <RecommendationIcon color="primary" />;
    }
  };

  const getVariantTitle = () => {
    if (title) return title;
    
    switch (variant) {
      case 'content':
        return 'Related Content';
      case 'nodes':
        return 'Similar Nodes';
      case 'concepts':
        return 'Concept Matches';
      default:
        return 'Recommendations';
    }
  };

  const formatDifficulty = (level: number | null) => {
    if (!level) return 'Unknown';
    if (level <= 3) return 'Easy';
    if (level <= 6) return 'Medium';
    return 'Hard';
  };

  const formatSuccessRate = (rate: number) => {
    return `${Math.round(rate * 100)}%`;
  };

  const formatTime = (ms: number | null) => {
    if (!ms) return 'Unknown';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  const renderRecommendationCard = (recommendation: any, index: number) => {
    const isContent = 'node_count' in recommendation;
    const isNode = 'node_type' in recommendation && !('concept_match_score' in recommendation);
    const isConcept = 'concept_match_score' in recommendation;

    return (
      <Card 
        key={recommendation.id}
        variant={compact ? "outlined" : "elevation"}
        sx={{ 
          cursor: onSelect ? 'pointer' : 'default',
          transition: 'all 0.2s ease-in-out',
          '&:hover': onSelect ? {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4]
          } : {},
          mb: compact ? 1 : 2
        }}
        onClick={() => onSelect?.(recommendation)}
      >
        <CardContent sx={{ pb: compact ? 1 : 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ flex: 1, mr: 1 }}>
              <Typography 
                variant={compact ? "body2" : "subtitle2"} 
                fontWeight={600}
                sx={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {recommendation.title}
              </Typography>
              
              {isContent && recommendation.description && !compact && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {recommendation.description.substring(0, 100)}
                  {recommendation.description.length > 100 && '...'}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Score indicator */}
              <Chip
                size="small"
                label={
                  isContent ? `${Math.round(recommendation.combined_score * 100)}%` :
                  isNode ? `${Math.round(recommendation.combined_score * 100)}%` :
                  `${Math.round(recommendation.concept_match_score * 100)}%`
                }
                color={
                  (recommendation.combined_score || recommendation.concept_match_score) > 0.7 ? "success" :
                  (recommendation.combined_score || recommendation.concept_match_score) > 0.4 ? "warning" : "default"
                }
                sx={{ fontSize: '0.7rem', fontWeight: 600 }}
              />
              
              {/* Action buttons */}
              {onPlay && isContent && (
                <Tooltip title="Play Activity">
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(recommendation);
                    }}
                  >
                    <PlayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              
              {onEdit && (
                <Tooltip title="Edit">
                  <IconButton 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(recommendation);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Metadata chips */}
          <Stack direction="row" spacing={0.5} sx={{ mb: compact ? 0 : 1, flexWrap: 'wrap', gap: 0.5 }}>
            {isContent && (
              <Chip
                size="small"
                icon={<Psychology />}
                label={`${recommendation.node_count} nodes`}
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
            
            {isNode && (
              <Chip
                size="small"
                label={recommendation.node_type}
                variant="outlined"
                sx={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
              />
            )}
            
            {isConcept && (
              <>
                {recommendation.keywords.length > 0 && (
                  <Chip
                    size="small"
                    icon={<KeywordIcon />}
                    label={`${recommendation.keywords.length} keywords`}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                )}
                {recommendation.objectives.length > 0 && (
                  <Chip
                    size="small"
                    icon={<ObjectiveIcon />}
                    label={`${recommendation.objectives.length} objectives`}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                )}
              </>
            )}
          </Stack>

          {/* Performance metrics */}
          {showPerformance && !compact && (
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              {recommendation.success_rate !== undefined && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <SuccessIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {formatSuccessRate(recommendation.success_rate)}
                  </Typography>
                </Box>
              )}
              
              {recommendation.difficulty_level && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <DifficultyIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {formatDifficulty(recommendation.difficulty_level)}
                  </Typography>
                </Box>
              )}
              
              {recommendation.avg_completion_time && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(recommendation.avg_completion_time)}
                  </Typography>
                </Box>
              )}
              
              {isConcept && recommendation.usage_count > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Used {recommendation.usage_count}x
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!contentId && !nodeId && !conceptOptions?.keywords?.length && !conceptOptions?.objectives?.length) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: compact ? 1 : 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getVariantIcon()}
            <Typography variant="h6" fontWeight={600}>
              {getVariantTitle()}
            </Typography>
            {recommendations.length > 0 && (
              <Badge badgeContent={recommendations.length} color="primary" />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {processingTime > 0 && (
              <Typography variant="caption" color="text.secondary">
                {processingTime.toFixed(0)}ms
              </Typography>
            )}
            
            <Tooltip title="Refresh recommendations">
              <IconButton size="small" onClick={refetch} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            {compact && (
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Loading state */}
        {loading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Finding smart recommendations...
            </Typography>
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Alert severity="warning" size="small" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Recommendations */}
        {expanded && !loading && recommendations.length > 0 && (
          <Box>
            {compact ? (
              <Stack spacing={0.5}>
                {recommendations.slice(0, limit).map((rec, index) => 
                  renderRecommendationCard(rec, index)
                )}
              </Stack>
            ) : (
              <Grid container spacing={2}>
                {recommendations.slice(0, limit).map((rec, index) => (
                  <Grid item xs={12} sm={6} key={rec.id}>
                    {renderRecommendationCard(rec, index)}
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* Empty state */}
        {!loading && recommendations.length === 0 && !error && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No recommendations found. Try different content or adjust your criteria.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RecommendedContent;