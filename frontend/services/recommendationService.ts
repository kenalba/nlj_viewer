/**
 * Recommendation Service
 * 
 * Client service for intelligent content and node recommendations.
 * Integrates with backend recommendation API for content discovery and Flow Editor suggestions.
 */

import { getApiClient } from '../client/api';

export interface ContentRecommendation {
  id: string;
  title: string;
  description: string;
  similarity_score: number;
  created_at: string;
  node_count: number;
  
  // Performance metrics (if included)
  avg_success_rate?: number;
  avg_completion_time?: number;
  avg_difficulty_score?: number;
  combined_score: number;
}

export interface NodeRecommendation {
  id: string;
  title: string;
  node_type: string;
  similarity_score: number;
  difficulty_level: number | null;
  success_rate: number;
  avg_completion_time: number | null;
  created_at: string;
  combined_score: number;
}

export interface ConceptSuggestion {
  id: string;
  title: string;
  node_type: string;
  concept_match_score: number;
  difficulty_level: number | null;
  success_rate: number;
  keywords: string[];
  objectives: string[];
  usage_count: number;
  created_at: string;
}

export interface RecommendationResponse<T> {
  recommendations: T[];
  total_count: number;
  request_params: Record<string, any>;
  processing_time_ms: number;
}

export interface ContentRecommendationOptions {
  limit?: number;
  includePerformance?: boolean;
  minSimilarityScore?: number;
}

export interface NodeRecommendationOptions {
  limit?: number;
  includeDifferentTypes?: boolean;
  performanceWeight?: number;
}

export interface ConceptRecommendationOptions {
  keywords?: string[];
  objectives?: string[];
  limit?: number;
  difficultyRange?: [number, number];
  performanceThreshold?: number;
}

export interface BatchRecommendationResponse {
  batch_recommendations: Record<string, ContentRecommendation[]>;
  total_content_items: number;
  total_recommendations: number;
  processing_time_ms: number;
}

export interface TrendingContentResponse {
  trending_content: ContentRecommendation[];
  total_count: number;
  time_window_days: number;
  processing_time_ms: number;
  note?: string;
}

/**
 * Get content recommendations based on a source activity.
 */
export const getRelatedContent = async (
  contentId: string,
  options: ContentRecommendationOptions = {}
): Promise<RecommendationResponse<ContentRecommendation>> => {
  try {
    const api = getApiClient();
    const params = new URLSearchParams();
    
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.includePerformance !== undefined) {
      params.set('include_performance', options.includePerformance.toString());
    }
    if (options.minSimilarityScore !== undefined) {
      params.set('min_similarity_score', options.minSimilarityScore.toString());
    }

    const response = await api.get(`/api/recommendations/content/${contentId}/related?${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get related content recommendations:', error);
    throw error;
  }
};

/**
 * Get node recommendations for Flow Editor integration.
 */
export const getRelatedNodes = async (
  nodeId: string,
  options: NodeRecommendationOptions = {}
): Promise<RecommendationResponse<NodeRecommendation>> => {
  try {
    const api = getApiClient();
    const params = new URLSearchParams();
    
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.includeDifferentTypes !== undefined) {
      params.set('include_different_types', options.includeDifferentTypes.toString());
    }
    if (options.performanceWeight !== undefined) {
      params.set('performance_weight', options.performanceWeight.toString());
    }

    const response = await api.get(`/api/recommendations/nodes/${nodeId}/related?${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get related node recommendations:', error);
    throw error;
  }
};

/**
 * Get content recommendations based on specific concepts.
 */
export const getConceptBasedRecommendations = async (
  options: ConceptRecommendationOptions
): Promise<RecommendationResponse<ConceptSuggestion>> => {
  try {
    const api = getApiClient();
    const requestData = {
      keywords: options.keywords || [],
      objectives: options.objectives || [],
      limit: options.limit || 15,
      difficulty_range: options.difficultyRange || null,
      performance_threshold: options.performanceThreshold || 0.6
    };

    const response = await api.post('/api/recommendations/concepts', requestData);
    return response.data;
  } catch (error) {
    console.error('Failed to get concept-based recommendations:', error);
    throw error;
  }
};

/**
 * Get recommendations for multiple content items in a single request.
 */
export const getBatchContentRecommendations = async (
  contentIds: string[],
  limitPerContent: number = 5,
  includePerformance: boolean = true
): Promise<BatchRecommendationResponse> => {
  try {
    const api = getApiClient();
    const params = new URLSearchParams({
      limit_per_content: limitPerContent.toString(),
      include_performance: includePerformance.toString()
    });

    const response = await api.post(`/api/recommendations/content/batch?${params}`, contentIds);
    return response.data;
  } catch (error) {
    console.error('Failed to get batch content recommendations:', error);
    throw error;
  }
};

/**
 * Get trending content based on recent usage and performance.
 */
export const getTrendingContent = async (
  limit: number = 20,
  daysBack: number = 30,
  includePerformance: boolean = true
): Promise<TrendingContentResponse> => {
  try {
    const api = getApiClient();
    const params = new URLSearchParams({
      limit: limit.toString(),
      days_back: daysBack.toString(),
      include_performance: includePerformance.toString()
    });

    const response = await api.get(`/api/recommendations/trending?${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get trending content:', error);
    throw error;
  }
};

/**
 * Check recommendation service health.
 */
export const checkRecommendationHealth = async (): Promise<{
  status: string;
  service: string;
  timestamp: string;
  database_connected: boolean;
  elasticsearch_connected: boolean;
}> => {
  try {
    const api = getApiClient();
    const response = await api.get('/api/recommendations/health');
    return response.data;
  } catch (error) {
    console.error('Failed to check recommendation service health:', error);
    throw error;
  }
};

/**
 * React hook for content recommendations with caching and error handling.
 */
export const useContentRecommendations = (
  contentId: string | null,
  options: ContentRecommendationOptions = {},
  enabled: boolean = true
) => {
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);

  const fetchRecommendations = useCallback(async () => {
    if (!contentId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getRelatedContent(contentId, options);
      setRecommendations(response.recommendations);
      setProcessingTime(response.processing_time_ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [contentId, enabled, JSON.stringify(options)]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    processingTime,
    refetch: fetchRecommendations
  };
};

/**
 * React hook for node recommendations with Flow Editor integration.
 */
export const useNodeRecommendations = (
  nodeId: string | null,
  options: NodeRecommendationOptions = {},
  enabled: boolean = true
) => {
  const [recommendations, setRecommendations] = useState<NodeRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);

  const fetchRecommendations = useCallback(async () => {
    if (!nodeId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getRelatedNodes(nodeId, options);
      setRecommendations(response.recommendations);
      setProcessingTime(response.processing_time_ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load node recommendations');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId, enabled, JSON.stringify(options)]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    processingTime,
    refetch: fetchRecommendations
  };
};

/**
 * React hook for concept-based recommendations.
 */
export const useConceptRecommendations = (
  options: ConceptRecommendationOptions,
  enabled: boolean = true
) => {
  const [recommendations, setRecommendations] = useState<ConceptSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);

  const fetchRecommendations = useCallback(async () => {
    if (!enabled || (!options.keywords?.length && !options.objectives?.length)) {
      setRecommendations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getConceptBasedRecommendations(options);
      setRecommendations(response.recommendations);
      setProcessingTime(response.processing_time_ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load concept recommendations');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, JSON.stringify(options)]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    processingTime,
    refetch: fetchRecommendations
  };
};

// Required imports for hooks
import { useState, useEffect, useCallback } from 'react';