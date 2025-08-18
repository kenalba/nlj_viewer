/**
 * Node Analytics Hooks
 * Custom hooks for managing node performance data, analytics, and optimization insights
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  NodePerformanceMetrics,
  NodeComparison,
  ActivityNodeAnalytics,
  ContentOptimization,
  TrendingNodes,
  TrendingNode,
  getNodeAnalytics,
  compareNodes,
  getActivityNodeAnalytics,
  getOptimizationSuggestions,
  getTrendingNodes,
  getNodePerformanceTrends,
} from '../services/nodeService';

export interface UseNodeAnalyticsResult {
  data: NodePerformanceMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching comprehensive node analytics
 */
export const useNodeAnalytics = (nodeId: string | null): UseNodeAnalyticsResult => {
  const [data, setData] = useState<NodePerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    if (!nodeId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const analyticsData = await getNodeAnalytics(nodeId);
      setData(analyticsData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching node analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch node analytics');
    } finally {
      setIsLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    if (nodeId) {
      fetchData();
    } else {
      setData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [fetchData, nodeId]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    refetch: fetchData,
  };
};

export interface UseNodeComparisonResult {
  data: NodeComparison | null;
  isLoading: boolean;
  error: string | null;
  compare: (nodeIds: string[], includeContent?: boolean) => Promise<void>;
  clear: () => void;
}

/**
 * Hook for comparing multiple nodes' performance
 */
export const useNodeComparison = (): UseNodeComparisonResult => {
  const [data, setData] = useState<NodeComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback(async (nodeIds: string[], includeContent: boolean = false) => {
    if (nodeIds.length === 0) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const comparisonData = await compareNodes(nodeIds, includeContent);
      setData(comparisonData);
    } catch (err) {
      console.error('Error comparing nodes:', err);
      setError(err instanceof Error ? err.message : 'Failed to compare nodes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    compare,
    clear,
  };
};

export interface UseActivityNodeAnalyticsResult {
  data: ActivityNodeAnalytics | null;
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching node analytics within a specific activity
 */
export const useActivityNodeAnalytics = (activityId: string | null): UseActivityNodeAnalyticsResult => {
  const [data, setData] = useState<ActivityNodeAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    if (!activityId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const analyticsData = await getActivityNodeAnalytics(activityId);
      setData(analyticsData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching activity node analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activity node analytics');
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (activityId) {
      fetchData();
    } else {
      setData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [fetchData, activityId]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    refetch: fetchData,
  };
};

export interface UseContentOptimizationResult {
  data: ContentOptimization | null;
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date;
  refetch: () => Promise<void>;
  getSuggestionsByType: (type: string) => ContentOptimization['suggestions'];
  getHighPrioritySuggestions: () => ContentOptimization['suggestions'];
}

/**
 * Hook for fetching AI-powered content optimization suggestions
 */
export const useContentOptimization = (nodeId: string | null): UseContentOptimizationResult => {
  const [data, setData] = useState<ContentOptimization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    if (!nodeId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const optimizationData = await getOptimizationSuggestions(nodeId);
      setData(optimizationData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching optimization suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch optimization suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    if (nodeId) {
      fetchData();
    } else {
      setData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [fetchData, nodeId]);

  const getSuggestionsByType = useCallback((type: string) => {
    return data?.suggestions.filter(suggestion => suggestion.type === type) || [];
  }, [data]);

  const getHighPrioritySuggestions = useCallback(() => {
    return data?.suggestions.filter(suggestion => suggestion.severity === 'high') || [];
  }, [data]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    refetch: fetchData,
    getSuggestionsByType,
    getHighPrioritySuggestions,
  };
};

export interface UseTrendingNodesResult {
  data: TrendingNodes | null;
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date;
  refetch: (timeWindowDays?: number, limit?: number) => Promise<void>;
  getTopPerformers: (count?: number) => TrendingNode[];
  getByNodeType: (nodeType: string) => TrendingNode[];
}

/**
 * Hook for fetching trending nodes based on recent performance
 */
export const useTrendingNodes = (
  initialTimeWindow: number = 7,
  initialLimit: number = 20
): UseTrendingNodesResult => {
  const [data, setData] = useState<TrendingNodes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async (timeWindowDays = initialTimeWindow, limit = initialLimit) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const trendingData = await getTrendingNodes(timeWindowDays, limit);
      setData(trendingData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching trending nodes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trending nodes');
    } finally {
      setIsLoading(false);
    }
  }, [initialTimeWindow, initialLimit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTopPerformers = useCallback((count = 5) => {
    return data?.trending_nodes
      .sort((a, b) => b.trend_score - a.trend_score)
      .slice(0, count) || [];
  }, [data]);

  const getByNodeType = useCallback((nodeType: string) => {
    return data?.trending_nodes.filter(node => node.node_type === nodeType) || [];
  }, [data]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    refetch: fetchData,
    getTopPerformers,
    getByNodeType,
  };
};

export interface UseNodePerformanceTrendsResult {
  data: {
    node_id: string;
    time_range: string;
    data_points: Array<{
      date: string;
      success_rate: number;
      interactions: number;
      avg_completion_time: number;
    }>;
    summary: {
      trend_direction: 'improving' | 'stable' | 'declining';
      trend_strength: number;
      period_comparison: {
        success_rate_change: number;
        interaction_count_change: number;
      };
    };
  } | null;
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date;
  refetch: (timeRange?: '7d' | '30d' | '90d' | '1y') => Promise<void>;
}

/**
 * Hook for fetching node performance trends over time
 */
export const useNodePerformanceTrends = (
  nodeId: string | null,
  initialTimeRange: '7d' | '30d' | '90d' | '1y' = '30d'
): UseNodePerformanceTrendsResult => {
  const [data, setData] = useState<UseNodePerformanceTrendsResult['data']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async (timeRange = initialTimeRange) => {
    if (!nodeId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const trendsData = await getNodePerformanceTrends(nodeId, timeRange);
      setData(trendsData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching node performance trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch performance trends');
    } finally {
      setIsLoading(false);
    }
  }, [nodeId, initialTimeRange]);

  useEffect(() => {
    if (nodeId) {
      fetchData();
    } else {
      setData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [fetchData, nodeId]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    refetch: fetchData,
  };
};

export interface NodeAnalyticsInsights {
  performance_rating: 'excellent' | 'good' | 'fair' | 'poor';
  key_strengths: string[];
  improvement_areas: string[];
  usage_pattern: 'high' | 'medium' | 'low';
  recommendation: 'optimize' | 'maintain' | 'retire' | 'promote';
}

/**
 * Hook that provides derived insights from node analytics data
 */
export const useNodeInsights = (nodeData: NodePerformanceMetrics | null): NodeAnalyticsInsights | null => {
  return useMemo(() => {
    if (!nodeData) return null;

    const { performance_metrics, interaction_stats } = nodeData;
    const successRate = performance_metrics.success_rate || 0;
    const engagementScore = performance_metrics.engagement_score || 0;
    const totalInteractions = interaction_stats.total_interactions;
    
    // Determine performance rating
    let performance_rating: NodeAnalyticsInsights['performance_rating'];
    if (successRate >= 85 && engagementScore >= 0.7) {
      performance_rating = 'excellent';
    } else if (successRate >= 70 && engagementScore >= 0.5) {
      performance_rating = 'good';
    } else if (successRate >= 60 && engagementScore >= 0.3) {
      performance_rating = 'fair';
    } else {
      performance_rating = 'poor';
    }

    // Identify key strengths
    const key_strengths: string[] = [];
    if (successRate >= 80) key_strengths.push('High success rate');
    if (engagementScore >= 0.6) key_strengths.push('Strong learner engagement');
    if (totalInteractions >= 100) key_strengths.push('Popular content');
    if (performance_metrics.avg_completion_time_ms && performance_metrics.avg_completion_time_ms < 30000) {
      key_strengths.push('Quick completion time');
    }

    // Identify improvement areas
    const improvement_areas: string[] = [];
    if (successRate < 60) improvement_areas.push('Low success rate needs attention');
    if (engagementScore < 0.4) improvement_areas.push('Poor learner engagement');
    if (totalInteractions < 10) improvement_areas.push('Limited usage data');
    if (performance_metrics.avg_completion_time_ms && performance_metrics.avg_completion_time_ms > 120000) {
      improvement_areas.push('Long completion time');
    }

    // Determine usage pattern
    let usage_pattern: NodeAnalyticsInsights['usage_pattern'];
    if (totalInteractions >= 100) {
      usage_pattern = 'high';
    } else if (totalInteractions >= 20) {
      usage_pattern = 'medium';
    } else {
      usage_pattern = 'low';
    }

    // Generate recommendation
    let recommendation: NodeAnalyticsInsights['recommendation'];
    if (performance_rating === 'excellent' && usage_pattern === 'high') {
      recommendation = 'promote';
    } else if (performance_rating === 'good' && usage_pattern !== 'low') {
      recommendation = 'maintain';
    } else if (performance_rating === 'poor' && usage_pattern === 'low') {
      recommendation = 'retire';
    } else {
      recommendation = 'optimize';
    }

    return {
      performance_rating,
      key_strengths,
      improvement_areas,
      usage_pattern,
      recommendation,
    };
  }, [nodeData]);
};

export default {
  useNodeAnalytics,
  useNodeComparison,
  useActivityNodeAnalytics,
  useContentOptimization,
  useTrendingNodes,
  useNodePerformanceTrends,
  useNodeInsights,
};