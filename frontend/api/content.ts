/**
 * Content API Client
 * Handles API calls to the content management endpoints
 */

import { apiClient } from './client';

export interface ContentItem {
  id: string;
  title: string;
  description?: string | null;
  content_type: 'training' | 'survey' | 'assessment' | 'game' | 'mixed';
  learning_style?: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing' | null;
  state: 'draft' | 'submitted' | 'in_review' | 'approved' | 'published' | 'rejected' | 'archived';
  is_template: boolean;
  template_category?: string | null;
  view_count: number;
  completion_count: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  nlj_data: any;
  created_by?: string;
}

export interface ContentListResponse {
  items: ContentItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ContentFilters {
  content_type?: string;
  learning_style?: string;
  template_category?: string;
  is_template?: boolean;
  state?: string;
  search?: string;
  sort_by?: 'title' | 'created_at' | 'view_count' | 'completion_count';
  sort_order?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface ContentCreate {
  title: string;
  description: string;
  nlj_data: any;
  content_type: 'training' | 'survey' | 'assessment' | 'game' | 'mixed';
  learning_style: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  is_template?: boolean;
  template_category?: string;
  parent_content_id?: string;
}

export interface ContentUpdate {
  title?: string;
  description?: string;
  nlj_data?: any;
  content_type?: 'training' | 'survey' | 'assessment' | 'game' | 'mixed';
  learning_style?: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  is_template?: boolean;
  template_category?: string;
}

export const contentApi = {
  // List content with filters
  async list(filters: ContentFilters = {}): Promise<ContentListResponse> {
    const params = new URLSearchParams();
    
    if (filters.content_type) params.append('content_type', filters.content_type);
    if (filters.learning_style) params.append('learning_style', filters.learning_style);
    if (filters.template_category) params.append('template_category', filters.template_category);
    if (filters.is_template !== undefined) params.append('is_template', filters.is_template.toString());
    if (filters.state) params.append('state', filters.state);
    if (filters.search) params.append('search', filters.search);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.size) params.append('size', filters.size.toString());

    const response = await apiClient.get(`/api/content/?${params.toString()}`);
    return response.data;
  },

  // Get single content item
  async get(id: string): Promise<ContentItem> {
    const response = await apiClient.get(`/api/content/${id}`);
    return response.data;
  },

  // Create new content
  async create(data: ContentCreate): Promise<ContentItem> {
    const response = await apiClient.post('/api/content/', data);
    return response.data;
  },

  // Update existing content
  async update(id: string, data: ContentUpdate): Promise<ContentItem> {
    const response = await apiClient.put(`/api/content/${id}`, data);
    return response.data;
  },

  // Delete content
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/content/${id}`);
  },

  // Get content statistics for dashboard
  async getStats(): Promise<{
    total: number;
    by_type: Record<string, number>;
    by_state: Record<string, number>;
    recent_count: number;
  }> {
    try {
      // Get all published content for stats
      const response = await this.list({ 
        state: 'published', 
        size: 1000 
      });
      
      const stats = {
        total: response.total,
        by_type: {} as Record<string, number>,
        by_state: { published: response.total },
        recent_count: response.items.filter(item => {
          const daysSinceCreated = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceCreated <= 7;
        }).length
      };

      // Count by type
      response.items.forEach(item => {
        stats.by_type[item.content_type] = (stats.by_type[item.content_type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get content stats:', error);
      return {
        total: 0,
        by_type: {},
        by_state: { published: 0 },
        recent_count: 0
      };
    }
  }
};

export default contentApi;