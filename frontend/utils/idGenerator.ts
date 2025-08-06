/**
 * ID Generation Utilities
 * Consistent ID generation for nodes, conditions, and other entities
 */

/**
 * Generate a unique ID with timestamp and random suffix
 */
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate a node ID
 */
export const generateNodeId = (): string => {
  return generateId('node');
};

/**
 * Generate a link ID
 */
export const generateLinkId = (): string => {
  return generateId('link');
};

/**
 * Generate a condition ID for branch nodes
 */
export const generateConditionId = (): string => {
  return generateId('condition');
};

/**
 * Generate a variable ID
 */
export const generateVariableId = (): string => {
  return generateId('var');
};

/**
 * Check if an ID has a valid format
 */
export const isValidId = (id: string): boolean => {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
};