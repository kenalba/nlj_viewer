/**
 * Custom hook for managing analytics data
 * Handles data fetching, caching, and state management for all analytics components
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client/client';

export interface PlatformMetrics {
  total_statements: number;
  unique_learners: number;
  unique_activities: number;
  completion_rate: number;
  average_score: number | null;
  daily_activity: Array<{
    date: string;
    count: number;
  }>;
  top_verbs: Array<{
    verb: string;
    count: number;
  }>;
  activity_types: Array<{
    type: string;
    count: number;
  }>;
}

export interface AnalyticsData {
  platformOverview: PlatformMetrics;
  healthStatus: {
    faststream: { success: boolean; status: string; system: string; architecture: string };
    elasticsearch: { success: boolean };
    analytics_system: string;
    migration_status?: string;
  };
  trends: {
    daily_activity: Array<{
      date: string;
      count: number;
    }>;
    summary: {
      total_statements: number;
      unique_learners: number;
      completion_rate: number;
      average_score: number | null;
    };
  };
}

export const useAnalyticsData = (timePeriod: string) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel using apiClient
      const [overviewResponse, healthResponse, trendsResponse] = await Promise.all([
        apiClient.get('/api/analytics/overview'),
        apiClient.get('/api/analytics/health'),
        apiClient.get(`/api/analytics/trends?period=${timePeriod}&metric=activity`)
      ]);

      // Extract data from axios responses
      const [overviewData, healthData, trendsData] = [
        overviewResponse.data,
        healthResponse.data,
        trendsResponse.data
      ];

      setData({
        platformOverview: overviewData.data,
        healthStatus: healthData,
        trends: trendsData.data
      });
      setLastRefresh(new Date());
      
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    refetch: fetchData,
  };
};