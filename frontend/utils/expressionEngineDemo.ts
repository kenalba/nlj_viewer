/**
 * Manual test/demo for Expression Engine
 * Run this to verify the expression engine works correctly
 */

import { evaluateExpression, validateExpression, extractVariables, getExpressionDescription } from './expressionEngine';

// Test context with sample variables
const testContext = {
  score: 85,
  attempts: 3,
  userName: 'admin',
  isComplete: true,
  bonus: 10
};

console.log('=== Expression Engine Demo ===\n');

// Test basic expressions
const testExpressions = [
  'score >= 80',
  'attempts <= 5',
  'userName == "admin"',
  '(score + bonus) > 90',
  'isComplete && score >= 80',
  'attempts < 3 || score > 85',
  '!isComplete',
  'score / attempts > 25',
  'invalid syntax +',
  ''
];

testExpressions.forEach((expr, index) => {
  console.log(`Test ${index + 1}: "${expr}"`);
  
  // Validate syntax
  const validation = validateExpression(expr);
  console.log(`  Syntax valid: ${validation.success}`);
  if (!validation.success) {
    console.log(`  Error: ${validation.error}`);
  }
  
  // Extract variables
  const variables = extractVariables(expr);
  console.log(`  Variables: [${variables.join(', ')}]`);
  
  // Get description
  const description = getExpressionDescription(expr);
  console.log(`  Description: ${description}`);
  
  // Evaluate if syntax is valid
  if (validation.success && expr.trim()) {
    const result = evaluateExpression(expr, testContext);
    console.log(`  Result: ${result.success ? result.value : `Error: ${result.error}`}`);
  }
  
  console.log('');
});

console.log('=== Demo Complete ===');

// Export so it can be run
export default function runDemo() {
  // This function exists just to make the file importable
}