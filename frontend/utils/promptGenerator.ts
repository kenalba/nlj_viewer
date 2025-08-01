/**
 * Unified Prompt Generation Utility
 * Handles both LLMPromptGenerator and Content Studio configuration formats
 */

import { 
  generateSchemaDocumentation, 
  generateBloomsTaxonomyReference, 
  generateValidationReference,
  generateExampleScenarios,
  getAllNodeTypes,
  type NodeTypeDocumentation
} from './schemaDocGenerator';

// Content Studio configuration format (matches backend)
export interface ContentStudioConfig {
  audience_persona: string;
  learning_objective: string;
  content_style: 'conversational' | 'formal' | 'gamified' | 'scenario_based';
  complexity_level: number;
  scenario_length: number;
  include_variables: boolean;
  include_branching: boolean;
  node_types_enabled: Record<string, string[]>;
  custom_instructions: string;
  blooms_levels: string[];
}

// LLMPromptGenerator configuration format
export interface LLMPromptConfig {
  audiencePersona: string;
  learningObjective: string;
  contentStyle: 'conversational' | 'formal' | 'gamified' | 'scenario_based';
  complexityLevel: number;
  bloomsLevels: string[];
  includedNodeTypes: string[];
  excludedNodeTypes: string[];
  includeMediaPlaceholders: boolean;
  includeVariables: boolean;
  includeXAPI: boolean;
  domainContext: string;
  sourceContentType: string;
}

// Unified configuration that can handle both formats
export type UnifiedPromptConfig = ContentStudioConfig | LLMPromptConfig;

/**
 * Check if config is Content Studio format
 */
function isContentStudioConfig(config: UnifiedPromptConfig): config is ContentStudioConfig {
  return 'audience_persona' in config && 'node_types_enabled' in config;
}

/**
 * Convert any config format to normalized values
 */
function normalizeConfig(config: UnifiedPromptConfig) {
  if (isContentStudioConfig(config)) {
    // Content Studio format
    const enabledNodeTypes: string[] = [];
    Object.values(config.node_types_enabled).forEach(types => {
      enabledNodeTypes.push(...types);
    });

    return {
      audiencePersona: config.audience_persona || 'General learners',
      learningObjective: config.learning_objective || 'Complete the learning activity',
      contentStyle: config.content_style,
      complexityLevel: config.complexity_level,
      scenarioLength: config.scenario_length,
      includeVariables: config.include_variables,
      includeBranching: config.include_branching,
      enabledNodeTypes,
      customInstructions: config.custom_instructions,
      bloomsLevels: config.blooms_levels || [],
      // Content Studio defaults
      includeMediaPlaceholders: false,
      includeXAPI: false,
      domainContext: 'general_business',
      sourceContentType: 'training_manual'
    };
  } else {
    // LLM Prompt Generator format
    return {
      audiencePersona: config.audiencePersona,
      learningObjective: config.learningObjective,
      contentStyle: config.contentStyle,
      complexityLevel: config.complexityLevel,
      scenarioLength: 5, // Default for LLM format
      includeVariables: config.includeVariables,
      includeBranching: false, // LLM format doesn't have this yet
      enabledNodeTypes: config.includedNodeTypes,
      customInstructions: '', // LLM format doesn't have this
      bloomsLevels: config.bloomsLevels,
      includeMediaPlaceholders: config.includeMediaPlaceholders,
      includeXAPI: config.includeXAPI,
      domainContext: config.domainContext,
      sourceContentType: config.sourceContentType
    };
  }
}

/**
 * Get filtered node types based on configuration
 */
function getFilteredNodeTypes(enabledTypes: string[]): NodeTypeDocumentation[] {
  const allNodeTypes = getAllNodeTypes();
  
  // Always include start and end nodes
  const filteredTypes = allNodeTypes.filter(node => {
    if (node.nodeType === 'start' || node.nodeType === 'end') {
      return true;
    }
    
    if (enabledTypes.length > 0) {
      return enabledTypes.includes(node.nodeType);
    }
    
    return true; // Include all if none specified
  });

  return filteredTypes;
}

/**
 * Generate style guidance text
 */
function getStyleGuidance(style: string): string {
  switch (style) {
    case 'conversational':
      return '**Conversational Style**: Use friendly, informal language. Include personal examples and relatable scenarios. Make learners feel comfortable and engaged.';
    case 'formal':
      return '**Formal Style**: Use professional, structured language. Focus on precise terminology and clear instructions. Maintain a serious, authoritative tone.';
    case 'gamified':
      return '**Gamified Style**: Include game elements like points, challenges, and achievements. Use competitive language and progress indicators. Make learning feel like play.';
    case 'scenario_based':
      return '**Scenario-Based Style**: Create realistic workplace situations. Use case studies and real-world examples. Focus on practical application and problem-solving.';
    default:
      return '';
  }
}

/**
 * Generate complexity guidance text
 */
function getComplexityGuidance(level: number): string {
  if (level <= 3) {
    return `**Simple (${level}/10)**: Create linear scenarios with basic question types (true/false, multiple choice). Focus on knowledge recall and basic understanding. Use clear, straightforward language.`;
  } else if (level <= 6) {
    return `**Moderate (${level}/10)**: Include multiple question types with some branching. Mix recall with application questions. Use scenarios that require thinking and analysis.`;
  } else {
    return `**Complex (${level}/10)**: Create sophisticated scenarios with branching paths, variables, and complex interactions. Include higher-order thinking questions and realistic decision-making scenarios.`;
  }
}

/**
 * Generate domain guidance text
 */
function getDomainGuidance(domain: string): string {
  const domainMap: Record<string, string> = {
    automotive: 'Use automotive industry terminology, focus on vehicle knowledge, customer service, and sales processes.',
    healthcare: 'Emphasize patient care, medical procedures, compliance, and safety protocols.',
    finance: 'Include financial concepts, regulations, risk management, and client relationship building.',
    technology: 'Focus on technical skills, software knowledge, troubleshooting, and innovation.',
    education: 'Emphasize teaching methods, student engagement, curriculum design, and assessment.',
    manufacturing: 'Include production processes, quality control, safety procedures, and efficiency.',
    retail: 'Focus on customer service, product knowledge, sales techniques, and inventory management.',
    hospitality: 'Emphasize guest service, hospitality standards, communication skills, and problem resolution.',
    general_business: 'Include business fundamentals, communication, leadership, and professional skills.',
    other: 'Adapt language and examples to the specific domain context provided in the source material.'
  };
  return domainMap[domain] || domainMap.other;
}

/**
 * Generate unified prompt for any configuration format
 * This replaces both frontend LLMPromptGenerator and backend _build_prompt_from_config
 */
export function generateUnifiedPrompt(config: UnifiedPromptConfig): string {
  const normalized = normalizeConfig(config);
  const filteredNodeTypes = getFilteredNodeTypes(normalized.enabledNodeTypes);
  
  // Generate documentation sections with filtered node types
  const schemaDoc = generateSchemaDocumentation(filteredNodeTypes);
  const bloomsRef = generateBloomsTaxonomyReference();
  const validationRef = generateValidationReference();
  const examples = generateExampleScenarios();

  const nodeTypeList = filteredNodeTypes.map(node => 
    `- **${node.displayName}** (\`${node.nodeType}\`): ${node.description}`
  ).join('\n');

  const complexityGuidance = getComplexityGuidance(normalized.complexityLevel);
  const styleGuidance = getStyleGuidance(normalized.contentStyle);
  const domainGuidance = getDomainGuidance(normalized.domainContext);

  // Build the complete prompt
  const promptParts = [
    "# NLJ Scenario Generation Request",
    "",
    "## Generation Parameters",
    `- **Target Audience**: ${normalized.audiencePersona}`,
    `- **Learning Objective**: ${normalized.learningObjective}`,
    `- **Content Style**: ${normalized.contentStyle.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
    `- **Complexity Level**: ${normalized.complexityLevel}/10`,
    `- **Scenario Length**: ~${normalized.scenarioLength} nodes`,
    `- **Include Variables**: ${normalized.includeVariables ? 'Yes' : 'No'}`,
    `- **Include Branching**: ${normalized.includeBranching ? 'Yes' : 'No'}`
  ];

  // Add Bloom's taxonomy levels if specified
  if (normalized.bloomsLevels.length > 0) {
    promptParts.push(`- **Target Bloom's Levels**: ${normalized.bloomsLevels.join(', ')}`);
  }

  // Add domain context for LLM format
  if ('domainContext' in config) {
    promptParts.push(`- **Domain Context**: ${normalized.domainContext}`);
    promptParts.push(`- **Source Content Type**: ${normalized.sourceContentType}`);
  }

  // Add custom instructions if provided
  if (normalized.customInstructions) {
    promptParts.push("", "## Custom Instructions", normalized.customInstructions);
  }

  promptParts.push(
    "",
    "## Content Style Guidelines",
    "",
    styleGuidance,
    "",
    "## Complexity Level Guidelines", 
    "",
    complexityGuidance,
    "",
    "## Domain Context Guidelines",
    "",
    domainGuidance,
    "",
    "## Available Node Types",
    "",
    "You can use the following node types in your scenario:",
    "",
    nodeTypeList,
    "",
    "## Bloom's Taxonomy Guidelines",
    "",
    bloomsRef,
    "",
    "## Schema Documentation", 
    "",
    schemaDoc,
    "",
    "## CRITICAL: Link Types and Structure",
    "",
    "**Link Types:**",
    "- **\"link\"**: Standard navigation between nodes (start → question, choice → next_question, question → end)",
    "- **\"parent-child\"**: REQUIRED for connecting questions to their choices (question → choice)",
    "",
    "**Multiple Choice Questions MUST follow this structure:**",
    "1. Create a \"question\" node with the question text",
    "2. Create separate \"choice\" nodes for each answer option", 
    "3. Connect question to choices using \"parent-child\" links",
    "4. Connect each choice to next node using \"link\" links",
    "",
    "**Example Multiple Choice Structure:**",
    "```json",
    "{",
    "  \"nodes\": [",
    "    {\"id\": \"q1\", \"type\": \"question\", \"text\": \"What is...?\"},",
    "    {\"id\": \"choice1\", \"type\": \"choice\", \"text\": \"Answer A\", \"isCorrect\": true},",
    "    {\"id\": \"choice2\", \"type\": \"choice\", \"text\": \"Answer B\", \"isCorrect\": false}",
    "  ],",
    "  \"links\": [",
    "    {\"type\": \"parent-child\", \"sourceNodeId\": \"q1\", \"targetNodeId\": \"choice1\"},",
    "    {\"type\": \"parent-child\", \"sourceNodeId\": \"q1\", \"targetNodeId\": \"choice2\"},",
    "    {\"type\": \"link\", \"sourceNodeId\": \"choice1\", \"targetNodeId\": \"next_node\"},",
    "    {\"type\": \"link\", \"sourceNodeId\": \"choice2\", \"targetNodeId\": \"next_node\"}",
    "  ]",
    "}",
    "```",
    "",
    "## Validation Requirements",
    "",
    "**The NLJ Viewer includes comprehensive validation that will catch common errors:**",
    "",
    "- Questions without choices (missing parent-child links)",
    "- Choice nodes without parent questions",
    "- Choice nodes without navigation links", 
    "- Invalid link types",
    "- Links pointing to non-existent nodes",
    "- Missing start/end nodes",
    "- Orphaned nodes",
    "",
    "**If your generated JSON has validation errors, the system will provide detailed error messages to help you fix the structure.**",
    "",
    validationRef,
    "",
    "## Example Scenarios",
    "",
    examples
  );

  // Add advanced features sections
  if (normalized.includeVariables) {
    promptParts.push(
      "",
      "## Variable Usage Guidelines",
      "",
      "Keep variable usage simple and purposeful:",
      "",
      "- Use for basic scoring: `correctAnswers`, `totalQuestions`, `score`",
      "- Simple conditional logic: `if score >= 80% then success_path else review_path`",
      "- Avoid complex nested conditions in initial versions", 
      "- Variables should have clear, descriptive names",
      "",
      "Example variable definitions:",
      "```json",
      "\"variableDefinitions\": [",
      "  {",
      "    \"id\": \"correctAnswers\",",
      "    \"name\": \"Correct Answers\",",
      "    \"type\": \"integer\"",
      "  },",
      "  {",
      "    \"id\": \"totalQuestions\", ",
      "    \"name\": \"Total Questions\",",
      "    \"type\": \"integer\"",
      "  }",
      "]",
      "```"
    );
  }

  if (normalized.includeBranching) {
    promptParts.push(
      "",
      "## Branching Logic Guidelines",
      "",
      "- Use 'branch' node type for conditional navigation",
      "- Branch nodes evaluate conditions and route to different paths",
      "- Include 'conditions' array with expression, targetNodeId, label",
      "- Add 'defaultTargetNodeId' for fallback routing",
      "- Expression examples: 'score >= 80', 'experience_level === \"advanced\"', 'confidence_rating <= 2'",
      "- Mathematical operators: +, -, *, /, %",
      "- Comparison operators: ===, !==, <, <=, >, >=", 
      "- Logical operators: &&, ||, !",
      "",
      "Example branch node:",
      "```json",
      "{\"type\": \"branch\", \"title\": \"Path Selection\", \"text\": \"Routing based on performance\", \"conditions\": [{\"expression\": \"score >= 80\", \"targetNodeId\": \"advanced_content\", \"label\": \"High Score Path\"}], \"defaultTargetNodeId\": \"basic_content\"}",
      "```"
    );
  }

  if (normalized.includeMediaPlaceholders) {
    promptParts.push(
      "",
      "## Media Placeholder Guidelines",
      "",
      "When including media in your scenarios:",
      "",
      "- Use detailed placeholder descriptions: \"Image: Car engine diagram showing alternator location with parts labeled\"",
      "- Specify media purpose: \"Video: 2-minute demonstration of proper brake pad replacement procedure\"",
      "- Include accessibility descriptions: \"Audio: Customer service conversation example with background noise\"",
      "- Provide context for content creators: \"Stock photo suggestion: Professional mechanic using diagnostic equipment\"",
      "- Use realistic file paths: \"/images/engine-diagram.jpg\", \"/videos/brake-replacement.mp4\""
    );
  }

  if (normalized.includeXAPI) {
    promptParts.push(
      "",
      "## xAPI Integration Guidelines",
      "",
      "Include xAPI configuration for learning analytics:",
      "",
      "- Use standard xAPI verbs: experienced, answered, completed, passed, failed",
      "- Include meaningful activity definitions",
      "- Provide context for learning analytics systems",
      "- Use consistent statement structure",
      "",
      "Example xAPI configuration:",
      "```json",
      "\"integrations\": {",
      "  \"lrs\": {",
      "    \"endpoint\": \"https://your-lrs-endpoint.com/xapi/\",",
      "    \"auth\": {",
      "      \"username\": \"your_username\",",
      "      \"password\": \"your_password\"",
      "    }",
      "  }",
      "}",
      "```"
    );
  }

  promptParts.push(
    "",
    "## Content Formatting Guidelines",
    "",
    "**IMPORTANT**: All content should use HTML formatting instead of markdown:",
    "",
    "- **Bold text**: Use `<strong>Bold text</strong>` instead of `**Bold text**`",
    "- **Italic text**: Use `<em>Italic text</em>` instead of `*Italic text*`",
    "- **Headers**: Use `<h1>Header</h1>`, `<h2>Header</h2>`, etc. instead of `# Header`",
    "- **Lists**: Use `<ul><li>Item</li></ul>` instead of `- Item`",
    "- **Links**: Use `<a href=\"url\">Link text</a>` instead of `[Link text](url)`",
    "- **Line breaks**: Use `<br>` for line breaks or `<p>` tags for paragraphs",
    "- **Images**: Use `<img src=\"url\" alt=\"description\">` instead of `![alt](url)`",
    "",
    "**Example HTML-formatted content:**",
    "```html",
    "<h2>Learning Objectives</h2>",
    "<p>After completing this training, you will be able to:</p>",
    "<ul>",
    "  <li><strong>Identify</strong> key components of the system</li>",
    "  <li><em>Explain</em> the process workflow</li>",
    "  <li>Apply knowledge in <strong>real-world scenarios</strong></li>",
    "</ul>",
    "```",
    "",
    "This HTML formatting ensures consistent rendering across all components in the NLJ Viewer.",
    "",
    "## Generation Instructions",
    "",
    "1. **Analyze the Source Material**: Understand the content domain, key concepts, and learning requirements",
    "2. **Create a Logical Flow**: Design a sequence that builds knowledge progressively", 
    "3. **Match Audience Level**: Adjust language, examples, and complexity to the specified persona",
    "4. **Align with Learning Objectives**: Ensure all content directly supports the stated objectives",
    "5. **Use Appropriate Node Types**: Select node types that best serve the learning goals",
    "6. **Include Realistic Content**: Create questions and scenarios that reflect real-world applications",
    "7. **Use HTML Formatting**: Apply HTML formatting to all text content for consistent rendering",
    "8. **Validate Structure**: Ensure all required properties are included and links are properly connected",
    "",
    "## Output Format",
    "",
    "Provide ONLY valid JSON in the following structure:",
    "",
    "```json",
    "{",
    "  \"id\": \"unique-scenario-id\",",
    "  \"name\": \"Descriptive Scenario Name\",",
    "  \"orientation\": \"horizontal\",",
    "  \"activityType\": \"training\",",
    "  \"nodes\": [",  
    "    // Array of node objects following the schema",
    "  ],",
    "  \"links\": [",
    "    // Array of link objects connecting nodes",
    "  ]",
    "}",
    "```",
    "",
    "## Important Notes",
    "",
    "- Ensure all JSON is valid and parseable",
    "- Every node must have a unique ID",
    "- All links must reference existing node IDs", 
    "- Include proper coordinates (x, y, width, height) for all nodes",
    "- Test your JSON structure before submitting",
    "- Focus on educational value and learner engagement",
    "",
    "## Your Source Material",
    "",
    "[Place your source material here - training manuals, documentation, policies, etc.]",
    "",
    "---",
    "",
    "Now generate the NLJ scenario based on the above requirements and your source material."
  );

  return promptParts.join('\n');
}