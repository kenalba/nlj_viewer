/**
 * API Client Configuration
 * Axios instance with authentication interceptors for NLJ Platform backend
 */

import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes for long-running operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  
  failedQueue = [];
};

// Response interceptor for error handling with token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh using current token (proactive refresh before expiry)
        const currentToken = localStorage.getItem('access_token');
        
        if (currentToken) {
          // Attempt token refresh - but this will fail if token is already expired
          // This is for proactive refresh only
          const response = await apiClient.post('/api/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${currentToken}` }
          });
          
          const { access_token } = response.data;
          
          // Update stored token
          localStorage.setItem('access_token', access_token);
          
          // Update default authorization header
          apiClient.defaults.headers.common.Authorization = `Bearer ${access_token}`;
          
          // Process queued requests
          processQueue(null, access_token);
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        } else {
          throw new Error('No token available');
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        console.log('Token refresh failed, logging out user');
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // Use custom event to notify auth context
        window.dispatchEvent(new CustomEvent('auth:logout', { 
          detail: 'Your session has expired. Please log in again.' 
        }));
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;