/**
 * Type definitions for React Flow integration with NLJ scenarios
 */

import type { Node, Edge, NodeProps, EdgeProps, Position } from '@xyflow/react';
import type { NLJNode, NLJScenario, Link } from '../../types/nlj';

// Extended React Flow node data that includes NLJ node information
export interface FlowNodeData extends Record<string, unknown> {
  nljNode: NLJNode;
  label: string;
  nodeType: string;
  isStart?: boolean;
  isEnd?: boolean;
  hasContent?: boolean;
  isInteractive?: boolean;
  choiceCount?: number;
  questionType?: string;
  gameType?: string;
  isEditing?: boolean;
}

// Extended React Flow edge data that includes NLJ link information
export interface FlowEdgeData extends Record<string, unknown> {
  nljLink: Link;
  probability?: number;
  isSelected?: boolean;
  isHovered?: boolean;
}

// React Flow node type with NLJ data
export type FlowNode = Node<FlowNodeData>;

// React Flow edge type with NLJ data
export type FlowEdge = Edge<FlowEdgeData>;

// Props for custom node components
export interface FlowNodeProps extends NodeProps {
  data: FlowNodeData;
  onEdit?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onConnect?: (nodeId: string, handle: string) => void;
  isEditMode?: boolean;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

// Props for custom edge components
export interface FlowEdgeProps extends EdgeProps {
  data: FlowEdgeData;
  onEdit?: (edgeId: string) => void;
  onDelete?: (edgeId: string) => void;
  isEditMode?: boolean;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

// Node types for the flow editor
export type FlowNodeType = 
  | 'start'
  | 'end'
  | 'question'
  | 'choice'
  | 'interstitial_panel'
  | 'true_false'
  | 'ordering'
  | 'matching'
  | 'short_answer'
  | 'likert_scale'
  | 'rating'
  | 'matrix'
  | 'slider'
  | 'text_area'
  | 'multi_select'
  | 'checkbox'
  | 'connections'
  | 'wordle';

// Available node types for the palette
export interface NodeTypeInfo {
  type: FlowNodeType;
  label: string;
  description: string;
  icon: string;
  category: 'structure' | 'question' | 'survey' | 'assessment' | 'game';
  color: string;
  isInteractive: boolean;
  hasChoices: boolean;
  supportsMedia: boolean;
}

// Layout configuration for auto-positioning
export interface LayoutConfig {
  algorithm: 'hierarchical' | 'force' | 'circular' | 'manual';
  direction: 'TB' | 'BT' | 'LR' | 'RL'; // Top-Bottom, Bottom-Top, Left-Right, Right-Left
  spacing: {
    nodeSpacing: number;
    levelSpacing: number;
    minNodeDistance: number;
  };
  alignment: 'start' | 'center' | 'end';
}

// Flow editor state
export interface FlowEditorState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodes: string[];
  selectedEdges: string[];
  draggedNode: FlowNode | null;
  isConnecting: boolean;
  connectionSource: string | null;
  connectionTarget: string | null;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  layout: LayoutConfig;
  isEditMode: boolean;
  isDirty: boolean;
  lastSaved?: Date;
}

// Flow editor actions
export type FlowEditorAction =
  | { type: 'LOAD_SCENARIO'; payload: NLJScenario }
  | { type: 'ADD_NODE'; payload: { nodeType: FlowNodeType; position: { x: number; y: number } } }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; updates: Partial<FlowNodeData> } }
  | { type: 'DELETE_NODE'; payload: { nodeId: string } }
  | { type: 'ADD_EDGE'; payload: { source: string; target: string; probability?: number } }
  | { type: 'UPDATE_EDGE'; payload: { edgeId: string; updates: Partial<FlowEdgeData> } }
  | { type: 'DELETE_EDGE'; payload: { edgeId: string } }
  | { type: 'SELECT_NODES'; payload: { nodeIds: string[] } }
  | { type: 'SELECT_EDGES'; payload: { edgeIds: string[] } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_VIEWPORT'; payload: { x: number; y: number; zoom: number } }
  | { type: 'SET_LAYOUT'; payload: LayoutConfig }
  | { type: 'TOGGLE_EDIT_MODE' }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' }
  | { type: 'START_CONNECTION'; payload: { nodeId: string; handleId: string } }
  | { type: 'END_CONNECTION'; payload: { nodeId: string; handleId: string } }
  | { type: 'CANCEL_CONNECTION' }
  | { type: 'AUTO_LAYOUT' }
  | { type: 'RESET_ZOOM' }
  | { type: 'FIT_VIEW' };

// Validation results for flow integrity
export interface FlowValidationResult {
  isValid: boolean;
  errors: Array<{
    type: 'error' | 'warning';
    message: string;
    nodeId?: string;
    edgeId?: string;
    suggestion?: string;
  }>;
  orphanedNodes: string[];
  unreachableNodes: string[];
  missingConnections: string[];
  duplicateConnections: string[];
}

// Export configuration for flow diagrams
export interface FlowExportConfig {
  format: 'png' | 'svg' | 'pdf' | 'json';
  quality: 'low' | 'medium' | 'high';
  includeBackground: boolean;
  includeControls: boolean;
  includeMinimap: boolean;
  customDimensions?: {
    width: number;
    height: number;
  };
}

// Flow editor preferences
export interface FlowEditorPreferences {
  theme: 'hyundai' | 'unfiltered' | 'custom';
  showGrid: boolean;
  showMinimap: boolean;
  showControls: boolean;
  autoSave: boolean;
  autoSaveInterval: number; // in seconds
  snapToGrid: boolean;
  gridSize: number;
  defaultLayout: LayoutConfig;
  nodeDefaults: {
    width: number;
    height: number;
    borderRadius: number;
  };
  edgeDefaults: {
    type: 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';
    animated: boolean;
    style: React.CSSProperties;
  };
}

// Connection handle types
export interface ConnectionHandle {
  id: string;
  type: 'source' | 'target';
  position: Position;
  isConnectable: boolean;
  maxConnections?: number;
  label?: string;
  style?: React.CSSProperties;
}

// Node creation template
export interface NodeTemplate {
  type: FlowNodeType;
  defaultData: Partial<FlowNodeData>;
  defaultPosition: { x: number; y: number };
  defaultSize: { width: number; height: number };
  handles: ConnectionHandle[];
  validation: {
    required: string[];
    optional: string[];
    maxIncoming: number;
    maxOutgoing: number;
  };
}