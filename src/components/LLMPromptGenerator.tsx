import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Typography,
  Box,
  FormGroup,
  Checkbox,
  Divider,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Download as DownloadIcon,
  Close as CloseIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { 
  generateSchemaDocumentation, 
  generateBloomsTaxonomyReference, 
  generateValidationReference,
  generateExampleScenarios,
  getAllNodeTypes,
  getNodeTypesByCategory
} from '../utils/schemaDocGenerator';

interface LLMPromptGeneratorProps {
  open: boolean;
  onClose: () => void;
}

interface PromptConfiguration {
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

const DEFAULT_CONFIG: PromptConfiguration = {
  audiencePersona: 'New employees in automotive sales',
  learningObjective: 'Master product knowledge and customer interaction skills',
  contentStyle: 'conversational',
  complexityLevel: 5,
  bloomsLevels: ['Remember', 'Understand', 'Apply'],
  includedNodeTypes: [],
  excludedNodeTypes: [],
  includeMediaPlaceholders: true,
  includeVariables: false,
  includeXAPI: false,
  domainContext: 'automotive',
  sourceContentType: 'training_manual'
};

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
const CONTENT_STYLES = [
  { value: 'conversational', label: 'Conversational', description: 'Friendly, informal tone' },
  { value: 'formal', label: 'Formal', description: 'Professional, structured approach' },
  { value: 'gamified', label: 'Gamified', description: 'Game-like elements and challenges' },
  { value: 'scenario_based', label: 'Scenario-Based', description: 'Real-world situations and cases' }
];

const DOMAIN_CONTEXTS = [
  'automotive', 'healthcare', 'finance', 'technology', 'education', 
  'manufacturing', 'retail', 'hospitality', 'general_business', 'other'
];

const SOURCE_CONTENT_TYPES = [
  'training_manual', 'policy_document', 'procedure_guide', 'product_specifications',
  'case_studies', 'best_practices', 'compliance_requirements', 'technical_documentation'
];

export const LLMPromptGenerator: React.FC<LLMPromptGeneratorProps> = ({ open, onClose }) => {
  const [config, setConfig] = useState<PromptConfiguration>(DEFAULT_CONFIG);
  const [currentTab, setCurrentTab] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');

  const handleConfigChange = (key: keyof PromptConfiguration, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleBloomsLevelChange = (level: string, checked: boolean) => {
    const newLevels = checked 
      ? [...config.bloomsLevels, level]
      : config.bloomsLevels.filter(l => l !== level);
    handleConfigChange('bloomsLevels', newLevels);
  };

  const handleNodeTypeChange = (nodeType: string, included: boolean) => {
    if (included) {
      const newIncluded = [...config.includedNodeTypes, nodeType];
      const newExcluded = config.excludedNodeTypes.filter(t => t !== nodeType);
      handleConfigChange('includedNodeTypes', newIncluded);
      handleConfigChange('excludedNodeTypes', newExcluded);
    } else {
      const newIncluded = config.includedNodeTypes.filter(t => t !== nodeType);
      const newExcluded = [...config.excludedNodeTypes, nodeType];
      handleConfigChange('includedNodeTypes', newIncluded);
      handleConfigChange('excludedNodeTypes', newExcluded);
    }
  };

  const generatePrompt = (): string => {
    const schemaDoc = generateSchemaDocumentation();
    const bloomsRef = generateBloomsTaxonomyReference();
    const validationRef = generateValidationReference();
    const examples = generateExampleScenarios();
    const allNodeTypes = getAllNodeTypes();
    
    // Filter node types based on selection
    const availableNodeTypes = allNodeTypes.filter(node => {
      if (config.includedNodeTypes.length > 0) {
        return config.includedNodeTypes.includes(node.nodeType);
      }
      return !config.excludedNodeTypes.includes(node.nodeType);
    });

    const nodeTypeList = availableNodeTypes.map(node => 
      `- **${node.displayName}** (\`${node.nodeType}\`): ${node.description}`
    ).join('\n');

    const complexityGuidance = getComplexityGuidance(config.complexityLevel);
    const styleGuidance = getStyleGuidance(config.contentStyle);
    const domainGuidance = getDomainGuidance(config.domainContext);

    return `# NLJ Scenario Generation Prompt

## Your Task

Generate a valid NLJ JSON scenario based on the provided source material and requirements below. Create engaging, educational content that matches the specified audience persona and learning objectives.

## Target Configuration

- **Audience Persona**: ${config.audiencePersona}
- **Learning Objective**: ${config.learningObjective}
- **Content Style**: ${config.contentStyle}
- **Complexity Level**: ${config.complexityLevel}/10
- **Target Bloom's Levels**: ${config.bloomsLevels.join(', ')}
- **Domain Context**: ${config.domainContext}
- **Source Content Type**: ${config.sourceContentType}

## Content Style Guidelines

${styleGuidance}

## Complexity Level Guidelines

${complexityGuidance}

## Domain Context Guidelines

${domainGuidance}

## Available Node Types

You can use the following node types in your scenario:

${nodeTypeList}

## Bloom's Taxonomy Guidelines

${bloomsRef}

## Schema Documentation

${schemaDoc}

## Validation Requirements

${validationRef}

## Example Scenarios

${examples}

${config.includeMediaPlaceholders ? `## Media Placeholder Guidelines

When including media in your scenarios:

- Use detailed placeholder descriptions: "Image: Car engine diagram showing alternator location with parts labeled"
- Specify media purpose: "Video: 2-minute demonstration of proper brake pad replacement procedure"
- Include accessibility descriptions: "Audio: Customer service conversation example with background noise"
- Provide context for content creators: "Stock photo suggestion: Professional mechanic using diagnostic equipment"
- Use realistic file paths: "/images/engine-diagram.jpg", "/videos/brake-replacement.mp4"

` : ''}

${config.includeVariables ? `## Variable Usage Guidelines

Keep variable usage simple and purposeful:

- Use for basic scoring: \`correctAnswers\`, \`totalQuestions\`, \`score\`
- Simple conditional logic: \`if score >= 80% then success_path else review_path\`
- Avoid complex nested conditions in initial versions
- Variables should have clear, descriptive names

Example variable definitions:
\`\`\`json
"variableDefinitions": [
  {
    "id": "correctAnswers",
    "name": "Correct Answers",
    "type": "integer"
  },
  {
    "id": "totalQuestions", 
    "name": "Total Questions",
    "type": "integer"
  }
]
\`\`\`

` : ''}

${config.includeXAPI ? `## xAPI Integration Guidelines

Include xAPI configuration for learning analytics:

- Use standard xAPI verbs: experienced, answered, completed, passed, failed
- Include meaningful activity definitions
- Provide context for learning analytics systems
- Use consistent statement structure

Example xAPI configuration:
\`\`\`json
"integrations": {
  "lrs": {
    "endpoint": "https://your-lrs-endpoint.com/xapi/",
    "auth": {
      "username": "your_username",
      "password": "your_password"
    }
  }
}
\`\`\`

` : ''}

## Generation Instructions

1. **Analyze the Source Material**: Understand the content domain, key concepts, and learning requirements
2. **Create a Logical Flow**: Design a sequence that builds knowledge progressively
3. **Match Audience Level**: Adjust language, examples, and complexity to the specified persona
4. **Align with Learning Objectives**: Ensure all content directly supports the stated objectives
5. **Use Appropriate Node Types**: Select node types that best serve the learning goals
6. **Include Realistic Content**: Create questions and scenarios that reflect real-world applications
7. **Validate Structure**: Ensure all required properties are included and links are properly connected

## Output Format

Provide ONLY valid JSON in the following structure:

\`\`\`json
{
  "id": "unique-scenario-id",
  "name": "Descriptive Scenario Name",
  "orientation": "horizontal",
  "activityType": "training",
  "nodes": [
    // Array of node objects following the schema
  ],
  "links": [
    // Array of link objects connecting nodes
  ]
}
\`\`\`

## Important Notes

- Ensure all JSON is valid and parseable
- Every node must have a unique ID
- All links must reference existing node IDs
- Include proper coordinates (x, y, width, height) for all nodes
- Test your JSON structure before submitting
- Focus on educational value and learner engagement

## Your Source Material

[Place your source material here - training manuals, documentation, policies, etc.]

---

Now generate the NLJ scenario based on the above requirements and your source material.`;
  };

  const getComplexityGuidance = (level: number): string => {
    if (level <= 3) {
      return `**Simple (${level}/10)**: Create linear scenarios with basic question types (true/false, multiple choice). Focus on knowledge recall and basic understanding. Use clear, straightforward language.`;
    } else if (level <= 6) {
      return `**Moderate (${level}/10)**: Include multiple question types with some branching. Mix recall with application questions. Use scenarios that require thinking and analysis.`;
    } else {
      return `**Complex (${level}/10)**: Create sophisticated scenarios with branching paths, variables, and complex interactions. Include higher-order thinking questions and realistic decision-making scenarios.`;
    }
  };

  const getStyleGuidance = (style: string): string => {
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
  };

  const getDomainGuidance = (domain: string): string => {
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
  };

  const handleGeneratePrompt = () => {
    const prompt = generatePrompt();
    setGeneratedPrompt(prompt);
    setShowPreview(true);
  };

  const handleDownloadPrompt = () => {
    const prompt = generatedPrompt || generatePrompt();
    const blob = new Blob([prompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nlj-generation-prompt-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const TabPanel = ({ children, value, index }: { children: React.ReactNode; value: number; index: number }) => (
    <div hidden={value !== index} style={{ padding: '20px 0' }}>
      {value === index && children}
    </div>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ style: { minHeight: '80vh' } }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">LLM Prompt Generator</Typography>
          <Box>
            <Tooltip title="Generate Preview">
              <IconButton onClick={handleGeneratePrompt} color="primary">
                <PreviewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download Prompt">
              <IconButton onClick={handleDownloadPrompt} color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Tabs value={currentTab} onChange={(_, value) => setCurrentTab(value)}>
          <Tab label="Basic Configuration" />
          <Tab label="Content & Style" />
          <Tab label="Node Types" />
          <Tab label="Advanced Options" />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              label="Audience Persona"
              value={config.audiencePersona}
              onChange={(e) => handleConfigChange('audiencePersona', e.target.value)}
              fullWidth
              placeholder="e.g., New employees in automotive sales"
              helperText="Describe your target learners - their role, experience level, and context"
            />
            
            <TextField
              label="Learning Objective"
              value={config.learningObjective}
              onChange={(e) => handleConfigChange('learningObjective', e.target.value)}
              fullWidth
              placeholder="e.g., Master product knowledge and customer interaction skills"
              helperText="What should learners be able to do after completing this scenario?"
            />

            <FormControl component="fieldset">
              <FormLabel component="legend">Target Bloom's Taxonomy Levels</FormLabel>
              <FormGroup row>
                {BLOOM_LEVELS.map(level => (
                  <FormControlLabel
                    key={level}
                    control={
                      <Checkbox
                        checked={config.bloomsLevels.includes(level)}
                        onChange={(e) => handleBloomsLevelChange(level, e.target.checked)}
                      />
                    }
                    label={level}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Box display="flex" flexDirection="column" gap={3}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Content Style</FormLabel>
              <RadioGroup
                value={config.contentStyle}
                onChange={(e) => handleConfigChange('contentStyle', e.target.value)}
              >
                {CONTENT_STYLES.map(style => (
                  <FormControlLabel
                    key={style.value}
                    value={style.value}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body1">{style.label}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {style.description}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>

            <Box>
              <Typography gutterBottom>Complexity Level: {config.complexityLevel}/10</Typography>
              <Slider
                value={config.complexityLevel}
                onChange={(_, value) => handleConfigChange('complexityLevel', value)}
                min={1}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="textSecondary">
                1-3: Simple linear scenarios | 4-6: Moderate branching | 7-10: Complex interactions
              </Typography>
            </Box>

            <FormControl fullWidth>
              <FormLabel>Domain Context</FormLabel>
              <RadioGroup
                value={config.domainContext}
                onChange={(e) => handleConfigChange('domainContext', e.target.value)}
                row
              >
                {DOMAIN_CONTEXTS.map(domain => (
                  <FormControlLabel
                    key={domain}
                    value={domain}
                    control={<Radio />}
                    label={domain.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <Box display="flex" flexDirection="column" gap={3}>
            <Alert severity="info">
              Select specific node types to include, or leave empty to include all available types.
            </Alert>
            
            {(['structural', 'question', 'survey', 'game'] as const).map(category => {
              const categoryNodes = getNodeTypesByCategory(category);
              return (
                <Box key={category}>
                  <Typography variant="h6" gutterBottom>
                    {category.charAt(0).toUpperCase() + category.slice(1)} Nodes
                  </Typography>
                  <FormGroup>
                    {categoryNodes.map(node => (
                      <FormControlLabel
                        key={node.nodeType}
                        control={
                          <Checkbox
                            checked={config.includedNodeTypes.includes(node.nodeType)}
                            onChange={(e) => handleNodeTypeChange(node.nodeType, e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{node.displayName}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {node.description}
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                  </FormGroup>
                </Box>
              );
            })}
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Box display="flex" flexDirection="column" gap={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeMediaPlaceholders}
                  onChange={(e) => handleConfigChange('includeMediaPlaceholders', e.target.checked)}
                />
              }
              label="Include Media Placeholder Guidelines"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeVariables}
                  onChange={(e) => handleConfigChange('includeVariables', e.target.checked)}
                />
              }
              label="Include Variable Usage Guidelines"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeXAPI}
                  onChange={(e) => handleConfigChange('includeXAPI', e.target.checked)}
                />
              }
              label="Include xAPI Integration Guidelines"
            />

            <FormControl fullWidth>
              <FormLabel>Source Content Type</FormLabel>
              <RadioGroup
                value={config.sourceContentType}
                onChange={(e) => handleConfigChange('sourceContentType', e.target.value)}
              >
                {SOURCE_CONTENT_TYPES.map(type => (
                  <FormControlLabel
                    key={type}
                    value={type}
                    control={<Radio />}
                    label={type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>
        </TabPanel>

        {showPreview && (
          <Box mt={3}>
            <Divider />
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Generated Prompt Preview
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {generatedPrompt.substring(0, 1000)}...
              </Typography>
            </Paper>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleGeneratePrompt} color="primary">
          Generate Preview
        </Button>
        <Button 
          onClick={handleDownloadPrompt} 
          color="primary" 
          variant="contained"
          startIcon={<DownloadIcon />}
        >
          Download Prompt
        </Button>
      </DialogActions>
    </Dialog>
  );
};