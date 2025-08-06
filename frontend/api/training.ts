/**
 * Training Sessions and Registration API Client
 * Handles training session management and learner registration
 */

import { apiClient } from './client';

// Training Program Types (templates)
export interface TrainingProgram {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  prerequisites?: string[];
  content_items?: string[];
  learning_objectives?: string[];
  instructor_requirements?: Record<string, any>;
  requires_approval: boolean;
  auto_approve: boolean;
  is_active: boolean;
  is_published: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  total_sessions: number;
  upcoming_sessions: number;
  total_bookings: number;
}

export interface TrainingProgramCreate {
  title: string;
  description?: string;
  duration_minutes?: number;
  prerequisites?: string[];
  content_items?: string[];
  learning_objectives?: string[];
  instructor_requirements?: Record<string, any>;
  requires_approval?: boolean;
  auto_approve?: boolean;
  is_published?: boolean;
}

export interface TrainingSession {
  id: string;
  program_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location?: string;
  location_details?: Record<string, any>;
  capacity: number;
  instructor_id?: string;
  session_notes?: string;
  status: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  attendance_taken: boolean;
  attendance_taken_at?: string;
  created_at: string;
  updated_at: string;
  available_spots: number;
  total_bookings: number;
  confirmed_bookings: number;
  waitlist_count: number;
}

export interface AvailabilityInfo {
  program_id: string;
  program_title: string;
  available_sessions: TrainingSession[];
  total_capacity: number;
  remaining_spots: number;
  prerequisites_met: boolean;
  registration_status: 'available' | 'waitlist' | 'full' | 'not_eligible' | string;
}

export interface RegistrationRequest {
  program_id: string;
  session_id?: string;
  preferred_times?: string[];
  special_requirements?: string;
  emergency_contact?: string;
}

export interface Registration {
  id: string;
  program_id: string;
  session_id: string;
  learner_id: string;
  booking_status: string;
  registration_method: string;
  special_requirements?: Record<string, any>;
  waitlist_position?: number;
  confirmation_sent: boolean;
  registered_at: string;
  updated_at: string;
}

// Training Programs API
export const trainingProgramsAPI = {
  // List training programs
  async list(params?: {
    published_only?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<TrainingProgram[]> {
    const response = await apiClient.get('/api/training-programs/', { params });
    return response.data;
  },

  // Get training program details
  async get(programId: string): Promise<TrainingProgram> {
    const response = await apiClient.get(`/api/training-programs/${programId}`);
    return response.data;
  },

  // Create training program
  async create(programData: TrainingProgramCreate): Promise<TrainingProgram> {
    const response = await apiClient.post('/api/training-programs/', programData);
    return response.data;
  },

  // Update training program
  async update(programId: string, programData: Partial<TrainingProgramCreate>): Promise<TrainingProgram> {
    const response = await apiClient.put(`/api/training-programs/${programId}`, programData);
    return response.data;
  },

  // Delete training program
  async delete(programId: string): Promise<void> {
    await apiClient.delete(`/api/training-programs/${programId}`);
  },

  // Get sessions for a program
  async getSessions(programId: string, includePast: boolean = false): Promise<TrainingSession[]> {
    const response = await apiClient.get(`/api/training-programs/${programId}/sessions`, { 
      params: { include_past: includePast } 
    });
    return response.data;
  },

  // Create session for a program
  async createSession(programId: string, sessionData: {
    start_time: string;
    end_time: string;
    timezone?: string;
    location?: string;
    location_details?: Record<string, any>;
    capacity?: number;
    instructor_id?: string;
    session_notes?: string;
  }): Promise<TrainingSession> {
    const response = await apiClient.post(`/api/training-programs/${programId}/sessions`, {
      program_id: programId,
      ...sessionData
    });
    return response.data;
  },
};

// Registration API
export const registrationAPI = {
  // Check availability for a session
  async checkAvailability(sessionId: string): Promise<AvailabilityInfo> {
    const response = await apiClient.get(`/api/availability/${sessionId}`);
    return response.data;
  },

  // Register for a session
  async register(registrationData: RegistrationRequest): Promise<Registration> {
    const response = await apiClient.post('/api/register', registrationData);
    return response.data;
  },

  // Get user's registrations
  async getMyRegistrations(params?: {
    status_filter?: string;
    skip?: number;
    limit?: number;
  }): Promise<Registration[]> {
    const response = await apiClient.get('/api/my-registrations', { params });
    return response.data;
  },

  // Cancel registration
  async cancel(bookingId: string): Promise<void> {
    await apiClient.delete(`/api/registrations/${bookingId}`);
  },
};

// Training Sessions API
export const trainingSessionsAPI = {
  // List all training sessions
  async list(params?: {
    program_id?: string;
    include_past?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<TrainingSession[]> {
    const response = await apiClient.get('/api/training-sessions/', { params });
    return response.data;
  },

  // Get training session details
  async get(sessionId: string): Promise<TrainingSession> {
    const response = await apiClient.get(`/api/training-sessions/${sessionId}`);
    return response.data;
  },

  // Update training session
  async update(sessionId: string, sessionData: {
    start_time?: string;
    end_time?: string;
    timezone?: string;
    location?: string;
    location_details?: Record<string, any>;
    capacity?: number;
    instructor_id?: string;
    session_notes?: string;
    status?: string;
  }): Promise<TrainingSession> {
    const response = await apiClient.put(`/api/training-sessions/${sessionId}`, sessionData);
    return response.data;
  },

  // Cancel training session
  async cancel(sessionId: string, reason?: string): Promise<TrainingSession> {
    const response = await apiClient.post(`/api/training-sessions/${sessionId}/cancel`, {
      cancellation_reason: reason
    });
    return response.data;
  },

  // Delete training session
  async delete(sessionId: string): Promise<void> {
    await apiClient.delete(`/api/training-sessions/${sessionId}`);
  },
};

export default {
  programs: trainingProgramsAPI,
  sessions: trainingSessionsAPI,
  registrations: registrationAPI,
};