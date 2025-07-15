/**
 * TypeScript interfaces for Non-Linear Journey (NLJ) schema
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

export interface BaseNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

export type NLJNode = StartNode | EndNode | QuestionNode | ChoiceNode | InterstitialPanelNode;

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

export interface NLJScenario {
  id: string;
  name: string;
  orientation: 'vertical' | 'horizontal';
  nodes: NLJNode[];
  links: Link[];
  variableDefinitions?: VariableDefinition[];
  goals?: Goal[];
}

export interface GameState {
  scenarioId: string;
  currentNodeId: string;
  variables: Record<string, number>;
  visitedNodes: Set<string>;
  completed: boolean;
  score?: number;
}

export interface GameAction {
  type: 'LOAD_SCENARIO' | 'NAVIGATE_TO_NODE' | 'UPDATE_VARIABLE' | 'COMPLETE_SCENARIO' | 'RESET';
  payload?: any;
}