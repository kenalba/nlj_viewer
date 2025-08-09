/**
 * API client for public activity sharing functionality.
 * Handles creating, managing, and accessing shared activities.
 */

import { apiClient } from './client';
import type { ContentItem } from './content';

// API Response Types
export interface SharedToken {
  id: string;
  content_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  access_count: number;
  last_accessed_at?: string;
  description?: string;
  is_expired: boolean;
  is_valid: boolean;
  public_url: string;
  qr_code_url?: string;
}

export interface PublicActivity {
  id: string;
  title: string;
  description?: string;
  content_type: string;
  nlj_data: any; // NLJ scenario data
  created_at: string;
  view_count: number;
  completion_count: number;
}

export interface ShareAnalytics {
  total_shares: number;
  total_public_views: number;
  total_public_completions: number;
  last_shared_at?: string;
  most_recent_access?: string;
}

export interface CreateShareRequest {
  description?: string;
  expires_at?: string; // ISO 8601 datetime
}

export interface CreateShareResponse {
  success: boolean;
  token: SharedToken;
  public_url: string;
  message: string;
}

export interface UpdateShareRequest {
  description?: string;
  expires_at?: string;
  is_active?: boolean;
}

// API Client
export const sharingApi = {
  /**
   * Create a public share for an activity
   */
  async createShare(contentId: string, request: CreateShareRequest): Promise<CreateShareResponse> {
    const response = await apiClient.post<CreateShareResponse>(`/api/content/${contentId}/share`, request);
    return response.data;
  },

  /**
   * Get all shares for a specific content item
   */
  async getContentShares(contentId: string): Promise<SharedToken[]> {
    const response = await apiClient.get<SharedToken[]>(`/api/content/${contentId}/shares`);
    return response.data;
  },

  /**
   * Get sharing analytics for content
   */
  async getShareAnalytics(contentId: string): Promise<ShareAnalytics> {
    const response = await apiClient.get<ShareAnalytics>(`/api/content/${contentId}/share-analytics`);
    return response.data;
  },

  /**
   * Update a share token
   */
  async updateShare(tokenId: string, request: UpdateShareRequest): Promise<SharedToken> {
    const response = await apiClient.put<SharedToken>(`/api/content/shares/${tokenId}`, request);
    return response.data;
  },

  /**
   * Revoke a share token
   */
  async revokeShare(tokenId: string): Promise<void> {
    await apiClient.delete(`/api/content/shares/${tokenId}`);
  },

  /**
   * Get all shares created by the current user
   */
  async getUserShares(): Promise<SharedToken[]> {
    const response = await apiClient.get<SharedToken[]>(`/api/content/my-shares`);
    return response.data;
  },

  // Public API endpoints (no authentication required)

  /**
   * Get shared activity data via public token (no auth required)
   */
  async getSharedActivity(token: string): Promise<PublicActivity> {
    // Use nginx proxy for production, direct backend for development
    const isProduction = window.location.hostname !== 'localhost';
    const apiUrl = isProduction 
      ? `/api/shared/${token}`  // Use nginx proxy in production
      : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/shared/${token}`;
      
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Shared activity not found or access expired');
      }
      throw new Error(`Failed to load shared activity: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Record completion of a publicly accessed activity
   */
  async recordPublicCompletion(token: string): Promise<void> {
    // Use nginx proxy for production, direct backend for development
    const isProduction = window.location.hostname !== 'localhost';
    const apiUrl = isProduction 
      ? `/api/shared/${token}/complete`  // Use nginx proxy in production
      : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/shared/${token}/complete`;
      
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to record completion: ${response.statusText}`);
    }
  },

  /**
   * Check health of public sharing system
   */
  async checkPublicHealth(): Promise<{ status: string; service: string }> {
    // Use nginx proxy for production, direct backend for development
    const isProduction = window.location.hostname !== 'localhost';
    const apiUrl = isProduction 
      ? `/api/shared/health`  // Use nginx proxy in production
      : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/shared/health`;
      
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Public sharing service unavailable');
    }

    return response.json();
  },
};

// Utility functions

/**
 * Generate QR code data URL for a share URL
 */
export async function generateQRCode(url: string, options?: {
  width?: number;
  margin?: number;
  color?: { dark?: string; light?: string };
}): Promise<string> {
  // Dynamic import of QRCode library
  const QRCode = await import('qrcode');
  
  const qrOptions = {
    width: options?.width || 300,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#FFFFFF',
    },
  };

  return QRCode.default.toDataURL(url, qrOptions);
}

/**
 * Check if a content item can be shared publicly
 */
export function canShareContent(content: ContentItem): boolean {
  // Allow sharing of any content (draft, published, etc.)
  // Users should be able to share their work for feedback/testing
  return true;
}

/**
 * Format share analytics for display
 */
export function formatShareAnalytics(analytics: ShareAnalytics): {
  totalShares: string;
  totalViews: string;
  totalCompletions: string;
  completionRate: string;
  lastActivity: string;
} {
  const completionRate = analytics.total_public_views > 0 
    ? Math.round((analytics.total_public_completions / analytics.total_public_views) * 100)
    : 0;

  const lastActivity = analytics.most_recent_access || analytics.last_shared_at;
  const lastActivityFormatted = lastActivity 
    ? new Date(lastActivity).toLocaleDateString()
    : 'Never';

  return {
    totalShares: analytics.total_shares.toString(),
    totalViews: analytics.total_public_views.toString(),
    totalCompletions: analytics.total_public_completions.toString(),
    completionRate: `${completionRate}%`,
    lastActivity: lastActivityFormatted,
  };
}

/**
 * Validate share expiration date
 */
export function validateExpirationDate(date: string): string | null {
  const expDate = new Date(date);
  const now = new Date();
  
  if (isNaN(expDate.getTime())) {
    return 'Invalid date format';
  }
  
  if (expDate <= now) {
    return 'Expiration date must be in the future';
  }
  
  return null;
}