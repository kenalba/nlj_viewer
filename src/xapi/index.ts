/**
 * Standalone xAPI Module
 * 
 * A complete, reusable xAPI (Experience API) implementation that can be used
 * independently in other projects for tracking learning experiences.
 * 
 * Features:
 * - Full xAPI 1.0.3 specification compliance
 * - TypeScript types and interfaces
 * - Fluent statement builder API
 * - LRS client with offline support
 * - Validation and error handling
 * - Event-driven architecture
 * - Minimal dependencies
 * 
 * Usage:
 * ```typescript
 * import { createStatement, createActor, createActivity, XAPI_VERBS } from './xapi';
 * 
 * const statement = createStatement()
 *   .setActor(createActor({ name: 'John Doe', email: 'john@example.com' }))
 *   .setVerb(XAPI_VERBS.COMPLETED)
 *   .setObject(createActivity({ id: 'course-1', name: 'Introduction to xAPI' }))
 *   .build();
 * ```
 */

// ============================================================================
// Core Types and Interfaces
// ============================================================================

export {
  // Constants
  XAPI_VERBS,
  XAPI_ACTIVITY_TYPES
} from './types';

export type {
  // Core xAPI Types
  XAPIStatement,
  XAPIActor,
  XAPIVerb,
  XAPIObject,
  XAPIResult,
  XAPIScore,
  XAPIContext,
  XAPIActivityDefinition,
  XAPIInteractionType,
  XAPIInteractionComponent,
  XAPIContextActivities,
  XAPIStatementRef,
  XAPIAttachment,
  XAPIAccount,
  XAPILanguageMap,
  XAPIExtensions,
  
  // Builder Types
  XAPIStatementBuilder,
  XAPIValidationResult,
  XAPIValidationError,
  XAPIConfig,
  
  // Event Types
  LearningActivityEvent,
  QuestionEvent,
  SurveyEvent
} from './types';

// ============================================================================
// Statement Builder
// ============================================================================

export {
  StatementBuilder,
  createStatement,
  createActor,
  createActivity,
  createResult,
  createContext,
  eventToStatement,
  questionEventToStatement,
  surveyEventToStatement,
  validateStatement
} from './builder';

// ============================================================================
// LRS Client
// ============================================================================

export {
  XAPIClient,
  LocalStorageXAPIStorage,
  OfflineXAPIClient,
  createXAPIClient,
  createOfflineXAPIClient,
  createMockXAPIClient
} from './client';

export type {
  XAPIClientConfig,
  XAPIClientResponse,
  XAPIOfflineStorage
} from './client';

// ============================================================================
// Convenience Re-exports
// ============================================================================

import { createStatement, createActor, createActivity } from './builder';
import { XAPI_VERBS, XAPI_ACTIVITY_TYPES } from './types';

export const xapi = {
  // Factory functions
  createStatement,
  createActor,
  createActivity,
  
  // Constants
  verbs: XAPI_VERBS,
  activityTypes: XAPI_ACTIVITY_TYPES,
  
  // Common patterns
  createLearningStatement: (actor: any, verb: any, activity: any) => 
    createStatement().setActor(actor).setVerb(verb).setObject(activity),
    
  createQuestionStatement: (actor: any, questionId: string, response: string, isCorrect: boolean) =>
    createStatement()
      .setActor(actor)
      .setVerb(XAPI_VERBS.ANSWERED)
      .setObject(createActivity({ id: questionId, name: `Question ${questionId}` }))
      .setResult({ success: isCorrect, response }),
      
  createCompletionStatement: (actor: any, activityId: string, activityName: string, score?: number) =>
    createStatement()
      .setActor(actor)
      .setVerb(XAPI_VERBS.COMPLETED)
      .setObject(createActivity({ id: activityId, name: activityName }))
      .setResult({ completion: true, score: score ? { raw: score } : undefined })
};

// ============================================================================
// Package Information
// ============================================================================

export const XAPI_MODULE_INFO = {
  name: 'standalone-xapi',
  version: '1.0.0',
  description: 'Standalone xAPI (Experience API) implementation for tracking learning experiences',
  features: [
    'Full xAPI 1.0.3 specification compliance',
    'TypeScript types and interfaces',
    'Fluent statement builder API',
    'LRS client with offline support',
    'Validation and error handling',
    'Event-driven architecture',
    'Minimal dependencies'
  ],
  compatibility: {
    xapiVersion: '1.0.3',
    typescript: '>=4.0.0',
    environments: ['browser', 'node']
  }
};

// ============================================================================
// Default Export
// ============================================================================

export default xapi;