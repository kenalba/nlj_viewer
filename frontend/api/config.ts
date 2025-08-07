/**
 * API Configuration
 * Shared configuration constants for API clients
 */

// Dev container should use the nlj-api service directly
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.NODE_ENV === 'development' ? 'http://nlj-api:8000' : '/api');