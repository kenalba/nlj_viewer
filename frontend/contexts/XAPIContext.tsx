/**
 * xAPI Event Tracking Context
 * 
 * Provides centralized event tracking for learning activities using the standalone xAPI module.
 * Automatically tracks activity lifecycle events, question interactions, and survey responses.
 */

import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { 
  createActor,
  createActivity,
  createResult,
  createContext as createXAPIContext,
  eventToStatement,
  questionEventToStatement,
  surveyEventToStatement,
  wordleEventToStatement,
  createXAPIClient,
  createMockXAPIClient,
  XAPIClient,
  XAPI_ACTIVITY_TYPES
} from '../xapi';
import type { 
  XAPIStatement, 
  XAPIActor, 
  XAPIConfig,
  LearningActivityEvent,
  QuestionEvent,
  SurveyEvent,
  GameEvent,
  ConnectionsEvent,
  WordleEvent
} from '../xapi';
import type { NLJScenario } from '../types/nlj';

// ============================================================================
// Context Types
// ============================================================================

export interface XAPIContextState {
  // Configuration
  isEnabled: boolean;
  config: XAPIConfig | null;
  actor: XAPIActor | null;
  
  // Event tracking
  statements: XAPIStatement[];
  currentActivity: string | null;
  sessionId: string;
  
  // Statistics
  totalEvents: number;
  lastEventTime: Date | null;
}

export interface XAPIContextActions {
  // Configuration
  configure: (config: XAPIConfig) => void;
  setActor: (actor: XAPIActor) => void;
  enable: () => void;
  disable: () => void;
  
  // Activity lifecycle
  trackActivityLaunched: (scenario: NLJScenario) => void;
  trackActivityCompleted: (scenario: NLJScenario, score?: number, variableStates?: Record<string, number | string | boolean>) => void;
  trackActivitySuspended: (scenario: NLJScenario) => void;
  trackActivityResumed: (scenario: NLJScenario) => void;
  
  // Question interactions
  trackQuestionAnswered: (
    questionId: string,
    questionType: string,
    response: string,
    isCorrect: boolean,
    timeSpent?: number,
    attempts?: number
  ) => void;
  
  trackQuestionSkipped: (questionId: string, questionType: string) => void;
  
  // Survey responses
  trackSurveyStarted: (surveyId: string, surveyType: string) => void;
  trackSurveyCompleted: (surveyId: string, surveyType: string) => void;
  trackSurveyResponse: (
    surveyId: string,
    questionId: string,
    response: string,
    sectionId?: string
  ) => void;
  trackSurveyDistribution: (params: {
    surveyId: string;
    surveyTitle: string;
    method: string;
    recipientCount: number;
  }) => void;
  
  // Navigation
  trackNodeVisited: (nodeId: string, nodeType: string) => void;
  
  // Connections game tracking
  trackConnectionsGameStarted: (gameId: string, gameTitle: string) => void;
  trackConnectionsGroupFound: (
    gameId: string,
    gameTitle: string,
    foundGroup: {
      category: string;
      words: string[];
      difficulty: 'yellow' | 'green' | 'blue' | 'purple';
    },
    groupsFound: number,
    totalGroups: number
  ) => void;
  trackConnectionsMistake: (
    gameId: string,
    gameTitle: string,
    mistakes: number,
    maxMistakes: number
  ) => void;
  trackConnectionsGameCompleted: (
    gameId: string,
    gameTitle: string,
    groupsFound: number,
    totalGroups: number,
    mistakes: number,
    timeSpent: number,
    finalScore?: number
  ) => void;
  trackConnectionsGameFailed: (
    gameId: string,
    gameTitle: string,
    groupsFound: number,
    totalGroups: number,
    mistakes: number,
    timeSpent: number,
    finalScore?: number
  ) => void;
  
  // Wordle game tracking
  trackWordleGameStarted: (gameId: string, gameTitle: string, wordLength: number, maxAttempts: number, hardMode: boolean) => void;
  trackWordleGuessMade: (
    gameId: string,
    gameTitle: string,
    guess: string,
    guessNumber: number,
    feedback: Array<'correct' | 'present' | 'absent'>,
    wordLength: number,
    hardMode: boolean
  ) => void;
  trackWordleWordGuessed: (
    gameId: string,
    gameTitle: string,
    guess: string,
    guessNumber: number,
    totalGuesses: number,
    hardMode: boolean
  ) => void;
  trackWordleHintUsed: (
    gameId: string,
    gameTitle: string,
    hintsUsed: number,
    guessNumber: number
  ) => void;
  trackWordleGameCompleted: (
    gameId: string,
    gameTitle: string,
    totalGuesses: number,
    maxAttempts: number,
    timeSpent: number,
    hintsUsed: number,
    hardMode: boolean,
    finalScore?: number
  ) => void;
  trackWordleGameFailed: (
    gameId: string,
    gameTitle: string,
    totalGuesses: number,
    maxAttempts: number,
    timeSpent: number,
    hintsUsed: number,
    hardMode: boolean,
    finalScore?: number
  ) => void;
  
  // Data export
  exportStatements: () => XAPIStatement[];
  exportJSON: () => string;
  exportCSV: () => string;
  
  // State management
  clearStatements: () => void;
  getStatementCount: () => number;
}

export type XAPIContextValue = XAPIContextState & XAPIContextActions;

// ============================================================================
// Context Implementation
// ============================================================================

const XAPIContext = createContext<XAPIContextValue | null>(null);

export const useXAPI = (): XAPIContextValue => {
  const context = useContext(XAPIContext);
  if (!context) {
    throw new Error('useXAPI must be used within an XAPIProvider');
  }
  return context;
};

// ============================================================================
// Provider Component
// ============================================================================

interface XAPIProviderProps {
  children: React.ReactNode;
  initialConfig?: XAPIConfig;
  defaultActor?: XAPIActor;
  enabled?: boolean;
}

export const XAPIProvider: React.FC<XAPIProviderProps> = ({
  children,
  initialConfig,
  defaultActor,
  enabled = true
}) => {
  // State management
  const [config, setConfig] = useState<XAPIConfig | null>(initialConfig || null);
  const [actor, setActorState] = useState<XAPIActor | null>(defaultActor || null);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [statements, setStatements] = useState<XAPIStatement[]>([]);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [totalEvents, setTotalEvents] = useState(0);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  
  // Session management
  const sessionId = useRef(crypto.randomUUID());
  const xapiClient = useRef<XAPIClient | Partial<XAPIClient> | null>(null);
  const launchedActivities = useRef<Set<string>>(new Set());
  
  // Initialize xAPI client when config changes
  useEffect(() => {
    if (config && config.endpoint) {
      xapiClient.current = createXAPIClient({
        endpoint: config.endpoint,
        username: config.username || '',
        password: config.password || ''
      });
    } else {
      xapiClient.current = createMockXAPIClient();
    }
  }, [config]);
  
  // Create default actor if none provided
  useEffect(() => {
    if (!actor && isEnabled) {
      const defaultUser = createActor({
        name: 'Anonymous User',
        account: {
          homePage: window.location.origin,
          name: `user_${sessionId.current.split('-')[0]}`
        }
      });
      setActorState(defaultUser);
    }
  }, [actor, isEnabled]);
  
  // ============================================================================
  // Helper Functions
  // ============================================================================
  
  
  const trackEvent = useCallback((event: LearningActivityEvent | QuestionEvent | SurveyEvent | GameEvent | WordleEvent) => {
    if (!isEnabled || !actor) {
      return;
    }
    
    try {
      let statement: XAPIStatement;
      
      if ('questionId' in event) {
        statement = questionEventToStatement(event as QuestionEvent);
        console.log('📝 xAPI:', event.type, event.questionId, event.response);
      } else if ('surveyId' in event) {
        statement = surveyEventToStatement(event as SurveyEvent);
        console.log('📊 xAPI:', event.type, event.surveyId);
      } else if ('gameId' in event && 'gameTitle' in event && 'wordLength' in event) {
        statement = wordleEventToStatement(event as WordleEvent);
        console.log('🎮 xAPI Wordle:', event.type, event.gameId, event.gameTitle);
      } else {
        statement = eventToStatement(event as LearningActivityEvent);
        console.log('🎯 xAPI:', event.type, event.activityId);
      }
      
      if (!statement) return;
      
      // Update state
      setStatements(prev => [...prev, statement]);
      setTotalEvents(prev => prev + 1);
      setLastEventTime(new Date());
      
      // Send to LRS if client is configured
      if (xapiClient.current && config && xapiClient.current.sendStatement) {
        xapiClient.current.sendStatement(statement).catch((error: Error) => {
          console.error('Failed to send xAPI statement:', error);
        });
      }
    } catch (error) {
      console.error('Failed to create xAPI statement:', error);
    }
  }, [isEnabled, actor, config]);
  
  // ============================================================================
  // Context Actions
  // ============================================================================
  
  const configure = useCallback((newConfig: XAPIConfig) => {
    setConfig(newConfig);
  }, []);
  
  const setActor = useCallback((newActor: XAPIActor) => {
    setActorState(newActor);
  }, []);
  
  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);
  
  const disable = useCallback(() => {
    setIsEnabled(false);
  }, []);
  
  // Activity lifecycle tracking
  const trackActivityLaunched = useCallback((scenario: NLJScenario) => {
    if (!isEnabled || !actor) return;
    
    // Prevent duplicate launches
    if (launchedActivities.current.has(scenario.id)) {
      return;
    }
    
    launchedActivities.current.add(scenario.id);
    setCurrentActivity(scenario.id);
    
    const event: LearningActivityEvent = {
      type: 'launched',
      activityId: scenario.id,
      activityName: scenario.name,
      activityType: XAPI_ACTIVITY_TYPES.COURSE,
      actor,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US',
        extensions: {
          'http://nlj-viewer.com/extensions/scenario-type': scenario.activityType || 'training'
        }
      })
    };
    
    trackEvent(event);
  }, [isEnabled, actor, trackEvent]);
  
  const trackActivityCompleted = useCallback((scenario: NLJScenario, score?: number, variableStates?: Record<string, number | string | boolean>) => {
    if (!actor) return;
    
    // Prepare extensions with variable states if provided
    const extensions: Record<string, unknown> = {};
    if (variableStates && Object.keys(variableStates).length > 0) {
      extensions['https://nlj.com/xapi/extensions/variable-states'] = variableStates;
    }
    
    const event: LearningActivityEvent = {
      type: 'completed',
      activityId: scenario.id,
      activityName: scenario.name,
      activityType: XAPI_ACTIVITY_TYPES.COURSE,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        completion: true,
        success: score !== undefined ? score > 0 : true,
        score: score !== undefined ? { raw: score } : undefined,
        extensions: Object.keys(extensions).length > 0 ? extensions : undefined
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
    setCurrentActivity(null);
  }, [actor, trackEvent]);
  
  const trackActivitySuspended = useCallback((scenario: NLJScenario) => {
    if (!actor) return;
    
    const event: LearningActivityEvent = {
      type: 'suspended',
      activityId: scenario.id,
      activityName: scenario.name,
      activityType: XAPI_ACTIVITY_TYPES.COURSE,
      actor,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackActivityResumed = useCallback((scenario: NLJScenario) => {
    if (!actor) return;
    
    const event: LearningActivityEvent = {
      type: 'resumed',
      activityId: scenario.id,
      activityName: scenario.name,
      activityType: XAPI_ACTIVITY_TYPES.COURSE,
      actor,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  // Question interaction tracking
  const trackQuestionAnswered = useCallback((
    questionId: string,
    questionType: string,
    response: string,
    isCorrect: boolean,
    timeSpent?: number,
    attempts?: number
  ) => {
    if (!actor || !currentActivity) return;
    
    const event: QuestionEvent = {
      type: 'answered',
      activityId: currentActivity,
      activityName: 'Current Activity',
      activityType: XAPI_ACTIVITY_TYPES.COURSE,
      questionId,
      questionType,
      actor,
      response,
      isCorrect,
      timeSpent: timeSpent || 0,
      attempts: attempts || 1,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, currentActivity, trackEvent]);
  
  const trackQuestionSkipped = useCallback((questionId: string, questionType: string) => {
    if (!actor || !currentActivity) return;
    
    const event: QuestionEvent = {
      type: 'skipped',
      activityId: currentActivity,
      activityName: 'Current Activity',
      activityType: XAPI_ACTIVITY_TYPES.COURSE,
      questionId,
      questionType,
      actor,
      response: '',
      isCorrect: false,
      timeSpent: 0,
      attempts: 0,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, currentActivity, trackEvent]);
  
  // Survey tracking
  const trackSurveyStarted = useCallback((surveyId: string, surveyType: string) => {
    if (!actor) return;
    
    const event: SurveyEvent = {
      type: 'responded',
      activityId: surveyId,
      activityName: `Survey: ${surveyId}`,
      activityType: XAPI_ACTIVITY_TYPES.SURVEY,
      surveyId,
      surveyType,
      actor,
      anonymous: false,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackSurveyCompleted = useCallback((surveyId: string, surveyType: string) => {
    if (!actor) return;
    
    const event: SurveyEvent = {
      type: 'completed',
      activityId: surveyId,
      activityName: `Survey: ${surveyId}`,
      activityType: XAPI_ACTIVITY_TYPES.SURVEY,
      surveyId,
      surveyType,
      actor,
      anonymous: false,
      timestamp: new Date().toISOString(),
      result: createResult({
        completion: true,
        success: true
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackSurveyResponse = useCallback((
    surveyId: string,
    questionId: string,
    response: string,
    sectionId?: string
  ) => {
    if (!actor) {
      return;
    }
    
    const event: SurveyEvent = {
      type: 'responded',
      activityId: surveyId,
      activityName: `Survey: ${surveyId}`,
      activityType: XAPI_ACTIVITY_TYPES.SURVEY,
      surveyId,
      surveyType: 'general',
      actor,
      anonymous: false,
      sectionId,
      timestamp: new Date().toISOString(),
      result: createResult({
        response
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US',
        extensions: {
          'http://nlj-viewer.com/extensions/question-id': questionId
        }
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);

  const trackSurveyDistribution = useCallback((params: {
    surveyId: string;
    surveyTitle: string;
    method: string;
    recipientCount: number;
  }) => {
    if (!actor) return;
    
    const event: SurveyEvent = {
      type: 'distributed',
      activityId: params.surveyId,
      activityName: params.surveyTitle,
      activityType: XAPI_ACTIVITY_TYPES.SURVEY,
      surveyId: params.surveyId,
      surveyType: 'distribution',
      actor,
      anonymous: false,
      timestamp: new Date().toISOString(),
      result: createResult({
        completion: true,
        success: true,
        extensions: {
          'http://nlj-viewer.com/extensions/distribution-method': params.method,
          'http://nlj-viewer.com/extensions/recipient-count': params.recipientCount
        }
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  // Navigation tracking
  const trackNodeVisited = useCallback((nodeId: string, nodeType: string) => {
    if (!actor || !currentActivity) return;
    
    const event: LearningActivityEvent = {
      type: 'launched',
      activityId: `${currentActivity}-${nodeId}`,
      activityName: `Node: ${nodeId}`,
      activityType: XAPI_ACTIVITY_TYPES.INTERACTION,
      actor,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US',
        parentActivity: createActivity({
          id: currentActivity,
          name: 'Current Activity'
        }),
        extensions: {
          'http://nlj-viewer.com/extensions/node-type': nodeType
        }
      })
    };
    
    trackEvent(event);
  }, [actor, currentActivity, trackEvent]);
  
  // Connections game tracking
  const trackConnectionsGameStarted = useCallback((gameId: string, gameTitle: string) => {
    if (!actor) return;
    
    const event: ConnectionsEvent = {
      type: 'game_started',
      activityId: gameId,
      activityName: `Connections Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      actor,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackConnectionsGroupFound = useCallback((
    gameId: string,
    gameTitle: string,
    foundGroup: {
      category: string;
      words: string[];
      difficulty: 'yellow' | 'green' | 'blue' | 'purple';
    },
    groupsFound: number,
    totalGroups: number
  ) => {
    if (!actor) return;
    
    const event: ConnectionsEvent = {
      type: 'group_found',
      activityId: gameId,
      activityName: `Connections Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      foundGroup,
      groupsFound,
      totalGroups,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: true,
        response: JSON.stringify(foundGroup)
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackConnectionsMistake = useCallback((
    gameId: string,
    gameTitle: string,
    mistakes: number,
    maxMistakes: number
  ) => {
    if (!actor) return;
    
    const event: ConnectionsEvent = {
      type: 'mistake_made',
      activityId: gameId,
      activityName: `Connections Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      mistakes,
      maxMistakes,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: false
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackConnectionsGameCompleted = useCallback((
    gameId: string,
    gameTitle: string,
    groupsFound: number,
    totalGroups: number,
    mistakes: number,
    timeSpent: number,
    finalScore?: number
  ) => {
    if (!actor) return;
    
    const event: ConnectionsEvent = {
      type: 'game_completed',
      activityId: gameId,
      activityName: `Connections Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      groupsFound,
      totalGroups,
      mistakes,
      timeSpent,
      finalScore,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: true,
        completion: true,
        score: finalScore ? { raw: finalScore } : undefined,
        duration: timeSpent
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackConnectionsGameFailed = useCallback((
    gameId: string,
    gameTitle: string,
    groupsFound: number,
    totalGroups: number,
    mistakes: number,
    timeSpent: number,
    finalScore?: number
  ) => {
    if (!actor) return;
    
    const event: ConnectionsEvent = {
      type: 'game_failed',
      activityId: gameId,
      activityName: `Connections Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      groupsFound,
      totalGroups,
      mistakes,
      timeSpent,
      finalScore,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: false,
        completion: true,
        score: finalScore ? { raw: finalScore } : undefined,
        duration: timeSpent
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  // Wordle game tracking functions
  const trackWordleGameStarted = useCallback((gameId: string, gameTitle: string, wordLength: number, maxAttempts: number, hardMode: boolean) => {
    if (!actor) return;
    
    const event: WordleEvent = {
      type: 'game_started',
      activityId: gameId,
      activityName: `Wordle Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      wordLength,
      maxAttempts,
      hardMode,
      actor,
      timestamp: new Date().toISOString(),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackWordleGuessMade = useCallback((
    gameId: string,
    gameTitle: string,
    guess: string,
    guessNumber: number,
    feedback: Array<'correct' | 'present' | 'absent'>,
    wordLength: number,
    hardMode: boolean
  ) => {
    if (!actor) return;
    
    const event: WordleEvent = {
      type: 'guess_made',
      activityId: gameId,
      activityName: `Wordle Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      currentGuess: guess,
      guessNumber,
      feedback,
      wordLength,
      hardMode,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: false,
        response: guess
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackWordleWordGuessed = useCallback((
    gameId: string,
    gameTitle: string,
    guess: string,
    guessNumber: number,
    totalGuesses: number,
    hardMode: boolean
  ) => {
    if (!actor) return;
    
    const event: WordleEvent = {
      type: 'word_guessed',
      activityId: gameId,
      activityName: `Wordle Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      currentGuess: guess,
      guessNumber,
      totalGuesses,
      hardMode,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: true,
        response: guess
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackWordleHintUsed = useCallback((
    gameId: string,
    gameTitle: string,
    hintsUsed: number,
    guessNumber: number
  ) => {
    if (!actor) return;
    
    const event: WordleEvent = {
      type: 'hint_used',
      activityId: gameId,
      activityName: `Wordle Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      hintsUsed,
      guessNumber,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: true
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackWordleGameCompleted = useCallback((
    gameId: string,
    gameTitle: string,
    totalGuesses: number,
    maxAttempts: number,
    timeSpent: number,
    hintsUsed: number,
    hardMode: boolean,
    finalScore?: number
  ) => {
    if (!actor) return;
    
    const event: WordleEvent = {
      type: 'game_completed',
      activityId: gameId,
      activityName: `Wordle Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      totalGuesses,
      maxAttempts,
      timeSpent,
      hintsUsed,
      hardMode,
      finalScore,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: true,
        completion: true,
        score: finalScore ? { raw: finalScore } : undefined,
        duration: timeSpent
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  const trackWordleGameFailed = useCallback((
    gameId: string,
    gameTitle: string,
    totalGuesses: number,
    maxAttempts: number,
    timeSpent: number,
    hintsUsed: number,
    hardMode: boolean,
    finalScore?: number
  ) => {
    if (!actor) return;
    
    const event: WordleEvent = {
      type: 'game_failed',
      activityId: gameId,
      activityName: `Wordle Game: ${gameTitle}`,
      activityType: XAPI_ACTIVITY_TYPES.SIMULATION,
      gameId,
      gameTitle,
      totalGuesses,
      maxAttempts,
      timeSpent,
      hintsUsed,
      hardMode,
      finalScore,
      actor,
      timestamp: new Date().toISOString(),
      result: createResult({
        success: false,
        completion: true,
        score: finalScore ? { raw: finalScore } : undefined,
        duration: timeSpent
      }),
      context: createXAPIContext({
        registration: sessionId.current,
        platform: 'NLJ Viewer',
        language: 'en-US'
      })
    };
    
    trackEvent(event);
  }, [actor, trackEvent]);
  
  // Data export functions
  const exportStatements = useCallback(() => {
    return [...statements];
  }, [statements]);
  
  const exportJSON = useCallback(() => {
    return JSON.stringify(statements, null, 2);
  }, [statements]);
  
  const exportCSV = useCallback(() => {
    if (statements.length === 0) return '';
    
    const headers = ['timestamp', 'verb', 'actor', 'object', 'result', 'context'];
    const rows = statements.map(stmt => [
      stmt.timestamp || '',
      stmt.verb.display['en-US'] || stmt.verb.id,
      stmt.actor.name || 'Anonymous',
      stmt.object.id,
      stmt.result ? JSON.stringify(stmt.result) : '',
      stmt.context ? JSON.stringify(stmt.context) : ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }, [statements]);
  
  // State management
  const clearStatements = useCallback(() => {
    setStatements([]);
    setTotalEvents(0);
    setLastEventTime(null);
    launchedActivities.current.clear();
  }, []);
  
  const getStatementCount = useCallback(() => {
    return statements.length;
  }, [statements]);
  
  // ============================================================================
  // Context Value
  // ============================================================================
  
  const contextValue: XAPIContextValue = {
    // State
    isEnabled,
    config,
    actor,
    statements,
    currentActivity,
    sessionId: sessionId.current,
    totalEvents,
    lastEventTime,
    
    // Actions
    configure,
    setActor,
    enable,
    disable,
    trackActivityLaunched,
    trackActivityCompleted,
    trackActivitySuspended,
    trackActivityResumed,
    trackQuestionAnswered,
    trackQuestionSkipped,
    trackSurveyStarted,
    trackSurveyCompleted,
    trackSurveyResponse,
    trackSurveyDistribution,
    trackNodeVisited,
    trackConnectionsGameStarted,
    trackConnectionsGroupFound,
    trackConnectionsMistake,
    trackConnectionsGameCompleted,
    trackConnectionsGameFailed,
    trackWordleGameStarted,
    trackWordleGuessMade,
    trackWordleWordGuessed,
    trackWordleHintUsed,
    trackWordleGameCompleted,
    trackWordleGameFailed,
    exportStatements,
    exportJSON,
    exportCSV,
    clearStatements,
    getStatementCount
  };
  
  return (
    <XAPIContext.Provider value={contextValue}>
      {children}
    </XAPIContext.Provider>
  );
};