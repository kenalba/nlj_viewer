/**
 * SurveyConfigurationService Tests
 * Validates scale detection and configuration generation for all NLJ node types
 */

import { describe, it, expect } from 'vitest';
import { SurveyConfigurationService } from '../SurveyConfigurationService';
import type { 
  NLJScenario, 
  LikertScaleNode, 
  RatingNode, 
  TrueFalseNode,
  TextAreaNode,
  MatrixNode,
  SliderNode,
  QuestionNode
} from '../../types/nlj';

const configService = new SurveyConfigurationService();

// Mock survey scenarios for testing
const createMockLikertNode = (): LikertScaleNode => ({
  id: 'likert-1',
  type: 'likert_scale',
  x: 0, y: 0, width: 300, height: 200,
  text: 'How satisfied are you with our service?',
  content: 'Please rate your satisfaction',
  scale: {
    min: 1,
    max: 5,
    labels: {
      min: 'Very Dissatisfied',
      max: 'Very Satisfied',
      middle: 'Neutral'
    }
  },
  required: true,
  followUp: { enabled: true }
});

const createMockRatingNode = (): RatingNode => ({
  id: 'rating-1', 
  type: 'rating',
  x: 0, y: 0, width: 300, height: 200,
  text: 'Rate the quality of our product',
  ratingType: 'stars',
  range: { min: 1, max: 5 },
  required: true
});

const createMockTrueFalseNode = (): TrueFalseNode => ({
  id: 'tf-1',
  type: 'true_false',
  x: 0, y: 0, width: 300, height: 200,
  text: 'Would you recommend us to a friend?',
  required: true
});

const createMockNPSNode = (): LikertScaleNode => ({
  id: 'nps-1',
  type: 'likert_scale',
  x: 0, y: 0, width: 300, height: 200,
  text: 'How likely are you to recommend us?',
  scale: {
    min: 0,
    max: 10,
    labels: {
      min: 'Not at all likely',
      max: 'Extremely likely'
    }
  },
  required: true
});

const createMockMatrixNode = (): MatrixNode => ({
  id: 'matrix-1',
  type: 'matrix',
  x: 0, y: 0, width: 300, height: 200,
  text: 'Rate each aspect of our service',
  rows: [
    { id: 'speed', text: 'Speed of service', required: true },
    { id: 'quality', text: 'Quality of service', required: true }
  ],
  columns: [
    { id: 'poor', text: 'Poor', value: 1 },
    { id: 'fair', text: 'Fair', value: 2 },
    { id: 'good', text: 'Good', value: 3 },
    { id: 'excellent', text: 'Excellent', value: 4 }
  ],
  matrixType: 'single',
  required: true
});

const createMockSliderNode = (): SliderNode => ({
  id: 'slider-1',
  type: 'slider',
  x: 0, y: 0, width: 300, height: 200,
  text: 'How would you rate your overall experience?',
  range: { min: 0, max: 100, step: 1 },
  labels: {
    min: 'Poor',
    max: 'Excellent'
  },
  required: true
});

const createMockTextAreaNode = (): TextAreaNode => ({
  id: 'text-1',
  type: 'text_area',
  x: 0, y: 0, width: 300, height: 200,
  text: 'Please provide additional feedback',
  placeholder: 'Your comments here...',
  maxLength: 500,
  required: false
});

const createMockSurvey = (nodes: any[], surveyMetadata?: any): NLJScenario => ({
  id: 'test-survey',
  name: 'Test Customer Satisfaction Survey',
  orientation: 'vertical',
  nodes,
  links: [],
  activityType: 'survey',
  surveyMetadata
});

describe('SurveyConfigurationService', () => {
  describe('Scale Detection', () => {
    it('should detect Likert scale correctly', () => {
      const likertNode = createMockLikertNode();
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      expect(config.questions).toHaveLength(1);
      const question = config.questions[0];
      expect(question.scale.type).toBe('likert');
      expect(question.scale.range).toEqual([1, 5]);
      expect(question.scale.valueCount).toBe(5);
      expect(question.scale.semanticMapping).toBe('satisfaction');
      expect(question.scale.colorScheme).toBe('likert');
    });

    it('should detect NPS scale (0-10) correctly', () => {
      const npsNode = createMockNPSNode();
      const survey = createMockSurvey([npsNode]);
      const config = configService.generateConfiguration(survey);
      
      const question = config.questions[0];
      expect(question.scale.type).toBe('nps');
      expect(question.scale.range).toEqual([0, 10]);
      expect(question.scale.valueCount).toBe(11);
      expect(question.scale.colorScheme).toBe('nps');
      expect(question.scale.positiveThreshold).toBe(7); // 70% of 10
    });

    it('should detect rating scale correctly', () => {
      const ratingNode = createMockRatingNode();
      const survey = createMockSurvey([ratingNode]);
      const config = configService.generateConfiguration(survey);
      
      const question = config.questions[0];
      expect(question.scale.type).toBe('rating');
      expect(question.scale.subtype).toBe('stars');
      expect(question.scale.range).toEqual([1, 5]);
      expect(question.scale.semanticMapping).toBe('satisfaction');
    });

    it('should detect binary scale correctly', () => {
      const binaryNode = createMockTrueFalseNode();
      const survey = createMockSurvey([binaryNode]);
      const config = configService.generateConfiguration(survey);
      
      const question = config.questions[0];
      expect(question.scale.type).toBe('binary');
      expect(question.scale.range).toEqual([0, 1]);
      expect(question.scale.labels).toEqual(['False', 'True']);
      expect(question.scale.valueCount).toBe(2);
      expect(question.scale.colorScheme).toBe('binary');
    });

    it('should detect matrix scale correctly', () => {
      const matrixNode = createMockMatrixNode();
      const survey = createMockSurvey([matrixNode]);
      const config = configService.generateConfiguration(survey);
      
      const question = config.questions[0];
      expect(question.scale.type).toBe('matrix');
      expect(question.scale.subtype).toBe('single');
      expect(question.scale.labels).toEqual(['Poor', 'Fair', 'Good', 'Excellent']);
      expect(question.scale.values).toEqual([1, 2, 3, 4]);
      expect(question.scale.valueCount).toBe(4);
    });

    it('should detect slider scale correctly', () => {
      const sliderNode = createMockSliderNode();
      const survey = createMockSurvey([sliderNode]);
      const config = configService.generateConfiguration(survey);
      
      const question = config.questions[0];
      expect(question.scale.type).toBe('numeric');
      expect(question.scale.subtype).toBe('slider');
      expect(question.scale.range).toEqual([0, 100]);
      expect(question.scale.labels).toEqual(['Poor', 'Excellent']);
      expect(question.scale.positiveThreshold).toBe(70); // 70% of 100
    });

    it('should detect text scale correctly', () => {
      const textNode = createMockTextAreaNode();
      const survey = createMockSurvey([textNode]);
      const config = configService.generateConfiguration(survey);
      
      const question = config.questions[0];
      expect(question.scale.type).toBe('text');
      expect(question.scale.labels).toEqual(['Text Response']);
      expect(question.scale.values).toEqual(['text']);
      expect(question.scale.colorScheme).toBe('custom');
      expect(question.analyticsEnabled).toBe(false); // Text areas don't support standard analytics
    });
  });

  describe('Survey Type Detection', () => {
    it('should use explicit survey type from metadata', () => {
      const nodes = [createMockLikertNode(), createMockRatingNode()];
      const survey = createMockSurvey(nodes, { surveyType: 'engagement' });
      const config = configService.generateConfiguration(survey);
      
      expect(config.type).toBe('engagement');
    });

    it('should detect satisfaction survey type from name', () => {
      const nodes = [createMockLikertNode(), createMockRatingNode()];
      const survey = createMockSurvey(nodes);
      survey.name = 'Customer Satisfaction Survey';
      const config = configService.generateConfiguration(survey);
      
      expect(config.type).toBe('satisfaction');
    });

    it('should detect custom survey type when no pattern matches', () => {
      const textNode = createMockTextAreaNode();
      textNode.text = 'What is your favorite color?';
      const survey = createMockSurvey([textNode]);
      survey.name = 'Random Questions Survey'; // Non-matching name
      const config = configService.generateConfiguration(survey);
      
      expect(config.type).toBe('feedback'); // Default for 'survey' activityType
    });

    it('should fall back to custom for non-survey activity types', () => {
      const textNode = createMockTextAreaNode();
      const survey = createMockSurvey([textNode]);
      survey.activityType = 'training'; // Non-survey activity type
      const config = configService.generateConfiguration(survey);
      
      expect(config.type).toBe('custom');
    });
  });

  describe('Question Configuration', () => {
    it('should extract question metadata correctly', () => {
      const likertNode = createMockLikertNode();
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      const question = config.questions[0];
      expect(question.nodeId).toBe('likert-1');
      expect(question.nodeType).toBe('likert_scale');
      expect(question.text).toBe('How satisfied are you with our service?');
      expect(question.isRequired).toBe(true);
      expect(question.hasFollowUp).toBe(true);
      expect(question.analyticsEnabled).toBe(true);
      expect(question.order).toBe(1);
    });

    it('should handle multiple questions with proper ordering', () => {
      const nodes = [
        createMockLikertNode(),
        createMockRatingNode(),
        createMockTrueFalseNode(),
        createMockTextAreaNode()
      ];
      const survey = createMockSurvey(nodes);
      const config = configService.generateConfiguration(survey);
      
      expect(config.questions).toHaveLength(4);
      expect(config.totalQuestions).toBe(4);
      expect(config.analyticsQuestions).toBe(3); // Text area doesn't support analytics
      
      // Check ordering
      config.questions.forEach((question, index) => {
        expect(question.order).toBe(index + 1);
      });
    });
  });

  describe('Semantic Mapping Detection', () => {
    it('should use metadata semantic mapping override', () => {
      const likertNode = createMockLikertNode();
      const survey = createMockSurvey([likertNode], { 
        defaultSemanticMapping: 'performance' 
      });
      const config = configService.generateConfiguration(survey);
      
      expect(config.questions[0].scale.semanticMapping).toBe('performance');
    });

    it('should detect agreement semantic mapping', () => {
      const likertNode = createMockLikertNode();
      likertNode.text = 'Do you agree with our policies?';
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      expect(config.questions[0].scale.semanticMapping).toBe('agreement');
    });

    it('should detect performance semantic mapping', () => {
      const likertNode = createMockLikertNode();
      likertNode.text = 'How would you rate the quality of our performance?';
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      expect(config.questions[0].scale.semanticMapping).toBe('performance');
    });

    it('should detect frequency semantic mapping', () => {
      const likertNode = createMockLikertNode();
      likertNode.text = 'How often do you use our service?';
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      expect(config.questions[0].scale.semanticMapping).toBe('frequency');
    });

    it('should default to custom for unrecognized patterns', () => {
      const likertNode = createMockLikertNode();
      likertNode.text = 'What is your favorite aspect?';
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      expect(config.questions[0].scale.semanticMapping).toBe('custom');
    });
  });

  describe('Configuration Metadata', () => {
    it('should generate correct demographic configuration', () => {
      const survey = createMockSurvey([createMockLikertNode()]);
      const config = configService.generateConfiguration(survey);
      
      expect(config.demographics).toEqual({
        primary: ['department', 'location'],
        secondary: ['tenure', 'role', 'manager'],
        hierarchical: true,
        anonymizationThreshold: 4,
        availableGroupings: ['department', 'location', 'tenure', 'role', 'manager', 'team', 'audience']
      });
    });

    it('should estimate completion time correctly', () => {
      const nodes = [
        createMockLikertNode(), // 10s + 20s follow-up = 30s
        createMockRatingNode(),  // 8s
        createMockTrueFalseNode(), // 5s
        createMockTextAreaNode() // 45s
      ];
      const survey = createMockSurvey(nodes);
      const config = configService.generateConfiguration(survey);
      
      expect(config.estimatedCompletionTime).toBe(88); // 30 + 8 + 5 + 45
    });

    it('should set proper display configuration', () => {
      const survey = createMockSurvey([createMockLikertNode()]);
      const config = configService.generateConfiguration(survey);
      
      expect(config.displayConfig).toEqual({
        defaultGroupBy: 'location', // Default when no department metadata
        showTrends: true,
        showBenchmarks: false, // Default when no benchmarkCategory
        compactMode: false
      });
    });

    it('should use metadata for display configuration', () => {
      const survey = createMockSurvey([createMockLikertNode()], {
        department: 'Sales',
        benchmarkCategory: 'automotive'
      });
      const config = configService.generateConfiguration(survey);
      
      expect(config.displayConfig).toEqual({
        defaultGroupBy: 'department', // From metadata
        showTrends: true,
        showBenchmarks: true, // From benchmarkCategory
        compactMode: false
      });
    });
  });

  describe('Label Generation', () => {
    it('should generate 5-point Likert labels correctly', () => {
      const likertNode = createMockLikertNode();
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      const expectedLabels = [
        'Very Dissatisfied',
        'Disagree', 
        'Neutral',
        'Agree',
        'Very Satisfied'
      ];
      expect(config.questions[0].scale.labels).toEqual(expectedLabels);
    });

    it('should handle custom Likert labels', () => {
      const likertNode = createMockLikertNode();
      likertNode.scale.labels.custom = {
        1: 'Terrible',
        2: 'Poor',
        3: 'Okay',
        4: 'Good', 
        5: 'Amazing'
      };
      const survey = createMockSurvey([likertNode]);
      const config = configService.generateConfiguration(survey);
      
      const expectedLabels = ['Terrible', 'Poor', 'Okay', 'Good', 'Amazing'];
      expect(config.questions[0].scale.labels).toEqual(expectedLabels);
    });
  });
});