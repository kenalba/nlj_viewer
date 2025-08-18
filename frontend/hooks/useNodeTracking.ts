/**
 * Node Tracking Hook
 * Enhanced tracking for individual node interactions and performance
 */

import { useCallback, useRef, useEffect } from 'react';
import { NLJNode } from '../types/nlj';
import { useXAPI } from '../contexts/XAPIContext';

interface NodeInteractionData {
  nodeId: string;
  nodeType: string;
  interactionType: 'viewed' | 'attempted' | 'completed' | 'skipped';
  responseData?: Record<string, unknown>;
  isCorrect?: boolean;
  score?: number;
  timeToRespond?: number;
  attempts?: number;
  sessionId?: string;
  activityId?: string;
  userId?: string;
}

interface UseNodeTrackingOptions {
  trackViews?: boolean;
  trackAttempts?: boolean;
  trackCompletions?: boolean;
  trackTiming?: boolean;
  sessionId?: string;
  activityId?: string;
}

const DEFAULT_OPTIONS: UseNodeTrackingOptions = {
  trackViews: true,
  trackAttempts: true,
  trackCompletions: true,
  trackTiming: true,
};

export const useNodeTracking = (
  node: NLJNode | null,
  options: UseNodeTrackingOptions = DEFAULT_OPTIONS
) => {
  const { emitStatement } = useXAPI();
  const nodeStartTime = useRef<number | null>(null);
  const lastTrackedNodeId = useRef<string | null>(null);
  const attemptCount = useRef<number>(0);
  
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Track when a node is first viewed
  const trackNodeView = useCallback(() => {
    if (!node || !mergedOptions.trackViews) return;

    // Reset tracking for new node
    if (lastTrackedNodeId.current !== node.id) {
      nodeStartTime.current = Date.now();
      attemptCount.current = 0;
      lastTrackedNodeId.current = node.id;

      // Emit view statement
      const interactionData: NodeInteractionData = {
        nodeId: node.id,
        nodeType: node.type,
        interactionType: 'viewed',
        sessionId: mergedOptions.sessionId,
        activityId: mergedOptions.activityId,
      };

      emitNodeInteractionStatement(interactionData);
    }
  }, [node, mergedOptions.trackViews, mergedOptions.sessionId, mergedOptions.activityId]);

  // Track node interaction attempts
  const trackNodeAttempt = useCallback((
    responseData: Record<string, unknown>,
    isCorrect?: boolean,
    score?: number
  ) => {
    if (!node || !mergedOptions.trackAttempts) return;

    attemptCount.current += 1;
    const timeToRespond = mergedOptions.trackTiming && nodeStartTime.current 
      ? Date.now() - nodeStartTime.current 
      : undefined;

    const interactionData: NodeInteractionData = {
      nodeId: node.id,
      nodeType: node.type,
      interactionType: 'attempted',
      responseData,
      isCorrect,
      score,
      timeToRespond,
      attempts: attemptCount.current,
      sessionId: mergedOptions.sessionId,
      activityId: mergedOptions.activityId,
    };

    emitNodeInteractionStatement(interactionData);
  }, [node, mergedOptions.trackAttempts, mergedOptions.trackTiming, mergedOptions.sessionId, mergedOptions.activityId]);

  // Track node completion
  const trackNodeCompletion = useCallback((
    finalResponseData: Record<string, unknown>,
    isCorrect?: boolean,
    score?: number
  ) => {
    if (!node || !mergedOptions.trackCompletions) return;

    const timeToRespond = mergedOptions.trackTiming && nodeStartTime.current 
      ? Date.now() - nodeStartTime.current 
      : undefined;

    const interactionData: NodeInteractionData = {
      nodeId: node.id,
      nodeType: node.type,
      interactionType: 'completed',
      responseData: finalResponseData,
      isCorrect,
      score,
      timeToRespond,
      attempts: attemptCount.current,
      sessionId: mergedOptions.sessionId,
      activityId: mergedOptions.activityId,
    };

    emitNodeInteractionStatement(interactionData);
  }, [node, mergedOptions.trackCompletions, mergedOptions.trackTiming, mergedOptions.sessionId, mergedOptions.activityId]);

  // Track when a node is skipped
  const trackNodeSkip = useCallback((reason?: string) => {
    if (!node) return;

    const interactionData: NodeInteractionData = {
      nodeId: node.id,
      nodeType: node.type,
      interactionType: 'skipped',
      responseData: { skipReason: reason || 'user_navigation' },
      sessionId: mergedOptions.sessionId,
      activityId: mergedOptions.activityId,
    };

    emitNodeInteractionStatement(interactionData);
  }, [node, mergedOptions.sessionId, mergedOptions.activityId]);

  // Helper function to emit node interaction statements
  const emitNodeInteractionStatement = useCallback((interactionData: NodeInteractionData) => {
    try {
      // Enhanced xAPI statement with node-specific extensions
      const statement = {
        actor: {
          // Actor will be set by xAPI context
        },
        verb: {
          id: getVerbIRI(interactionData.interactionType),
          display: { 'en-US': getVerbDisplay(interactionData.interactionType) }
        },
        object: {
          id: `node://${interactionData.nodeId}`,
          definition: {
            name: { 'en-US': `Node ${interactionData.nodeId}` },
            description: { 'en-US': `${interactionData.nodeType} interaction` },
            type: getActivityTypeIRI(interactionData.nodeType),
            extensions: {
              'https://nlj.ai/extensions/node-metadata': {
                nodeId: interactionData.nodeId,
                nodeType: interactionData.nodeType,
                interactionType: interactionData.interactionType,
                sessionId: interactionData.sessionId,
                activityId: interactionData.activityId,
                attempts: interactionData.attempts,
              },
              'https://nlj.ai/extensions/performance-data': {
                timeToRespond: interactionData.timeToRespond,
                isCorrect: interactionData.isCorrect,
                score: interactionData.score,
              }
            }
          }
        },
        result: interactionData.responseData ? {
          response: JSON.stringify(interactionData.responseData),
          success: interactionData.isCorrect,
          score: interactionData.score ? {
            raw: interactionData.score,
            scaled: interactionData.score / 100, // Assuming score is out of 100
          } : undefined,
          duration: interactionData.timeToRespond ? 
            `PT${Math.round(interactionData.timeToRespond / 1000)}S` : undefined,
        } : undefined,
        context: {
          extensions: {
            'https://nlj.ai/extensions/node-context': {
              nodePosition: 'unknown', // Could be enhanced with position data
              totalNodes: 'unknown',   // Could be enhanced with scenario data
              nodeCategory: getNodeCategory(interactionData.nodeType),
            }
          }
        }
      };

      emitStatement(statement);
    } catch (error) {
      console.error('Failed to emit node interaction statement:', error);
    }
  }, [emitStatement]);

  // Auto-track node views when node changes
  useEffect(() => {
    if (node) {
      trackNodeView();
    }
  }, [node?.id, trackNodeView]);

  // Cleanup when component unmounts or node changes
  useEffect(() => {
    return () => {
      // Could track node abandonment here if needed
    };
  }, [node?.id]);

  return {
    trackNodeView,
    trackNodeAttempt,
    trackNodeCompletion,
    trackNodeSkip,
    currentNodeId: node?.id || null,
    attemptCount: attemptCount.current,
    nodeStartTime: nodeStartTime.current,
  };
};

// Helper functions for xAPI statement generation
const getVerbIRI = (interactionType: string): string => {
  const verbMap = {
    viewed: 'http://adlnet.gov/expapi/verbs/experienced',
    attempted: 'http://adlnet.gov/expapi/verbs/attempted',
    completed: 'http://adlnet.gov/expapi/verbs/completed',
    skipped: 'http://adlnet.gov/expapi/verbs/suspended',
  };
  return verbMap[interactionType as keyof typeof verbMap] || 'http://adlnet.gov/expapi/verbs/interacted';
};

const getVerbDisplay = (interactionType: string): string => {
  const displayMap = {
    viewed: 'experienced',
    attempted: 'attempted',
    completed: 'completed',
    skipped: 'skipped',
  };
  return displayMap[interactionType as keyof typeof displayMap] || 'interacted with';
};

const getActivityTypeIRI = (nodeType: string): string => {
  const typeMap = {
    true_false: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    multiple_choice: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    short_answer: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    likert_scale: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    rating: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    matrix: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    slider: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    text_area: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    interstitial: 'http://adlnet.gov/expapi/activities/lesson',
    connections: 'http://adlnet.gov/expapi/activities/simulation',
    wordle: 'http://adlnet.gov/expapi/activities/simulation',
  };
  return typeMap[nodeType as keyof typeof typeMap] || 'http://adlnet.gov/expapi/activities/other';
};

const getNodeCategory = (nodeType: string): string => {
  if (['true_false', 'multiple_choice', 'short_answer'].includes(nodeType)) {
    return 'assessment';
  }
  if (['likert_scale', 'rating', 'matrix', 'slider', 'text_area'].includes(nodeType)) {
    return 'survey';
  }
  if (['connections', 'wordle'].includes(nodeType)) {
    return 'game';
  }
  if (['interstitial'].includes(nodeType)) {
    return 'structure';
  }
  return 'unknown';
};

export default useNodeTracking;