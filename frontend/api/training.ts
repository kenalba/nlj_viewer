/**
 * Training Sessions and Registration API Client
 * Handles training session management and learner registration
 */

import { apiClient } from './client';

// Event-driven operation response types
export interface EventResponse {
  message: string;
  event_id: string;
  resource_id: string;
  status_endpoint?: string;
}

export interface BookingResponse {
  message: string;
  event_id: string;
  booking_id: string;
  session_id: string;
  status_endpoint: string;
}

export interface BookingStatusResponse {
  booking_id: string;
  status: 'processing' | 'confirmed' | 'waitlisted' | 'failed';
  message: string;
  waitlist_position?: number;
}

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
  session_id: string;
  registration_method?: string;
  special_requirements?: Record<string, any>;
  registration_notes?: string;
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

  // Create training program (event-driven)
  async create(programData: TrainingProgramCreate): Promise<EventResponse> {
    const response = await apiClient.post('/api/training-programs/', programData);
    return response.data;
  },

  // Poll for creation status
  async getStatus(programId: string): Promise<TrainingProgram> {
    const response = await apiClient.get(`/api/training-programs/${programId}`);
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

  // Create session for a program (event-driven)
  async createSession(programId: string, sessionData: {
    start_time: string;
    end_time: string;
    timezone?: string;
    location?: string;
    location_details?: Record<string, any>;
    capacity?: number;
    instructor_id?: string;
    session_notes?: string;
  }): Promise<EventResponse> {
    const response = await apiClient.post(`/api/training-programs/${programId}/sessions`, {
      program_id: programId,
      ...sessionData
    });
    return response.data;
  },
};

// Registration API
export const registrationAPI = {
  // Register for a session (event-driven)
  async register(registrationData: RegistrationRequest): Promise<BookingResponse> {
    const response = await apiClient.post('/api/training-registrations/register', registrationData);
    return response.data;
  },

  // Check booking status
  async getBookingStatus(bookingId: string): Promise<BookingStatusResponse> {
    const response = await apiClient.get(`/api/training-registrations/${bookingId}/status`);
    return response.data;
  },

  // Poll for registration confirmation (utility function)
  async pollBookingStatus(bookingId: string, maxAttempts: number = 20, intervalMs: number = 1000): Promise<BookingStatusResponse> {
    let attempts = 0;
    while (attempts < maxAttempts) {
      const status = await this.getBookingStatus(bookingId);
      if (status.status !== 'processing') {
        return status;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
    throw new Error('Registration status polling timeout');
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