/**
 * Prompt Configuration Component
 * Enhanced LLM prompt configuration with document context awareness
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Slider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Preview as PreviewIcon,
  FlashOn as PresetIcon,
  Palette as StyleIcon,
  Speed as ComplexityIcon,
  Timeline as LengthIcon,
  Extension as AdvancedIcon,
  Edit as CustomIcon,
  School as BloomsIcon,
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import type { SourceDocument } from '../../client/sources';
import { 
  generateSchemaDocumentation, 
  getAllOptionalNodeTypesByCategory 
} from '../../utils/schemaDocGenerator';

interface PromptConfiguration {
  audience_persona: string;
  learning_objective: string;
  content_style: 'conversational' | 'formal' | 'gamified' | 'scenario_based';
  complexity_level: number;
  estimated_duration: number; // in minutes instead of node count
  include_variables: boolean;
  include_branching: boolean;
  node_types_enabled: Record<string, string[]>;
  custom_instructions: string;
  blooms_levels: string[];
}

interface PromptConfigurationProps {
  selectedDocuments: SourceDocument[];
  onConfigurationChange: (config: PromptConfiguration) => void;
}

const defaultConfig: PromptConfiguration = {
  audience_persona: '',
  learning_objective: '',  
  content_style: 'conversational',
  complexity_level: 3,
  estimated_duration: 5, // 5 minutes default
  include_variables: true,
  include_branching: false,
  node_types_enabled: {
    structural: ['interstitial_panel'],
    question: ['multiple_choice', 'true_false'],
    survey: [],
    game: []
  },
  custom_instructions: '',
  blooms_levels: []
};

export const PromptConfiguration: React.FC<PromptConfigurationProps> = ({
  selectedDocuments,
  onConfigurationChange
}) => {
  const theme = useTheme();
  const [config, setConfig] = useState<PromptConfiguration>(defaultConfig);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // Update configuration whenever it changes (with useCallback to prevent infinite loops)
  const debouncedConfigChange = useCallback(
    (newConfig: PromptConfiguration) => {
      onConfigurationChange(newConfig);
    },
    [onConfigurationChange]
  );

  useEffect(() => {
    debouncedConfigChange(config);
  }, [config, debouncedConfigChange]);

  // Generate prompt preview
  useEffect(() => {
    const prompt = generatePrompt(config, selectedDocuments);
    setGeneratedPrompt(prompt);
  }, [config, selectedDocuments]);

  const updateConfig = (updates: Partial<PromptConfiguration>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleBloomsLevelToggle = (level: string) => {
    const newLevels = config.blooms_levels.includes(level)
      ? config.blooms_levels.filter(l => l !== level)
      : [...config.blooms_levels, level];
    
    // Update node types based on selected Bloom's levels
    const updatedNodeTypes = getNodeTypesForBloomsLevels(newLevels);
    
    setConfig(prev => ({
      ...prev,
      blooms_levels: newLevels,
      node_types_enabled: updatedNodeTypes
    }));
  };

  // Function to determine which node types should be enabled based on Bloom's levels
  const getNodeTypesForBloomsLevels = (levels: string[]): Record<string, string[]> => {
    const nodeTypesByCategory = getAllOptionalNodeTypesByCategory();
    
    if (levels.length === 0) {
      // If no levels selected, return default minimal set
      return {
        structural: nodeTypesByCategory.structural?.filter(type => ['interstitial_panel'].includes(type)) || [],
        question: nodeTypesByCategory.question?.filter(type => ['multiple_choice', 'true_false'].includes(type)) || [],
        survey: [],
        game: []
      };
    }
    
    const result = {
      structural: nodeTypesByCategory.structural?.filter(type => ['interstitial_panel'].includes(type)) || [],
      question: [] as string[],
      survey: [] as string[],
      game: [] as string[]
    };
    
    // Remember: Basic recall (fewest types)
    if (levels.includes('Remember')) {
      result.question.push('question', 'true_false');
    }
    
    // Understand: Comprehension (add more types)
    if (levels.includes('Understand')) {
      result.question.push('question', 'true_false', 'matching');
      result.survey.push('multi_select');
    }
    
    // Apply: Practical application (build on understand)
    if (levels.includes('Apply')) {
      result.question.push('question', 'true_false', 'matching', 'ordering', 'checkbox');
      result.survey.push('multi_select');
      result.game.push('wordle');
    }
    
    // Analyze: Complex analysis (specialized types)
    if (levels.includes('Analyze')) {
      result.question.push('matching', 'ordering');
      result.survey.push('matrix');
      result.game.push('connections');
    }
    
    // Evaluate: Assessment and judgment (survey-focused)
    if (levels.includes('Evaluate')) {
      result.question.push('short_answer');
      result.survey.push('likert_scale', 'rating', 'slider', 'text_area');
    }
    
    // Create: Creative synthesis (most types, open-ended)
    if (levels.includes('Create')) {
      result.question.push('short_answer', 'ordering');
      result.survey.push('text_area');
      result.game.push('wordle');
    }
    
    // Remove duplicates from all arrays
    result.structural = [...new Set(result.structural)];
    result.question = [...new Set(result.question)];
    result.survey = [...new Set(result.survey)];
    result.game = [...new Set(result.game)];
    
    return result;
  };

  // Function to determine which Bloom's level enabled a specific node type
  const getBloomsLevelForNodeType = (nodeType: string): string | null => {
    if (config.blooms_levels.length === 0) return null;
    
    // Remember: Basic recall (fewest types)
    if (['question', 'true_false'].includes(nodeType) && config.blooms_levels.includes('Remember')) {
      return 'Remember';
    }
    
    // Understand: Comprehension (add more types)  
    if (['question', 'true_false', 'matching'].includes(nodeType) && config.blooms_levels.includes('Understand')) {
      return 'Understand';
    }
    if (['multi_select'].includes(nodeType) && config.blooms_levels.includes('Understand')) {
      return 'Understand';
    }
    
    // Apply: Practical application (build on understand)
    if (['question', 'true_false', 'matching', 'ordering', 'checkbox'].includes(nodeType) && config.blooms_levels.includes('Apply')) {
      return 'Apply';
    }
    if (['multi_select'].includes(nodeType) && config.blooms_levels.includes('Apply')) {
      return 'Apply';
    }
    if (['wordle'].includes(nodeType) && config.blooms_levels.includes('Apply')) {
      return 'Apply';
    }
    
    // Analyze: Complex analysis (specialized types)
    if (['matching', 'ordering'].includes(nodeType) && config.blooms_levels.includes('Analyze')) {
      return 'Analyze';
    }
    if (['matrix'].includes(nodeType) && config.blooms_levels.includes('Analyze')) {
      return 'Analyze';
    }
    if (['connections'].includes(nodeType) && config.blooms_levels.includes('Analyze')) {
      return 'Analyze';
    }
    
    // Evaluate: Assessment and judgment (survey-focused)
    if (['short_answer'].includes(nodeType) && config.blooms_levels.includes('Evaluate')) {
      return 'Evaluate';
    }
    if (['likert_scale', 'rating', 'slider', 'text_area'].includes(nodeType) && config.blooms_levels.includes('Evaluate')) {
      return 'Evaluate';
    }
    
    // Create: Creative synthesis (most types, open-ended)
    if (['short_answer', 'ordering'].includes(nodeType) && config.blooms_levels.includes('Create')) {
      return 'Create';
    }
    if (['text_area'].includes(nodeType) && config.blooms_levels.includes('Create')) {
      return 'Create';
    }
    if (['wordle'].includes(nodeType) && config.blooms_levels.includes('Create')) {
      return 'Create';
    }
    
    return null;
  };

  // Get color for Bloom's level
  const getBloomsLevelColor = (level: string): string => {
    const colorMap: Record<string, string> = {
      'Remember': theme.palette.info.main,
      'Understand': theme.palette.success.main,
      'Apply': theme.palette.warning.main,
      'Analyze': theme.palette.secondary.main,
      'Evaluate': theme.palette.primary.main,
      'Create': theme.palette.error.main
    };
    return colorMap[level] || theme.palette.text.secondary;
  };

  const updateNodeTypes = (category: keyof PromptConfiguration['node_types_enabled'], nodeType: string, enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      node_types_enabled: {
        ...prev.node_types_enabled,
        [category]: enabled
          ? [...prev.node_types_enabled[category], nodeType]
          : prev.node_types_enabled[category].filter(type => type !== nodeType)
      }
    }));
  };

  const generatePrompt = (config: PromptConfiguration, documents: SourceDocument[]): string => {
    const enabledNodeTypes = [
      ...(config.node_types_enabled.structural || []),
      ...(config.node_types_enabled.question || []),
      ...(config.node_types_enabled.survey || []),
      ...(config.node_types_enabled.game || [])
    ];

    return `# NLJ Scenario Generation Request

## Context Documents
${documents.map(doc => `- **${doc.original_filename}** (${doc.file_type.toUpperCase()}, ${Math.round(doc.file_size / 1024)}KB)`).join('\n')}

## Generation Parameters
- **Target Audience**: ${config.audience_persona || 'General learners'}
- **Learning Objective**: ${config.learning_objective || 'To be determined based on source content'}
- **Content Style**: ${config.content_style}
- **Complexity Level**: ${config.complexity_level}/5
- **Estimated Duration**: ${config.estimated_duration} minutes
- **Include Variables**: ${config.include_variables ? 'Yes' : 'No'}
- **Include Branching**: ${config.include_branching ? 'Yes' : 'No'}
- **Target Bloom's Levels**: ${config.blooms_levels.length > 0 ? config.blooms_levels.join(', ') : 'All levels (no restriction)'}

## Enabled Node Types
${enabledNodeTypes.map(type => `- ${type}`).join('\n')}

${config.custom_instructions ? `## Custom Instructions\n${config.custom_instructions}` : ''}

## Schema Documentation
${generateSchemaDocumentation()}

## Instructions
Please analyze the provided documents and create an engaging NLJ scenario that:
1. Leverages key concepts and information from the source materials
2. Aligns with the specified learning objective and audience
3. Uses the requested content style and complexity level
4. Incorporates the enabled node types appropriately
5. ${config.include_variables ? 'Includes meaningful variables for tracking progress' : 'Uses simple linear progression'}
6. ${config.include_branching ? 'Includes conditional branching based on user responses' : 'Follows a primarily linear path'}
7. ${config.blooms_levels.length > 0 ? `Focuses on Bloom's Taxonomy levels: ${config.blooms_levels.join(', ')}. Design questions and interactions that specifically target these cognitive levels.` : 'Uses a balanced mix of cognitive complexity levels as appropriate for the content.'}

Return the complete NLJ scenario as valid JSON following the schema documentation above.`;
  };

  const handlePresetSelect = (preset: string) => {
    const presets = {
      'sales_training': {
        ...defaultConfig,
        audience_persona: 'Sales professionals and account managers',
        content_style: 'scenario_based' as const,
        complexity_level: 4,
        estimated_duration: 10,
        include_branching: true,
        blooms_levels: ['Apply', 'Analyze', 'Evaluate']
      },
      'compliance_training': {
        ...defaultConfig,
        audience_persona: 'All employees requiring compliance certification',
        content_style: 'formal' as const,
        complexity_level: 2,
        estimated_duration: 8,
        include_branching: false,
        blooms_levels: ['Remember', 'Understand']
      },
      'interactive_quiz': {
        ...defaultConfig,
        audience_persona: 'Learners seeking engaging knowledge assessment',
        content_style: 'gamified' as const,
        complexity_level: 3,
        estimated_duration: 7,
        include_variables: true,
        blooms_levels: ['Apply', 'Analyze']
      }
    };
    
    if (preset in presets) {
      const selectedPreset = presets[preset as keyof typeof presets];
      // Update node types based on the preset's Bloom's levels
      const nodeTypes = getNodeTypesForBloomsLevels(selectedPreset.blooms_levels);
      setConfig({
        ...selectedPreset,
        node_types_enabled: nodeTypes
      });
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Quick Presets */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <PresetIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Quick Presets
          </Typography>
        </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={() => handlePresetSelect('sales_training')}
              sx={{ flex: { xs: '1 1 100%', sm: '1 1 auto' } }}
            >
              Sales Training
            </Button>
            <Button
              variant="outlined"
              onClick={() => handlePresetSelect('compliance_training')}
              sx={{ flex: { xs: '1 1 100%', sm: '1 1 auto' } }}
            >
              Compliance Training
            </Button>
            <Button
              variant="outlined"
              onClick={() => handlePresetSelect('interactive_quiz')}
              sx={{ flex: { xs: '1 1 100%', sm: '1 1 auto' } }}
            >
              Interactive Quiz
            </Button>
          </Box>
        </Box>

        {/* Learning Design */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <StyleIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Learning Design
            </Typography>
          </Box>
          
          {/* Content Style - Full Row */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Content Style
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
              {[
                {
                  value: 'conversational',
                  title: 'Conversational',
                  description: 'Natural, friendly tone with engaging dialogue'
                },
                {
                  value: 'formal',
                  title: 'Formal',
                  description: 'Professional, structured presentation style'
                },
                {
                  value: 'gamified',
                  title: 'Gamified',
                  description: 'Game-like elements with rewards and challenges'
                },
                {
                  value: 'scenario_based',
                  title: 'Scenario-Based',
                  description: 'Real-world situations and case studies'
                }
              ].map((style) => {
                const isSelected = config.content_style === style.value;
                return (
                  <Card
                    key={style.value}
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      border: isSelected ? '2px solid' : '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      backgroundColor: isSelected ? 'primary.50' : 'background.paper'
                    }}
                    onClick={() => updateConfig({ content_style: style.value as PromptConfiguration['content_style'] })}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        {style.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        {style.description}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Box>

          {/* Complexity & Duration Sliders Row */}
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Complexity Level */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ComplexityIcon color="action" sx={{ mr: 1 }} />
                <Typography gutterBottom>Complexity Level: {config.complexity_level || 3}/5</Typography>
              </Box>
              <Slider
                value={config.complexity_level || 3}
                onChange={(_, value) => updateConfig({ complexity_level: value as number })}
                step={1}
                marks
                min={1}
                max={5}
                valueLabelDisplay="auto"
              />
            </Box>
            
            {/* Estimated Duration */}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LengthIcon color="action" sx={{ mr: 1 }} />
                <Typography gutterBottom>Estimated Duration: {config.estimated_duration || 5} minutes</Typography>
              </Box>
              <Slider
                value={config.estimated_duration || 5}
                onChange={(_, value) => updateConfig({ estimated_duration: value as number })}
                step={1}
                marks={[
                  { value: 1, label: '1m' },
                  { value: 5, label: '5m' },
                  { value: 10, label: '10m' },
                  { value: 15, label: '15m' }
                ]}
                min={1}
                max={15}
                valueLabelDisplay="auto"
              />
            </Box>
          </Box>
        </Box>

        {/* Cognitive Complexity (Bloom's Taxonomy) */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <BloomsIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Cognitive Level
            </Typography>
            <Tooltip title="Educational framework for categorizing learning goals from basic recall to creative synthesis">
              <HelpIcon color="action" sx={{ ml: 1, fontSize: 18, cursor: 'help' }} />
            </Tooltip>
          </Box>
          
          {/* 2-Column Layout: Pyramid + Interactive Types */}
          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', lg: 'row' } }}>
            {/* Left Column: Bloom's Taxonomy Pyramid */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" gutterBottom sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
                Bloom's Taxonomy Levels
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                {/* Row 1: Create (top of pyramid) */}
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {[{ 
                    level: 'Create', 
                    description: 'Build something new',
                    examples: 'Designs, plans, original solutions',
                    complexity: 6
                  }].map((item) => {
                    const isSelected = config.blooms_levels.includes(item.level);
                    return (
                        <Box
                          key={item.level}
                          onClick={() => handleBloomsLevelToggle(item.level)}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: 140,
                            height: 65,
                            p: 1.5,
                            border: '2px solid',
                            borderColor: isSelected ? getBloomsLevelColor(item.level) : 'divider',
                            borderRadius: 2,
                            backgroundColor: isSelected ? `${getBloomsLevelColor(item.level)}15` : 'background.paper',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: isSelected ? `${getBloomsLevelColor(item.level)}25` : 'action.hover'
                            }
                          }}
                        >
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              fontWeight: 600,
                              color: isSelected ? getBloomsLevelColor(item.level) : 'text.primary',
                              textAlign: 'center',
                              mb: 0.5
                            }}
                          >
                            {item.level}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              fontSize: '0.7rem'
                            }}
                          >
                            {item.description}
                          </Typography>
                        </Box>
                    );
                  })}
                </Box>

                {/* Row 2: Analyze, Evaluate */}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                  {[
                    { 
                      level: 'Analyze', 
                      description: 'Break down relationships',
                      examples: 'Categorization, root cause analysis, connections',
                      complexity: 4
                    },
                    { 
                      level: 'Evaluate', 
                      description: 'Judge and assess',
                      examples: 'Critiques, recommendations, justifications',
                      complexity: 5
                    }
                  ].map((item) => {
                    const isSelected = config.blooms_levels.includes(item.level);
                    return (
                        <Box
                          key={item.level}
                          onClick={() => handleBloomsLevelToggle(item.level)}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: 140,
                            height: 65,
                            p: 1.5,
                            border: '2px solid',
                            borderColor: isSelected ? getBloomsLevelColor(item.level) : 'divider',
                            borderRadius: 2,
                            backgroundColor: isSelected ? `${getBloomsLevelColor(item.level)}15` : 'background.paper',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: isSelected ? `${getBloomsLevelColor(item.level)}25` : 'action.hover'
                            }
                          }}
                        >
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              fontWeight: 600,
                              color: isSelected ? getBloomsLevelColor(item.level) : 'text.primary',
                              textAlign: 'center',
                              mb: 0.5
                            }}
                          >
                            {item.level}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              fontSize: '0.7rem'
                            }}
                          >
                            {item.description}
                          </Typography>
                        </Box>
                    );
                  })}
                </Box>

                {/* Row 3: Remember, Understand, Apply (bottom of pyramid) */}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                  {[
                    { 
                      level: 'Remember', 
                      description: 'Recall facts and basics',
                      examples: 'Definitions, lists, facts',
                      complexity: 1 
                    },
                    { 
                      level: 'Understand', 
                      description: 'Explain and interpret',
                      examples: 'Summaries, explanations, comparisons',
                      complexity: 2
                    },
                    { 
                      level: 'Apply', 
                      description: 'Use in new situations',
                      examples: 'Problem solving, demonstrations, calculations',
                      complexity: 3
                    }
                  ].map((item) => {
                    const isSelected = config.blooms_levels.includes(item.level);
                    return (
                        <Box
                          key={item.level}
                          onClick={() => handleBloomsLevelToggle(item.level)}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: 140,
                            height: 65,
                            p: 1.5,
                            border: '2px solid',
                            borderColor: isSelected ? getBloomsLevelColor(item.level) : 'divider',
                            borderRadius: 2,
                            backgroundColor: isSelected ? `${getBloomsLevelColor(item.level)}15` : 'background.paper',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: isSelected ? `${getBloomsLevelColor(item.level)}25` : 'action.hover'
                            }
                          }}
                        >
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              fontWeight: 600,
                              color: isSelected ? getBloomsLevelColor(item.level) : 'text.primary',
                              textAlign: 'center',
                              mb: 0.5
                            }}
                          >
                            {item.level}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              fontSize: '0.7rem'
                            }}
                          >
                            {item.description}
                          </Typography>
                        </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>

            {/* Right Column: Interactive Types Based on Selected Levels */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" gutterBottom sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
                Enabled Question Types & Interactions
              </Typography>
              
              {config.blooms_levels.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(config.node_types_enabled).map(([category, nodeTypes]) => {
                    if (nodeTypes.length === 0) return null;
                    
                    const categoryLabels: Record<string, string> = {
                      structural: 'Content Panels',
                      question: 'Question Types', 
                      survey: 'Survey & Feedback',
                      game: 'Interactive Games'
                    };
                    
                    return (
                      <Box key={category}>
                        <Typography variant="caption" gutterBottom sx={{ fontWeight: 500, color: 'text.secondary', display: 'block' }}>
                          {categoryLabels[category] || category}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                          {nodeTypes.map(nodeType => {
                            const enabledByBloomsLevel = getBloomsLevelForNodeType(nodeType);
                            return (
                              <Chip 
                                key={nodeType}
                                label={nodeType === 'question' ? 'multiple choice' : nodeType.replace('_', ' ')}
                                size="small"
                                sx={{ 
                                  backgroundColor: enabledByBloomsLevel ? getBloomsLevelColor(enabledByBloomsLevel) : 'default',
                                  color: enabledByBloomsLevel ? (theme.palette.mode === 'dark' ? 'common.black' : 'common.white') : 'inherit',
                                  fontWeight: enabledByBloomsLevel ? 500 : 'inherit',
                                  '& .MuiChip-label': {
                                    color: enabledByBloomsLevel ? (theme.palette.mode === 'dark' ? 'common.black' : 'common.white') : 'inherit'
                                  }
                                }}
                              />
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Select Bloom's Taxonomy levels above to see which question types and interactions will be enabled for your activity.
                  </Typography>
                </Alert>
              )}
            </Box>
          </Box>
        </Box>

        {/* Custom Instructions */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <CustomIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Custom Instructions
            </Typography>
          </Box>
          <TextField
            value={config.custom_instructions || ''}
            onChange={(e) => updateConfig({ custom_instructions: e.target.value })}
            placeholder="Optional: Provide additional context or requirements for content generation..."
            fullWidth
            multiline
            rows={3}
          />
        </Box>

        {/* Advanced Settings - Progressive Disclosure */}
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="advanced-settings-content"
            id="advanced-settings-header"
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AdvancedIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>Advanced Settings</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {/* NLJ Features */}
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  NLJ Features
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.include_variables ?? true}
                        onChange={(e) => updateConfig({ include_variables: e.target.checked })}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Include Variables</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Enable variable tracking for personalized learning paths
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.include_branching ?? false}
                        onChange={(e) => updateConfig({ include_branching: e.target.checked })}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Include Branching Logic</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Enable conditional paths based on learner responses
                        </Typography>
                      </Box>
                    }
                  />
                </FormGroup>
              </Box>

              {/* Question Types & Interactions */}
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Question Types & Interactions
                </Typography>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    {config.blooms_levels.length > 0 
                      ? 'Question types are automatically enabled based on your Bloom\'s level selection above. You can manually override any selection by checking/unchecking items below.'
                      : 'Select Bloom\'s Taxonomy levels above to automatically enable appropriate question types, or manually select specific types below.'
                    }
                  </Typography>
                </Alert>
                
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {Object.entries(getAllOptionalNodeTypesByCategory()).map(([category, nodeTypes]) => {
                    // Map category names to more descriptive labels
                    const categoryLabels: Record<string, string> = {
                      structural: 'Content Panels',
                      question: 'Question Types', 
                      survey: 'Survey & Feedback',
                      game: 'Interactive Games'
                    };
                    
                    return (
                      <Box key={category} sx={{ minWidth: 200, flex: '1 1 200px' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          {categoryLabels[category] || category}
                        </Typography>
                      <FormGroup>
                        {nodeTypes.map(nodeType => {
                          const isEnabled = config.node_types_enabled[category as keyof typeof config.node_types_enabled]?.includes(nodeType) || false;
                          const isBloomsControlled = config.blooms_levels.length > 0;
                          const enabledByBloomsLevel = getBloomsLevelForNodeType(nodeType);
                          const isAutoEnabled = isBloomsControlled && enabledByBloomsLevel && isEnabled;
                          
                          return (
                            <FormControlLabel
                              key={nodeType}
                              control={
                                <Checkbox
                                  checked={isEnabled}
                                  onChange={(e) => updateNodeTypes(category as keyof typeof config.node_types_enabled, nodeType, e.target.checked)}
                                />
                              }
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      color: isAutoEnabled ? 'inherit' : 'inherit',
                                      fontWeight: isAutoEnabled ? 500 : 'inherit'
                                    }}
                                  >
                                    {nodeType === 'question' ? 'multiple choice' : nodeType.replace('_', ' ')}
                                  </Typography>
                                  {isAutoEnabled && enabledByBloomsLevel && (
                                    <Chip 
                                      label={enabledByBloomsLevel} 
                                      size="small" 
                                      sx={{ 
                                        height: 16, 
                                        fontSize: '0.6rem',
                                        backgroundColor: getBloomsLevelColor(enabledByBloomsLevel),
                                        color: theme.palette.mode === 'dark' ? 'common.black' : 'common.white',
                                        '& .MuiChip-label': {
                                          px: 0.5,
                                          color: theme.palette.mode === 'dark' ? 'common.black' : 'common.white'
                                        }
                                      }} 
                                    />
                                  )}
                                  {isEnabled && !isAutoEnabled && isBloomsControlled && (
                                    <Chip 
                                      label="Manual" 
                                      size="small" 
                                      color="default"
                                      variant="outlined"
                                      sx={{ 
                                        height: 16, 
                                        fontSize: '0.6rem',
                                        '& .MuiChip-label': {
                                          px: 0.5
                                        }
                                      }} 
                                    />
                                  )}
                                </Box>
                              }
                            />
                          );
                        })}
                      </FormGroup>
                    </Box>
                    );
                  })}
                </Box>
              </Box>

            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Preview Button */}
        <Box display="flex" justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={() => setPreviewOpen(true)}
          >
            Preview Generated Prompt
          </Button>
        </Box>
      </Box>

      {/* Prompt Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Generated Prompt Preview
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This is the prompt that will be sent to Claude along with your selected documents.
          </Alert>
          <TextField
            value={generatedPrompt}
            multiline
            fullWidth
            rows={20}
            variant="outlined"
            slotProps={{ input: { readOnly: true } }}
            sx={{ fontFamily: 'monospace' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};