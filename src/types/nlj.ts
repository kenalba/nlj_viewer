/**
 * TypeScript interfaces for Non-Linear Journey (NLJ) schema
 * Extended to support unified activity system (training, surveys, assessments)
 */

export interface Media {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO';
  fullPath: string;
  title?: string;
  description?: string;
  fullThumbnail?: string;
  createTimestamp?: string;
  updateTimestamp?: string;
}

export interface VariableChange {
  variableId: string;
  value: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Link {
  id: string;
  type: 'link' | 'parent-child';
  sourceNodeId: string;
  targetNodeId: string;
  probability?: number;
  startPoint: Point;
  endPoint: Point;
  bendPoints?: Point[];
}

// Activity and theme-related types
export type ActivityType = 'training' | 'survey' | 'assessment' | 'mixed';

export interface ThemeConfiguration {
  mode: 'hyundai' | 'unfiltered' | 'custom';
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
  };
}

export interface AccessibilityOptions {
  highContrast?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  reducedMotion?: boolean;
  screenReader?: boolean;
}

// Base node interface with common properties
export interface BaseNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Common properties for all node types
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  // Validation and theming
  validation?: ValidationConfig;
  theme?: Partial<ThemeConfiguration>;
  accessibility?: AccessibilityOptions;
}

export interface StartNode extends BaseNode {
  type: 'start';
}

export interface EndNode extends BaseNode {
  type: 'end';
}

export interface QuestionNode extends BaseNode {
  type: 'question';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
}

export interface ChoiceNode extends BaseNode {
  type: 'choice';
  parentId: string;
  text: string;
  value?: number;
  feedback?: string;
  isCorrect: boolean;
  choiceType: 'CORRECT' | 'INCORRECT' | 'NEUTRAL';
  variableChanges?: VariableChange[];
}

export interface InterstitialPanelNode extends BaseNode {
  type: 'interstitial_panel';
  text?: string;
  content?: string;
  media?: Media;
}

export interface TrueFalseNode extends BaseNode {
  type: 'true_false';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  correctAnswer: boolean;
}

export interface OrderingNode extends BaseNode {
  type: 'ordering';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  items: OrderingItem[];
}

export interface OrderingItem {
  id: string;
  text: string;
  correctOrder: number;
}

export interface MatchingNode extends BaseNode {
  type: 'matching';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  leftItems: MatchingItem[];
  rightItems: MatchingItem[];
  correctMatches: MatchingPair[];
}

export interface MatchingItem {
  id: string;
  text: string;
}

export interface MatchingPair {
  leftId: string;
  rightId: string;
}

export interface ShortAnswerNode extends BaseNode {
  type: 'short_answer';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  correctAnswers: string[];
  caseSensitive?: boolean;
}

// Validation configuration for all node types
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'range' | 'pattern' | 'custom';
  value?: any;
  message: string;
  customValidator?: (value: any) => boolean;
}

export interface ValidationConfig {
  rules: ValidationRule[];
  validateOnChange?: boolean;
  showErrorsImmediately?: boolean;
}

// Common response interface for all interactive nodes
export interface NodeResponse {
  nodeId: string;
  nodeType: string;
  response: any;
  timestamp: Date;
  timeToRespond: number;
  isCorrect?: boolean;
  isSkipped?: boolean;
  attemptNumber?: number;
  metadata?: Record<string, any>;
}

// Survey-specific node types
export interface LikertScaleNode extends BaseNode {
  type: 'likert_scale';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  scale: {
    min: number;
    max: number;
    step?: number;
    labels: {
      min: string;
      max: string;
      middle?: string;
      custom?: Record<number, string>;
    };
  };
  defaultValue?: number;
  required?: boolean;
  showNumbers?: boolean;
  showLabels?: boolean;
}

export interface RatingNode extends BaseNode {
  type: 'rating';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  ratingType: 'stars' | 'numeric' | 'categorical';
  range: {
    min: number;
    max: number;
    step?: number;
  };
  categories?: string[];
  defaultValue?: number;
  required?: boolean;
  allowHalf?: boolean; // For star ratings
  showValue?: boolean;
  icons?: {
    filled?: string;
    empty?: string;
  };
}

export interface MatrixNode extends BaseNode {
  type: 'matrix';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  rows: Array<{
    id: string;
    text: string;
    required?: boolean;
  }>;
  columns: Array<{
    id: string;
    text: string;
    value?: number;
    description?: string;
  }>;
  matrixType: 'single' | 'multiple' | 'rating';
  required?: boolean;
  allowMultiplePerRow?: boolean;
  randomizeRows?: boolean;
  randomizeColumns?: boolean;
}

export interface SliderNode extends BaseNode {
  type: 'slider';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  range: {
    min: number;
    max: number;
    step?: number;
    precision?: number;
  };
  labels: {
    min: string;
    max: string;
    custom?: Record<number, string>;
  };
  defaultValue?: number;
  required?: boolean;
  showValue?: boolean;
  showTicks?: boolean;
  continuous?: boolean;
}

export interface TextAreaNode extends BaseNode {
  type: 'text_area';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  rows?: number;
  columns?: number;
  resizable?: boolean;
  spellCheck?: boolean;
  wordCount?: boolean;
}

// Extended question node types for assessments
export interface MultiSelectNode extends BaseNode {
  type: 'multi_select';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  options: Array<{
    id: string;
    text: string;
    value?: number;
    isCorrect?: boolean;
  }>;
  minSelections?: number;
  maxSelections?: number;
  randomizeOptions?: boolean;
  required?: boolean;
}

export interface RankingNode extends BaseNode {
  type: 'ranking';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: Media[];
  items: Array<{
    id: string;
    text: string;
    correctRank?: number;
    description?: string;
  }>;
  maxRankings?: number;
  allowTies?: boolean;
  required?: boolean;
}

// Updated union type to include all node types
export type NLJNode = 
  | StartNode 
  | EndNode 
  | QuestionNode 
  | ChoiceNode 
  | InterstitialPanelNode 
  | TrueFalseNode 
  | OrderingNode 
  | MatchingNode 
  | ShortAnswerNode
  | LikertScaleNode
  | RatingNode
  | MatrixNode
  | SliderNode
  | TextAreaNode
  | MultiSelectNode
  | RankingNode;

// Type guards for node types
export const isQuestionNode = (node: NLJNode): node is QuestionNode => node.type === 'question';
export const isSurveyNode = (node: NLJNode): node is LikertScaleNode | RatingNode | MatrixNode | SliderNode | TextAreaNode => 
  ['likert_scale', 'rating', 'matrix', 'slider', 'text_area'].includes(node.type);
export const isInteractiveNode = (node: NLJNode): node is QuestionNode | TrueFalseNode | OrderingNode | MatchingNode | ShortAnswerNode | LikertScaleNode | RatingNode | MatrixNode | SliderNode | TextAreaNode | MultiSelectNode | RankingNode => 
  !['start', 'end', 'choice', 'interstitial_panel'].includes(node.type);
export const isAssessmentNode = (node: NLJNode): node is TrueFalseNode | OrderingNode | MatchingNode | ShortAnswerNode | QuestionNode | MultiSelectNode | RankingNode => 
  ['true_false', 'ordering', 'matching', 'short_answer', 'question', 'multi_select', 'ranking'].includes(node.type);

// Activity metadata and configuration
export interface ActivityMetadata {
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration?: number; // in minutes
  language?: string;
  version?: string;
  author?: string;
  lastModified?: Date;
  tags?: string[];
  prerequisites?: string[];
  learningObjectives?: string[];
}

export interface SurveyMetadata {
  anonymous?: boolean;
  allowSkip?: boolean;
  showProgress?: boolean;
  allowReview?: boolean;
  collectDemographics?: boolean;
  responseLimit?: number;
  expirationDate?: Date;
  targetAudience?: string;
  department?: string;
  industry?: string;
}

export interface AssessmentMetadata {
  passingScore?: number;
  maxAttempts?: number;
  timeLimit?: number; // in minutes
  allowReview?: boolean;
  showCorrectAnswers?: boolean;
  randomizeQuestions?: boolean;
  certificateEligible?: boolean;
  retakePolicy?: 'immediate' | 'delayed' | 'never';
  feedbackMode?: 'immediate' | 'summary' | 'none';
}

export interface VariableDefinition {
  id: string;
  name: string;
  type: 'integer' | 'string' | 'boolean';
}

export interface TagValue {
  id: string;
  tagDefinitionId: string;
  value: string;
}

export interface Goal {
  id: string;
  name: string;
  description: string;
  script: string;
  tagValues?: TagValue[];
}

// Extended scenario interface to support unified activities
export interface NLJScenario {
  id: string;
  name: string;
  orientation: 'vertical' | 'horizontal';
  nodes: NLJNode[];
  links: Link[];
  variableDefinitions?: VariableDefinition[];
  goals?: Goal[];
  // Extended activity properties
  activityType: ActivityType;
  activityMetadata?: ActivityMetadata;
  surveyMetadata?: SurveyMetadata;
  assessmentMetadata?: AssessmentMetadata;
  theme?: ThemeConfiguration;
  accessibility?: AccessibilityOptions;
  // Section-based organization for mixed activities
  sections?: Array<{
    id: string;
    title: string;
    description?: string;
    type: ActivityType;
    nodeIds: string[];
    metadata?: Record<string, any>;
  }>;
  // Branching and navigation rules
  navigationRules?: Array<{
    condition: string;
    action: 'skip' | 'show' | 'required';
    targetNodeIds: string[];
  }>;
  // Integration settings
  integrations?: {
    lrs?: {
      endpoint: string;
      auth?: Record<string, string>;
    };
    scorm?: {
      version: '1.2' | '2004';
      settings?: Record<string, any>;
    };
    custom?: Record<string, any>;
  };
}

// Extended game state to support unified activities
export interface GameState {
  scenarioId: string;
  currentNodeId: string;
  variables: Record<string, number>;
  visitedNodes: Set<string>;
  completed: boolean;
  score?: number;
  // Extended activity state
  activityType: ActivityType;
  responses: Record<string, NodeResponse>;
  currentSectionId?: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  // Survey-specific state
  surveySession?: {
    anonymous: boolean;
    allowSkip: boolean;
    showProgress: boolean;
    totalQuestions: number;
    answeredQuestions: number;
    skippedQuestions: number;
  };
  // Assessment-specific state
  assessmentSession?: {
    attemptNumber: number;
    timeLimit?: number;
    timeRemaining?: number;
    passingScore?: number;
    showCorrectAnswers: boolean;
    correctAnswers: number;
    incorrectAnswers: number;
  };
  // Theme and accessibility preferences
  theme?: ThemeConfiguration;
  accessibility?: AccessibilityOptions;
}

// Extended action types
export type GameActionType = 
  | 'LOAD_SCENARIO'
  | 'NAVIGATE_TO_NODE'
  | 'UPDATE_VARIABLE'
  | 'COMPLETE_SCENARIO'
  | 'RESET'
  | 'SUBMIT_RESPONSE'
  | 'SKIP_QUESTION'
  | 'UPDATE_SECTION'
  | 'UPDATE_THEME'
  | 'UPDATE_ACCESSIBILITY'
  | 'START_TIMER'
  | 'UPDATE_TIMER'
  | 'PAUSE_ACTIVITY'
  | 'RESUME_ACTIVITY';

export interface GameAction {
  type: GameActionType;
  payload?: any;
}

// Response aggregation for analytics
export interface ActivitySession {
  sessionId: string;
  activityId: string;
  activityType: ActivityType;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  completed: boolean;
  responses: NodeResponse[];
  score?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

// xAPI integration types
export interface XAPIActor {
  objectType: 'Agent' | 'Group';
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  openid?: string;
  account?: {
    homePage: string;
    name: string;
  };
}

export interface XAPIVerb {
  id: string;
  display: Record<string, string>;
}

export interface XAPIObject {
  objectType?: 'Activity' | 'Agent' | 'Group' | 'StatementRef' | 'SubStatement';
  id: string;
  definition?: {
    name?: Record<string, string>;
    description?: Record<string, string>;
    type?: string;
    moreInfo?: string;
    interactionType?: string;
    correctResponsesPattern?: string[];
    choices?: Array<{
      id: string;
      description: Record<string, string>;
    }>;
    scale?: Array<{
      id: string;
      description: Record<string, string>;
    }>;
    source?: Array<{
      id: string;
      description: Record<string, string>;
    }>;
    target?: Array<{
      id: string;
      description: Record<string, string>;
    }>;
    steps?: Array<{
      id: string;
      description: Record<string, string>;
    }>;
  };
}

export interface XAPIResult {
  score?: {
    scaled?: number;
    raw?: number;
    min?: number;
    max?: number;
  };
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string;
  extensions?: Record<string, any>;
}

export interface XAPIContext {
  registration?: string;
  instructor?: XAPIActor;
  team?: XAPIActor;
  contextActivities?: {
    parent?: XAPIObject[];
    grouping?: XAPIObject[];
    category?: XAPIObject[];
    other?: XAPIObject[];
  };
  revision?: string;
  platform?: string;
  language?: string;
  statement?: string;
  extensions?: Record<string, any>;
}

export interface XAPIStatement {
  id?: string;
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp?: string;
  stored?: string;
  authority?: XAPIActor;
  version?: string;
  attachments?: Array<{
    usageType: string;
    display: Record<string, string>;
    description?: Record<string, string>;
    contentType: string;
    length: number;
    sha2: string;
    fileUrl?: string;
  }>;
}