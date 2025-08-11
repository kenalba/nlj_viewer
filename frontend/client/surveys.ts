/**
 * Survey Analytics API Client
 * Handles API calls to survey-specific analytics endpoints
 */

import { apiClient } from './client';

// ============================================================================
// SURVEY STATISTICS TYPES
// ============================================================================

export interface SurveyStats {
  total_questions: number;
  total_responses: number;
  unique_respondents: number;
  completion_rate: number;
  average_completion_time: number;
  last_response_at?: string;
  response_distribution: {
    responses: number;
    completions: number;
    partial: number;
  };
}

export interface SurveyStatsResponse {
  success: boolean;
  data: SurveyStats;
  filters: {
    survey_id: string;
    since?: string;
  };
  generated_at: string;
}

// ============================================================================
// SURVEY LINKS TYPES
// ============================================================================

export interface SurveyLink {
  id: string;
  token: string;
  url: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  views: number;
  completions: number;
  description?: string;
}

export interface SurveyLinksResponse {
  success: boolean;
  data: {
    links: SurveyLink[];
    total: number;
    active_links: number;
  };
  survey_id: string;
  generated_at: string;
}

export interface CreateSurveyLinkRequest {
  description?: string;
  expires_at?: string; // ISO 8601 format
}

export interface CreateSurveyLinkResponse {
  success: boolean;
  data: SurveyLink;
  generated_at: string;
}

// ============================================================================
// SURVEY RESPONSES TYPES
// ============================================================================

export interface SurveyResponse {
  statement_id: string;
  respondent_id: string;
  question_id: string;
  response_value: any;
  timestamp: string;
  raw_score?: number;
  success?: boolean;
  follow_up_response?: string;
  question_type?: string;
}

export interface SurveyResponsesResponse {
  success: boolean;
  data: {
    responses: SurveyResponse[];
    total: number;
    survey_id: string;
  };
  filters: {
    since?: string;
    limit: number;
  };
  generated_at: string;
}

// ============================================================================
// SURVEY INSIGHTS TYPES
// ============================================================================

export interface SurveyInsights {
  sentiment_analysis: {
    overall_sentiment: string;
    sentiment_distribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
    key_themes: string[];
  };
  response_patterns: {
    completion_funnel: number[];
    question_difficulty: {
      easy: number;
      medium: number;
      hard: number;
    };
  };
  recommendations: string[];
}

export interface SurveyInsightsResponse {
  success: boolean;
  data: SurveyInsights;
  survey_id: string;
  note?: string;
  generated_at: string;
}

// ============================================================================
// API CLIENT
// ============================================================================

export const surveysApi = {
  // Get comprehensive survey statistics
  async getStats(surveyId: string, since?: string): Promise<SurveyStatsResponse> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    
    const response = await apiClient.get(`/api/surveys/${surveyId}/stats?${params.toString()}`);
    return response.data;
  },

  // Get all share links for a survey
  async getLinks(surveyId: string): Promise<SurveyLinksResponse> {
    const response = await apiClient.get(`/api/surveys/${surveyId}/links`);
    return response.data;
  },

  // Create a new share link for a survey
  async createLink(surveyId: string, data: CreateSurveyLinkRequest): Promise<CreateSurveyLinkResponse> {
    const response = await apiClient.post(`/api/surveys/${surveyId}/links`, data);
    return response.data;
  },

  // Revoke a share link
  async revokeLink(surveyId: string, tokenId: string): Promise<{ success: boolean; message: string; token_id: string; revoked_at: string }> {
    const response = await apiClient.delete(`/api/surveys/${surveyId}/links/${tokenId}`);
    return response.data;
  },

  // Get survey responses with follow-up text
  async getResponses(
    surveyId: string, 
    options: {
      since?: string;
      limit?: number;
    } = {}
  ): Promise<SurveyResponsesResponse> {
    const params = new URLSearchParams();
    if (options.since) params.append('since', options.since);
    if (options.limit) params.append('limit', options.limit.toString());
    
    const response = await apiClient.get(`/api/surveys/${surveyId}/responses?${params.toString()}`);
    return response.data;
  },

  // Get AI-generated survey insights (placeholder)
  async getInsights(surveyId: string): Promise<SurveyInsightsResponse> {
    const response = await apiClient.get(`/api/surveys/${surveyId}/insights`);
    return response.data;
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format completion rate as percentage string
 */
export const formatCompletionRate = (rate: number): string => {
  return `${rate.toFixed(1)}%`;
};

/**
 * Format completion time in human-readable format
 */
export const formatCompletionTime = (minutes: number): string => {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  } else if (minutes < 60) {
    return `${minutes.toFixed(1)}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  }
};

/**
 * Calculate response rate from survey statistics
 */
export const calculateResponseRate = (stats: SurveyStats): number => {
  if (stats.unique_respondents === 0) return 0;
  return (stats.total_responses / (stats.unique_respondents * stats.total_questions)) * 100;
};

/**
 * Check if a survey link is expired
 */
export const isLinkExpired = (link: SurveyLink): boolean => {
  if (!link.expires_at) return false;
  return new Date(link.expires_at) < new Date();
};

/**
 * Get link status display text
 */
export const getLinkStatus = (link: SurveyLink): { text: string; color: 'success' | 'warning' | 'error' } => {
  if (!link.is_active) {
    return { text: 'Revoked', color: 'error' };
  }
  
  if (isLinkExpired(link)) {
    return { text: 'Expired', color: 'warning' };
  }
  
  return { text: 'Active', color: 'success' };
};

/**
 * Format survey response timestamp
 */
export const formatResponseTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Extract question type display name
 */
export const getQuestionTypeDisplayName = (questionType?: string): string => {
  const typeMap: Record<string, string> = {
    'likert': 'Likert Scale',
    'rating': 'Rating',
    'matrix': 'Matrix',
    'slider': 'Slider',
    'text_area': 'Text Area',
    'multiple_choice': 'Multiple Choice',
    'true_false': 'True/False',
  };
  
  return typeMap[questionType || ''] || questionType || 'Survey Question';
};

/**
 * Generate QR code data URL for survey link (placeholder)
 */
export const generateQRCode = async (url: string): Promise<string> => {
  // TODO: Implement actual QR code generation
  // For now, return a placeholder
  console.log('TODO: Generate QR code for URL:', url);
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwcHgiPkRSIENvZGU8L3RleHQ+PC9zdmc+';
};