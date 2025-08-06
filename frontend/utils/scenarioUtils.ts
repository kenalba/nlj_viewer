import type { NLJScenario, NLJNode, ChoiceNode } from '../types/nlj';

/**
 * Find the next node based on current node and user choice
 */
export const findNextNode = (
  scenario: NLJScenario,
  currentNodeId: string,
  choiceId?: string
): string | null => {
  const links = scenario.links.filter(link => link.sourceNodeId === currentNodeId);
  
  if (choiceId) {
    // Find link from specific choice
    const choiceLink = links.find(link => link.sourceNodeId === choiceId);
    return choiceLink?.targetNodeId || null;
  }
  
  // Find direct link (for non-choice nodes)
  // First try explicit 'link' type, then fall back to any non-parent-child link, then any link
  const directLink = links.find(link => link.type === 'link') || 
                    links.find(link => link.type !== 'parent-child') || 
                    links[0];
  return directLink?.targetNodeId || null;
};

/**
 * Get all choices for a question node
 */
export const getChoicesForQuestion = (
  scenario: NLJScenario,
  questionNodeId: string
): ChoiceNode[] => {
  const parentChildLinks = scenario.links.filter(
    link => link.type === 'parent-child' && link.sourceNodeId === questionNodeId
  );
  
  // Use a Set to prevent duplicates based on node ID
  const seenNodeIds = new Set<string>();
  return parentChildLinks
    .map(link => scenario.nodes.find(node => node.id === link.targetNodeId))
    .filter((node): node is ChoiceNode => {
      if (!node || node.type !== 'choice' || seenNodeIds.has(node.id)) {
        return false;
      }
      seenNodeIds.add(node.id);
      return true;
    });
};

/**
 * Find node by ID
 */
export const findNodeById = (scenario: NLJScenario, nodeId: string): NLJNode | null => {
  return scenario.nodes.find(node => node.id === nodeId) || null;
};

/**
 * Check if scenario is completed (reached end node)
 */
export const isScenarioComplete = (scenario: NLJScenario, currentNodeId: string): boolean => {
  const currentNode = findNodeById(scenario, currentNodeId);
  return currentNode?.type === 'end';
};

/**
 * Apply variable changes from a choice with full operation support
 */
export const applyVariableChanges = (
  currentVariables: Record<string, number | string | boolean>,
  choice: ChoiceNode
): Record<string, number | string | boolean> => {
  if (!choice.variableChanges) return currentVariables;
  
  const newVariables = { ...currentVariables };
  
  choice.variableChanges.forEach(change => {
    const currentValue = newVariables[change.variableId] || 0;
    const changeValue = change.value;
    
    switch (change.operation) {
      case 'set':
        newVariables[change.variableId] = changeValue;
        break;
        
      case 'add':
        if (typeof currentValue === 'number' && typeof changeValue === 'number') {
          newVariables[change.variableId] = currentValue + changeValue;
        } else {
          console.warn(`Cannot add non-numeric values: ${currentValue} + ${changeValue}`);
          newVariables[change.variableId] = changeValue;
        }
        break;
        
      case 'subtract':
        if (typeof currentValue === 'number' && typeof changeValue === 'number') {
          newVariables[change.variableId] = currentValue - changeValue;
        } else {
          console.warn(`Cannot subtract non-numeric values: ${currentValue} - ${changeValue}`);
          newVariables[change.variableId] = changeValue;
        }
        break;
        
      case 'multiply':
        if (typeof currentValue === 'number' && typeof changeValue === 'number') {
          newVariables[change.variableId] = currentValue * changeValue;
        } else {
          console.warn(`Cannot multiply non-numeric values: ${currentValue} * ${changeValue}`);
          newVariables[change.variableId] = changeValue;
        }
        break;
        
      case 'divide':
        if (typeof currentValue === 'number' && typeof changeValue === 'number') {
          if (changeValue === 0) {
            console.warn(`Division by zero attempted for variable ${change.variableId}`);
            newVariables[change.variableId] = currentValue;
          } else {
            newVariables[change.variableId] = currentValue / changeValue;
          }
        } else {
          console.warn(`Cannot divide non-numeric values: ${currentValue} / ${changeValue}`);
          newVariables[change.variableId] = changeValue;
        }
        break;
        
      case 'append':
        if (typeof currentValue === 'string' && typeof changeValue === 'string') {
          newVariables[change.variableId] = currentValue + changeValue;
        } else {
          // Convert to strings and append
          newVariables[change.variableId] = String(currentValue) + String(changeValue);
        }
        break;
        
      case 'toggle':
        if (typeof currentValue === 'boolean') {
          newVariables[change.variableId] = !currentValue;
        } else {
          // Convert to boolean and toggle
          newVariables[change.variableId] = !Boolean(currentValue);
        }
        break;
        
      default:
        console.warn(`Unknown operation: ${change.operation}, defaulting to set`);
        newVariables[change.variableId] = changeValue;
        break;
    }
  });
  
  return newVariables;
};

/**
 * Valid node types that are actually implemented in the system
 */
export const VALID_NODE_TYPES = [
  'start',
  'end',
  'question',
  'choice',
  'interstitial_panel',
  'true_false',
  'ordering',
  'matching',
  'short_answer',
  'likert_scale',
  'rating',
  'matrix',
  'slider',
  'text_area',
  'multi_select',
  'checkbox',
  'connections',
  'wordle',
  'crossword',
  'branch'
] as const;

/**
 * Check if a node type is valid
 */
export const isValidNodeType = (nodeType: string): boolean => {
  return VALID_NODE_TYPES.includes(nodeType as any);
};

/**
 * Node types that require either text or content property (not both, just one)
 */
const CONTENT_REQUIRED_NODE_TYPES = [
  'question',
  'choice',
  'interstitial_panel',
  'true_false',
  'ordering',
  'matching',
  'short_answer',
  'likert_scale',
  'rating',
  'matrix',
  'slider',
  'text_area',
  'multi_select',
  'checkbox',
  'connections',
  'wordle'
] as const;

/**
 * Validate individual node structure
 */
const validateNodeStructure = (node: any): string[] => {
  const errors: string[] = [];
  
  // Check required base properties
  if (!node.id) {
    errors.push(`Node missing required 'id' property`);
  }
  if (!node.type) {
    errors.push(`Node "${node.id || 'unknown'}" missing required 'type' property`);
  }
  
  // Check if node type requires either text or content property
  if (node.type && CONTENT_REQUIRED_NODE_TYPES.includes(node.type)) {
    const hasText = node.text && node.text.trim().length > 0;
    const hasContent = node.content && node.content.trim().length > 0;
    const hasMedia = node.media && node.media.fullPath && node.media.fullPath.trim().length > 0;
    
    // Special case: interstitial panels can have just media without text/content
    if (node.type === 'interstitial_panel') {
      if (!hasText && !hasContent && !hasMedia) {
        errors.push(`Node "${node.id}" of type "${node.type}" missing required content - must have either 'text', 'content', or 'media' property with non-empty value`);
      }
    } else {
      // Other content-required nodes must have text or content
      if (!hasText && !hasContent) {
        errors.push(`Node "${node.id}" of type "${node.type}" missing required content - must have either 'text' or 'content' property with non-empty value`);
      }
    }
  }
  
  // Type-specific validation
  switch (node.type) {
    case 'choice':
      if (typeof node.isCorrect !== 'boolean') {
        errors.push(`Choice node "${node.id}" missing required 'isCorrect' boolean property`);
      }
      break;
      
    case 'true_false':
      if (typeof node.correctAnswer !== 'boolean') {
        errors.push(`True/false node "${node.id}" missing required 'correctAnswer' boolean property`);
      }
      break;
      
    case 'ordering':
      if (!Array.isArray(node.items) || node.items.length === 0) {
        errors.push(`Ordering node "${node.id}" missing required 'items' array`);
      }
      break;
      
    case 'matching':
      if (!Array.isArray(node.leftItems) || !Array.isArray(node.rightItems)) {
        errors.push(`Matching node "${node.id}" missing required 'leftItems' and 'rightItems' arrays`);
      }
      if (!Array.isArray(node.correctMatches)) {
        errors.push(`Matching node "${node.id}" missing required 'correctMatches' array`);
      }
      break;
      
    case 'short_answer':
      if (!Array.isArray(node.correctAnswers)) {
        errors.push(`Short answer node "${node.id}" missing required 'correctAnswers' array`);
      }
      break;
      
    case 'likert_scale':
      if (!node.scale || typeof node.scale !== 'object') {
        errors.push(`Likert scale node "${node.id}" missing required 'scale' object`);
      }
      break;
      
    case 'rating':
      if (!node.ratingType || !node.range) {
        errors.push(`Rating node "${node.id}" missing required 'ratingType' and 'range' properties`);
      }
      break;
      
    case 'matrix':
      if (!Array.isArray(node.rows) || !Array.isArray(node.columns)) {
        errors.push(`Matrix node "${node.id}" missing required 'rows' and 'columns' arrays`);
      }
      break;
      
    case 'multi_select':
    case 'checkbox':
      if (!Array.isArray(node.options) || node.options.length === 0) {
        errors.push(`${node.type} node "${node.id}" missing required 'options' array`);
      }
      break;
      
    case 'connections':
      if (!node.gameData || !node.gameData.groups) {
        errors.push(`Connections node "${node.id}" missing required 'gameData.groups' property`);
      }
      break;
      
    case 'wordle':
      if (!node.gameData || !node.gameData.targetWord) {
        errors.push(`Wordle node "${node.id}" missing required 'gameData.targetWord' property`);
      }
      break;
      
    case 'crossword':
      if (!node.gameSettings || !node.gameSettings.grid || !node.gameSettings.clues) {
        errors.push(`Crossword node "${node.id}" missing required 'gameSettings.grid' and 'gameSettings.clues' properties`);
      }
      break;
      
    case 'branch':
      if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
        errors.push(`Branch node "${node.id}" missing required 'conditions' array`);
      } else {
        // Validate each condition
        node.conditions.forEach((condition: any, index: number) => {
          if (!condition.id) {
            errors.push(`Branch node "${node.id}" condition ${index + 1} missing required 'id' property`);
          }
          if (!condition.label || condition.label.trim() === '') {
            errors.push(`Branch node "${node.id}" condition ${index + 1} missing required 'label' property`);
          }
          if (!condition.expression || condition.expression.trim() === '') {
            errors.push(`Branch node "${node.id}" condition ${index + 1} missing required 'expression' property`);
          }
          if (!condition.targetNodeId || condition.targetNodeId.trim() === '') {
            errors.push(`Branch node "${node.id}" condition ${index + 1} missing required 'targetNodeId' property`);
          }
        });
      }
      if (!node.evaluationMode || !['first-match', 'priority-order'].includes(node.evaluationMode)) {
        errors.push(`Branch node "${node.id}" missing or invalid 'evaluationMode' property. Must be 'first-match' or 'priority-order'`);
      }
      break;
  }
  
  return errors;
};

/**
 * Validate NLJ scenario structure
 */
export const validateScenario = (scenario: NLJScenario): string[] => {
  const errors: string[] = [];
  
  // Check for unknown node types
  const unknownNodes = scenario.nodes.filter(node => !VALID_NODE_TYPES.includes(node.type as any));
  if (unknownNodes.length > 0) {
    unknownNodes.forEach(node => {
      errors.push(`Unknown node type "${node.type}" for node "${node.id}". Valid types are: ${VALID_NODE_TYPES.join(', ')}`);
    });
  }
  
  // Validate each node's structure
  scenario.nodes.forEach(node => {
    const nodeErrors = validateNodeStructure(node);
    errors.push(...nodeErrors);
  });
  
  // Check for start node
  const startNodes = scenario.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('No start node found');
  } else if (startNodes.length > 1) {
    errors.push('Multiple start nodes found');
  }
  
  // Check for end node
  const endNodes = scenario.nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('No end node found');
  }
  
  // Check for orphaned nodes
  const linkedNodeIds = new Set([
    ...scenario.links.map(l => l.sourceNodeId),
    ...scenario.links.map(l => l.targetNodeId),
  ]);
  
  const orphanedNodes = scenario.nodes.filter(
    node => !linkedNodeIds.has(node.id) && node.type !== 'start'
  );
  
  if (orphanedNodes.length > 0) {
    errors.push(`Orphaned nodes: ${orphanedNodes.map(n => n.id).join(', ')}`);
  }
  
  // Check for multiple choice questions without choices
  const questionNodes = scenario.nodes.filter(n => n.type === 'question');
  questionNodes.forEach(questionNode => {
    const choices = getChoicesForQuestion(scenario, questionNode.id);
    if (choices.length === 0) {
      errors.push(`Question node "${questionNode.id}" has no choice options. Multiple choice questions require at least one choice node connected via parent-child links.`);
    }
  });
  
  // Check for choice nodes without parent questions
  const choiceNodes = scenario.nodes.filter(n => n.type === 'choice');
  choiceNodes.forEach(choiceNode => {
    const parentLinks = scenario.links.filter(
      link => link.type === 'parent-child' && link.targetNodeId === choiceNode.id
    );
    if (parentLinks.length === 0) {
      errors.push(`Choice node "${choiceNode.id}" is not connected to any question. Choice nodes must be connected from a question node via parent-child links.`);
    } else if (parentLinks.length > 1) {
      errors.push(`Choice node "${choiceNode.id}" has multiple parent questions. Each choice should belong to only one question.`);
    }
  });
  
  // Check for choice nodes without navigation links
  choiceNodes.forEach(choiceNode => {
    const navigationLinks = scenario.links.filter(
      link => link.type === 'link' && link.sourceNodeId === choiceNode.id
    );
    if (navigationLinks.length === 0) {
      errors.push(`Choice node "${choiceNode.id}" has no navigation link. Choice nodes must have a link to the next node in the scenario.`);
    }
  });
  
  // Check for invalid link types
  const validLinkTypes = ['link', 'parent-child'];
  scenario.links.forEach(link => {
    if (!validLinkTypes.includes(link.type)) {
      errors.push(`Invalid link type "${link.type}" for link "${link.id}". Valid types are: ${validLinkTypes.join(', ')}`);
    }
  });
  
  // Check for links pointing to non-existent nodes
  const nodeIds = new Set(scenario.nodes.map(n => n.id));
  scenario.links.forEach(link => {
    if (!nodeIds.has(link.sourceNodeId)) {
      errors.push(`Link "${link.id}" references non-existent source node "${link.sourceNodeId}"`);
    }
    if (!nodeIds.has(link.targetNodeId)) {
      errors.push(`Link "${link.id}" references non-existent target node "${link.targetNodeId}"`);
    }
  });
  
  return errors;
};