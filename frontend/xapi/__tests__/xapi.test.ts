/**
 * Tests for the standalone xAPI module
 */

import { describe, it, expect } from 'vitest';
import {
  createStatement,
  createActor,
  createActivity,
  createResult,
  createContext,
  XAPI_VERBS,
  XAPI_ACTIVITY_TYPES,
  validateStatement,
  eventToStatement,
  questionEventToStatement,
  surveyEventToStatement
} from '../index';

describe('xAPI Module', () => {
  describe('Statement Builder', () => {
    it('should create a valid basic statement', () => {
      const actor = createActor({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const activity = createActivity({
        id: 'http://example.com/course/1',
        name: 'Introduction to xAPI',
        type: XAPI_ACTIVITY_TYPES.COURSE
      });

      const statement = createStatement()
        .setActor(actor)
        .setVerb(XAPI_VERBS.COMPLETED)
        .setObject(activity)
        .build();

      expect(statement.actor).toEqual(actor);
      expect(statement.verb).toEqual(XAPI_VERBS.COMPLETED);
      expect(statement.object).toEqual(activity);
      expect(statement.id).toBeDefined();
      expect(statement.timestamp).toBeDefined();
    });

    it('should create a statement with result', () => {
      const actor = createActor({ name: 'Jane Doe', email: 'jane@example.com' });
      const activity = createActivity({ id: 'quiz-1', name: 'Quiz 1' });
      const result = createResult({
        success: true,
        completion: true,
        score: { raw: 85, scaled: 0.85, min: 0, max: 100 }
      });

      const statement = createStatement()
        .setActor(actor)
        .setVerb(XAPI_VERBS.COMPLETED)
        .setObject(activity)
        .setResult(result)
        .build();

      expect(statement.result).toEqual(result);
    });

    it('should create a statement with context', () => {
      const actor = createActor({ name: 'Bob Smith', email: 'bob@example.com' });
      const activity = createActivity({ id: 'lesson-1', name: 'Lesson 1' });
      const context = createContext({
        platform: 'NLJ Viewer',
        language: 'en-US',
        registration: 'uuid-123'
      });

      const statement = createStatement()
        .setActor(actor)
        .setVerb(XAPI_VERBS.EXPERIENCED)
        .setObject(activity)
        .setContext(context)
        .build();

      expect(statement.context).toEqual(context);
    });

    it('should throw error for invalid statement', () => {
      expect(() => {
        createStatement().build();
      }).toThrow('Invalid xAPI statement');
    });
  });

  describe('Validation', () => {
    it('should validate a correct statement', () => {
      const statement = createStatement()
        .setActor(createActor({ name: 'Test User', email: 'test@example.com' }))
        .setVerb(XAPI_VERBS.COMPLETED)
        .setObject(createActivity({ id: 'test-activity', name: 'Test Activity' }))
        .build();

      const validation = validateStatement(statement);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid scaled score', () => {
      const statement = createStatement()
        .setActor(createActor({ name: 'Test User', email: 'test@example.com' }))
        .setVerb(XAPI_VERBS.COMPLETED)
        .setObject(createActivity({ id: 'test-activity', name: 'Test Activity' }))
        .setResult({ score: { scaled: 1.5 } })
        .build();

      const validation = validateStatement(statement);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].field).toBe('result.score.scaled');
    });
  });

  describe('Event Conversion', () => {
    it('should convert learning activity event to statement', () => {
      const event = {
        type: 'completed' as const,
        activityId: 'course-1',
        activityName: 'Introduction Course',
        activityType: XAPI_ACTIVITY_TYPES.COURSE,
        actor: createActor({ name: 'Test User', email: 'test@example.com' }),
        result: { completion: true, success: true },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const statement = eventToStatement(event);
      
      expect(statement.verb).toEqual(XAPI_VERBS.COMPLETED);
      expect(statement.object.id).toBe('course-1');
      expect(statement.result?.completion).toBe(true);
      expect(statement.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should convert question event to statement', () => {
      const event = {
        type: 'answered' as const,
        activityId: 'quiz-1',
        activityName: 'Quiz 1',
        activityType: XAPI_ACTIVITY_TYPES.ASSESSMENT,
        questionId: 'question-1',
        questionType: 'multiple-choice',
        actor: createActor({ name: 'Test User', email: 'test@example.com' }),
        response: 'A',
        isCorrect: true,
        timeSpent: 30,
        attempts: 1
      };

      const statement = questionEventToStatement(event);
      
      expect(statement.verb).toEqual(XAPI_VERBS.ANSWERED);
      expect(statement.object.id).toBe('question-1');
      expect(statement.result?.success).toBe(true);
      expect(statement.result?.response).toBe('A');
      expect(statement.context?.contextActivities?.parent).toBeDefined();
    });

    it('should convert survey event to statement', () => {
      const event = {
        type: 'responded' as const,
        activityId: 'survey-1',
        activityName: 'Employee Survey',
        activityType: XAPI_ACTIVITY_TYPES.SURVEY,
        surveyId: 'survey-1',
        surveyType: 'employee-engagement',
        actor: createActor({ name: 'Test User', email: 'test@example.com' }),
        anonymous: true
      };

      const statement = surveyEventToStatement(event);
      
      expect(statement.verb).toEqual(XAPI_VERBS.RESPONDED);
      expect(statement.object.id).toBe('survey-1');
      expect(statement.object.definition?.extensions?.['http://example.com/extensions/anonymous']).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    it('should create actor with email', () => {
      const actor = createActor({
        name: 'John Doe',
        email: 'john@example.com'
      });

      expect(actor.name).toBe('John Doe');
      expect(actor.mbox).toBe('mailto:john@example.com');
      expect(actor.objectType).toBe('Agent');
    });

    it('should create actor with account', () => {
      const actor = createActor({
        name: 'Jane Doe',
        account: {
          homePage: 'https://example.com',
          name: 'jane.doe'
        }
      });

      expect(actor.name).toBe('Jane Doe');
      expect(actor.account).toEqual({
        homePage: 'https://example.com',
        name: 'jane.doe'
      });
    });

    it('should create activity with all properties', () => {
      const activity = createActivity({
        id: 'http://example.com/course/1',
        name: 'Test Course',
        description: 'A test course',
        type: XAPI_ACTIVITY_TYPES.COURSE,
        moreInfo: 'http://example.com/info',
        extensions: { 'http://example.com/difficulty': 'beginner' }
      });

      expect(activity.id).toBe('http://example.com/course/1');
      expect(activity.definition?.name?.['en-US']).toBe('Test Course');
      expect(activity.definition?.description?.['en-US']).toBe('A test course');
      expect(activity.definition?.type).toBe(XAPI_ACTIVITY_TYPES.COURSE);
      expect(activity.definition?.moreInfo).toBe('http://example.com/info');
      expect(activity.definition?.extensions).toEqual({ 'http://example.com/difficulty': 'beginner' });
    });
  });

  describe('Constants', () => {
    it('should have predefined verbs', () => {
      expect(XAPI_VERBS.COMPLETED.id).toBe('http://adlnet.gov/expapi/verbs/completed');
      expect(XAPI_VERBS.COMPLETED.display['en-US']).toBe('completed');
    });

    it('should have predefined activity types', () => {
      expect(XAPI_ACTIVITY_TYPES.COURSE).toBe('http://adlnet.gov/expapi/activities/course');
      expect(XAPI_ACTIVITY_TYPES.ASSESSMENT).toBe('http://adlnet.gov/expapi/activities/assessment');
    });
  });
});