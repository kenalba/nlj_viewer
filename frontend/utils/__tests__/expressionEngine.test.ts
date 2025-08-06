/**
 * Tests for Expression Engine
 * Comprehensive test suite for AST parsing and expression evaluation
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  parse,
  evaluateAST,
  evaluateExpression,
  validateExpression,
  extractVariables,
  getExpressionDescription,
  getExpressionType,
  type VariableContext,
  type ASTNode
} from '../expressionEngine';

describe('Expression Engine', () => {
  describe('tokenize', () => {
    it('should tokenize numbers correctly', () => {
      const tokens = tokenize('42 3.14');
      expect(tokens).toEqual([
        { type: 'number', value: '42', position: 0 },
        { type: 'number', value: '3.14', position: 3 }
      ]);
    });

    it('should tokenize strings correctly', () => {
      const tokens = tokenize('"hello" \'world\'');
      expect(tokens).toEqual([
        { type: 'string', value: 'hello', position: 0 },
        { type: 'string', value: 'world', position: 8 }
      ]);
    });

    it('should tokenize booleans correctly', () => {
      const tokens = tokenize('true false');
      expect(tokens).toEqual([
        { type: 'boolean', value: 'true', position: 0 },
        { type: 'boolean', value: 'false', position: 5 }
      ]);
    });

    it('should tokenize operators correctly', () => {
      const tokens = tokenize('+ - * / % < <= > >= == != && || !');
      const expectedOperators = ['+', '-', '*', '/', '%', '<', '<=', '>', '>=', '==', '!=', '&&', '||', '!'];
      
      expectedOperators.forEach((op, index) => {
        expect(tokens[index].type).toBe('operator');
        expect(tokens[index].value).toBe(op);
      });
    });

    it('should tokenize identifiers correctly', () => {
      const tokens = tokenize('score user_name _temp');
      expect(tokens).toEqual([
        { type: 'identifier', value: 'score', position: 0 },
        { type: 'identifier', value: 'user_name', position: 6 },
        { type: 'identifier', value: '_temp', position: 16 }
      ]);
    });

    it('should handle parentheses and commas', () => {
      const tokens = tokenize('(a, b)');
      expect(tokens).toEqual([
        { type: 'parenthesis', value: '(', position: 0 },
        { type: 'identifier', value: 'a', position: 1 },
        { type: 'comma', value: ',', position: 2 },
        { type: 'identifier', value: 'b', position: 4 },
        { type: 'parenthesis', value: ')', position: 5 }
      ]);
    });

    it('should handle escape sequences in strings', () => {
      const tokens = tokenize('"hello\\nworld"');
      expect(tokens[0]).toEqual({
        type: 'string',
        value: 'hello\nworld',
        position: 0
      });
    });

    it('should throw error for unterminated string', () => {
      expect(() => tokenize('"unterminated')).toThrow('Unterminated string literal');
    });

    it('should throw error for unexpected character', () => {
      expect(() => tokenize('score @ value')).toThrow("Unexpected character '@'");
    });
  });

  describe('parse', () => {
    it('should parse simple literals', () => {
      expect(parse(tokenize('42'))).toEqual({
        type: 'literal',
        value: 42
      });

      expect(parse(tokenize('"hello"'))).toEqual({
        type: 'literal',
        value: 'hello'
      });

      expect(parse(tokenize('true'))).toEqual({
        type: 'literal',
        value: true
      });
    });

    it('should parse identifiers', () => {
      expect(parse(tokenize('score'))).toEqual({
        type: 'identifier',
        identifier: 'score'
      });
    });

    it('should parse binary operations with correct precedence', () => {
      const ast = parse(tokenize('2 + 3 * 4'));
      expect(ast).toEqual({
        type: 'binary',
        operator: '+',
        left: { type: 'literal', value: 2 },
        right: {
          type: 'binary',
          operator: '*',
          left: { type: 'literal', value: 3 },
          right: { type: 'literal', value: 4 }
        }
      });
    });

    it('should handle parentheses correctly', () => {
      const ast = parse(tokenize('(2 + 3) * 4'));
      expect(ast).toEqual({
        type: 'binary',
        operator: '*',
        left: {
          type: 'binary',
          operator: '+',
          left: { type: 'literal', value: 2 },
          right: { type: 'literal', value: 3 }
        },
        right: { type: 'literal', value: 4 }
      });
    });

    it('should parse unary operations', () => {
      expect(parse(tokenize('!true'))).toEqual({
        type: 'unary',
        operator: '!',
        right: { type: 'literal', value: true }
      });

      expect(parse(tokenize('-5'))).toEqual({
        type: 'unary',
        operator: '-',
        right: { type: 'literal', value: 5 }
      });
    });

    it('should parse comparison operations', () => {
      const ast = parse(tokenize('score >= 80'));
      expect(ast).toEqual({
        type: 'binary',
        operator: '>=',
        left: { type: 'identifier', identifier: 'score' },
        right: { type: 'literal', value: 80 }
      });
    });

    it('should parse logical operations', () => {
      const ast = parse(tokenize('a && b || c'));
      expect(ast).toEqual({
        type: 'binary',
        operator: '||',
        left: {
          type: 'binary',
          operator: '&&',
          left: { type: 'identifier', identifier: 'a' },
          right: { type: 'identifier', identifier: 'b' }
        },
        right: { type: 'identifier', identifier: 'c' }
      });
    });
  });

  describe('evaluateAST', () => {
    const context: VariableContext = {
      score: 85,
      attempts: 3,
      userName: 'John',
      isComplete: true,
      average: 87.5
    };

    it('should evaluate literals', () => {
      expect(evaluateAST({ type: 'literal', value: 42 }, context)).toBe(42);
      expect(evaluateAST({ type: 'literal', value: 'hello' }, context)).toBe('hello');
      expect(evaluateAST({ type: 'literal', value: true }, context)).toBe(true);
    });

    it('should evaluate identifiers', () => {
      expect(evaluateAST({ type: 'identifier', identifier: 'score' }, context)).toBe(85);
      expect(evaluateAST({ type: 'identifier', identifier: 'userName' }, context)).toBe('John');
      expect(evaluateAST({ type: 'identifier', identifier: 'isComplete' }, context)).toBe(true);
    });

    it('should throw error for undefined variables', () => {
      expect(() => 
        evaluateAST({ type: 'identifier', identifier: 'undefined_var' }, context)
      ).toThrow('Undefined variable: undefined_var');
    });

    it('should evaluate arithmetic operations', () => {
      const addAST: ASTNode = {
        type: 'binary',
        operator: '+',
        left: { type: 'literal', value: 10 },
        right: { type: 'literal', value: 5 }
      };
      expect(evaluateAST(addAST, context)).toBe(15);

      const divideAST: ASTNode = {
        type: 'binary',
        operator: '/',
        left: { type: 'identifier', identifier: 'score' },
        right: { type: 'literal', value: 5 }
      };
      expect(evaluateAST(divideAST, context)).toBe(17);
    });

    it('should evaluate comparison operations', () => {
      const compareAST: ASTNode = {
        type: 'binary',
        operator: '>=',
        left: { type: 'identifier', identifier: 'score' },
        right: { type: 'literal', value: 80 }
      };
      expect(evaluateAST(compareAST, context)).toBe(true);
    });

    it('should evaluate logical operations', () => {
      const logicalAST: ASTNode = {
        type: 'binary',
        operator: '&&',
        left: { type: 'identifier', identifier: 'isComplete' },
        right: {
          type: 'binary',
          operator: '>',
          left: { type: 'identifier', identifier: 'score' },
          right: { type: 'literal', value: 80 }
        }
      };
      expect(evaluateAST(logicalAST, context)).toBe(true);
    });

    it('should evaluate unary operations', () => {
      const notAST: ASTNode = {
        type: 'unary',
        operator: '!',
        right: { type: 'literal', value: false }
      };
      expect(evaluateAST(notAST, context)).toBe(true);

      const negateAST: ASTNode = {
        type: 'unary',
        operator: '-',
        right: { type: 'literal', value: 10 }
      };
      expect(evaluateAST(negateAST, context)).toBe(-10);
    });

    it('should handle division by zero', () => {
      const divideByZeroAST: ASTNode = {
        type: 'binary',
        operator: '/',
        left: { type: 'literal', value: 10 },
        right: { type: 'literal', value: 0 }
      };
      expect(() => evaluateAST(divideByZeroAST, context)).toThrow('Division by zero');
    });
  });

  describe('evaluateExpression', () => {
    const context: VariableContext = {
      score: 85,
      attempts: 3,
      userName: 'John',
      isComplete: true
    };

    it('should evaluate simple expressions', () => {
      expect(evaluateExpression('score >= 80', context)).toEqual({
        success: true,
        value: true
      });

      expect(evaluateExpression('attempts + 2', context)).toEqual({
        success: true,
        value: 5
      });
    });

    it('should handle complex expressions', () => {
      expect(evaluateExpression('(score >= 80) && (attempts <= 5)', context)).toEqual({
        success: true,
        value: true
      });
    });

    it('should return error for invalid syntax', () => {
      const result = evaluateExpression('score +', context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected end of expression');
    });

    it('should return error for undefined variables', () => {
      const result = evaluateExpression('undefined_var > 10', context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Undefined variable');
    });

    it('should handle empty expressions', () => {
      const result = evaluateExpression('', context);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty expression');
    });
  });

  describe('validateExpression', () => {
    it('should validate correct expressions', () => {
      expect(validateExpression('score >= 80')).toEqual({ success: true });
      expect(validateExpression('(a + b) * c')).toEqual({ success: true });
      expect(validateExpression('!flag && (x > 0)')).toEqual({ success: true });
    });

    it('should reject invalid expressions', () => {
      const result = validateExpression('score +');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected end of expression');
    });

    it('should reject empty expressions', () => {
      const result = validateExpression('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty expression');
    });
  });

  describe('extractVariables', () => {
    it('should extract variable names', () => {
      expect(extractVariables('score >= 80')).toEqual(['score']);
      expect(extractVariables('(score + bonus) >= threshold')).toEqual(['score', 'bonus', 'threshold']);
      expect(extractVariables('userName == "admin" && isActive')).toEqual(['userName', 'isActive']);
    });

    it('should handle expressions with no variables', () => {
      expect(extractVariables('42 + 10')).toEqual([]);
      expect(extractVariables('"hello" == "world"')).toEqual([]);
    });

    it('should handle duplicate variables', () => {
      expect(extractVariables('score + score * 2')).toEqual(['score']);
    });

    it('should handle invalid expressions gracefully', () => {
      expect(extractVariables('invalid +')).toEqual([]);
    });
  });

  describe('getExpressionDescription', () => {
    it('should create human-readable descriptions', () => {
      expect(getExpressionDescription('score >= 80')).toBe('{score} greater than or equal 80');
      expect(getExpressionDescription('userName == "admin"')).toBe('{userName} equals "admin"');
      expect(getExpressionDescription('!isComplete')).toBe('not {isComplete}');
      expect(getExpressionDescription('a && b')).toBe('{a} and {b}');
    });

    it('should handle invalid expressions gracefully', () => {
      expect(getExpressionDescription('invalid +')).toBe('invalid +');
    });
  });

  describe('getExpressionType', () => {
    const context: VariableContext = {
      score: 85,
      userName: 'John',
      isComplete: true
    };

    it('should determine literal types', () => {
      expect(getExpressionType({ type: 'literal', value: 42 }, context)).toBe('number');
      expect(getExpressionType({ type: 'literal', value: 'hello' }, context)).toBe('string');
      expect(getExpressionType({ type: 'literal', value: true }, context)).toBe('boolean');
    });

    it('should determine identifier types from context', () => {
      expect(getExpressionType({ type: 'identifier', identifier: 'score' }, context)).toBe('number');
      expect(getExpressionType({ type: 'identifier', identifier: 'userName' }, context)).toBe('string');
      expect(getExpressionType({ type: 'identifier', identifier: 'isComplete' }, context)).toBe('boolean');
    });

    it('should determine binary operation types', () => {
      const arithmeticAST: ASTNode = {
        type: 'binary',
        operator: '+',
        left: { type: 'literal', value: 1 },
        right: { type: 'literal', value: 2 }
      };
      expect(getExpressionType(arithmeticAST, context)).toBe('number');

      const comparisonAST: ASTNode = {
        type: 'binary',
        operator: '>=',
        left: { type: 'literal', value: 1 },
        right: { type: 'literal', value: 2 }
      };
      expect(getExpressionType(comparisonAST, context)).toBe('boolean');
    });

    it('should determine unary operation types', () => {
      const notAST: ASTNode = {
        type: 'unary',
        operator: '!',
        right: { type: 'literal', value: true }
      };
      expect(getExpressionType(notAST, context)).toBe('boolean');

      const negateAST: ASTNode = {
        type: 'unary',
        operator: '-',
        right: { type: 'literal', value: 10 }
      };
      expect(getExpressionType(negateAST, context)).toBe('number');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle string operations', () => {
      const context = { name: 'John', greeting: 'Hello' };
      expect(evaluateExpression('greeting + " " + name', context)).toEqual({
        success: true,
        value: 'Hello John'
      });
    });

    it('should handle boolean logic correctly', () => {
      const context = { a: true, b: false, c: true };
      expect(evaluateExpression('a && b || c', context)).toEqual({
        success: true,
        value: true
      });
    });

    it('should handle nested parentheses', () => {
      expect(evaluateExpression('((2 + 3) * (4 + 1))', {})).toEqual({
        success: true,
        value: 25
      });
    });

    it('should handle operator precedence correctly', () => {
      expect(evaluateExpression('2 + 3 * 4 - 1', {})).toEqual({
        success: true,
        value: 13
      });
    });

    it('should handle mixed type comparisons', () => {
      const context = { score: 85, threshold: '80' };
      // Note: This should work due to JavaScript's type coercion
      expect(evaluateExpression('score > threshold', context)).toEqual({
        success: true,
        value: true
      });
    });
  });
});