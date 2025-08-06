/**
 * Variable Interpolation Utility
 * Handles variable substitution in content and choices using curly braces notation
 */

export interface VariableContext {
  [key: string]: number | string | boolean;
}

/**
 * Interpolate variables in text using curly braces notation
 * Examples: 
 * - "Your score is {score}" -> "Your score is 85"
 * - "Hello {playerName}, you have {attempts} attempts left" -> "Hello John, you have 3 attempts left"
 * - "Status: {completed ? 'Complete' : 'Incomplete'}" -> "Status: Complete"
 */
export function interpolateVariables(
  text: string, 
  variables: VariableContext = {},
  options: {
    fallbackValue?: string;
    preserveUnknown?: boolean;
    formatters?: Record<string, (value: any) => string>;
  } = {}
): string {
  const { 
    fallbackValue = '???', 
    preserveUnknown = false,
    formatters = {}
  } = options;
  
  // Match variables in curly braces: {variableName}, {variableName|formatter}, {expression}
  const variableRegex = /\{([^}]+)\}/g;
  
  return text.replace(variableRegex, (match, expression) => {
    try {
      // Handle formatter syntax: {variable|formatter}
      const [variableName, formatterName] = expression.split('|').map((s: string) => s.trim());
      
      // Simple variable lookup
      if (variableName in variables) {
        let value = variables[variableName];
        
        // Apply formatter if specified
        if (formatterName && formatters[formatterName]) {
          value = formatters[formatterName](value);
        } else {
          // Default formatting
          value = formatValue(value, formatterName);
        }
        
        return String(value);
      }
      
      // Handle simple expressions (basic conditional syntax)
      if (expression.includes('?')) {
        return evaluateSimpleConditional(expression, variables);
      }
      
      // Variable not found
      if (preserveUnknown) {
        return match; // Keep original {variable} syntax
      }
      
      return fallbackValue;
      
    } catch (error) {
      console.warn('Variable interpolation error:', error);
      return preserveUnknown ? match : fallbackValue;
    }
  });
}

/**
 * Apply default formatting to values
 */
function formatValue(value: any, formatter?: string): string {
  if (formatter) {
    switch (formatter.toLowerCase()) {
      case 'uppercase':
      case 'upper':
        return String(value).toUpperCase();
      case 'lowercase':
      case 'lower':
        return String(value).toLowerCase();
      case 'capitalize':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
      case 'number':
        return Number(value).toString();
      case 'percent':
        return (Number(value) * 100).toFixed(1) + '%';
      case 'currency':
        return '$' + Number(value).toFixed(2);
      case 'yesno':
        return Boolean(value) ? 'Yes' : 'No';
      case 'truefalse':
        return Boolean(value) ? 'True' : 'False';
      case 'round':
        return Math.round(Number(value)).toString();
      case 'floor':
        return Math.floor(Number(value)).toString();
      case 'ceil':
        return Math.ceil(Number(value)).toString();
      default:
        return String(value);
    }
  }
  
  return String(value);
}

/**
 * Evaluate simple conditional expressions
 * Format: {variable ? 'true_value' : 'false_value'}
 */
function evaluateSimpleConditional(expression: string, variables: VariableContext): string {
  try {
    // Parse simple ternary: variable ? 'true' : 'false'
    const ternaryMatch = expression.match(/^(.+?)\s*\?\s*'([^']*?)'\s*:\s*'([^']*?)'$/);
    if (ternaryMatch) {
      const [, condition, trueValue, falseValue] = ternaryMatch;
      const conditionResult = evaluateCondition(condition.trim(), variables);
      return conditionResult ? trueValue : falseValue;
    }
    
    // Parse simple ternary with unquoted values: variable ? true_value : false_value
    const ternaryMatchUnquoted = expression.match(/^(.+?)\s*\?\s*([^:]+?)\s*:\s*(.+)$/);
    if (ternaryMatchUnquoted) {
      const [, condition, trueValue, falseValue] = ternaryMatchUnquoted;
      const conditionResult = evaluateCondition(condition.trim(), variables);
      return conditionResult ? trueValue.trim() : falseValue.trim();
    }
    
    return expression;
  } catch {
    return expression;
  }
}

/**
 * Evaluate simple conditions for ternary expressions
 */
function evaluateCondition(condition: string, variables: VariableContext): boolean {
  // Handle direct variable lookup
  if (condition in variables) {
    return Boolean(variables[condition]);
  }
  
  // Handle simple comparisons: variable == value, variable > value, etc.
  const comparisonMatch = condition.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (comparisonMatch) {
    const [, leftVar, operator, rightValue] = comparisonMatch;
    const leftVal = variables[leftVar.trim()];
    const rightVal = parseValue(rightValue.trim());
    
    switch (operator) {
      case '==': return leftVal == rightVal;
      case '!=': return leftVal != rightVal;
      case '>': return Number(leftVal) > Number(rightVal);
      case '>=': return Number(leftVal) >= Number(rightVal);
      case '<': return Number(leftVal) < Number(rightVal);
      case '<=': return Number(leftVal) <= Number(rightVal);
      default: return false;
    }
  }
  
  return false;
}

/**
 * Parse value from string (number, boolean, or string)
 */
function parseValue(value: string): any {
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // Parse boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Parse number
  const num = Number(value);
  if (!isNaN(num)) return num;
  
  // Return as string
  return value;
}

/**
 * Extract all variable references from text
 */
export function extractVariableReferences(text: string): string[] {
  const variableRegex = /\{([^}|?:]+)/g;
  const variables = new Set<string>();
  let match;
  
  while ((match = variableRegex.exec(text)) !== null) {
    const varName = match[1].trim();
    // Skip conditional expressions
    if (!varName.includes('?')) {
      variables.add(varName);
    }
  }
  
  return Array.from(variables);
}

/**
 * Check if text contains variable interpolation syntax
 */
export function hasVariableInterpolation(text: string): boolean {
  return /\{[^}]+\}/.test(text);
}

/**
 * Validate variable interpolation syntax
 */
export function validateInterpolationSyntax(text: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const variableRegex = /\{([^}]+)\}/g;
  let match;
  
  while ((match = variableRegex.exec(text)) !== null) {
    const expression = match[1];
    
    // Check for empty expressions
    if (!expression.trim()) {
      errors.push('Empty variable expression: {}');
      continue;
    }
    
    // Check for invalid characters
    if (expression.includes('\n') || expression.includes('\r')) {
      errors.push(`Invalid characters in expression: {${expression}}`);
    }
    
    // Check ternary syntax
    if (expression.includes('?')) {
      if (!expression.includes(':')) {
        errors.push(`Incomplete ternary expression: {${expression}}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Default formatters for common use cases
 */
export const DEFAULT_FORMATTERS: Record<string, (value: any) => string> = {
  score: (value: number) => `${value} points`,
  attempts: (value: number) => `${value} ${value === 1 ? 'attempt' : 'attempts'}`,
  percentage: (value: number) => `${(value * 100).toFixed(1)}%`,
  currency: (value: number) => `$${value.toFixed(2)}`,
  time: (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },
  ordinal: (value: number) => {
    const suffix = ['th', 'st', 'nd', 'rd'][value % 10] || 'th';
    if (value >= 11 && value <= 13) return `${value}th`;
    return `${value}${suffix}`;
  },
};