/**
 * Node API service client for node management and analytics.
 * Handles CRUD operations, performance analytics, and content optimization.
 */

import { apiClient } from '../client/client';

export interface Node {
  id: string;
  node_type: string;
  content: Record<string, unknown>;
  content_hash?: string;
  concept_fingerprint?: string;
  title?: string;
  description?: string;
  difficulty_level?: number;
  avg_completion_time?: number;
  success_rate?: number;
  difficulty_score?: number;
  engagement_score?: number;
  current_version_id?: string;
  base_language: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NodeInteraction {
  id: string;
  node_id: string;
  user_id: string;
  activity_id?: string;
  session_id: string;
  response_data: Record<string, unknown>;
  is_correct?: boolean;
  score?: number;
  time_to_respond?: number;
  attempts: number;
  activity_session_id?: string;
  created_at: string;
}

export interface ActivityNode {
  id: string;
  activity_id: string;
  node_id: string;
  position: number;
  configuration_overrides?: Record<string, unknown>;
  created_at: string;
}

export interface NodePerformanceMetrics {
  node_info: {
    id: string;
    node_type: string;
    title?: string;
    description?: string;
    difficulty_level?: number;
    content_hash?: string;
    created_at?: string;
    updated_at?: string;
  };
  performance_metrics: {
    success_rate?: number;
    avg_completion_time_ms?: number;
    difficulty_score?: number;
    engagement_score?: number;
  };
  interaction_stats: {
    total_interactions: number;
    unique_users: number;
    avg_response_time_ms?: number;
    avg_score?: number;
    avg_attempts?: number;
    success_rate?: number;
  };
  activity_usage: {
    used_in_activities: number;
    total_interactions_across_activities: number;
    activities: Array<{
      activity_id: string;
      activity_title: string;
      position_in_activity: number;
      interactions: number;
    }>;
  };
  learning_concepts: {
    learning_objectives: Array<{
      id: string;
      text: string;
      domain?: string;
      cognitive_level?: string;
    }>;
    keywords: Array<{
      id: string;
      text: string;
      domain?: string;
      category?: string;
    }>;
    has_concepts: boolean;
  };
  elasticsearch_analytics?: Record<string, unknown>;
  generated_at: string;
}

export interface NodeComparison {
  nodes: Array<{
    id: string;
    node_type: string;
    title?: string;
    difficulty_level?: number;
    success_rate: number;
    avg_completion_time_ms: number;
    difficulty_score: number;
    engagement_score: number;
    total_interactions: number;
    unique_users: number;
    content?: Record<string, unknown>;
  }>;
  comparison_summary: {
    node_count: number;
    avg_success_rate: number;
    min_success_rate: number;
    max_success_rate: number;
    avg_completion_time_ms: number;
    fastest_completion_ms: number;
    slowest_completion_ms: number;
    best_performing_node?: unknown;
    most_engaging_node?: unknown;
  };
  generated_at: string;
}

export interface ActivityNodeAnalytics {
  activity_info: {
    id: string;
    title: string;
    total_nodes: number;
  };
  nodes: Array<{
    node_id: string;
    node_type: string;
    title?: string;
    position: number;
    difficulty_level?: number;
    success_rate?: number;
    avg_completion_time_ms?: number;
    activity_specific_stats: Record<string, unknown>;
    configuration_overrides?: Record<string, unknown>;
  }>;
  activity_analytics: Record<string, unknown>;
  generated_at: string;
}

export interface OptimizationSuggestion {
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendations: string[];
}

export interface ContentOptimization {
  node_id: string;
  suggestions: OptimizationSuggestion[];
  optimization_score: number;
  generated_at: string;
}

export interface TrendingNode {
  node_id: string;
  node_type: string;
  title?: string;
  overall_success_rate?: number;
  recent_interactions: number;
  unique_recent_users: number;
  recent_avg_score?: number;
  trend_score: number;
}

export interface TrendingNodes {
  time_window_days: number;
  trending_nodes: TrendingNode[];
  generated_at: string;
}

export interface NodesListParams {
  limit?: number;
  offset?: number;
  node_type?: string;
  search?: string;
  sort_by?: 'created_at' | 'updated_at' | 'success_rate' | 'usage_count';
  sort_order?: 'asc' | 'desc';
}

export interface NodesListResponse {
  items: Node[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get paginated list of nodes with filtering and sorting
 */
export const getNodes = async (params: NodesListParams = {}): Promise<NodesListResponse> => {
  const response = await apiClient.get('/api/nodes/', { params });
  return response.data;
};

/**
 * Get single node by ID
 */
export const getNode = async (nodeId: string): Promise<Node> => {
  const response = await apiClient.get(`/api/nodes/${nodeId}`);
  return response.data;
};

/**
 * Create new node
 */
export const createNode = async (nodeData: Omit<Node, 'id' | 'created_at' | 'updated_at'>): Promise<Node> => {
  const response = await apiClient.post('/api/nodes/', nodeData);
  return response.data;
};

/**
 * Update existing node
 */
export const updateNode = async (nodeId: string, nodeData: Partial<Node>): Promise<Node> => {
  const response = await apiClient.put(`/api/nodes/${nodeId}`, nodeData);
  return response.data;
};

/**
 * Delete node
 */
export const deleteNode = async (nodeId: string): Promise<void> => {
  await apiClient.delete(`/api/nodes/${nodeId}`);
};

/**
 * Get comprehensive node analytics summary
 */
export const getNodeAnalytics = async (nodeId: string): Promise<NodePerformanceMetrics> => {
  const response = await apiClient.get(`/api/nodes/${nodeId}/analytics`);
  return response.data;
};

/**
 * Compare performance metrics across multiple nodes
 */
export const compareNodes = async (
  nodeIds: string[], 
  includeContent: boolean = false
): Promise<NodeComparison> => {
  const response = await apiClient.post('/api/nodes/compare', {
    node_ids: nodeIds,
    include_content: includeContent
  });
  return response.data;
};

/**
 * Get analytics for all nodes within a specific activity
 */
export const getActivityNodeAnalytics = async (activityId: string): Promise<ActivityNodeAnalytics> => {
  const response = await apiClient.get(`/api/nodes/activities/${activityId}/analytics`);
  return response.data;
};

/**
 * Get AI-powered content optimization suggestions
 */
export const getOptimizationSuggestions = async (nodeId: string): Promise<ContentOptimization> => {
  const response = await apiClient.get(`/api/nodes/${nodeId}/optimize`);
  return response.data;
};

/**
 * Get trending nodes based on recent performance and usage
 */
export const getTrendingNodes = async (
  timeWindowDays: number = 7, 
  limit: number = 20
): Promise<TrendingNodes> => {
  const response = await apiClient.get('/api/nodes/trending', {
    params: { time_window_days: timeWindowDays, limit }
  });
  return response.data;
};

/**
 * Get node interactions for analytics
 */
export const getNodeInteractions = async (
  nodeId: string,
  params: {
    limit?: number;
    offset?: number;
    activity_id?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
  } = {}
): Promise<{
  items: NodeInteraction[];
  total: number;
  limit: number;
  offset: number;
}> => {
  const response = await apiClient.get(`/api/nodes/${nodeId}/interactions`, { params });
  return response.data;
};

/**
 * Get nodes by content hash for deduplication
 */
export const getNodesByContentHash = async (contentHash: string): Promise<Node[]> => {
  const response = await apiClient.get(`/api/nodes/by-hash/${contentHash}`);
  return response.data;
};

/**
 * Search nodes by content or metadata
 */
export const searchNodes = async (
  query: string,
  params: {
    node_types?: string[];
    min_success_rate?: number;
    max_difficulty?: number;
    limit?: number;
  } = {}
): Promise<NodesListResponse> => {
  const response = await apiClient.get('/api/nodes/search', {
    params: { q: query, ...params }
  });
  return response.data;
};

/**
 * Get node performance trends over time
 */
export const getNodePerformanceTrends = async (
  nodeId: string,
  timeRange: '7d' | '30d' | '90d' | '1y' = '30d'
): Promise<{
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
}> => {
  const response = await apiClient.get(`/api/nodes/${nodeId}/trends`, {
    params: { time_range: timeRange }
  });
  return response.data;
};

export default {
  getNodes,
  getNode,
  createNode,
  updateNode,
  deleteNode,
  getNodeAnalytics,
  compareNodes,
  getActivityNodeAnalytics,
  getOptimizationSuggestions,
  getTrendingNodes,
  getNodeInteractions,
  getNodesByContentHash,
  searchNodes,
  getNodePerformanceTrends,
};