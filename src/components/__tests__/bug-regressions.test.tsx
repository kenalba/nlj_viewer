import React from 'react';
import { render, screen, fireEvent, waitFor, vi } from '../../test/utils';
import { NodeRenderer } from '../NodeRenderer';
import { LikertScaleNode } from '../LikertScaleNode';
import { RatingNode } from '../RatingNode';
import { createMockLikertQuestion, createMockRatingQuestion } from '../../test/utils';
import type { NLJScenario } from '../../types/nlj';
import { GameContext } from '../../contexts/GameContext';

describe('Bug Regression Tests', () => {
  describe('Bug #4: Survey Question State Persistence Issue', () => {
    it('should reset state when navigating between different likert scale questions', async () => {
      const question1 = createMockLikertQuestion({ 
        id: 'q1', 
        text: 'Question 1: How satisfied are you with your job?',
        scale: { min: 1, max: 5, step: 1, labels: { min: 'Very Dissatisfied', max: 'Very Satisfied' } }
      });
      
      const question2 = createMockLikertQuestion({ 
        id: 'q2', 
        text: 'Question 2: How likely are you to recommend us?',
        scale: { min: 1, max: 5, step: 1, labels: { min: 'Very Unlikely', max: 'Very Likely' } }
      });

      const onAnswer = vi.fn();
      const { rerender } = render(
        <LikertScaleNode key="q1" question={question1} onAnswer={onAnswer} />
      );

      // Answer first question
      const button3 = screen.getByRole('button', { name: /3/i });
      fireEvent.click(button3);
      
      // Verify first question has selected value - button should be in contained variant
      expect(button3).toHaveClass('MuiButton-contained');

      // Navigate to second question by re-rendering with new question
      rerender(
        <LikertScaleNode key="q2" question={question2} onAnswer={onAnswer} />
      );

      // Wait for component to update
      await waitFor(() => {
        expect(screen.getByText('Question 2: How likely are you to recommend us?')).toBeInTheDocument();
      });

      // Verify second question has NO selected value (state was reset)
      const newButton3 = screen.getByRole('button', { name: /3/i });
      expect(newButton3).toHaveClass('MuiButton-outlined');
      expect(newButton3).not.toHaveClass('MuiButton-contained');
      
      // Verify all buttons are in unselected state
      const allButtons = screen.getAllByRole('button');
      const scaleButtons = allButtons.filter(btn => btn.textContent?.match(/^[1-5]$/));
      scaleButtons.forEach(btn => {
        expect(btn).toHaveClass('MuiButton-outlined');
        expect(btn).not.toHaveClass('MuiButton-contained');
      });
    });

    it('should reset state when navigating between different rating questions', async () => {
      const question1 = createMockRatingQuestion({ 
        id: 'r1', 
        text: 'Rate your experience',
        ratingType: 'stars',
        range: { min: 1, max: 5 }
      });
      
      const question2 = createMockRatingQuestion({ 
        id: 'r2', 
        text: 'Rate our service',
        ratingType: 'stars',
        range: { min: 1, max: 5 }
      });

      const onAnswer = vi.fn();
      const { rerender } = render(
        <RatingNode key="r1" question={question1} onAnswer={onAnswer} />
      );

      // Answer first question by clicking on stars
      const stars = screen.getAllByRole('button');
      const starButton = stars.find(btn => btn.getAttribute('aria-label')?.includes('3 Stars'));
      if (starButton) {
        fireEvent.click(starButton);
      }

      // Navigate to second question
      rerender(
        <RatingNode key="r2" question={question2} onAnswer={onAnswer} />
      );

      // Wait for component to update
      await waitFor(() => {
        expect(screen.getByText('Rate our service')).toBeInTheDocument();
      });

      // Verify rating was reset (no stars should be filled)
      const newStars = screen.getAllByRole('button');
      const starButtons = newStars.filter(btn => btn.getAttribute('aria-label')?.includes('Stars'));
      // Check that no stars are in "filled" state
      starButtons.forEach(btn => {
        expect(btn).not.toHaveClass('Mui-selected');
      });
    });

    it('should reset state when same question type appears multiple times in sequence', async () => {
      const question1 = createMockLikertQuestion({ 
        id: 'seq1', 
        text: 'First question',
        scale: { min: 1, max: 7, step: 1, labels: { min: 'Strongly Disagree', max: 'Strongly Agree' } }
      });
      
      const question2 = createMockLikertQuestion({ 
        id: 'seq2', 
        text: 'Second question',
        scale: { min: 1, max: 7, step: 1, labels: { min: 'Strongly Disagree', max: 'Strongly Agree' } }
      });

      const onAnswer = vi.fn();
      const { rerender } = render(
        <LikertScaleNode key="seq1" question={question1} onAnswer={onAnswer} />
      );

      // Select value 5 on first question
      const button5 = screen.getByRole('button', { name: /5/i });
      fireEvent.click(button5);

      // Verify selection
      expect(button5).toHaveClass('MuiButton-contained');

      // Navigate to second question of same type
      rerender(
        <LikertScaleNode key="seq2" question={question2} onAnswer={onAnswer} />
      );

      // Wait for component to update
      await waitFor(() => {
        expect(screen.getByText('Second question')).toBeInTheDocument();
      });

      // Verify that button 5 is NOT selected in the new question
      const newButton5 = screen.getByRole('button', { name: /5/i });
      expect(newButton5).toHaveClass('MuiButton-outlined');
      expect(newButton5).not.toHaveClass('MuiButton-contained');
    });
  });

  describe('Bug #5: Survey Question Navigation Failure', () => {
    const createMockScenario = (nodes: any[], links: any[]): NLJScenario => ({
      id: 'test-scenario',
      name: 'Test Survey',
      nodes,
      links,
      variableDefinitions: [],
    });

    it('should not complete scenario prematurely when navigation fails', async () => {
      const mockCompleteScenario = vi.fn();
      const mockNavigateToNode = vi.fn();
      
      const nodes = [
        { id: 'start', type: 'start', x: 100, y: 100, width: 200, height: 100 },
        { id: 'q1', type: 'likert_scale', x: 100, y: 200, width: 400, height: 200, text: 'Question 1', scale: { min: 1, max: 5, step: 1, labels: { min: 'Min', max: 'Max' } } },
        { id: 'q2', type: 'likert_scale', x: 100, y: 300, width: 400, height: 200, text: 'Question 2', scale: { min: 1, max: 5, step: 1, labels: { min: 'Min', max: 'Max' } } },
        { id: 'end', type: 'end', x: 100, y: 400, width: 200, height: 100 },
      ];

      const links = [
        { id: 'start-q1', type: 'link', sourceNodeId: 'start', targetNodeId: 'q1' },
        { id: 'q1-q2', type: 'link', sourceNodeId: 'q1', targetNodeId: 'q2' },
        { id: 'q2-end', type: 'link', sourceNodeId: 'q2', targetNodeId: 'end' },
      ];

      const scenario = createMockScenario(nodes, links);
      
      // Mock the game context to capture calls
      const mockGameContext = {
        state: { 
          scenarioId: 'test', 
          currentNodeId: 'q1', 
          variables: {}, 
          visitedNodes: new Set(),
          completed: false,
          activityType: 'survey' as const,
          responses: {},
          sessionId: 'test-session',
          startTime: new Date(),
        },
        navigateToNode: mockNavigateToNode,
        completeScenario: mockCompleteScenario,
        updateVariable: vi.fn(),
        loadScenario: vi.fn(),
        reset: vi.fn(),
      };

      render(
        <GameContext.Provider value={mockGameContext}>
          <NodeRenderer node={nodes[1]} scenario={scenario} />
        </GameContext.Provider>
      );

      // Answer the question
      const button3 = screen.getByRole('button', { name: /3/i });
      fireEvent.click(button3);
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      // Wait for navigation logic to execute
      await waitFor(() => {
        // Should navigate to next node, not complete scenario
        expect(mockNavigateToNode).toHaveBeenCalledWith('q2');
        expect(mockCompleteScenario).not.toHaveBeenCalled();
      });
    });

    it('should only complete scenario when reaching actual end node', async () => {
      const mockCompleteScenario = vi.fn();
      const mockNavigateToNode = vi.fn();
      
      const nodes = [
        { id: 'q1', type: 'likert_scale', x: 100, y: 200, width: 400, height: 200, text: 'Final Question', scale: { min: 1, max: 5, step: 1, labels: { min: 'Min', max: 'Max' } } },
        { id: 'end', type: 'end', x: 100, y: 400, width: 200, height: 100 },
      ];

      const links = [
        { id: 'q1-end', type: 'link', sourceNodeId: 'q1', targetNodeId: 'end' },
      ];

      const scenario = createMockScenario(nodes, links);
      
      const mockGameContext = {
        state: { 
          scenarioId: 'test', 
          currentNodeId: 'q1', 
          variables: {}, 
          visitedNodes: new Set(),
          completed: false,
          activityType: 'survey' as const,
          responses: {},
          sessionId: 'test-session',
          startTime: new Date(),
        },
        navigateToNode: mockNavigateToNode,
        completeScenario: mockCompleteScenario,
        updateVariable: vi.fn(),
        loadScenario: vi.fn(),
        reset: vi.fn(),
      };

      render(
        <GameContext.Provider value={mockGameContext}>
          <NodeRenderer node={nodes[0]} scenario={scenario} />
        </GameContext.Provider>
      );

      // Answer the final question
      const button3 = screen.getByRole('button', { name: /3/i });
      fireEvent.click(button3);
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      // Wait for navigation logic to execute
      await waitFor(() => {
        // Should complete scenario when reaching end node
        expect(mockCompleteScenario).toHaveBeenCalled();
      });
    });

    it('should log error when navigation fails due to missing links', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockCompleteScenario = vi.fn();
      const mockNavigateToNode = vi.fn();
      
      const nodes = [
        { id: 'q1', type: 'likert_scale', x: 100, y: 200, width: 400, height: 200, text: 'Orphaned Question', scale: { min: 1, max: 5, step: 1, labels: { min: 'Min', max: 'Max' } } },
      ];

      // No links - this should cause navigation failure
      const links: any[] = [];

      const scenario = createMockScenario(nodes, links);
      
      const mockGameContext = {
        state: { 
          scenarioId: 'test', 
          currentNodeId: 'q1', 
          variables: {}, 
          visitedNodes: new Set(),
          completed: false,
          activityType: 'survey' as const,
          responses: {},
          sessionId: 'test-session',
          startTime: new Date(),
        },
        navigateToNode: mockNavigateToNode,
        completeScenario: mockCompleteScenario,
        updateVariable: vi.fn(),
        loadScenario: vi.fn(),
        reset: vi.fn(),
      };

      render(
        <GameContext.Provider value={mockGameContext}>
          <NodeRenderer node={nodes[0]} scenario={scenario} />
        </GameContext.Provider>
      );

      // Answer the question
      const button3 = screen.getByRole('button', { name: /3/i });
      fireEvent.click(button3);
      
      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);

      // Wait for navigation logic to execute
      await waitFor(() => {
        // Should log error and NOT complete scenario
        expect(consoleSpy).toHaveBeenCalledWith('Navigation failed: Could not find next node for q1');
        expect(mockCompleteScenario).not.toHaveBeenCalled();
        expect(mockNavigateToNode).not.toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});