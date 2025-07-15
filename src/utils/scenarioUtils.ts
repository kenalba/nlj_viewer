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
  const directLink = links.find(link => link.type === 'link');
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
  
  return parentChildLinks
    .map(link => scenario.nodes.find(node => node.id === link.targetNodeId))
    .filter((node): node is ChoiceNode => node?.type === 'choice');
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
 * Apply variable changes from a choice
 */
export const applyVariableChanges = (
  currentVariables: Record<string, number>,
  choice: ChoiceNode
): Record<string, number> => {
  if (!choice.variableChanges) return currentVariables;
  
  const newVariables = { ...currentVariables };
  choice.variableChanges.forEach(change => {
    newVariables[change.variableId] = change.value;
  });
  
  return newVariables;
};

/**
 * Validate NLJ scenario structure
 */
export const validateScenario = (scenario: NLJScenario): string[] => {
  const errors: string[] = [];
  
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
  
  return errors;
};