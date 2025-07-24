/**
 * Standalone xAPI (Experience API) Types and Interfaces
 * 
 * This module provides TypeScript interfaces for the xAPI specification
 * and can be used independently in other projects.
 * 
 * Based on xAPI Specification 1.0.3
 * https://github.com/adlnet/xAPI-Spec
 */

// ============================================================================
// Core xAPI Types
// ============================================================================

/**
 * xAPI Statement - Core data structure for tracking learning experiences
 */
export interface XAPIStatement {
  id?: string;
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp?: string; // ISO 8601 timestamp
  stored?: string; // ISO 8601 timestamp
  authority?: XAPIActor;
  version?: string;
  attachments?: XAPIAttachment[];
}

/**
 * Actor - Who performed the activity
 */
export interface XAPIActor {
  objectType?: 'Agent' | 'Group';
  name?: string;
  mbox?: string; // mailto:email@example.com
  mbox_sha1sum?: string;
  openid?: string;
  account?: XAPIAccount;
  member?: XAPIActor[]; // For groups
}

export interface XAPIAccount {
  homePage: string;
  name: string;
}

/**
 * Verb - What action was performed
 */
export interface XAPIVerb {
  id: string; // IRI
  display: XAPILanguageMap;
}

/**
 * Object - What the activity was performed on
 */
export interface XAPIObject {
  objectType?: 'Activity' | 'Agent' | 'Group' | 'SubStatement' | 'StatementRef';
  id?: string; // IRI for activities
  definition?: XAPIActivityDefinition;
  // Additional properties for non-Activity objects
  actor?: XAPIActor;
  verb?: XAPIVerb;
  object?: XAPIObject;
}

export interface XAPIActivityDefinition {
  name?: XAPILanguageMap;
  description?: XAPILanguageMap;
  type?: string; // IRI
  moreInfo?: string; // IRI
  interactionType?: XAPIInteractionType;
  correctResponsesPattern?: string[];
  choices?: XAPIInteractionComponent[];
  scale?: XAPIInteractionComponent[];
  source?: XAPIInteractionComponent[];
  target?: XAPIInteractionComponent[];
  steps?: XAPIInteractionComponent[];
  extensions?: XAPIExtensions;
}

export interface XAPIInteractionComponent {
  id: string;
  description?: XAPILanguageMap;
}

export type XAPIInteractionType = 
  | 'true-false'
  | 'choice'
  | 'fill-in'
  | 'long-fill-in'
  | 'matching'
  | 'performance'
  | 'sequencing'
  | 'likert'
  | 'numeric'
  | 'other';

/**
 * Result - Outcome of the activity
 */
export interface XAPIResult {
  score?: XAPIScore;
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string; // ISO 8601 duration
  extensions?: XAPIExtensions;
}

export interface XAPIScore {
  scaled?: number; // -1 to 1
  raw?: number;
  min?: number;
  max?: number;
}

/**
 * Context - Additional context for the statement
 */
export interface XAPIContext {
  registration?: string; // UUID
  instructor?: XAPIActor;
  team?: XAPIActor;
  contextActivities?: XAPIContextActivities;
  revision?: string;
  platform?: string;
  language?: string; // RFC 5646 Language Tag
  statement?: XAPIStatementRef;
  extensions?: XAPIExtensions;
}

export interface XAPIContextActivities {
  parent?: XAPIObject[];
  grouping?: XAPIObject[];
  category?: XAPIObject[];
  other?: XAPIObject[];
}

export interface XAPIStatementRef {
  objectType: 'StatementRef';
  id: string; // UUID
}

export interface XAPIAttachment {
  usageType: string; // IRI
  display: XAPILanguageMap;
  description?: XAPILanguageMap;
  contentType: string; // MIME type
  length: number;
  sha2: string;
  fileUrl?: string; // IRI
}

// ============================================================================
// Utility Types
// ============================================================================

export interface XAPILanguageMap {
  [languageTag: string]: string;
}

export interface XAPIExtensions {
  [iri: string]: unknown;
}

// ============================================================================
// Common xAPI Verbs (predefined for convenience)
// ============================================================================

export const XAPI_VERBS = {
  // Core verbs
  EXPERIENCED: {
    id: 'http://adlnet.gov/expapi/verbs/experienced',
    display: { 'en-US': 'experienced' }
  },
  COMPLETED: {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'en-US': 'completed' }
  },
  PASSED: {
    id: 'http://adlnet.gov/expapi/verbs/passed',
    display: { 'en-US': 'passed' }
  },
  FAILED: {
    id: 'http://adlnet.gov/expapi/verbs/failed',
    display: { 'en-US': 'failed' }
  },
  ANSWERED: {
    id: 'http://adlnet.gov/expapi/verbs/answered',
    display: { 'en-US': 'answered' }
  },
  ASKED: {
    id: 'http://adlnet.gov/expapi/verbs/asked',
    display: { 'en-US': 'asked' }
  },
  ATTEMPTED: {
    id: 'http://adlnet.gov/expapi/verbs/attempted',
    display: { 'en-US': 'attempted' }
  },
  ATTENDED: {
    id: 'http://adlnet.gov/expapi/verbs/attended',
    display: { 'en-US': 'attended' }
  },
  COMMENTED: {
    id: 'http://adlnet.gov/expapi/verbs/commented',
    display: { 'en-US': 'commented' }
  },
  EXITED: {
    id: 'http://adlnet.gov/expapi/verbs/exited',
    display: { 'en-US': 'exited' }
  },
  IMPORTED: {
    id: 'http://adlnet.gov/expapi/verbs/imported',
    display: { 'en-US': 'imported' }
  },
  INITIALIZED: {
    id: 'http://adlnet.gov/expapi/verbs/initialized',
    display: { 'en-US': 'initialized' }
  },
  INTERACTED: {
    id: 'http://adlnet.gov/expapi/verbs/interacted',
    display: { 'en-US': 'interacted' }
  },
  LAUNCHED: {
    id: 'http://adlnet.gov/expapi/verbs/launched',
    display: { 'en-US': 'launched' }
  },
  MASTERED: {
    id: 'http://adlnet.gov/expapi/verbs/mastered',
    display: { 'en-US': 'mastered' }
  },
  PREFERRED: {
    id: 'http://adlnet.gov/expapi/verbs/preferred',
    display: { 'en-US': 'preferred' }
  },
  PROGRESSED: {
    id: 'http://adlnet.gov/expapi/verbs/progressed',
    display: { 'en-US': 'progressed' }
  },
  REGISTERED: {
    id: 'http://adlnet.gov/expapi/verbs/registered',
    display: { 'en-US': 'registered' }
  },
  RESPONDED: {
    id: 'http://adlnet.gov/expapi/verbs/responded',
    display: { 'en-US': 'responded' }
  },
  RESUMED: {
    id: 'http://adlnet.gov/expapi/verbs/resumed',
    display: { 'en-US': 'resumed' }
  },
  SCORED: {
    id: 'http://adlnet.gov/expapi/verbs/scored',
    display: { 'en-US': 'scored' }
  },
  SHARED: {
    id: 'http://adlnet.gov/expapi/verbs/shared',
    display: { 'en-US': 'shared' }
  },
  SUSPENDED: {
    id: 'http://adlnet.gov/expapi/verbs/suspended',
    display: { 'en-US': 'suspended' }
  },
  TERMINATED: {
    id: 'http://adlnet.gov/expapi/verbs/terminated',
    display: { 'en-US': 'terminated' }
  },
  VOIDED: {
    id: 'http://adlnet.gov/expapi/verbs/voided',
    display: { 'en-US': 'voided' }
  },
  // Connections game specific verbs
  CONNECTED: {
    id: 'http://nlj-viewer.com/xapi/verbs/connected',
    display: { 'en-US': 'connected' }
  },
  GROUPED: {
    id: 'http://nlj-viewer.com/xapi/verbs/grouped',
    display: { 'en-US': 'grouped' }
  },
  MISTAKEN: {
    id: 'http://nlj-viewer.com/xapi/verbs/mistaken',
    display: { 'en-US': 'mistaken' }
  },
  // Wordle game specific verbs
  GUESSED: {
    id: 'http://nlj-viewer.com/xapi/verbs/guessed',
    display: { 'en-US': 'guessed' }
  },
  HINTED: {
    id: 'http://nlj-viewer.com/xapi/verbs/hinted',
    display: { 'en-US': 'hinted' }
  },
  
  // Extended verbs for surveys and assessments
  SUBMITTED: {
    id: 'http://id.tincanapi.com/verb/submitted',
    display: { 'en-US': 'submitted' }
  },
  SKIPPED: {
    id: 'http://id.tincanapi.com/verb/skipped',
    display: { 'en-US': 'skipped' }
  },
  REVIEWED: {
    id: 'http://id.tincanapi.com/verb/reviewed',
    display: { 'en-US': 'reviewed' }
  },
  ABANDONED: {
    id: 'http://id.tincanapi.com/verb/abandoned',
    display: { 'en-US': 'abandoned' }
  }
} as const;

// ============================================================================
// Common Activity Types
// ============================================================================

export const XAPI_ACTIVITY_TYPES = {
  COURSE: 'http://adlnet.gov/expapi/activities/course',
  LESSON: 'http://adlnet.gov/expapi/activities/lesson',
  ASSESSMENT: 'http://adlnet.gov/expapi/activities/assessment',
  QUESTION: 'http://adlnet.gov/expapi/activities/question',
  SIMULATION: 'http://adlnet.gov/expapi/activities/simulation',
  INTERACTION: 'http://adlnet.gov/expapi/activities/cmi.interaction',
  SURVEY: 'http://id.tincanapi.com/activitytype/survey',
  MODULE: 'http://adlnet.gov/expapi/activities/module',
  OBJECTIVE: 'http://adlnet.gov/expapi/activities/objective',
  PERFORMANCE: 'http://adlnet.gov/expapi/activities/performance',
  MEDIA: 'http://adlnet.gov/expapi/activities/media',
  MEETING: 'http://adlnet.gov/expapi/activities/meeting',
  DISCUSSION: 'http://id.tincanapi.com/activitytype/discussion',
  FEEDBACK: 'http://id.tincanapi.com/activitytype/feedback'
} as const;

// ============================================================================
// Statement Builder Helper Types
// ============================================================================

export interface XAPIStatementBuilder {
  statement: Partial<XAPIStatement>;
  setActor(actor: XAPIActor): XAPIStatementBuilder;
  setVerb(verb: XAPIVerb): XAPIStatementBuilder;
  setObject(object: XAPIObject): XAPIStatementBuilder;
  setResult(result: XAPIResult): XAPIStatementBuilder;
  setContext(context: XAPIContext): XAPIStatementBuilder;
  setTimestamp(timestamp?: string): XAPIStatementBuilder;
  build(): XAPIStatement;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface XAPIValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface XAPIValidationResult {
  valid: boolean;
  errors: XAPIValidationError[];
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface XAPIConfig {
  endpoint?: string;
  username?: string;
  password?: string;
  version?: string;
  actor?: XAPIActor;
  platform?: string;
  language?: string;
  extensions?: XAPIExtensions;
}

// ============================================================================
// Event Types for Learning Activities
// ============================================================================

export interface LearningActivityEvent {
  type: 'launched' | 'completed' | 'passed' | 'failed' | 'suspended' | 'resumed' | 'answered' | 'responded' | 'skipped' | 'abandoned';
  activityId: string;
  activityName: string;
  activityType: string;
  actor: XAPIActor;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp?: string;
  extensions?: XAPIExtensions;
}

export interface QuestionEvent extends LearningActivityEvent {
  type: 'answered' | 'skipped';
  questionId: string;
  questionType: string;
  response?: string;
  isCorrect?: boolean;
  timeSpent?: number;
  attempts?: number;
}

export interface SurveyEvent extends LearningActivityEvent {
  type: 'responded' | 'skipped' | 'completed' | 'abandoned';
  surveyId: string;
  surveyType: string;
  anonymous?: boolean;
  sectionId?: string;
}

export interface GameEvent {
  type: string;
  activityId: string;
  activityName: string;
  activityType: string;
  actor: XAPIActor;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp?: string;
  extensions?: XAPIExtensions;
}

export interface ConnectionsEvent extends GameEvent {
  type: 'game_started' | 'group_found' | 'mistake_made' | 'game_completed' | 'game_failed';
  gameId: string;
  gameTitle: string;
  groupsFound?: number;
  totalGroups?: number;
  mistakes?: number;
  maxMistakes?: number;
  foundGroup?: {
    category: string;
    words: string[];
    difficulty: 'yellow' | 'green' | 'blue' | 'purple';
  };
  timeSpent?: number;
  finalScore?: number;
}

export interface WordleEvent extends GameEvent {
  type: 'game_started' | 'guess_made' | 'word_guessed' | 'hint_used' | 'game_completed' | 'game_failed';
  gameId: string;
  gameTitle: string;
  currentGuess?: string;
  guessNumber?: number;
  totalGuesses?: number;
  maxAttempts?: number;
  wordLength?: number;
  hardMode?: boolean;
  feedback?: Array<'correct' | 'present' | 'absent'>;
  hintsUsed?: number;
  timeSpent?: number;
  finalScore?: number;
}