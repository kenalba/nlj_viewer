/**
 * User Management API calls
 */

import { apiClient } from './client';
import { type User, type RegisterRequest } from './auth';

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface UserFilters {
  role?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  role?: 'creator' | 'reviewer' | 'approver' | 'admin';
  is_active?: boolean;
}

// User management API functions
export const usersAPI = {
  async getUsers(filters?: UserFilters): Promise<UserListResponse> {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());

    const response = await apiClient.get(`/api/users/?${params.toString()}`);
    return response.data;
  },

  async getUser(userId: string): Promise<User> {
    const response = await apiClient.get(`/api/users/${userId}`);
    return response.data;
  },

  async createUser(userData: RegisterRequest): Promise<User> {
    const response = await apiClient.post('/api/users/', userData);
    return response.data;
  },

  async updateUser(userId: string, userData: UserUpdate): Promise<User> {
    const response = await apiClient.put(`/api/users/${userId}`, userData);
    return response.data;
  },

  async activateUser(userId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/users/${userId}/activate`);
    return response.data;
  },

  async deactivateUser(userId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/users/${userId}/deactivate`);
    return response.data;
  },

  async getRoles(): Promise<string[]> {
    const response = await apiClient.get('/api/users/roles/');
    return response.data;
  },
};