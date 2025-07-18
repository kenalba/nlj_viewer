/**
 * Utility functions for converting between NLJ and React Flow formats
 */

import { MarkerType } from '@xyflow/react';
import type { NLJScenario, NLJNode, Link } from '../../types/nlj';
import type { FlowNode, FlowEdge, FlowNodeData, FlowEdgeData, NodeTypeInfo, FlowValidationResult, LayoutConfig } from '../types/flow';

// Node type information for the palette and visual styling
export const NODE_TYPE_INFO: Record<string, NodeTypeInfo> = {
  start: {
    type: 'start',
    label: 'Start',
    description: 'Entry point of the scenario',
    icon: '🏁',
    category: 'structure',
    color: '#2E7D32', // Darker green
    isInteractive: false,
    hasChoices: false,
    supportsMedia: false,
  },
  end: {
    type: 'end',
    label: 'End',
    description: 'Exit point of the scenario',
    icon: '🎯',
    category: 'structure',
    color: '#C62828', // Darker red
    isInteractive: false,
    hasChoices: false,
    supportsMedia: false,
  },
  question: {
    type: 'question',
    label: 'Multiple Choice',
    description: 'Question with multiple choice answers',
    icon: '❓',
    category: 'assessment',
    color: '#1565C0', // Darker blue
    isInteractive: true,
    hasChoices: true,
    supportsMedia: true,
  },
  choice: {
    type: 'choice',
    label: 'Choice',
    description: 'Answer choice for questions',
    icon: '✓',
    category: 'assessment',
    color: '#6A1B9A', // Darker purple
    isInteractive: false,
    hasChoices: false,
    supportsMedia: false,
  },
  interstitial_panel: {
    type: 'interstitial_panel',
    label: 'Info Panel',
    description: 'Information or content panel',
    icon: '📄',
    category: 'structure',
    color: '#E65100', // Darker orange
    isInteractive: false,
    hasChoices: false,
    supportsMedia: true,
  },
  true_false: {
    type: 'true_false',
    label: 'True/False',
    description: 'True or False question',
    icon: '✅',
    category: 'assessment',
    color: '#558B2F', // Darker light green
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  ordering: {
    type: 'ordering',
    label: 'Ordering',
    description: 'Drag and drop ordering question',
    icon: '📝',
    category: 'assessment',
    color: '#00838F', // Darker cyan
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  matching: {
    type: 'matching',
    label: 'Matching',
    description: 'Match items from two lists',
    icon: '🔗',
    category: 'assessment',
    color: '#283593', // Darker indigo
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  short_answer: {
    type: 'short_answer',
    label: 'Short Answer',
    description: 'Text input for short answers',
    icon: '✏️',
    category: 'assessment',
    color: '#455A64', // Darker blue grey
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  likert_scale: {
    type: 'likert_scale',
    label: 'Likert Scale',
    description: 'Rating scale question',
    icon: '📊',
    category: 'survey',
    color: '#5D4037', // Darker brown
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  rating: {
    type: 'rating',
    label: 'Rating',
    description: 'Star or numeric rating',
    icon: '⭐',
    category: 'survey',
    color: '#F57C00', // Darker amber
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  matrix: {
    type: 'matrix',
    label: 'Matrix',
    description: 'Grid-based question',
    icon: '📋',
    category: 'survey',
    color: '#616161', // Darker grey
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  slider: {
    type: 'slider',
    label: 'Slider',
    description: 'Continuous range input',
    icon: '🎚️',
    category: 'survey',
    color: '#512DA8', // Darker deep purple
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  text_area: {
    type: 'text_area',
    label: 'Text Area',
    description: 'Multi-line text input',
    icon: '📝',
    category: 'survey',
    color: '#00695C', // Darker teal
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  multi_select: {
    type: 'multi_select',
    label: 'Multi Select',
    description: 'Multiple selection question',
    icon: '☑️',
    category: 'assessment',
    color: '#2E7D32', // Darker green
    isInteractive: true,
    hasChoices: true,
    supportsMedia: true,
  },
  checkbox: {
    type: 'checkbox',
    label: 'Checkbox',
    description: 'Checkbox selection',
    icon: '☑️',
    category: 'assessment',
    color: '#1565C0', // Darker blue
    isInteractive: true,
    hasChoices: true,
    supportsMedia: true,
  },
  connections: {
    type: 'connections',
    label: 'Connections',
    description: 'Word grouping game',
    icon: '🎮',
    category: 'game',
    color: '#AD1457', // Darker pink
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
  wordle: {
    type: 'wordle',
    label: 'Wordle',
    description: 'Word guessing game',
    icon: '🎯',
    category: 'game',
    color: '#D84315', // Darker deep orange
    isInteractive: true,
    hasChoices: false,
    supportsMedia: true,
  },
};

// Convert NLJ node to Flow node data
export function nljNodeToFlowNodeData(nljNode: NLJNode): FlowNodeData {
  const typeInfo = NODE_TYPE_INFO[nljNode.type];
  
  // Get display text from the node
  const getNodeText = (node: NLJNode): string => {
    if ('text' in node && node.text) return node.text;
    if ('title' in node && node.title) return node.title;
    if ('content' in node && node.content) return node.content;
    return typeInfo?.label || node.type;
  };

  // Get choice count for question nodes
  const getChoiceCount = (node: NLJNode): number => {
    if ('options' in node && node.options) return node.options.length;
    if ('items' in node && node.items) return node.items.length;
    if ('leftItems' in node && node.leftItems) return node.leftItems.length;
    return 0;
  };

  // Get question type for better labeling
  const getQuestionType = (node: NLJNode): string => {
    if (node.type === 'question') return 'Multiple Choice';
    if (node.type === 'true_false') return 'True/False';
    if (node.type === 'ordering') return 'Ordering';
    if (node.type === 'matching') return 'Matching';
    if (node.type === 'short_answer') return 'Short Answer';
    if (node.type === 'likert_scale') return 'Likert Scale';
    if (node.type === 'rating') return 'Rating';
    if (node.type === 'matrix') return 'Matrix';
    if (node.type === 'slider') return 'Slider';
    if (node.type === 'text_area') return 'Text Area';
    if (node.type === 'multi_select') return 'Multi Select';
    if (node.type === 'checkbox') return 'Checkbox';
    return typeInfo?.label || node.type;
  };

  // Get game type for game nodes
  const getGameType = (node: NLJNode): string | undefined => {
    if (node.type === 'connections') return 'Connections';
    if (node.type === 'wordle') return 'Wordle';
    return undefined;
  };

  return {
    nljNode,
    label: getNodeText(nljNode),
    nodeType: nljNode.type,
    isStart: nljNode.type === 'start',
    isEnd: nljNode.type === 'end',
    hasContent: 'text' in nljNode || 'content' in nljNode,
    isInteractive: typeInfo?.isInteractive || false,
    choiceCount: getChoiceCount(nljNode),
    questionType: getQuestionType(nljNode),
    gameType: getGameType(nljNode),
    isEditing: false,
  };
}

// Convert NLJ link to Flow edge data
export function nljLinkToFlowEdgeData(nljLink: Link): FlowEdgeData {
  return {
    nljLink,
    probability: nljLink.probability,
    isSelected: false,
    isHovered: false,
  };
}

// Convert NLJ scenario to Flow nodes and edges
export function nljScenarioToFlow(scenario: NLJScenario): { nodes: FlowNode[], edges: FlowEdge[] } {
  const nodes: FlowNode[] = scenario.nodes.map(nljNode => ({
    id: nljNode.id,
    type: 'custom',
    position: { x: nljNode.x, y: nljNode.y },
    data: nljNodeToFlowNodeData(nljNode),
    draggable: true,
    selectable: true,
    style: {
      width: nljNode.width,
      height: nljNode.height,
    },
  }));

  // Convert explicit links
  const edges: FlowEdge[] = scenario.links.map(nljLink => ({
    id: nljLink.id,
    source: nljLink.sourceNodeId,
    target: nljLink.targetNodeId,
    type: 'custom',
    data: nljLinkToFlowEdgeData(nljLink),
    animated: false,
    style: {
      stroke: '#666',
      strokeWidth: 2,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#666',
    },
    label: nljLink.probability !== undefined ? `${Math.round(nljLink.probability * 100)}%` : undefined,
  }));

  // Add parent-child relationships from parentId fields
  scenario.nodes.forEach(node => {
    if ('parentId' in node && node.parentId) {
      // Create an edge from parent to child
      const parentChildEdge: FlowEdge = {
        id: `parent-${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        type: 'custom',
        data: {
          nljLink: {
            id: `parent-${node.parentId}-${node.id}`,
            type: 'parent-child' as const,
            sourceNodeId: node.parentId,
            targetNodeId: node.id,
            probability: 1.0,
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 0, y: 0 },
            bendPoints: [],
          },
          probability: 1.0,
          isSelected: false,
          isHovered: false,
        },
        animated: false,
        style: {
          stroke: '#9C27B0', // Purple for parent-child relationships
          strokeWidth: 1,
          strokeDasharray: '5,5', // Dashed line to distinguish from regular links
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#9C27B0',
        },
      };
      
      edges.push(parentChildEdge);
    }
  });

  return { nodes, edges };
}

// Convert Flow nodes and edges back to NLJ format
export function flowToNljScenario(
  nodes: FlowNode[], 
  edges: FlowEdge[], 
  originalScenario: NLJScenario
): NLJScenario {
  const nljNodes: NLJNode[] = nodes.map(flowNode => ({
    ...flowNode.data.nljNode,
    x: flowNode.position.x,
    y: flowNode.position.y,
    width: flowNode.style?.width as number || flowNode.data.nljNode.width,
    height: flowNode.style?.height as number || flowNode.data.nljNode.height,
  }));

  const nljLinks: Link[] = edges.map(flowEdge => ({
    id: flowEdge.data?.nljLink?.id || flowEdge.id,
    type: (flowEdge.data?.nljLink?.type || 'link') as 'link' | 'parent-child',
    sourceNodeId: flowEdge.source,
    targetNodeId: flowEdge.target,
    probability: flowEdge.data?.probability || 1.0,
    startPoint: flowEdge.data?.nljLink?.startPoint || { x: 0, y: 0 },
    endPoint: flowEdge.data?.nljLink?.endPoint || { x: 0, y: 0 },
    bendPoints: flowEdge.data?.nljLink?.bendPoints || [],
  }));

  return {
    ...originalScenario,
    nodes: nljNodes,
    links: nljLinks,
  };
}

// Auto-layout algorithms
export function calculateAutoLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  config: LayoutConfig
): { nodes: FlowNode[], edges: FlowEdge[] } {
  const updatedNodes = [...nodes];
  
  switch (config.algorithm) {
    case 'hierarchical':
      return calculateHierarchicalLayout(updatedNodes, edges, config);
    case 'force':
      return calculateForceLayout(updatedNodes, edges, config);
    case 'circular':
      return calculateCircularLayout(updatedNodes, edges, config);
    default:
      return { nodes: updatedNodes, edges };
  }
}

// Detect cycles in the graph using DFS
function hasCycles(nodes: FlowNode[], edges: FlowEdge[]): boolean {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const colors = new Map<string, number>();
  
  // Initialize all nodes as WHITE (unvisited)
  nodes.forEach(node => colors.set(node.id, WHITE));
  
  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(node => adjacencyList.set(node.id, []));
  edges.forEach(edge => {
    const targets = adjacencyList.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyList.set(edge.source, targets);
  });
  
  function dfs(nodeId: string): boolean {
    colors.set(nodeId, GRAY);
    
    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const neighborColor = colors.get(neighbor);
      if (neighborColor === GRAY) {
        return true; // Back edge found, cycle detected
      }
      if (neighborColor === WHITE && dfs(neighbor)) {
        return true;
      }
    }
    
    colors.set(nodeId, BLACK);
    return false;
  }
  
  // Check each unvisited node
  for (const node of nodes) {
    if (colors.get(node.id) === WHITE) {
      if (dfs(node.id)) {
        return true;
      }
    }
  }
  
  return false;
}

// Hierarchical layout (top-down, left-right, etc.)
function calculateHierarchicalLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  config: LayoutConfig
): { nodes: FlowNode[], edges: FlowEdge[] } {
  const { direction, spacing } = config;
  const { nodeSpacing, levelSpacing } = spacing;
  
  // Check for cycles first
  if (hasCycles(nodes, edges)) {
    console.warn('Flow layout: Cycles detected in graph. Using fallback force-directed layout for better readability.');
    return calculateForceLayout(nodes, edges, config);
  }
  
  // Find start nodes (no incoming edges)
  const startNodes = nodes.filter(node => 
    !edges.some(edge => edge.target === node.id)
  );
  
  // If no start nodes, use the first node as start
  if (startNodes.length === 0 && nodes.length > 0) {
    startNodes.push(nodes[0]);
  }
  
  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(node => adjacencyList.set(node.id, []));
  edges.forEach(edge => {
    const targets = adjacencyList.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyList.set(edge.source, targets);
  });
  
  // BFS to assign levels (now safe from cycles)
  const levels = new Map<string, number>();
  const queue: Array<{ nodeId: string; level: number }> = [];
  
  startNodes.forEach(node => {
    levels.set(node.id, 0);
    queue.push({ nodeId: node.id, level: 0 });
  });
  
  while (queue.length > 0) {
    const { nodeId, level } = queue.shift()!;
    const targets = adjacencyList.get(nodeId) || [];
    
    targets.forEach(targetId => {
      const currentLevel = levels.get(targetId);
      const newLevel = level + 1;
      
      // Only update if we haven't seen this node before OR if we found a longer path
      if (currentLevel === undefined || newLevel > currentLevel) {
        levels.set(targetId, newLevel);
        queue.push({ nodeId: targetId, level: newLevel });
      }
    });
  }
  
  // Group nodes by level
  const nodesByLevel = new Map<number, FlowNode[]>();
  nodes.forEach(node => {
    const level = levels.get(node.id) || 0;
    const nodesAtLevel = nodesByLevel.get(level) || [];
    nodesAtLevel.push(node);
    nodesByLevel.set(level, nodesAtLevel);
  });
  
  // Position nodes with proper dimension-aware layout
  const updatedNodes = nodes.map(node => {
    const level = levels.get(node.id) || 0;
    const nodesAtLevel = nodesByLevel.get(level) || [];
    const indexInLevel = nodesAtLevel.findIndex(n => n.id === node.id);
    
    // Get actual node dimensions from the DOM or use defaults
    const nodeWidth = node.measured?.width || node.data.nljNode.width || 250;
    const nodeHeight = node.measured?.height || node.data.nljNode.height || 120;
    
    let x: number, y: number;
    
    if (direction === 'TB' || direction === 'BT') {
      // For top-to-bottom layout, space nodes horizontally
      // Calculate proper spacing based on actual node widths
      let totalWidthNeeded = 0;
      
      // Calculate the starting position for this level
      const levelWidths = nodesAtLevel.map(n => n.measured?.width || n.data.nljNode.width || 250);
      const totalLevelWidth = levelWidths.reduce((sum, w) => sum + w, 0);
      const totalSpacing = (nodesAtLevel.length - 1) * Math.max(nodeSpacing, 100);
      totalWidthNeeded = totalLevelWidth + totalSpacing;
      
      // Start from the left edge of the level
      let startX = -totalWidthNeeded / 2;
      
      // Position this specific node
      for (let i = 0; i < indexInLevel; i++) {
        const prevNodeWidth = nodesAtLevel[i].measured?.width || nodesAtLevel[i].data.nljNode.width || 250;
        startX += prevNodeWidth + Math.max(nodeSpacing, 100);
      }
      
      x = startX + nodeWidth / 2;
      
      // Calculate Y position based on cumulative heights of previous levels
      let cumulativeY = 0;
      for (let prevLevel = 0; prevLevel < level; prevLevel++) {
        const prevLevelNodes = nodesByLevel.get(prevLevel) || [];
        const maxHeightInLevel = Math.max(
          ...prevLevelNodes.map(n => n.measured?.height || n.data.nljNode.height || 120)
        );
        cumulativeY += maxHeightInLevel + Math.max(levelSpacing, 200);
      }
      
      y = cumulativeY;
      if (direction === 'BT') y = -y;
    } else {
      // For left-to-right layout, space nodes vertically
      // Calculate proper spacing based on actual node heights
      let totalHeightNeeded = 0;
      
      // Calculate the starting position for this level
      const levelHeights = nodesAtLevel.map(n => n.measured?.height || n.data.nljNode.height || 120);
      const totalLevelHeight = levelHeights.reduce((sum, h) => sum + h, 0);
      const totalSpacing = (nodesAtLevel.length - 1) * Math.max(nodeSpacing, 80);
      totalHeightNeeded = totalLevelHeight + totalSpacing;
      
      // Start from the top edge of the level
      let startY = -totalHeightNeeded / 2;
      
      // Position this specific node
      for (let i = 0; i < indexInLevel; i++) {
        const prevNodeHeight = nodesAtLevel[i].measured?.height || nodesAtLevel[i].data.nljNode.height || 120;
        startY += prevNodeHeight + Math.max(nodeSpacing, 80);
      }
      
      // Calculate X position based on cumulative widths of previous levels
      let cumulativeX = 0;
      for (let prevLevel = 0; prevLevel < level; prevLevel++) {
        const prevLevelNodes = nodesByLevel.get(prevLevel) || [];
        const maxWidthInLevel = Math.max(
          ...prevLevelNodes.map(n => n.measured?.width || n.data.nljNode.width || 250)
        );
        cumulativeX += maxWidthInLevel + Math.max(levelSpacing, 300);
      }
      
      x = cumulativeX;
      y = startY + nodeHeight / 2;
      if (direction === 'RL') x = -x;
    }
    
    return {
      ...node,
      position: { x, y },
    };
  });
  
  return { nodes: updatedNodes, edges };
}

// Force-directed layout (simplified)
function calculateForceLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  _config: LayoutConfig
): { nodes: FlowNode[], edges: FlowEdge[] } {
  // Better force-directed layout for complex scenarios
  const updatedNodes = [...nodes];
  
  // Try to identify start and end nodes for better positioning (unused for now)
  // const _startNodes = nodes.filter(node => 
  //   node.data.isStart || !edges.some(edge => edge.target === node.id)
  // );
  // const _endNodes = nodes.filter(node => 
  //   node.data.isEnd || !edges.some(edge => edge.source === node.id)
  // );
  
  // Use a grid-based approach for better readability
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);
  
  const nodeWidth = 300;
  const nodeHeight = 200;
  const padding = 100;
  
  updatedNodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    // Position start nodes at the top, end nodes at the bottom
    let x = col * (nodeWidth + padding);
    let y = row * (nodeHeight + padding);
    
    // Adjust positioning for special node types
    if (node.data.isStart) {
      y = -nodeHeight; // Move start nodes above the grid
    } else if (node.data.isEnd) {
      y = rows * (nodeHeight + padding); // Move end nodes below the grid
    }
    
    node.position = { x, y };
  });
  
  return { nodes: updatedNodes, edges };
}

// Circular layout
function calculateCircularLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  _config: LayoutConfig
): { nodes: FlowNode[], edges: FlowEdge[] } {
  // Calculate radius accounting for node dimensions
  const maxNodeDimension = Math.max(
    ...nodes.map(n => Math.max(n.data.nljNode.width || 250, n.data.nljNode.height || 120))
  );
  const radius = Math.max(350, nodes.length * 70 + maxNodeDimension);
  
  const updatedNodes = nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    
    return {
      ...node,
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      },
    };
  });
  
  return { nodes: updatedNodes, edges };
}

// Validate flow integrity
export function validateFlow(nodes: FlowNode[], edges: FlowEdge[]): FlowValidationResult {
  const errors: FlowValidationResult['errors'] = [];
  const orphanedNodes: string[] = [];
  const unreachableNodes: string[] = [];
  const missingConnections: string[] = [];
  const duplicateConnections: string[] = [];
  
  // Check for start and end nodes
  const startNodes = nodes.filter(node => node.data.isStart);
  const endNodes = nodes.filter(node => node.data.isEnd);
  
  if (startNodes.length === 0) {
    errors.push({
      type: 'error',
      message: 'No start node found',
      suggestion: 'Add a start node to define the entry point',
    });
  } else if (startNodes.length > 1) {
    errors.push({
      type: 'warning',
      message: 'Multiple start nodes found',
      suggestion: 'Consider using only one start node for clarity',
    });
  }
  
  if (endNodes.length === 0) {
    errors.push({
      type: 'warning',
      message: 'No end node found',
      suggestion: 'Add an end node to define completion',
    });
  }
  
  // Check for orphaned nodes (no connections)
  nodes.forEach(node => {
    const hasIncoming = edges.some(edge => edge.target === node.id);
    const hasOutgoing = edges.some(edge => edge.source === node.id);
    
    if (!hasIncoming && !hasOutgoing && !node.data.isStart) {
      orphanedNodes.push(node.id);
      errors.push({
        type: 'warning',
        message: `Node "${node.data.label}" has no connections`,
        nodeId: node.id,
        suggestion: 'Connect this node to the flow or remove it',
      });
    }
  });
  
  // Check for unreachable nodes (no path from start) with cycle protection
  if (startNodes.length > 0) {
    const reachableNodes = new Set<string>();
    const queue = [...startNodes.map(n => n.id)];
    const maxIterations = nodes.length * 5; // Reasonable limit for reachability check
    let iterationCount = 0;
    
    while (queue.length > 0 && iterationCount < maxIterations) {
      iterationCount++;
      const nodeId = queue.shift()!;
      if (reachableNodes.has(nodeId)) continue;
      
      reachableNodes.add(nodeId);
      
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      outgoingEdges.forEach(edge => {
        if (!reachableNodes.has(edge.target)) {
          queue.push(edge.target);
        }
      });
    }
    
    // If we hit the iteration limit, log a warning
    if (iterationCount >= maxIterations) {
      console.warn('Flow validation: Maximum iterations reached during reachability check, potential cycle detected.');
    }
    
    nodes.forEach(node => {
      if (!reachableNodes.has(node.id) && !node.data.isStart) {
        unreachableNodes.push(node.id);
        errors.push({
          type: 'warning',
          message: `Node "${node.data.label}" is unreachable from start`,
          nodeId: node.id,
          suggestion: 'Add a path from the start node to this node',
        });
      }
    });
  }
  
  // Check for duplicate connections
  const connectionMap = new Map<string, string[]>();
  edges.forEach(edge => {
    const key = `${edge.source}-${edge.target}`;
    const existing = connectionMap.get(key) || [];
    existing.push(edge.id);
    connectionMap.set(key, existing);
  });
  
  connectionMap.forEach((edgeIds, connection) => {
    if (edgeIds.length > 1) {
      duplicateConnections.push(...edgeIds);
      errors.push({
        type: 'warning',
        message: `Duplicate connection found: ${connection}`,
        suggestion: 'Remove duplicate connections or adjust probabilities',
      });
    }
  });
  
  return {
    isValid: errors.filter(e => e.type === 'error').length === 0,
    errors,
    orphanedNodes,
    unreachableNodes,
    missingConnections,
    duplicateConnections,
  };
}

// Generate a unique ID for new nodes/edges
export function generateId(prefix: string = 'node'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get node style based on type and theme
export function getNodeStyle(nodeType: string, theme: string = 'unfiltered'): React.CSSProperties {
  const typeInfo = NODE_TYPE_INFO[nodeType];
  const baseStyle: React.CSSProperties = {
    background: typeInfo?.color || '#666',
    color: '#fff',
    border: '2px solid #333',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  if (theme === 'hyundai') {
    baseStyle.fontFamily = 'HyundaiSansHead, Arial, sans-serif';
    baseStyle.borderRadius = '4px';
  }
  
  return baseStyle;
}

// Get edge style based on type and theme
export function getEdgeStyle(_edgeType: string, theme: string = 'unfiltered'): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    stroke: '#666',
    strokeWidth: 2,
  };
  
  if (theme === 'hyundai') {
    baseStyle.stroke = '#002c5f';
    baseStyle.strokeWidth = 3;
  }
  
  return baseStyle;
}