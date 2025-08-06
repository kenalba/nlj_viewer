import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import type { FlowNodeType } from '../../types/flow';

// Mock Material-UI icons
vi.mock('@mui/icons-material', () => ({
  PlayArrow: () => React.createElement('div', { 'data-testid': 'start-icon' }),
  Stop: () => React.createElement('div', { 'data-testid': 'end-icon' }),
  Quiz: () => React.createElement('div', { 'data-testid': 'question-icon' }),
  CheckCircle: () => React.createElement('div', { 'data-testid': 'choice-icon' }),
  Article: () => React.createElement('div', { 'data-testid': 'interstitial-icon' }),
  CheckBox: () => React.createElement('div', { 'data-testid': 'true-false-icon' }),
  Reorder: () => React.createElement('div', { 'data-testid': 'ordering-icon' }),
  Link: () => React.createElement('div', { 'data-testid': 'matching-icon' }),
  Edit: () => React.createElement('div', { 'data-testid': 'short-answer-icon' }),
  BarChart: () => React.createElement('div', { 'data-testid': 'likert-icon' }),
  Star: () => React.createElement('div', { 'data-testid': 'rating-icon' }),
  Grid3x3: () => React.createElement('div', { 'data-testid': 'matrix-icon' }),
  Tune: () => React.createElement('div', { 'data-testid': 'slider-icon' }),
  Notes: () => React.createElement('div', { 'data-testid': 'text-area-icon' }),
  CheckBoxOutlineBlank: () => React.createElement('div', { 'data-testid': 'multi-select-icon' }),
  SportsEsports: () => React.createElement('div', { 'data-testid': 'connections-icon' }),
  Games: () => React.createElement('div', { 'data-testid': 'wordle-icon' }),
}));

import {
  getNodeIcon,
  getNodeTypeInfo,
  usesChoiceNodes,
  isSelfContained,
  isGame,
  supportsMedia,
  hasInteractiveElements,
  getNodeTypeDisplayName,
  getNodeTypeDescription,
  getNodeTypeCategory,
  getNodeTypeColor,
  getNodeTypeEmoji,
  getNodeTypesByCategory,
  getNodeCategories,
  isQuestionType,
  isSurveyType,
  isStructureType,
  isValidNodeType,
  getDefaultNodeTypeForCategory,
} from '../nodeTypeUtils.tsx';

describe('nodeTypeUtils', () => {
  describe('getNodeIcon', () => {
    it('returns a React element for valid node types', () => {
      const icon = getNodeIcon('start');
      expect(icon).toBeDefined();
      expect(typeof icon).toBe('object');
      expect(icon.type).toBeDefined();
    });

    it('returns default icon for invalid node types', () => {
      const icon = getNodeIcon('invalid' as FlowNodeType);
      expect(icon).toBeDefined();
    });
  });

  describe('getNodeTypeInfo', () => {
    it('returns correct info for valid node types', () => {
      const info = getNodeTypeInfo('start');
      expect(info).toBeDefined();
      expect(info.type).toBe('start');
      expect(info.label).toBe('Start');
      expect(info.category).toBe('structure');
    });

    it('returns fallback info for invalid node types', () => {
      const info = getNodeTypeInfo('invalid' as FlowNodeType);
      expect(info).toBeDefined();
      expect(info.type).toBe('question'); // fallback
    });
  });

  describe('usesChoiceNodes', () => {
    it('returns true for question types with choices', () => {
      expect(usesChoiceNodes('question')).toBe(true);
      expect(usesChoiceNodes('multi_select')).toBe(true);
      expect(usesChoiceNodes('checkbox')).toBe(true);
    });

    it('returns false for types without choices', () => {
      expect(usesChoiceNodes('true_false')).toBe(false);
      expect(usesChoiceNodes('start')).toBe(false);
      expect(usesChoiceNodes('connections')).toBe(false);
    });
  });

  describe('isSelfContained', () => {
    it('returns true for self-contained types', () => {
      expect(isSelfContained('connections')).toBe(true);
      expect(isSelfContained('wordle')).toBe(true);
      expect(isSelfContained('likert_scale')).toBe(true);
      expect(isSelfContained('true_false')).toBe(true);
    });

    it('returns false for non-self-contained types', () => {
      expect(isSelfContained('question')).toBe(false);
      expect(isSelfContained('start')).toBe(false);
      expect(isSelfContained('interstitial_panel')).toBe(false);
    });
  });

  describe('isGame', () => {
    it('returns true for game types', () => {
      expect(isGame('connections')).toBe(true);
      expect(isGame('wordle')).toBe(true);
    });

    it('returns false for non-game types', () => {
      expect(isGame('question')).toBe(false);
      expect(isGame('start')).toBe(false);
      expect(isGame('likert_scale')).toBe(false);
    });
  });

  describe('supportsMedia', () => {
    it('returns true for types that support media', () => {
      expect(supportsMedia('question')).toBe(true);
      expect(supportsMedia('interstitial_panel')).toBe(true);
      expect(supportsMedia('connections')).toBe(true);
    });

    it('returns false for types that do not support media', () => {
      expect(supportsMedia('start')).toBe(false);
      expect(supportsMedia('end')).toBe(false);
      expect(supportsMedia('choice')).toBe(false);
    });
  });

  describe('hasInteractiveElements', () => {
    it('returns true for interactive types', () => {
      expect(hasInteractiveElements('question')).toBe(true);
      expect(hasInteractiveElements('true_false')).toBe(true);
      expect(hasInteractiveElements('connections')).toBe(true);
    });

    it('returns false for non-interactive types', () => {
      expect(hasInteractiveElements('start')).toBe(false);
      expect(hasInteractiveElements('end')).toBe(false);
      expect(hasInteractiveElements('interstitial_panel')).toBe(false);
    });
  });

  describe('getNodeTypeDisplayName', () => {
    it('returns correct display names', () => {
      expect(getNodeTypeDisplayName('start')).toBe('Start');
      expect(getNodeTypeDisplayName('question')).toBe('Multiple Choice');
      expect(getNodeTypeDisplayName('true_false')).toBe('True/False');
      expect(getNodeTypeDisplayName('connections')).toBe('Connections');
    });
  });

  describe('getNodeTypeDescription', () => {
    it('returns correct descriptions', () => {
      expect(getNodeTypeDescription('start')).toBe('Entry point of the scenario');
      expect(getNodeTypeDescription('question')).toBe('Question with multiple choice answers');
      expect(getNodeTypeDescription('connections')).toBe('Word grouping game');
    });
  });

  describe('getNodeTypeCategory', () => {
    it('returns correct categories', () => {
      expect(getNodeTypeCategory('start')).toBe('structure');
      expect(getNodeTypeCategory('question')).toBe('assessment');
      expect(getNodeTypeCategory('likert_scale')).toBe('survey');
      expect(getNodeTypeCategory('connections')).toBe('game');
    });
  });

  describe('getNodeTypeColor', () => {
    it('returns valid color values', () => {
      const color = getNodeTypeColor('start');
      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
      expect(color.startsWith('#')).toBe(true);
    });
  });

  describe('getNodeTypeEmoji', () => {
    it('returns emoji icons', () => {
      expect(getNodeTypeEmoji('start')).toBe('🏁');
      expect(getNodeTypeEmoji('end')).toBe('🎯');
      expect(getNodeTypeEmoji('question')).toBe('❓');
      expect(getNodeTypeEmoji('connections')).toBe('🎮');
    });
  });

  describe('getNodeTypesByCategory', () => {
    it('returns correct node types for each category', () => {
      const structureTypes = getNodeTypesByCategory('structure');
      expect(structureTypes).toContain('start');
      expect(structureTypes).toContain('end');
      expect(structureTypes).toContain('interstitial_panel');

      const assessmentTypes = getNodeTypesByCategory('assessment');
      expect(assessmentTypes).toContain('question');
      expect(assessmentTypes).toContain('true_false');
      expect(assessmentTypes).toContain('multi_select');
      expect(assessmentTypes).toContain('choice');

      const surveyTypes = getNodeTypesByCategory('survey');
      expect(surveyTypes).toContain('likert_scale');
      expect(surveyTypes).toContain('rating');
      expect(surveyTypes).toContain('matrix');

      const gameTypes = getNodeTypesByCategory('game');
      expect(gameTypes).toContain('connections');
      expect(gameTypes).toContain('wordle');
    });
  });

  describe('getNodeCategories', () => {
    it('returns all available categories', () => {
      const categories = getNodeCategories();
      expect(categories).toContain('structure');
      expect(categories).toContain('assessment');
      expect(categories).toContain('survey');
      expect(categories).toContain('game');
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('isQuestionType', () => {
    it('returns true for question types', () => {
      expect(isQuestionType('question')).toBe(true);
      expect(isQuestionType('true_false')).toBe(true);
      expect(isQuestionType('ordering')).toBe(true);
      expect(isQuestionType('matching')).toBe(true);
      expect(isQuestionType('short_answer')).toBe(true);
      expect(isQuestionType('multi_select')).toBe(true);
      expect(isQuestionType('checkbox')).toBe(true);
    });

    it('returns false for non-question types', () => {
      expect(isQuestionType('start')).toBe(false);
      expect(isQuestionType('likert_scale')).toBe(false);
      expect(isQuestionType('connections')).toBe(false);
    });
  });

  describe('isSurveyType', () => {
    it('returns true for survey types', () => {
      expect(isSurveyType('likert_scale')).toBe(true);
      expect(isSurveyType('rating')).toBe(true);
      expect(isSurveyType('matrix')).toBe(true);
      expect(isSurveyType('slider')).toBe(true);
      expect(isSurveyType('text_area')).toBe(true);
    });

    it('returns false for non-survey types', () => {
      expect(isSurveyType('question')).toBe(false);
      expect(isSurveyType('start')).toBe(false);
      expect(isSurveyType('connections')).toBe(false);
    });
  });

  describe('isStructureType', () => {
    it('returns true for structure types', () => {
      expect(isStructureType('start')).toBe(true);
      expect(isStructureType('end')).toBe(true);
      expect(isStructureType('interstitial_panel')).toBe(true);
      // Note: choice is actually in assessment category, not structure
    });

    it('returns false for non-structure types', () => {
      expect(isStructureType('question')).toBe(false);
      expect(isStructureType('likert_scale')).toBe(false);
      expect(isStructureType('connections')).toBe(false);
    });
  });

  describe('isValidNodeType', () => {
    it('returns true for valid node types', () => {
      expect(isValidNodeType('start')).toBe(true);
      expect(isValidNodeType('question')).toBe(true);
      expect(isValidNodeType('connections')).toBe(true);
    });

    it('returns false for invalid node types', () => {
      expect(isValidNodeType('invalid')).toBe(false);
      expect(isValidNodeType('')).toBe(false);
      expect(isValidNodeType('unknown')).toBe(false);
    });
  });

  describe('getDefaultNodeTypeForCategory', () => {
    it('returns valid default node types for each category', () => {
      const structureDefault = getDefaultNodeTypeForCategory('structure');
      expect(isValidNodeType(structureDefault)).toBe(true);
      expect(getNodeTypeCategory(structureDefault)).toBe('structure');

      const assessmentDefault = getDefaultNodeTypeForCategory('assessment');
      expect(isValidNodeType(assessmentDefault)).toBe(true);
      expect(getNodeTypeCategory(assessmentDefault)).toBe('assessment');

      const surveyDefault = getDefaultNodeTypeForCategory('survey');
      expect(isValidNodeType(surveyDefault)).toBe(true);
      expect(getNodeTypeCategory(surveyDefault)).toBe('survey');

      const gameDefault = getDefaultNodeTypeForCategory('game');
      expect(isValidNodeType(gameDefault)).toBe(true);
      expect(getNodeTypeCategory(gameDefault)).toBe('game');
    });

    it('returns fallback for invalid category', () => {
      const fallback = getDefaultNodeTypeForCategory('invalid');
      expect(fallback).toBe('question');
    });
  });
});