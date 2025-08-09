/**
 * Training Components
 * Export all training-related components
 */

export { default as RegistrationModal } from './RegistrationModal';
export { default as TrainingSessionCard } from './TrainingSessionCard';
export { default as StatusIndicator } from './StatusIndicator';

// Re-export types from API
export type {
  TrainingSession,
  TrainingProgram,
  RegistrationRequest,
  Registration,
  EventResponse,
  BookingResponse,
  BookingStatusResponse,
} from '../../client/training';

// Re-export hooks
export { useStatusPolling, useBookingStatusPolling, useProgramStatusPolling } from '../../hooks/useStatusPolling';