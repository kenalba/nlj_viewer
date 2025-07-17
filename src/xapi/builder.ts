/**
 * Standalone xAPI Statement Builder
 * 
 * Provides fluent interface for building xAPI statements with validation
 * Can be used independently in other projects
 */

import {
  XAPI_VERBS,
  XAPI_ACTIVITY_TYPES
} from './types';
import type {
  XAPIStatement,
  XAPIActor,
  XAPIVerb,
  XAPIObject,
  XAPIResult,
  XAPIContext,
  XAPIStatementBuilder,
  XAPIValidationResult,
  XAPIValidationError,
  LearningActivityEvent,
  QuestionEvent,
  SurveyEvent,
  ConnectionsEvent
} from './types';

// ============================================================================
// Statement Builder Implementation
// ============================================================================

export class StatementBuilder implements XAPIStatementBuilder {
  statement: Partial<XAPIStatement>;

  constructor() {
    this.statement = {
      id: this.generateUUID(),
      version: '1.0.3'
    };
  }

  setActor(actor: XAPIActor): XAPIStatementBuilder {
    this.statement.actor = actor;
    return this;
  }

  setVerb(verb: XAPIVerb): XAPIStatementBuilder {
    this.statement.verb = verb;
    return this;
  }

  setObject(object: XAPIObject): XAPIStatementBuilder {
    this.statement.object = object;
    return this;
  }

  setResult(result: XAPIResult): XAPIStatementBuilder {
    this.statement.result = result;
    return this;
  }

  setContext(context: XAPIContext): XAPIStatementBuilder {
    this.statement.context = context;
    return this;
  }

  setTimestamp(timestamp?: string): XAPIStatementBuilder {
    this.statement.timestamp = timestamp || new Date().toISOString();
    return this;
  }

  build(): XAPIStatement {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Invalid xAPI statement: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    return {
      ...this.statement,
      timestamp: this.statement.timestamp || new Date().toISOString()
    } as XAPIStatement;
  }

  private validate(): XAPIValidationResult {
    const errors: XAPIValidationError[] = [];

    // Required fields
    if (!this.statement.actor) {
      errors.push({ field: 'actor', message: 'Actor is required' });
    }
    if (!this.statement.verb) {
      errors.push({ field: 'verb', message: 'Verb is required' });
    }
    if (!this.statement.object) {
      errors.push({ field: 'object', message: 'Object is required' });
    }

    // Validate actor
    if (this.statement.actor && !this.isValidActor(this.statement.actor)) {
      errors.push({ field: 'actor', message: 'Actor must have at least one identifier (mbox, mbox_sha1sum, openid, or account)' });
    }

    // Validate verb
    if (this.statement.verb && !this.statement.verb.id) {
      errors.push({ field: 'verb.id', message: 'Verb ID is required' });
    }

    // Validate object
    if (this.statement.object && !this.statement.object.id) {
      errors.push({ field: 'object.id', message: 'Object ID is required' });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidActor(actor: XAPIActor): boolean {
    return !!(actor.mbox || actor.mbox_sha1sum || actor.openid || actor.account);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create a new statement builder
 */
export function createStatement(): XAPIStatementBuilder {
  return new StatementBuilder();
}

/**
 * Create an actor object
 */
export function createActor(config: {
  name?: string;
  email?: string;
  account?: { homePage: string; name: string };
}): XAPIActor {
  const actor: XAPIActor = {
    objectType: 'Agent'
  };

  if (config.name) {
    actor.name = config.name;
  }

  if (config.email) {
    actor.mbox = `mailto:${config.email}`;
  }

  if (config.account) {
    actor.account = config.account;
  }

  return actor;
}

/**
 * Create an activity object
 */
export function createActivity(config: {
  id: string;
  name: string;
  description?: string;
  type?: string;
  moreInfo?: string;
  extensions?: Record<string, unknown>;
}): XAPIObject {
  return {
    objectType: 'Activity',
    id: config.id,
    definition: {
      name: { 'en-US': config.name },
      description: config.description ? { 'en-US': config.description } : undefined,
      type: config.type || XAPI_ACTIVITY_TYPES.COURSE,
      moreInfo: config.moreInfo,
      extensions: config.extensions
    }
  };
}

/**
 * Create a result object
 */
export function createResult(config: {
  success?: boolean;
  completion?: boolean;
  response?: string;
  score?: {
    raw?: number;
    scaled?: number;
    min?: number;
    max?: number;
  };
  duration?: number; // in seconds
  extensions?: Record<string, unknown>;
}): XAPIResult {
  const result: XAPIResult = {};

  if (config.success !== undefined) {
    result.success = config.success;
  }

  if (config.completion !== undefined) {
    result.completion = config.completion;
  }

  if (config.response) {
    result.response = config.response;
  }

  if (config.score) {
    result.score = config.score;
  }

  if (config.duration) {
    result.duration = secondsToISO8601Duration(config.duration);
  }

  if (config.extensions) {
    result.extensions = config.extensions;
  }

  return result;
}

/**
 * Create a context object
 */
export function createContext(config: {
  registration?: string;
  platform?: string;
  language?: string;
  instructor?: XAPIActor;
  parentActivity?: XAPIObject;
  extensions?: Record<string, unknown>;
}): XAPIContext {
  const context: XAPIContext = {};

  if (config.registration) {
    context.registration = config.registration;
  }

  if (config.platform) {
    context.platform = config.platform;
  }

  if (config.language) {
    context.language = config.language;
  }

  if (config.instructor) {
    context.instructor = config.instructor;
  }

  if (config.parentActivity) {
    context.contextActivities = {
      parent: [config.parentActivity]
    };
  }

  if (config.extensions) {
    context.extensions = config.extensions;
  }

  return context;
}

// ============================================================================
// High-Level Event to Statement Converters
// ============================================================================

/**
 * Convert a learning activity event to an xAPI statement
 */
export function eventToStatement(event: LearningActivityEvent): XAPIStatement {
  const verb = getVerbForEventType(event.type);
  
  const activity = createActivity({
    id: event.activityId,
    name: event.activityName,
    type: event.activityType,
    extensions: event.extensions
  });

  const builder = createStatement()
    .setActor(event.actor)
    .setVerb(verb)
    .setObject(activity)
    .setTimestamp(event.timestamp);

  if (event.result) {
    builder.setResult(event.result);
  }

  if (event.context) {
    builder.setContext(event.context);
  }

  return builder.build();
}

/**
 * Convert a question event to an xAPI statement
 */
export function questionEventToStatement(event: QuestionEvent): XAPIStatement {
  const verb = getVerbForEventType(event.type);
  
  const activity = createActivity({
    id: event.questionId,
    name: `Question: ${event.questionId}`,
    type: XAPI_ACTIVITY_TYPES.QUESTION,
    extensions: {
      'http://example.com/extensions/question-type': event.questionType,
      ...event.extensions
    }
  });

  const result = createResult({
    success: event.isCorrect,
    response: event.response,
    duration: event.timeSpent,
    extensions: {
      'http://example.com/extensions/attempts': event.attempts
    }
  });

  const context = createContext({
    parentActivity: createActivity({
      id: event.activityId,
      name: event.activityName,
      type: event.activityType
    }),
    ...event.context
  });

  return createStatement()
    .setActor(event.actor)
    .setVerb(verb)
    .setObject(activity)
    .setResult(result)
    .setContext(context)
    .setTimestamp(event.timestamp)
    .build();
}

/**
 * Convert a survey event to an xAPI statement
 */
export function surveyEventToStatement(event: SurveyEvent): XAPIStatement {
  const verb = getVerbForEventType(event.type);
  
  const activity = createActivity({
    id: event.surveyId,
    name: `Survey: ${event.surveyId}`,
    type: XAPI_ACTIVITY_TYPES.SURVEY,
    extensions: {
      'http://example.com/extensions/survey-type': event.surveyType,
      'http://example.com/extensions/anonymous': event.anonymous,
      'http://example.com/extensions/section-id': event.sectionId,
      ...event.extensions
    }
  });

  const builder = createStatement()
    .setActor(event.actor)
    .setVerb(verb)
    .setObject(activity)
    .setTimestamp(event.timestamp);

  if (event.result) {
    builder.setResult(event.result);
  }

  if (event.context) {
    builder.setContext(event.context);
  }

  return builder.build();
}

/**
 * Convert a connections event to an xAPI statement
 */
export function connectionsEventToStatement(event: ConnectionsEvent): XAPIStatement {
  const verb = getVerbForConnectionsEventType(event.type);
  
  const activity = createActivity({
    id: event.gameId,
    name: `Connections Game: ${event.gameTitle}`,
    type: XAPI_ACTIVITY_TYPES.SIMULATION,
    extensions: {
      'http://nlj-viewer.com/extensions/game-title': event.gameTitle,
      'http://nlj-viewer.com/extensions/groups-found': event.groupsFound,
      'http://nlj-viewer.com/extensions/total-groups': event.totalGroups,
      'http://nlj-viewer.com/extensions/mistakes': event.mistakes,
      'http://nlj-viewer.com/extensions/max-mistakes': event.maxMistakes,
      'http://nlj-viewer.com/extensions/found-group': event.foundGroup,
      'http://nlj-viewer.com/extensions/final-score': event.finalScore,
      ...event.extensions
    }
  });

  const builder = createStatement()
    .setActor(event.actor)
    .setVerb(verb)
    .setObject(activity)
    .setTimestamp(event.timestamp);

  // Add result information based on event type
  if (event.type === 'game_completed' || event.type === 'game_failed') {
    builder.setResult(createResult({
      success: event.type === 'game_completed',
      completion: true,
      score: event.finalScore ? { raw: event.finalScore } : undefined,
      duration: event.timeSpent,
      extensions: {
        'http://nlj-viewer.com/extensions/groups-found': event.groupsFound,
        'http://nlj-viewer.com/extensions/mistakes': event.mistakes,
      }
    }));
  } else if (event.type === 'group_found' && event.foundGroup) {
    builder.setResult(createResult({
      success: true,
      response: JSON.stringify(event.foundGroup),
      extensions: {
        'http://nlj-viewer.com/extensions/group-category': event.foundGroup.category,
        'http://nlj-viewer.com/extensions/group-difficulty': event.foundGroup.difficulty,
        'http://nlj-viewer.com/extensions/group-words': event.foundGroup.words
      }
    }));
  } else if (event.type === 'mistake_made') {
    builder.setResult(createResult({
      success: false,
      extensions: {
        'http://nlj-viewer.com/extensions/mistakes': event.mistakes,
        'http://nlj-viewer.com/extensions/max-mistakes': event.maxMistakes
      }
    }));
  }

  if (event.result) {
    builder.setResult(event.result);
  }

  if (event.context) {
    builder.setContext(event.context);
  }

  return builder.build();
}

// ============================================================================
// Utility Functions
// ============================================================================

function getVerbForEventType(type: string): XAPIVerb {
  const verbMap: Record<string, XAPIVerb> = {
    launched: XAPI_VERBS.LAUNCHED,
    completed: XAPI_VERBS.COMPLETED,
    passed: XAPI_VERBS.PASSED,
    failed: XAPI_VERBS.FAILED,
    suspended: XAPI_VERBS.SUSPENDED,
    resumed: XAPI_VERBS.RESUMED,
    answered: XAPI_VERBS.ANSWERED,
    responded: XAPI_VERBS.RESPONDED,
    skipped: XAPI_VERBS.SKIPPED,
    abandoned: XAPI_VERBS.ABANDONED,
    submitted: XAPI_VERBS.SUBMITTED,
    reviewed: XAPI_VERBS.REVIEWED
  };

  return verbMap[type] || XAPI_VERBS.EXPERIENCED;
}

function getVerbForConnectionsEventType(type: string): XAPIVerb {
  const verbMap: Record<string, XAPIVerb> = {
    game_started: XAPI_VERBS.LAUNCHED,
    group_found: XAPI_VERBS.GROUPED,
    mistake_made: XAPI_VERBS.MISTAKEN,
    game_completed: XAPI_VERBS.COMPLETED,
    game_failed: XAPI_VERBS.FAILED
  };

  return verbMap[type] || XAPI_VERBS.EXPERIENCED;
}

function secondsToISO8601Duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  let duration = 'PT';
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  if (remainingSeconds > 0) duration += `${remainingSeconds}S`;
  
  return duration === 'PT' ? 'PT0S' : duration;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate an xAPI statement
 */
export function validateStatement(statement: XAPIStatement): XAPIValidationResult {
  const errors: XAPIValidationError[] = [];

  // Required fields
  if (!statement.actor) {
    errors.push({ field: 'actor', message: 'Actor is required' });
  }
  if (!statement.verb) {
    errors.push({ field: 'verb', message: 'Verb is required' });
  }
  if (!statement.object) {
    errors.push({ field: 'object', message: 'Object is required' });
  }

  // Validate timestamp format
  if (statement.timestamp && !isValidISO8601(statement.timestamp)) {
    errors.push({ field: 'timestamp', message: 'Timestamp must be a valid ISO 8601 date' });
  }

  // Validate score if present
  if (statement.result?.score) {
    const score = statement.result.score;
    if (score.scaled !== undefined && (score.scaled < -1 || score.scaled > 1)) {
      errors.push({ field: 'result.score.scaled', message: 'Scaled score must be between -1 and 1' });
    }
    if (score.min !== undefined && score.max !== undefined && score.min > score.max) {
      errors.push({ field: 'result.score', message: 'Score min cannot be greater than max' });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function isValidISO8601(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    return date.toISOString() === dateString;
  } catch {
    return false;
  }
}