/**
 * Survey Configuration Service
 * Auto-detects survey structure and generates configurations for analytics components
 * Supports all NLJ node types with intelligent scale detection
 */

import type {
  NLJScenario,
  NLJNode,
  LikertScaleNode,
  RatingNode,
  TrueFalseNode,
  TextAreaNode,
  MatrixNode,
  SliderNode,
  MultiSelectNode,
  CheckboxNode,
  QuestionNode,
  ShortAnswerNode
} from '../types/nlj';

// Survey analytics interfaces
export interface QuestionScale {
  id: string;
  type: 'likert' | 'nps' | 'binary' | 'rating' | 'categorical' | 'numeric' | 'text' | 'matrix';
  subtype?: string;
  range?: [number, number];
  labels: string[];
  values: (string | number)[];
  positiveThreshold?: number;
  semanticMapping: 'positive-negative' | 'satisfaction' | 'agreement' | 'performance' | 'frequency' | 'custom';
  // For analytics color coding
  colorScheme: 'likert' | 'nps' | 'binary' | 'custom';
  valueCount: number;
}

export interface QuestionConfiguration {
  id: string;
  nodeId: string;
  nodeType: string;
  title: string;
  text: string;
  scale: QuestionScale;
  isRequired: boolean;
  hasFollowUp: boolean;
  analyticsEnabled: boolean;
  // Metadata for demographics and grouping
  category?: string;
  section?: string;
  order: number;
}

export interface DemographicConfiguration {
  primary: string[];
  secondary: string[];
  hierarchical: boolean;
  anonymizationThreshold: number;
  availableGroupings: string[];
}

export interface SurveyConfiguration {
  surveyId: string;
  name: string;
  type: 'exit' | 'engagement' | 'satisfaction' | 'pulse' | 'performance' | 'custom';
  questions: QuestionConfiguration[];
  demographics: DemographicConfiguration;
  totalQuestions: number;
  analyticsQuestions: number;
  estimatedCompletionTime?: number;
  // Analytics display settings
  displayConfig: {
    defaultGroupBy: string;
    showTrends: boolean;
    showBenchmarks: boolean;
    compactMode: boolean;
  };
}

/**
 * Main service class for survey configuration detection
 */
export class SurveyConfigurationService {
  /**
   * Analyze NLJ scenario and generate survey configuration
   */
  public generateConfiguration(scenario: NLJScenario): SurveyConfiguration {
    // Filter nodes to only question/survey types
    const questionNodes = this.extractQuestionNodes(scenario.nodes);
    
    // Generate question configurations with metadata context
    const questions = questionNodes.map((node, index) => 
      this.generateQuestionConfiguration(node, index, scenario.surveyMetadata)
    );

    // Get survey type from metadata or detect from activity type
    const surveyType = this.determineSurveyType(scenario);

    // Generate demographic configuration with metadata context
    const demographics = this.generateDemographicConfiguration(scenario.surveyMetadata);

    // Calculate analytics metadata
    const analyticsEnabled = scenario.surveyMetadata?.enableAnalytics !== false; // Default true
    const analyticsQuestions = analyticsEnabled 
      ? questions.filter(q => q.analyticsEnabled).length 
      : 0;

    return {
      surveyId: scenario.id || 'unknown',
      name: scenario.name || 'Untitled Survey',
      type: surveyType,
      questions,
      demographics,
      totalQuestions: questions.length,
      analyticsQuestions,
      estimatedCompletionTime: this.estimateCompletionTime(questions),
      displayConfig: this.generateDisplayConfiguration(scenario.surveyMetadata),
    };
  }

  /**
   * Extract nodes that can be analyzed for survey analytics
   */
  private extractQuestionNodes(nodes: NLJNode[]): NLJNode[] {
    const questionNodeTypes = [
      'likert_scale',
      'rating', 
      'true_false',
      'text_area',
      'matrix',
      'slider',
      'multi_select',
      'checkbox',
      'question', // Multiple choice
      'short_answer'
    ];

    return nodes.filter(node => questionNodeTypes.includes(node.type));
  }

  /**
   * Generate configuration for individual question node
   */
  private generateQuestionConfiguration(node: NLJNode, order: number, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionConfiguration {
    const scale = this.detectQuestionScale(node, surveyMetadata);
    const isAnalyticsEnabled = this.isAnalyticsSupported(node.type) && (surveyMetadata?.enableAnalytics !== false);

    return {
      id: `question-${order + 1}`,
      nodeId: node.id,
      nodeType: node.type,
      title: this.extractQuestionTitle(node),
      text: this.extractQuestionText(node),
      scale,
      isRequired: this.extractRequired(node),
      hasFollowUp: this.hasFollowUpEnabled(node),
      analyticsEnabled: isAnalyticsEnabled,
      category: this.detectQuestionCategory(node),
      section: this.detectQuestionSection(node),
      order: order + 1,
    };
  }

  /**
   * Intelligent scale detection based on node type and configuration
   */
  private detectQuestionScale(node: NLJNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    switch (node.type) {
      case 'likert_scale':
        return this.createLikertScale(node as LikertScaleNode, surveyMetadata);
      
      case 'rating':
        return this.createRatingScale(node as RatingNode, surveyMetadata);
        
      case 'true_false':
        return this.createBinaryScale(node as TrueFalseNode, surveyMetadata);
        
      case 'slider':
        return this.createSliderScale(node as SliderNode, surveyMetadata);
        
      case 'matrix':
        return this.createMatrixScale(node as MatrixNode, surveyMetadata);
        
      case 'text_area':
        return this.createTextScale(node as TextAreaNode, surveyMetadata);
        
      case 'multi_select':
        return this.createMultiSelectScale(node as MultiSelectNode, surveyMetadata);
        
      case 'checkbox':
        return this.createCheckboxScale(node as CheckboxNode, surveyMetadata);
        
      case 'question':
        return this.createMultipleChoiceScale(node as QuestionNode, surveyMetadata);
        
      case 'short_answer':
        return this.createShortAnswerScale(node as ShortAnswerNode, surveyMetadata);
        
      default:
        return this.createGenericScale(node, surveyMetadata);
    }
  }

  /**
   * Create Likert scale configuration
   */
  private createLikertScale(node: LikertScaleNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    const { min, max, labels } = node.scale;
    const valueCount = max - min + 1;
    
    // Generate labels if not provided
    const scaleLabels = this.generateLikertLabels(min, max, labels);
    
    // Use metadata semantic mapping or detect from question text
    const semanticMapping = surveyMetadata?.defaultSemanticMapping || this.detectSemanticMapping(node.text);
    
    // Determine if this is NPS-style (0-10 scale)
    const isNPS = min === 0 && max === 10;
    
    return {
      id: `likert-${min}-${max}`,
      type: isNPS ? 'nps' : 'likert',
      range: [min, max],
      labels: scaleLabels,
      values: Array.from({ length: valueCount }, (_, i) => min + i),
      positiveThreshold: Math.ceil(max * 0.7), // 70% threshold for "positive"
      semanticMapping,
      colorScheme: isNPS ? 'nps' : 'likert',
      valueCount,
    };
  }

  /**
   * Create rating scale configuration
   */
  private createRatingScale(node: RatingNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    const { min, max } = node.range;
    const valueCount = max - min + 1;
    
    // Use categories if provided, otherwise generate numeric labels
    const labels = node.categories || Array.from({ length: valueCount }, (_, i) => `${min + i}`);
    
    const semanticMapping = surveyMetadata?.defaultSemanticMapping || 
                           (node.ratingType === 'stars' ? 'satisfaction' : this.detectSemanticMapping(node.text));
    
    return {
      id: `rating-${node.ratingType}-${min}-${max}`,
      type: 'rating',
      subtype: node.ratingType,
      range: [min, max],
      labels,
      values: Array.from({ length: valueCount }, (_, i) => min + i),
      positiveThreshold: Math.ceil(max * 0.7),
      semanticMapping,
      colorScheme: 'likert',
      valueCount,
    };
  }

  /**
   * Create binary scale (True/False, Yes/No)
   */
  private createBinaryScale(node: TrueFalseNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    return {
      id: `binary-${node.id}`,
      type: 'binary',
      range: [0, 1],
      labels: ['False', 'True'],
      values: [0, 1],
      positiveThreshold: 1,
      semanticMapping: surveyMetadata?.defaultSemanticMapping || 'custom',
      colorScheme: 'binary',
      valueCount: 2,
    };
  }

  /**
   * Create slider scale configuration
   */
  private createSliderScale(node: SliderNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    const { min, max } = node.range;
    const valueCount = Math.min(10, max - min + 1); // Limit for display
    
    // Generate labels from slider configuration
    const labels = this.generateSliderLabels(node);
    const semanticMapping = surveyMetadata?.defaultSemanticMapping || this.detectSemanticMapping(node.text);
    
    return {
      id: `slider-${min}-${max}`,
      type: 'numeric',
      subtype: 'slider',
      range: [min, max],
      labels,
      values: [min, max], // Continuous scale
      positiveThreshold: min + (max - min) * 0.7,
      semanticMapping,
      colorScheme: 'likert',
      valueCount,
    };
  }

  /**
   * Create matrix scale configuration
   */
  private createMatrixScale(node: MatrixNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    const columnLabels = node.columns.map(col => col.text);
    
    return {
      id: `matrix-${node.id}`,
      type: 'matrix',
      subtype: node.matrixType,
      labels: columnLabels,
      values: node.columns.map((col, index) => col.value || index),
      semanticMapping: surveyMetadata?.defaultSemanticMapping || this.detectSemanticMapping(node.text),
      colorScheme: 'likert',
      valueCount: node.columns.length,
    };
  }

  /**
   * Create text area scale (sentiment analysis potential)
   */
  private createTextScale(node: TextAreaNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    return {
      id: `text-${node.id}`,
      type: 'text',
      labels: ['Text Response'],
      values: ['text'],
      semanticMapping: 'custom', // Text doesn't use semantic mapping
      colorScheme: 'custom',
      valueCount: 1,
    };
  }

  /**
   * Create multiple choice scale
   */
  private createMultipleChoiceScale(node: QuestionNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    const choices = node.choices || [];
    const labels = choices.map(choice => choice.text);
    
    return {
      id: `choice-${node.id}`,
      type: 'categorical',
      subtype: 'single_choice',
      labels,
      values: choices.map((_, index) => index),
      semanticMapping: 'custom', // Categorical doesn't use semantic mapping
      colorScheme: 'custom',
      valueCount: choices.length,
    };
  }

  /**
   * Create multi-select scale
   */
  private createMultiSelectScale(node: MultiSelectNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    const labels = node.options.map(opt => opt.text);
    
    return {
      id: `multiselect-${node.id}`,
      type: 'categorical',
      subtype: 'multi_choice',
      labels,
      values: node.options.map(opt => opt.id),
      semanticMapping: 'custom',
      colorScheme: 'custom',
      valueCount: labels.length,
    };
  }

  /**
   * Create checkbox scale
   */
  private createCheckboxScale(node: CheckboxNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    const labels = node.options.map(opt => opt.text);
    
    return {
      id: `checkbox-${node.id}`,
      type: 'categorical',
      subtype: 'checkbox',
      labels,
      values: node.options.map(opt => opt.id),
      semanticMapping: 'custom',
      colorScheme: 'custom',
      valueCount: labels.length,
    };
  }

  /**
   * Create short answer scale
   */
  private createShortAnswerScale(node: ShortAnswerNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    return {
      id: `short-answer-${node.id}`,
      type: 'text',
      subtype: 'short_answer',
      labels: ['Text Response'],
      values: ['text'],
      semanticMapping: 'custom',
      colorScheme: 'custom',
      valueCount: 1,
    };
  }

  /**
   * Create generic scale for unknown node types
   */
  private createGenericScale(node: NLJNode, surveyMetadata?: import('../types/nlj').SurveyMetadata): QuestionScale {
    return {
      id: `generic-${node.id}`,
      type: 'categorical',
      labels: ['Response'],
      values: ['response'],
      semanticMapping: 'custom',
      colorScheme: 'custom',
      valueCount: 1,
    };
  }

  /**
   * Generate Likert scale labels
   */
  private generateLikertLabels(min: number, max: number, labels: any): string[] {
    const valueCount = max - min + 1;
    
    // Use custom labels if provided
    if (labels.custom) {
      return Array.from({ length: valueCount }, (_, i) => 
        labels.custom[min + i] || `${min + i}`
      );
    }
    
    // Use min/max/middle labels
    if (valueCount === 5) {
      return [
        labels.min || 'Strongly Disagree',
        'Disagree', 
        labels.middle || 'Neutral',
        'Agree',
        labels.max || 'Strongly Agree'
      ];
    } else if (valueCount === 3) {
      return [
        labels.min || 'Disagree',
        labels.middle || 'Neutral',
        labels.max || 'Agree'
      ];
    }
    
    // Default numeric labels
    return Array.from({ length: valueCount }, (_, i) => `${min + i}`);
  }

  /**
   * Generate slider labels
   */
  private generateSliderLabels(node: SliderNode): string[] {
    const { min, max, custom } = node.labels;
    
    if (custom && Object.keys(custom).length > 0) {
      return Object.values(custom);
    }
    
    return [min || `${node.range.min}`, max || `${node.range.max}`];
  }

  /**
   * Detect semantic meaning from question text
   */
  private detectSemanticMapping(text: string): QuestionConfiguration['scale']['semanticMapping'] {
    const lowerText = text.toLowerCase();
    
    // Check for satisfaction keywords
    if (lowerText.includes('satisf') || lowerText.includes('happy') || lowerText.includes('pleased')) {
      return 'satisfaction';
    }
    // Check for agreement keywords
    if (lowerText.includes('agree') || lowerText.includes('disagree') || lowerText.includes('opinion')) {
      return 'agreement';
    }
    // Check for performance keywords
    if (lowerText.includes('perform') || lowerText.includes('quality') || lowerText.includes('effective')) {
      return 'performance';
    }
    // Check for frequency keywords
    if (lowerText.includes('often') || lowerText.includes('frequency') || lowerText.includes('how much')) {
      return 'frequency';
    }
    // Check for positive/negative keywords
    if (lowerText.includes('positive') || lowerText.includes('negative') || lowerText.includes('good') || lowerText.includes('bad')) {
      return 'positive-negative';
    }
    
    return 'custom';
  }

  /**
   * Determine survey type from metadata with sensible defaults
   */
  private determineSurveyType(scenario: NLJScenario): SurveyConfiguration['type'] {
    // Priority 1: Use explicit survey type from metadata
    if (scenario.surveyMetadata?.surveyType) {
      return scenario.surveyMetadata.surveyType;
    }
    
    // Priority 2: Infer from activity type if it's specifically 'survey'
    if (scenario.activityType === 'survey') {
      // Use survey name to make a best guess
      const name = scenario.name.toLowerCase();
      if (name.includes('exit') || name.includes('departure') || name.includes('leaving')) {
        return 'exit';
      }
      if (name.includes('engagement') || name.includes('employee')) {
        return 'engagement';
      }
      if (name.includes('satisfaction') || name.includes('feedback')) {
        return 'satisfaction';
      }
      if (name.includes('pulse') || name.includes('quick') || name.includes('brief')) {
        return 'pulse';
      }
      if (name.includes('performance') || name.includes('review')) {
        return 'performance';
      }
      if (name.includes('onboarding') || name.includes('welcome')) {
        return 'onboarding';
      }
      
      // Default for survey activity type
      return 'feedback';
    }
    
    // Priority 3: Default based on activity type
    if (scenario.activityType === 'assessment') {
      return 'performance';
    }
    
    // Priority 4: Fallback to custom
    return 'custom';
  }

  /**
   * Generate display configuration based on survey metadata
   */
  private generateDisplayConfiguration(surveyMetadata?: import('../types/nlj').SurveyMetadata): SurveyConfiguration['displayConfig'] {
    return {
      defaultGroupBy: surveyMetadata?.department ? 'department' : 'location',
      showTrends: true,
      showBenchmarks: !!surveyMetadata?.benchmarkCategory,
      compactMode: false,
    };
  }

  /**
   * Generate demographic configuration with metadata context
   */
  private generateDemographicConfiguration(surveyMetadata?: import('../types/nlj').SurveyMetadata): DemographicConfiguration {
    const primary = [];
    const secondary = ['tenure', 'role', 'manager', 'generation', 'gender'];
    
    // Prioritize demographics based on metadata
    if (surveyMetadata?.department) {
      primary.push('department');
    }
    if (surveyMetadata?.targetAudience) {
      primary.push('audience');
    }
    
    // Default groupings if no metadata
    if (primary.length === 0) {
      primary.push('department', 'location');
    }

    // All available demographic groupings - easily extensible
    const availableGroupings = [
      // Core organizational demographics
      'department', 'location', 'team', 'business_unit', 'division',
      // Role-based demographics  
      'role', 'manager', 'job_level', 'employment_type',
      // Tenure demographics
      'tenure', 'hire_date_range', 'service_years_range',
      // Personal demographics (if collected)
      'generation', 'age_range', 'gender', 'education_level',
      // Custom demographics
      'audience', 'segment', 'cohort', 'custom_1', 'custom_2'
    ];

    return {
      primary,
      secondary,
      hierarchical: surveyMetadata?.collectDemographics !== false, // Default true
      anonymizationThreshold: 4, // Standard privacy threshold
      availableGroupings,
    };
  }

  /**
   * Check if node type supports analytics
   */
  private isAnalyticsSupported(nodeType: string): boolean {
    const supportedTypes = [
      'likert_scale', 'rating', 'true_false', 'slider', 'matrix', 
      'multi_select', 'checkbox', 'question'
    ];
    return supportedTypes.includes(nodeType);
  }

  /**
   * Extract question title from node
   */
  private extractQuestionTitle(node: NLJNode): string {
    return (node as any).title || `Question ${node.id}`;
  }

  /**
   * Extract question text from node
   */
  private extractQuestionText(node: NLJNode): string {
    return (node as any).text || (node as any).content || 'No question text';
  }

  /**
   * Extract required flag from node
   */
  private extractRequired(node: NLJNode): boolean {
    return (node as any).required || false;
  }

  /**
   * Check if node has follow-up enabled
   */
  private hasFollowUpEnabled(node: NLJNode): boolean {
    return !!(node as any).followUp?.enabled;
  }

  /**
   * Detect question category from node settings or text
   */
  private detectQuestionCategory(node: NLJNode): string | undefined {
    // Could be enhanced with node.settings?.category or text analysis
    return undefined;
  }

  /**
   * Detect question section from node settings or text
   */
  private detectQuestionSection(node: NLJNode): string | undefined {
    // Could be enhanced with node.settings?.section or text analysis
    return undefined;
  }

  /**
   * Estimate completion time for questions
   */
  private estimateCompletionTime(questions: QuestionConfiguration[]): number {
    return questions.reduce((total, question) => {
      // Base time estimates by question type
      const baseTime = {
        'likert_scale': 10, // 10 seconds
        'rating': 8,
        'true_false': 5,
        'text_area': 45,
        'matrix': 20,
        'slider': 12,
        'multi_select': 15,
        'checkbox': 15,
        'question': 10,
        'short_answer': 30,
      };
      
      const time = baseTime[question.nodeType as keyof typeof baseTime] || 10;
      return total + time + (question.hasFollowUp ? 20 : 0); // Add time for follow-up
    }, 0);
  }
}

// Export singleton instance
export const surveyConfigurationService = new SurveyConfigurationService();