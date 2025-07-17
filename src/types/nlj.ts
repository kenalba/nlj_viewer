/**
 * TypeScript interfaces for Non-Linear Journey (NLJ) schema
 * Extended to support unified activity system (training, surveys, assessments)
 */

// JSON-compatible types for metadata and extensions
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
export type JSONObject = Record<string, JSONValue>;

// Validation value types
export type ValidationValue = string | number | boolean | RegExp | { min?: number; max?: number };

// Node response types
export type NodeResponseValue = 
  | string 
  | number 
  | boolean 
  | null
  | string[] 
  | Array<{ id: string; value: string }>
  | Array<{ leftId: string; rightId: string }>
  | Record<string, string | string[]>;

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

// Interface for wrapped media items from external editor
export interface MediaWrapper {
  media: Media;
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
  metadata?: JSONObject;
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
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
  correctAnswer: boolean;
}

export interface OrderingNode extends BaseNode {
  type: 'ordering';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
  correctAnswers: string[];
  caseSensitive?: boolean;
}

// Validation configuration for all node types
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'range' | 'pattern' | 'custom';
  value?: ValidationValue;
  message: string;
  customValidator?: (value: unknown) => boolean;
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
  response: NodeResponseValue;
  timestamp: Date;
  timeToRespond: number;
  isCorrect?: boolean;
  isSkipped?: boolean;
  attemptNumber?: number;
  metadata?: JSONObject;
}

// Survey-specific node types
export interface LikertScaleNode extends BaseNode {
  type: 'likert_scale';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
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
  additionalMediaList?: MediaWrapper[];
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

// Connections game node types
export interface ConnectionsGroup {
  category: string;
  words: [string, string, string, string]; // Exactly 4 words
  difficulty: 'yellow' | 'green' | 'blue' | 'purple';
}

export interface ConnectionsGameData {
  title: string;
  instructions: string;
  groups: [ConnectionsGroup, ConnectionsGroup, ConnectionsGroup, ConnectionsGroup]; // Exactly 4 groups
  maxMistakes?: number; // Default: 4
  shuffleWords?: boolean; // Default: true
  showProgress?: boolean; // Default: true
}

export interface ConnectionsNode extends BaseNode {
  type: 'connections';
  text: string;
  content?: string;
  media?: Media;
  additionalMediaList?: MediaWrapper[];
  gameData: ConnectionsGameData;
  scoring?: {
    correctGroupPoints?: number; // Points for finding a correct group
    completionBonus?: number; // Bonus for completing all groups
    mistakePenalty?: number; // Points deducted for mistakes
  };
  timeLimit?: number; // Time limit in seconds (optional)
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
  | RankingNode
  | ConnectionsNode;

// Type guards for node types
export const isQuestionNode = (node: NLJNode): node is QuestionNode => node.type === 'question';
export const isSurveyNode = (node: NLJNode): node is LikertScaleNode | RatingNode | MatrixNode | SliderNode | TextAreaNode => 
  ['likert_scale', 'rating', 'matrix', 'slider', 'text_area'].includes(node.type);
export const isInteractiveNode = (node: NLJNode): node is QuestionNode | TrueFalseNode | OrderingNode | MatchingNode | ShortAnswerNode | LikertScaleNode | RatingNode | MatrixNode | SliderNode | TextAreaNode | MultiSelectNode | RankingNode | ConnectionsNode => 
  !['start', 'end', 'choice', 'interstitial_panel'].includes(node.type);
export const isAssessmentNode = (node: NLJNode): node is TrueFalseNode | OrderingNode | MatchingNode | ShortAnswerNode | QuestionNode | MultiSelectNode | RankingNode | ConnectionsNode => 
  ['true_false', 'ordering', 'matching', 'short_answer', 'question', 'multi_select', 'ranking', 'connections'].includes(node.type);
export const isConnectionsNode = (node: NLJNode): node is ConnectionsNode => node.type === 'connections';

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
    metadata?: JSONObject;
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
      settings?: JSONObject;
    };
    custom?: JSONObject;
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

// Specific action interfaces for type safety
export interface LoadScenarioAction {
  type: 'LOAD_SCENARIO';
  payload: NLJScenario;
}

export interface NavigateToNodeAction {
  type: 'NAVIGATE_TO_NODE';
  payload: { nodeId: string };
}

export interface UpdateVariableAction {
  type: 'UPDATE_VARIABLE';
  payload: { variableId: string; value: number };
}

export interface CompleteScenarioAction {
  type: 'COMPLETE_SCENARIO';
  payload?: { score?: number };
}

export interface ResetAction {
  type: 'RESET';
}

export interface SubmitResponseAction {
  type: 'SUBMIT_RESPONSE';
  payload: NodeResponse;
}

export interface SkipQuestionAction {
  type: 'SKIP_QUESTION';
  payload: { nodeId: string };
}

export interface UpdateSectionAction {
  type: 'UPDATE_SECTION';
  payload: { sectionId: string };
}

export interface UpdateThemeAction {
  type: 'UPDATE_THEME';
  payload: { theme: ThemeConfiguration };
}

export interface UpdateAccessibilityAction {
  type: 'UPDATE_ACCESSIBILITY';
  payload: { accessibility: AccessibilityOptions };
}

export interface StartTimerAction {
  type: 'START_TIMER';
  payload: { timeLimit: number };
}

export interface UpdateTimerAction {
  type: 'UPDATE_TIMER';
  payload: { timeRemaining: number };
}

export interface PauseActivityAction {
  type: 'PAUSE_ACTIVITY';
}

export interface ResumeActivityAction {
  type: 'RESUME_ACTIVITY';
}

export type GameAction = 
  | LoadScenarioAction
  | NavigateToNodeAction
  | UpdateVariableAction
  | CompleteScenarioAction
  | ResetAction
  | SubmitResponseAction
  | SkipQuestionAction
  | UpdateSectionAction
  | UpdateThemeAction
  | UpdateAccessibilityAction
  | StartTimerAction
  | UpdateTimerAction
  | PauseActivityAction
  | ResumeActivityAction;

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
  metadata?: JSONObject;
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
  extensions?: JSONObject;
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
  extensions?: JSONObject;
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