import React, { useState, useCallback } from 'react';
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
  Preview as PreviewIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { 
  getOptionalNodeTypesByCategory
} from '../utils/schemaDocGenerator';
import { generateUnifiedPrompt, type LLMPromptConfig } from '../utils/promptGenerator';

interface LLMPromptGeneratorProps {
  open: boolean;
  onClose: () => void;
}

// Use the unified configuration type
type PromptConfiguration = LLMPromptConfig;

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

const TabPanel = React.memo(({ children, value, index }: { children: React.ReactNode; value: number; index: number }) => (
  <div hidden={value !== index} style={{ padding: '20px 0' }}>
    {value === index && children}
  </div>
));
TabPanel.displayName = 'TabPanel';

export const LLMPromptGenerator: React.FC<LLMPromptGeneratorProps> = React.memo(({ open, onClose }) => {
  const [config, setConfig] = useState<PromptConfiguration>(DEFAULT_CONFIG);
  const [currentTab, setCurrentTab] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleConfigChange = useCallback((key: keyof PromptConfiguration, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAudiencePersonaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('audiencePersona', e.target.value);
  }, [handleConfigChange]);

  const handleLearningObjectiveChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('learningObjective', e.target.value);
  }, [handleConfigChange]);

  const handleContentStyleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('contentStyle', e.target.value);
  }, [handleConfigChange]);

  const handleComplexityLevelChange = useCallback((_: Event, value: number | number[]) => {
    handleConfigChange('complexityLevel', value);
  }, [handleConfigChange]);

  const handleDomainContextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('domainContext', e.target.value);
  }, [handleConfigChange]);

  const handleSourceContentTypeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('sourceContentType', e.target.value);
  }, [handleConfigChange]);

  const handleIncludeMediaPlaceholdersChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('includeMediaPlaceholders', e.target.checked);
  }, [handleConfigChange]);

  const handleIncludeVariablesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('includeVariables', e.target.checked);
  }, [handleConfigChange]);

  const handleIncludeXAPIChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleConfigChange('includeXAPI', e.target.checked);
  }, [handleConfigChange]);

  const handleBloomsLevelChange = useCallback((level: string, checked: boolean) => {
    setConfig(prev => {
      const newLevels = checked 
        ? [...prev.bloomsLevels, level]
        : prev.bloomsLevels.filter(l => l !== level);
      return { ...prev, bloomsLevels: newLevels };
    });
  }, []);

  const handleNodeTypeChange = useCallback((nodeType: string, included: boolean) => {
    setConfig(prev => {
      if (included) {
        const newIncluded = [...prev.includedNodeTypes, nodeType];
        const newExcluded = prev.excludedNodeTypes.filter(t => t !== nodeType);
        return { ...prev, includedNodeTypes: newIncluded, excludedNodeTypes: newExcluded };
      } else {
        const newIncluded = prev.includedNodeTypes.filter(t => t !== nodeType);
        const newExcluded = [...prev.excludedNodeTypes, nodeType];
        return { ...prev, includedNodeTypes: newIncluded, excludedNodeTypes: newExcluded };
      }
    });
  }, []);

  const generatePrompt = useCallback((currentConfig?: PromptConfiguration): string => {
    const configToUse = currentConfig || config;
    return generateUnifiedPrompt(configToUse);
  }, [config]);


  const handleGeneratePrompt = useCallback(() => {
    const prompt = generatePrompt(config);
    setGeneratedPrompt(prompt);
    setShowPreview(true);
  }, [generatePrompt, config]);

  const handleDownloadPrompt = useCallback(() => {
    const prompt = generatedPrompt || generatePrompt(config);
    const blob = new Blob([prompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nlj-generation-prompt-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedPrompt, generatePrompt, config]);

  const handleCopyPrompt = useCallback(async () => {
    const prompt = generatedPrompt || generatePrompt(config);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = prompt;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed: ', err);
      }
      document.body.removeChild(textArea);
    }
  }, [generatedPrompt, generatePrompt, config]);


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
            <Tooltip title={copySuccess ? "Copied!" : "Copy Prompt"}>
              <IconButton onClick={handleCopyPrompt} color="primary">
                <CopyIcon />
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
              onChange={handleAudiencePersonaChange}
              fullWidth
              placeholder="e.g., New employees in automotive sales"
              helperText="Describe your target learners - their role, experience level, and context"
            />
            
            <TextField
              label="Learning Objective"
              value={config.learningObjective}
              onChange={handleLearningObjectiveChange}
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
                onChange={handleContentStyleChange}
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
                onChange={handleComplexityLevelChange}
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
                onChange={handleDomainContextChange}
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
              Start and End nodes are always included automatically.
            </Alert>
            
            {(['structural', 'question', 'survey', 'game'] as const).map(category => {
              const categoryNodes = getOptionalNodeTypesByCategory(category);
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
                  onChange={handleIncludeMediaPlaceholdersChange}
                />
              }
              label="Include Media Placeholder Guidelines"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeVariables}
                  onChange={handleIncludeVariablesChange}
                />
              }
              label="Include Variable Usage Guidelines"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeXAPI}
                  onChange={handleIncludeXAPIChange}
                />
              }
              label="Include xAPI Integration Guidelines"
            />

            <FormControl fullWidth>
              <FormLabel>Source Content Type</FormLabel>
              <RadioGroup
                value={config.sourceContentType}
                onChange={handleSourceContentTypeChange}
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
          onClick={handleCopyPrompt} 
          color="primary" 
          variant="outlined"
          startIcon={<CopyIcon />}
        >
          {copySuccess ? "Copied!" : "Copy Prompt"}
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
});