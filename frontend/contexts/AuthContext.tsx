/**
 * Authentication Context
 * Manages user authentication state, JWT tokens, and auth-related operations
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authAPI, type User, type LoginRequest, type RegisterRequest, type PasswordChangeRequest } from '../client/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<RegisterRequest>) => Promise<void>;
  changePassword: (passwordData: PasswordChangeRequest) => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Proactive token refresh
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      const token = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (token && refreshToken && state.isAuthenticated) {
        try {
          // Attempt to refresh token proactively
          await authAPI.refreshToken();
          console.log('Token refreshed proactively');
        } catch (error) {
          console.log('Proactive token refresh failed:', error);
          // Don't logout here - let the API interceptor handle it
        }
      }
    }, 10 * 60 * 1000); // Refresh every 10 minutes

    return () => clearInterval(refreshInterval);
  }, [state.isAuthenticated]);

  // Handle automatic logout from API interceptor
  useEffect(() => {
    const handleAuthLogout = (event: CustomEvent) => {
      console.log('Auth logout event received:', event.detail);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      // Just clear the auth state - AppRouter will handle the redirect
    };

    window.addEventListener('auth:logout', handleAuthLogout as EventListener);
    
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout as EventListener);
    };
  }, []);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      const userStr = localStorage.getItem('user');

      if (token && userStr) {
        try {
          // Verify token is still valid
          await authAPI.verifyToken();
          const user = JSON.parse(userStr);
          
          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          // Token invalid, clear stored data
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } else {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authAPI.login(credentials);
      
      // Store token and user data
      localStorage.setItem('access_token', response.access_token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      localStorage.setItem('user', JSON.stringify(response.user));

      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.response?.data?.detail || 'Login failed',
      });
      throw error;
    }
  };

  const register = async (userData: RegisterRequest) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await authAPI.register(userData);
      setState(prev => ({ ...prev, isLoading: false, error: null }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || 'Registration failed',
      }));
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    // Call backend logout (for logging purposes)
    authAPI.logout().catch(console.error);
  };

  const updateProfile = async (userData: Partial<RegisterRequest>) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const updatedUser = await authAPI.updateProfile(userData);
      
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setState(prev => ({
        ...prev,
        user: updatedUser,
        isLoading: false,
        error: null,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || 'Profile update failed',
      }));
      throw error;
    }
  };

  const changePassword = async (passwordData: PasswordChangeRequest) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await authAPI.changePassword(passwordData);
      setState(prev => ({ ...prev, isLoading: false, error: null }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || 'Password change failed',
      }));
      throw error;
    }
  };

  const refreshUser = async () => {
    if (!state.isAuthenticated) return;

    try {
      const user = await authAPI.getCurrentUser();
      localStorage.setItem('user', JSON.stringify(user));
      setState(prev => ({ ...prev, user }));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    clearError,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};