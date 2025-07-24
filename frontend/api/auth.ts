/**
 * Authentication API calls
 */

import { apiClient } from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role?: 'creator' | 'reviewer' | 'approver' | 'admin';
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'creator' | 'reviewer' | 'approver' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// Auth API functions
export const authAPI = {
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const response = await apiClient.post('/api/auth/login', credentials);
    return response.data;
  },

  async register(userData: RegisterRequest): Promise<User> {
    const response = await apiClient.post('/api/auth/register', userData);
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },

  async updateProfile(userData: Partial<RegisterRequest>): Promise<User> {
    const response = await apiClient.put('/api/auth/me', userData);
    return response.data;
  },

  async changePassword(passwordData: PasswordChangeRequest): Promise<{ message: string }> {
    const response = await apiClient.post('/api/auth/change-password', passwordData);
    return response.data;
  },

  async logout(): Promise<{ message: string }> {
    const response = await apiClient.post('/api/auth/logout');
    return response.data;
  },

  async verifyToken(): Promise<{ message: string; user_id: string; username: string }> {
    const response = await apiClient.get('/api/auth/verify-token');
    return response.data;
  },
};