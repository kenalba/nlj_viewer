/**
 * Expression Engine for NLJ Activities
 * Provides safe expression evaluation with AST parsing for branch conditions and variable operations
 */

// Expression AST Node Types
export interface ASTNode {
  type: string;
  value?: any;
  left?: ASTNode;
  right?: ASTNode;
  operator?: string;
  identifier?: string;
  arguments?: ASTNode[];
}

// Variable Context for expression evaluation
export interface VariableContext {
  [key: string]: number | string | boolean;
}

// Expression evaluation result
export interface ExpressionResult {
  success: boolean;
  value?: any;
  error?: string;
}

// Supported operators and their precedence
const OPERATORS = {
  '||': { precedence: 1, associativity: 'left' },
  '&&': { precedence: 2, associativity: 'left' },
  '==': { precedence: 3, associativity: 'left' },
  '!=': { precedence: 3, associativity: 'left' },
  '<': { precedence: 4, associativity: 'left' },
  '<=': { precedence: 4, associativity: 'left' },
  '>': { precedence: 4, associativity: 'left' },
  '>=': { precedence: 4, associativity: 'left' },
  '+': { precedence: 5, associativity: 'left' },
  '-': { precedence: 5, associativity: 'left' },
  '*': { precedence: 6, associativity: 'left' },
  '/': { precedence: 6, associativity: 'left' },
  '%': { precedence: 6, associativity: 'left' },
  '!': { precedence: 7, associativity: 'right' },
} as const;

// Token types for lexical analysis
interface Token {
  type: 'number' | 'string' | 'boolean' | 'identifier' | 'operator' | 'parenthesis' | 'comma';
  value: string;
  position: number;
}

/**
 * Tokenize an expression string into tokens
 */
export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < expression.length) {
    const char = expression[position];

    // Skip whitespace
    if (/\s/.test(char)) {
      position++;
      continue;
    }

    // Numbers (including decimals)
    if (/\d/.test(char)) {
      let value = '';
      while (position < expression.length && /[\d.]/.test(expression[position])) {
        value += expression[position];
        position++;
      }
      tokens.push({ type: 'number', value, position: position - value.length });
      continue;
    }

    // Strings (quoted)
    if (char === '"' || char === "'") {
      const quote = char;
      const tokenStart = position; // Record the start position before moving
      let value = '';
      position++; // Skip opening quote
      
      while (position < expression.length && expression[position] !== quote) {
        if (expression[position] === '\\' && position + 1 < expression.length) {
          // Handle escape sequences
          position++;
          const escaped = expression[position];
          switch (escaped) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case 'r': value += '\r'; break;
            case '\\': value += '\\'; break;
            case '"': value += '"'; break;
            case "'": value += "'"; break;
            default: value += escaped; break;
          }
        } else {
          value += expression[position];
        }
        position++;
      }
      
      if (position >= expression.length) {
        throw new Error(`Unterminated string literal at position ${position}`);
      }
      
      position++; // Skip closing quote
      tokens.push({ type: 'string', value, position: tokenStart });
      continue;
    }

    // Boolean literals
    if (expression.substr(position, 4) === 'true') {
      tokens.push({ type: 'boolean', value: 'true', position });
      position += 4;
      continue;
    }
    
    if (expression.substr(position, 5) === 'false') {
      tokens.push({ type: 'boolean', value: 'false', position });
      position += 5;
      continue;
    }

    // Two-character operators
    const twoChar = expression.substr(position, 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar, position });
      position += 2;
      continue;
    }

    // Single-character operators
    if (['+', '-', '*', '/', '%', '<', '>', '!'].includes(char)) {
      tokens.push({ type: 'operator', value: char, position });
      position++;
      continue;
    }

    // Parentheses
    if (['(', ')'].includes(char)) {
      tokens.push({ type: 'parenthesis', value: char, position });
      position++;
      continue;
    }

    // Comma
    if (char === ',') {
      tokens.push({ type: 'comma', value: char, position });
      position++;
      continue;
    }

    // Identifiers (variable names, function names)
    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      while (position < expression.length && /[a-zA-Z0-9_]/.test(expression[position])) {
        value += expression[position];
        position++;
      }
      tokens.push({ type: 'identifier', value, position: position - value.length });
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${position}`);
  }

  return tokens;
}

/**
 * Parse tokens into an Abstract Syntax Tree (AST)
 */
export function parse(tokens: Token[]): ASTNode {
  let position = 0;

  function peek(): Token | null {
    return position < tokens.length ? tokens[position] : null;
  }

  function consume(): Token | null {
    return position < tokens.length ? tokens[position++] : null;
  }

  function parseExpression(minPrecedence = 0): ASTNode {
    let left = parsePrimary();

    while (true) {
      const token = peek();
      if (!token || token.type !== 'operator') break;

      const operator = token.value;
      const opInfo = OPERATORS[operator as keyof typeof OPERATORS];
      if (!opInfo || opInfo.precedence < minPrecedence) break;

      consume(); // consume operator

      const nextMinPrec = opInfo.associativity === 'left' 
        ? opInfo.precedence + 1 
        : opInfo.precedence;

      const right = parseExpression(nextMinPrec);

      left = {
        type: 'binary',
        operator,
        left,
        right
      };
    }

    return left;
  }

  function parsePrimary(): ASTNode {
    const token = peek();
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    // Handle unary operators
    if (token.type === 'operator' && (token.value === '!' || token.value === '-')) {
      consume();
      const operand = parsePrimary();
      return {
        type: 'unary',
        operator: token.value,
        right: operand
      };
    }

    // Handle parentheses
    if (token.type === 'parenthesis' && token.value === '(') {
      consume(); // consume '('
      const expr = parseExpression();
      const closeParen = consume();
      if (!closeParen || closeParen.value !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      return expr;
    }

    // Handle literals
    if (token.type === 'number') {
      consume();
      return {
        type: 'literal',
        value: parseFloat(token.value)
      };
    }

    if (token.type === 'string') {
      consume();
      return {
        type: 'literal',
        value: token.value
      };
    }

    if (token.type === 'boolean') {
      consume();
      return {
        type: 'literal',
        value: token.value === 'true'
      };
    }

    // Handle identifiers (variables)
    if (token.type === 'identifier') {
      consume();
      return {
        type: 'identifier',
        identifier: token.value
      };
    }

    throw new Error(`Unexpected token: ${token.type} '${token.value}' at position ${token.position}`);
  }

  const ast = parseExpression();
  
  if (position < tokens.length) {
    const remaining = tokens[position];
    throw new Error(`Unexpected token after expression: ${remaining.type} '${remaining.value}' at position ${remaining.position}`);
  }

  return ast;
}

/**
 * Evaluate an AST node against a variable context
 */
export function evaluateAST(ast: ASTNode, context: VariableContext): any {
  switch (ast.type) {
    case 'literal':
      return ast.value;

    case 'identifier':
      if (!ast.identifier) {
        throw new Error('Invalid identifier node');
      }
      if (!(ast.identifier in context)) {
        throw new Error(`Undefined variable: ${ast.identifier}`);
      }
      return context[ast.identifier];

    case 'binary':
      if (!ast.left || !ast.right || !ast.operator) {
        throw new Error('Invalid binary operation node');
      }
      
      const left = evaluateAST(ast.left, context);
      const right = evaluateAST(ast.right, context);

      switch (ast.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': 
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        case '%': 
          if (right === 0) throw new Error('Division by zero');
          return left % right;
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        case '&&': return left && right;
        case '||': return left || right;
        default:
          throw new Error(`Unknown binary operator: ${ast.operator}`);
      }

    case 'unary':
      if (!ast.right || !ast.operator) {
        throw new Error('Invalid unary operation node');
      }
      
      const operand = evaluateAST(ast.right, context);
      
      switch (ast.operator) {
        case '!': return !operand;
        case '-': return -operand;
        default:
          throw new Error(`Unknown unary operator: ${ast.operator}`);
      }

    default:
      throw new Error(`Unknown AST node type: ${ast.type}`);
  }
}

/**
 * Safe expression evaluation with error handling
 */
export function evaluateExpression(
  expression: string, 
  context: VariableContext = {}
): ExpressionResult {
  try {
    if (!expression.trim()) {
      return { success: false, error: 'Empty expression' };
    }

    const tokens = tokenize(expression);
    const ast = parse(tokens);
    const value = evaluateAST(ast, context);

    return { success: true, value };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Validate an expression without evaluation (syntax check only)
 */
export function validateExpression(expression: string): ExpressionResult {
  try {
    if (!expression.trim()) {
      return { success: false, error: 'Empty expression' };
    }

    const tokens = tokenize(expression);
    parse(tokens); // This will throw if syntax is invalid

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Extract variable names used in an expression
 */
export function extractVariables(expression: string): string[] {
  try {
    const tokens = tokenize(expression);
    // Try to parse the expression to ensure it's valid
    parse(tokens);
    
    const variables = new Set<string>();
    tokens.forEach(token => {
      if (token.type === 'identifier') {
        variables.add(token.value);
      }
    });
    
    return Array.from(variables);
  } catch {
    return [];
  }
}

/**
 * Get human-readable description of expression for UI
 */
export function getExpressionDescription(expression: string): string {
  try {
    const tokens = tokenize(expression);
    // Try to parse the expression to ensure it's valid
    parse(tokens);
    
    return tokens.map(token => {
      switch (token.type) {
        case 'identifier':
          return `{${token.value}}`;
        case 'operator':
          switch (token.value) {
            case '==': return 'equals';
            case '!=': return 'not equals';
            case '<=': return 'less than or equal';
            case '>=': return 'greater than or equal';
            case '<': return 'less than';
            case '>': return 'greater than';
            case '&&': return 'and';
            case '||': return 'or';
            case '!': return 'not';
            default: return token.value;
          }
        case 'string':
          return `"${token.value}"`;
        default:
          return token.value;
      }
    }).join(' ');
  } catch {
    return expression;
  }
}

/**
 * Type checking utilities
 */
export function getExpressionType(ast: ASTNode, context: VariableContext): 'number' | 'string' | 'boolean' | 'unknown' {
  switch (ast.type) {
    case 'literal':
      return typeof ast.value as 'number' | 'string' | 'boolean';
    
    case 'identifier':
      if (!ast.identifier || !(ast.identifier in context)) {
        return 'unknown';
      }
      return typeof context[ast.identifier] as 'number' | 'string' | 'boolean';
    
    case 'binary':
      if (!ast.operator) return 'unknown';
      
      switch (ast.operator) {
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
          return 'number';
        case '==':
        case '!=':
        case '<':
        case '<=':
        case '>':
        case '>=':
        case '&&':
        case '||':
          return 'boolean';
        default:
          return 'unknown';
      }
    
    case 'unary':
      if (!ast.operator) return 'unknown';
      
      switch (ast.operator) {
        case '!':
          return 'boolean';
        case '-':
          return 'number';
        default:
          return 'unknown';
      }
    
    default:
      return 'unknown';
  }
}