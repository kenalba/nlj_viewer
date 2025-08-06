/**
 * Prompt Configuration Component
 * Enhanced LLM prompt configuration with document context awareness
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  FormGroup,
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
  Tooltip
} from '@mui/material';
import {
  Preview as PreviewIcon,
  FlashOn as PresetIcon,
  Person as AudienceIcon,
  Flag as ObjectiveIcon,
  Palette as StyleIcon,
  Speed as ComplexityIcon,
  Timeline as LengthIcon,
  Extension as AdvancedIcon,
  Quiz as QuestionIcon,
  Edit as CustomIcon,
  School as BloomsIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import type { SourceDocument } from '../../api/sources';
import { 
  generateSchemaDocumentation, 
  getAllOptionalNodeTypesByCategory 
} from '../../utils/schemaDocGenerator';

interface PromptConfiguration {
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

interface PromptConfigurationProps {
  selectedDocuments: SourceDocument[];
  onConfigurationChange: (config: PromptConfiguration) => void;
}

const defaultConfig: PromptConfiguration = {
  audience_persona: '',
  learning_objective: '',  
  content_style: 'conversational',
  complexity_level: 3,
  scenario_length: 5,
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
    
    // Remember/Understand: Basic question types
    if (levels.some(l => ['Remember', 'Understand'].includes(l))) {
      result.question.push('question', 'true_false'); // 'question' represents multiple choice
    }
    
    // Apply: Interactive and practical question types
    if (levels.some(l => ['Apply'].includes(l))) {
      result.question.push('ordering', 'checkbox');
    }
    
    // Analyze: Complex interactions and matching
    if (levels.some(l => ['Analyze'].includes(l))) {
      result.question.push('matching');
      result.game.push('connections');
    }
    
    // Evaluate: Assessment and judgment tasks
    if (levels.some(l => ['Evaluate'].includes(l))) {
      result.question.push('short_answer');
    }
    
    // Create: Complex games and open-ended tasks
    if (levels.some(l => ['Create'].includes(l))) {
      result.question.push('short_answer');
      result.game.push('wordle'); // Word creation/building
    }
    
    return result;
  };

  // Function to determine which Bloom's level enabled a specific node type
  const getBloomsLevelForNodeType = (nodeType: string): string | null => {
    if (config.blooms_levels.length === 0) return null;
    
    // Remember/Understand
    if (['question', 'true_false'].includes(nodeType) && 
        config.blooms_levels.some(l => ['Remember', 'Understand'].includes(l))) {
      return config.blooms_levels.find(l => ['Remember', 'Understand'].includes(l)) || null;
    }
    
    // Apply
    if (['short_answer', 'ordering', 'likert_scale', 'rating'].includes(nodeType) && 
        config.blooms_levels.includes('Apply')) {
      return 'Apply';
    }
    
    // Analyze
    if (['matching', 'matrix', 'slider', 'connections'].includes(nodeType) && 
        config.blooms_levels.includes('Analyze')) {
      return 'Analyze';
    }
    
    // Evaluate
    if (nodeType === 'text_area' && config.blooms_levels.includes('Evaluate')) {
      return 'Evaluate';
    }
    
    // Create
    if (['wordle'].includes(nodeType) && config.blooms_levels.includes('Create')) {
      return 'Create';
    }
    if (nodeType === 'text_area' && config.blooms_levels.includes('Create')) {
      return 'Create';
    }
    
    return null;
  };

  // Get color for Bloom's level
  const getBloomsLevelColor = (level: string): string => {
    const colorMap: Record<string, string> = {
      'Remember': '#1976d2',
      'Understand': '#388e3c',
      'Apply': '#f57c00',
      'Analyze': '#c2185b',
      'Evaluate': '#7b1fa2',
      'Create': '#d32f2f'
    };
    return colorMap[level] || '#666';
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
- **Scenario Length**: ~${config.scenario_length} nodes
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
        include_branching: true,
        blooms_levels: ['Apply', 'Analyze', 'Evaluate']
      },
      'compliance_training': {
        ...defaultConfig,
        audience_persona: 'All employees requiring compliance certification',
        content_style: 'formal' as const,
        complexity_level: 2,
        include_branching: false,
        blooms_levels: ['Remember', 'Understand']
      },
      'interactive_quiz': {
        ...defaultConfig,
        audience_persona: 'Learners seeking engaging knowledge assessment',
        content_style: 'gamified' as const,
        complexity_level: 3,
        scenario_length: 8,
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
    <Box>
      {/* Document context summary */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">
            Using {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} as source material
          </Typography>
          <Box display="flex" gap={1}>
            {selectedDocuments.slice(0, 3).map(doc => (
              <Chip key={doc.id} label={doc.original_filename} size="small" />
            ))}
            {selectedDocuments.length > 3 && (
              <Chip label={`+${selectedDocuments.length - 3} more`} size="small" />
            )}
          </Box>
        </Box>
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Quick Presets */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PresetIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
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
          </CardContent>
        </Card>

        {/* Configuration Row */}
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* Basic Configuration */}
          <Card sx={{ flex: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AudienceIcon color="primary" sx={{ mr: 1.5 }} />
                <Typography variant="h6">
                  Basic Configuration
                </Typography>
              </Box>
              
              <Box mb={3}>
                <TextField
                  label="Target Audience"
                  value={config.audience_persona || ''}
                  onChange={(e) => updateConfig({ audience_persona: e.target.value })}
                  placeholder="e.g., Sales professionals, New employees, Technical staff"
                  fullWidth
                  helperText="Describe who will be taking this learning activity"
                  slotProps={{
                    input: {
                      startAdornment: <AudienceIcon color="action" sx={{ mr: 1 }} />
                    }
                  }}
                />
              </Box>

              <Box mb={3}>
                <TextField
                  label="Learning Objective"
                  value={config.learning_objective || ''}
                  onChange={(e) => updateConfig({ learning_objective: e.target.value })}
                  placeholder="e.g., Understand product features, Learn compliance procedures"
                  fullWidth
                  multiline
                  rows={2}
                  helperText="What should learners accomplish after completing this activity?"
                  slotProps={{
                    input: {
                      startAdornment: <ObjectiveIcon color="action" sx={{ mr: 1, alignSelf: 'flex-start', mt: 1 }} />
                    }
                  }}
                />
              </Box>

              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <StyleIcon color="action" sx={{ mr: 1 }} />
                  <FormLabel>Content Style</FormLabel>
                </Box>
                <RadioGroup
                  value={config.content_style || 'conversational'}
                  onChange={(e) => updateConfig({ content_style: e.target.value as PromptConfiguration['content_style'] })}
                  row
                >
                  <FormControlLabel value="conversational" control={<Radio />} label="Conversational" />
                  <FormControlLabel value="formal" control={<Radio />} label="Formal" />
                  <FormControlLabel value="gamified" control={<Radio />} label="Gamified" />
                  <FormControlLabel value="scenario_based" control={<Radio />} label="Scenario-Based" />
                </RadioGroup>
              </FormControl>

              <Box mb={3}>
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

              <Box mb={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LengthIcon color="action" sx={{ mr: 1 }} />
                  <Typography gutterBottom>Scenario Length: ~{config.scenario_length || 5} nodes</Typography>
                </Box>
                <Slider
                  value={config.scenario_length || 5}
                  onChange={(_, value) => updateConfig({ scenario_length: value as number })}
                  step={1}
                  marks
                  min={3}
                  max={15}
                  valueLabelDisplay="auto"
                />
              </Box>
            </CardContent>
          </Card>

          {/* Advanced Options */}
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AdvancedIcon color="primary" sx={{ mr: 1.5 }} />
                <Typography variant="h6">
                  Advanced Options
                </Typography>
              </Box>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.include_variables ?? true}
                      onChange={(e) => updateConfig({ include_variables: e.target.checked })}
                    />
                  }
                  label="Include Variables"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.include_branching ?? false}
                      onChange={(e) => updateConfig({ include_branching: e.target.checked })}
                    />
                  }
                  label="Include Branching Logic"
                />
              </FormGroup>
            </CardContent>
          </Card>
        </Box>

        {/* Bloom's Taxonomy Reference */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BloomsIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                Learning Objectives (Bloom's Taxonomy)
              </Typography>
              <Tooltip title="Educational framework for learning objectives">
                <HelpIcon color="action" sx={{ ml: 1, fontSize: 18 }} />
              </Tooltip>
            </Box>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Select cognitive levels to target. This automatically enables appropriate question types and interactions below.
              </Typography>
            </Alert>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
              {[
                { level: 'Remember', description: 'Recall facts, terms, basic concepts', color: '#1976d2' },
                { level: 'Understand', description: 'Explain ideas, summarize, classify', color: '#388e3c' },
                { level: 'Apply', description: 'Use knowledge in new situations', color: '#f57c00' },
                { level: 'Analyze', description: 'Break down, examine relationships', color: '#c2185b' },
                { level: 'Evaluate', description: 'Judge, critique, assess value', color: '#7b1fa2' },
                { level: 'Create', description: 'Build, design, compose new work', color: '#d32f2f' }
              ].map((item) => {
                const isSelected = config.blooms_levels.includes(item.level);
                return (
                  <Tooltip key={item.level} title={item.description}>
                    <Chip
                      label={item.level}
                      clickable
                      onClick={() => handleBloomsLevelToggle(item.level)}
                      variant={isSelected ? 'filled' : 'outlined'}
                      sx={{ 
                        color: isSelected ? 'white' : item.color,
                        backgroundColor: isSelected ? item.color : 'transparent',
                        borderColor: item.color,
                        '&:hover': { 
                          backgroundColor: isSelected ? item.color : 'rgba(0,0,0,0.04)',
                          opacity: 0.8
                        }
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Node Types - Auto-expanded */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <QuestionIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                Question Types & Interactions
              </Typography>
            </Box>
            
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
                                    color: 'white',
                                    '& .MuiChip-label': {
                                      px: 0.5
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
          </CardContent>
        </Card>

        {/* Custom Instructions */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CustomIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                Custom Instructions
              </Typography>
            </Box>
            <TextField
              value={config.custom_instructions || ''}
              onChange={(e) => updateConfig({ custom_instructions: e.target.value })}
              placeholder="Add any specific requirements or instructions for the AI generation..."
              fullWidth
              multiline
              rows={3}
              helperText="Optional: Provide additional context or requirements for content generation"
            />
          </CardContent>
        </Card>

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
    </Box>
  );
};