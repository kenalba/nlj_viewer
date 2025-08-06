/**
 * Expression system type definitions for dropdown-based expression builder
 */

// Variable option for dropdown selection
export interface VariableOption {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean';
  icon: string;
  color: string;
  description?: string;
}

// Operator option for dropdown selection
export interface OperatorOption {
  value: string;
  label: string;
  description: string;
  symbol: string; // Visual representation (>, ==, etc.)
  validTypes: ('number' | 'string' | 'boolean')[];
  category: 'comparison' | 'logical' | 'arithmetic';
}

// Predefined operators by category
export const COMPARISON_OPERATORS: OperatorOption[] = [
  {
    value: 'equals', 
    label: 'equals', 
    symbol: '===',
    description: 'Check if values are exactly equal',
    validTypes: ['number', 'string', 'boolean'],
    category: 'comparison'
  },
  {
    value: 'not_equals', 
    label: 'does not equal', 
    symbol: '!==',
    description: 'Check if values are not equal',
    validTypes: ['number', 'string', 'boolean'],
    category: 'comparison'
  },
  {
    value: 'greater_than', 
    label: 'is greater than', 
    symbol: '>',
    description: 'Check if first value is greater than second',
    validTypes: ['number'],
    category: 'comparison'
  },
  {
    value: 'greater_than_or_equal', 
    label: 'is greater than or equal to', 
    symbol: '>=',
    description: 'Check if first value is greater than or equal to second',
    validTypes: ['number'],
    category: 'comparison'
  },
  {
    value: 'less_than', 
    label: 'is less than', 
    symbol: '<',
    description: 'Check if first value is less than second',
    validTypes: ['number'],
    category: 'comparison'
  },
  {
    value: 'less_than_or_equal', 
    label: 'is less than or equal to', 
    symbol: '<=',
    description: 'Check if first value is less than or equal to second',
    validTypes: ['number'],
    category: 'comparison'
  },
  {
    value: 'contains', 
    label: 'contains', 
    symbol: 'contains',
    description: 'Check if string contains substring',
    validTypes: ['string'],
    category: 'comparison'
  },
  {
    value: 'starts_with', 
    label: 'starts with', 
    symbol: 'starts with',
    description: 'Check if string starts with substring',
    validTypes: ['string'],
    category: 'comparison'
  },
  {
    value: 'ends_with', 
    label: 'ends with', 
    symbol: 'ends with',
    description: 'Check if string ends with substring',
    validTypes: ['string'],
    category: 'comparison'
  }
];

export const LOGICAL_OPERATORS: OperatorOption[] = [
  {
    value: 'and', 
    label: 'AND', 
    symbol: '&&',
    description: 'Both conditions must be true',
    validTypes: ['boolean'],
    category: 'logical'
  },
  {
    value: 'or', 
    label: 'OR', 
    symbol: '||',
    description: 'At least one condition must be true',
    validTypes: ['boolean'],
    category: 'logical'
  }
];

// Variable change operations for dropdown selection
export interface OperationOption {
  value: 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'append' | 'toggle';
  label: string;
  description: string;
  symbol: string;
  validTypes: ('number' | 'string' | 'boolean')[];
  requiresValue: boolean;
}

export const VARIABLE_OPERATIONS: OperationOption[] = [
  // Number operations
  {
    value: 'set',
    label: 'Set to',
    symbol: '=',
    description: 'Set variable to specific value',
    validTypes: ['number', 'string', 'boolean'],
    requiresValue: true
  },
  {
    value: 'add',
    label: 'Add',
    symbol: '+',
    description: 'Add value to current variable',
    validTypes: ['number'],
    requiresValue: true
  },
  {
    value: 'subtract',
    label: 'Subtract',
    symbol: '-',
    description: 'Subtract value from current variable',
    validTypes: ['number'],
    requiresValue: true
  },
  {
    value: 'multiply',
    label: 'Multiply by',
    symbol: '×',
    description: 'Multiply current variable by value',
    validTypes: ['number'],
    requiresValue: true
  },
  {
    value: 'divide',
    label: 'Divide by',
    symbol: '÷',
    description: 'Divide current variable by value',
    validTypes: ['number'],
    requiresValue: true
  },
  // String operations
  {
    value: 'append',
    label: 'Append',
    symbol: '+',
    description: 'Add text to end of current string',
    validTypes: ['string'],
    requiresValue: true
  },
  // Boolean operations
  {
    value: 'toggle',
    label: 'Toggle',
    symbol: '!',
    description: 'Switch between true and false',
    validTypes: ['boolean'],
    requiresValue: false
  }
];

// Node target option for dropdown selection
export interface NodeOption {
  id: string;
  name: string;
  type: string;
  icon: string;
  description?: string;
}

// Expression condition for branch nodes
export interface ExpressionCondition {
  id: string;
  label: string;
  variableId: string;
  operator: string;
  value: number | string | boolean;
  targetNodeId: string;
}

// Expression evaluation result
export interface ExpressionResult {
  success: boolean;
  value: boolean | number | string;
  error?: string;
}

// Context for expression evaluation
export interface ExpressionContext {
  variables: Record<string, number | string | boolean>;
  functions?: Record<string, Function>;
}

// Common value suggestions by variable type
export interface ValueSuggestion {
  value: number | string | boolean;
  label: string;
  description?: string;
}

export const COMMON_STRING_VALUES: ValueSuggestion[] = [
  { value: 'admin', label: 'Admin', description: 'Administrator role' },
  { value: 'user', label: 'User', description: 'Standard user role' },
  { value: 'manager', label: 'Manager', description: 'Manager role' },
  { value: 'guest', label: 'Guest', description: 'Guest user' },
  { value: '', label: 'Empty', description: 'Empty string' }
];

export const COMMON_BOOLEAN_VALUES: ValueSuggestion[] = [
  { value: true, label: 'True', description: 'Boolean true value' },
  { value: false, label: 'False', description: 'Boolean false value' }
];

export const COMMON_NUMBER_VALUES: ValueSuggestion[] = [
  { value: 0, label: '0', description: 'Zero' },
  { value: 1, label: '1', description: 'One' },
  { value: 10, label: '10', description: 'Ten' },
  { value: 50, label: '50', description: 'Fifty' },
  { value: 100, label: '100', description: 'One hundred' }
];

// Helper functions for getting appropriate options
export function getOperatorsForType(type: 'number' | 'string' | 'boolean'): OperatorOption[] {
  return COMPARISON_OPERATORS.filter(op => op.validTypes.includes(type));
}

export function getOperationsForType(type: 'number' | 'string' | 'boolean'): OperationOption[] {
  return VARIABLE_OPERATIONS.filter(op => op.validTypes.includes(type));
}

export function getCommonValuesForType(type: 'number' | 'string' | 'boolean'): ValueSuggestion[] {
  switch (type) {
    case 'number':
      return COMMON_NUMBER_VALUES;
    case 'string':
      return COMMON_STRING_VALUES;
    case 'boolean':
      return COMMON_BOOLEAN_VALUES;
    default:
      return [];
  }
}

// Expression validation
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Expression builder state
export interface ExpressionBuilderState {
  variableId: string;
  operator: string;
  value: number | string | boolean;
  targetNodeId?: string; // For branch conditions
}