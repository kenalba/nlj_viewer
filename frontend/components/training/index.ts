/**
 * Training Components
 * Export all training-related components
 */

export { default as RegistrationModal } from './RegistrationModal';
export { default as TrainingSessionCard } from './TrainingSessionCard';

// Re-export types from API
export type {
  TrainingSession,
  TrainingSessionCreate,
  TrainingInstance,
  AvailabilityInfo,
  RegistrationRequest,
  Registration,
} from '../../api/training';