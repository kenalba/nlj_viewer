/**
 * Enhanced Node Renderer with Node-Level Tracking
 * Wrapper around the existing NodeRenderer that adds enhanced node-level analytics
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { NLJNode, NLJScenario, NodeResponseValue } from '../types/nlj';
import { NodeRenderer } from './NodeRenderer';
import { useNodeTracking } from '../hooks/useNodeTracking';
import { useGameContext } from '../contexts/GameContext';

interface EnhancedNodeRendererProps {
  node: NLJNode;
  scenario: NLJScenario;
  onComplete?: () => void;
  isPublicView?: boolean;
  activityId?: string;
  enableNodeTracking?: boolean;
}

export const EnhancedNodeRenderer: React.FC<EnhancedNodeRendererProps> = ({
  node,
  scenario,
  onComplete,
  isPublicView = false,
  activityId,
  enableNodeTracking = true,
}) => {
  const { state } = useGameContext();
  
  // Generate session ID for tracking consistency
  const sessionId = useMemo(() => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Initialize node tracking
  const {
    trackNodeView,
    trackNodeAttempt,
    trackNodeCompletion,
    trackNodeSkip,
    currentNodeId,
    attemptCount,
  } = useNodeTracking(node, {
    trackViews: enableNodeTracking,
    trackAttempts: enableNodeTracking,
    trackCompletions: enableNodeTracking,
    trackTiming: enableNodeTracking,
    sessionId,
    activityId,
  });

  // Track node changes
  useEffect(() => {
    if (enableNodeTracking && node) {
      trackNodeView();
    }
  }, [node.id, enableNodeTracking, trackNodeView]);

  // Enhanced completion handler that includes node tracking
  const handleNodeCompletion = useCallback((responseData?: NodeResponseValue) => {
    if (enableNodeTracking && responseData) {
      // Determine if response is correct based on node type and response
      const isCorrect = determineResponseCorrectness(node, responseData);
      const score = calculateNodeScore(node, responseData, isCorrect);

      // Track the completion
      trackNodeCompletion({
        response: responseData,
        nodeType: node.type,
        timestamp: new Date().toISOString(),
      }, isCorrect, score);
    }

    // Call original completion handler
    if (onComplete) {
      onComplete();
    }
  }, [node, responseData, enableNodeTracking, trackNodeCompletion, onComplete]);

  // Enhanced attempt handler for tracking user interactions
  const handleNodeAttempt = useCallback((responseData: NodeResponseValue) => {
    if (enableNodeTracking) {
      const isCorrect = determineResponseCorrectness(node, responseData);
      const score = calculateNodeScore(node, responseData, isCorrect);

      trackNodeAttempt({
        response: responseData,
        nodeType: node.type,
        timestamp: new Date().toISOString(),
        attemptNumber: attemptCount + 1,
      }, isCorrect, score);
    }
  }, [node, enableNodeTracking, trackNodeAttempt, attemptCount]);

  // Create enhanced props for the original NodeRenderer
  const enhancedProps = useMemo(() => ({
    node,
    scenario,
    onComplete: handleNodeCompletion,
    isPublicView,
    // Add tracking metadata that could be used by individual node components
    nodeMetadata: enableNodeTracking ? {
      sessionId,
      activityId,
      nodeStartTime: Date.now(),
      trackingEnabled: true,
      onAttempt: handleNodeAttempt,
    } : undefined,
  }), [node, scenario, handleNodeCompletion, isPublicView, enableNodeTracking, sessionId, activityId, handleNodeAttempt]);

  // If tracking is disabled, just use the original NodeRenderer
  if (!enableNodeTracking) {
    return (
      <NodeRenderer
        node={node}
        scenario={scenario}
        onComplete={onComplete}
        isPublicView={isPublicView}
      />
    );
  }

  // Return the original NodeRenderer with enhanced tracking
  return (
    <NodeRenderer
      {...enhancedProps}
    />
  );
};

// Helper function to determine if a response is correct
const determineResponseCorrectness = (node: NLJNode, responseData: NodeResponseValue): boolean | undefined => {
  switch (node.type) {
    case 'true_false':
      const tfResponse = responseData as boolean;
      const tfCorrect = (node as any).correctAnswer;
      return tfResponse === tfCorrect;

    case 'multiple_choice':
      const mcResponse = responseData as string;
      const mcChoices = (node as any).choices || [];
      const selectedChoice = mcChoices.find((choice: any) => choice.id === mcResponse);
      return selectedChoice?.choiceType === 'CORRECT';

    case 'short_answer':
      const saResponse = responseData as string;
      const saAnswers = (node as any).acceptedAnswers || [];
      return saAnswers.some((answer: string) => 
        answer.toLowerCase().trim() === saResponse.toLowerCase().trim()
      );

    case 'ordering':
      // For ordering, check if the order matches the correct sequence
      const orderResponse = responseData as string[];
      const correctOrder = (node as any).correctOrder || [];
      return JSON.stringify(orderResponse) === JSON.stringify(correctOrder);

    case 'matching':
      // For matching, check if all pairs are correct
      const matchResponse = responseData as Record<string, string>;
      const correctPairs = (node as any).correctPairs || {};
      return Object.entries(matchResponse).every(([key, value]) => 
        correctPairs[key] === value
      );

    case 'likert_scale':
    case 'rating':
    case 'slider':
    case 'text_area':
    case 'matrix':
      // These don't have inherently correct answers
      return undefined;

    case 'connections':
      const connectionsResponse = responseData as any;
      return connectionsResponse?.allGroupsFound === true;

    case 'wordle':
      const wordleResponse = responseData as any;
      return wordleResponse?.solved === true;

    default:
      return undefined;
  }
};

// Helper function to calculate a score for the node interaction
const calculateNodeScore = (
  node: NLJNode, 
  responseData: NodeResponseValue, 
  isCorrect?: boolean
): number | undefined => {
  if (isCorrect === undefined) {
    return undefined;
  }

  // Base score calculation
  let baseScore = isCorrect ? 100 : 0;

  // Adjust score based on node type and complexity
  switch (node.type) {
    case 'connections':
      const connectionsResponse = responseData as any;
      const foundGroups = connectionsResponse?.foundGroups?.length || 0;
      const totalGroups = 4; // Connections always has 4 groups
      baseScore = (foundGroups / totalGroups) * 100;
      break;

    case 'wordle':
      const wordleResponse = responseData as any;
      if (wordleResponse?.solved) {
        // Score based on number of attempts (fewer attempts = higher score)
        const attempts = wordleResponse.attempts || 6;
        baseScore = Math.max(10, 100 - (attempts - 1) * 15);
      }
      break;

    case 'ordering':
      // Partial credit for ordering - score based on how many items are in correct positions
      const orderResponse = responseData as string[];
      const correctOrder = (node as any).correctOrder || [];
      if (correctOrder.length > 0) {
        const correctPositions = orderResponse.filter((item, index) => 
          item === correctOrder[index]
        ).length;
        baseScore = (correctPositions / correctOrder.length) * 100;
      }
      break;

    case 'matching':
      // Partial credit for matching - score based on correct pairs
      const matchResponse = responseData as Record<string, string>;
      const correctPairs = (node as any).correctPairs || {};
      const totalPairs = Object.keys(correctPairs).length;
      if (totalPairs > 0) {
        const correctMatches = Object.entries(matchResponse).filter(([key, value]) => 
          correctPairs[key] === value
        ).length;
        baseScore = (correctMatches / totalPairs) * 100;
      }
      break;

    case 'matrix':
      // For matrix questions, could implement sophisticated scoring
      // For now, just return undefined to indicate no scoring
      return undefined;

    default:
      // For other question types, use binary scoring
      baseScore = isCorrect ? 100 : 0;
  }

  return Math.round(baseScore);
};

export default EnhancedNodeRenderer;