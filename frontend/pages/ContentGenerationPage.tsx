/**
 * Content Generation Page
 * Provides access to the LLM Prompt Generator for creating content
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert
} from '@mui/material';
import {
  AutoAwesome as GenerateIcon,
  Description as PromptIcon,
  Science as StudioIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Source as SourceIcon,
  Settings as ConfigIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { LLMPromptGenerator } from '../shared/LLMPromptGenerator';
import { SourceLibrarySelection } from '../components/content-studio/SourceLibrarySelection';
import { PromptConfiguration } from '../components/content-studio/PromptConfiguration';
import { GenerationProgress } from '../components/content-studio/GenerationProgress';
import { GenerationResults } from '../components/content-studio/GenerationResults';
import { type SourceDocument } from '../api/sources';
import { generateContent, pollGenerationStatus, type PromptConfiguration as ApiPromptConfiguration } from '../api/generation';
import type { NLJScenario } from '../types/nlj';

interface ContentGenerationState {
  selectedDocuments: SourceDocument[];
  promptConfig: ApiPromptConfiguration | null;
  generationStatus: 'idle' | 'generating' | 'completed' | 'error';
  generatedContent: NLJScenario | null;
  error: string | null;
  activeStep: number;
  sessionId: string | null;
}

export const ContentGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [promptGeneratorOpen, setPromptGeneratorOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'prompt' | 'studio' | null>(null);
  
  // Content Studio state
  const [studioState, setStudioState] = useState<ContentGenerationState>({
    selectedDocuments: [],
    promptConfig: null,
    generationStatus: 'idle',
    generatedContent: null,
    error: null,
    activeStep: 0,
    sessionId: null
  });

  const handleOpenPromptGenerator = () => {
    setPromptGeneratorOpen(true);
  };

  const handleClosePromptGenerator = () => {
    setPromptGeneratorOpen(false);
  };

  // Content Studio handlers
  const handleDocumentSelection = (documents: SourceDocument[]) => {
    setStudioState(prev => ({ ...prev, selectedDocuments: documents }));
  };

  const handlePromptConfiguration = useCallback((config: any) => {
    console.log('🔧 Prompt configuration updated:', {
      audience: config.audience_persona ? 'set' : 'empty',
      objective: config.learning_objective ? 'set' : 'empty',
      style: config.content_style,
      nodeTypes: Object.values(config.node_types_enabled || {}).flat().length
    });
    setStudioState(prev => ({ ...prev, promptConfig: config }));
  }, []);

  const handleStartGeneration = async () => {
    console.log('🎨 Content generation requested', {
      documents: studioState.selectedDocuments.length,
      config: studioState.promptConfig ? 'configured' : 'missing'
    });
    
    if (!studioState.promptConfig || studioState.selectedDocuments.length === 0) {
      console.error('❌ Generation prerequisites not met');
      setStudioState(prev => ({
        ...prev,
        generationStatus: 'error',
        error: 'Please select documents and configure generation settings'
      }));
      return;
    }

    console.log('🚀 Starting generation process...');
    setStudioState(prev => ({ ...prev, generationStatus: 'generating', error: null }));

    try {
      // Start generation
      console.log('📝 Generating content with documents:', studioState.selectedDocuments.map(d => d.original_filename));
      const response = await generateContent({
        source_document_ids: studioState.selectedDocuments.map(doc => doc.id),
        prompt_config: studioState.promptConfig,
        activity_name: `Generated Activity - ${new Date().toLocaleDateString()}`,
        activity_description: `Generated from ${studioState.selectedDocuments.length} source document(s)`
      });

      console.log('✅ Generation initiated, session ID:', response.session_id);
      setStudioState(prev => ({
        ...prev,
        sessionId: response.session_id
      }));

      // Poll for completion
      console.log('🔄 Starting status polling...');
      const finalStatus = await pollGenerationStatus(
        response.session_id,
        (progress) => {
          console.log('📊 Progress update:', progress);
          // Update progress in real-time
          setStudioState(prev => ({
            ...prev,
            generationStatus: progress.status === 'processing' ? 'generating' : 
                             progress.status === 'completed' ? 'completed' :
                             progress.status === 'failed' ? 'error' : prev.generationStatus
          }));
        }
      );

      console.log('🎉 Generation polling completed, final status:', finalStatus.status);
      if (finalStatus.generated_content) {
        console.log('✅ Content generated successfully, creating scenario...');
        const generatedScenario: NLJScenario = {
          ...finalStatus.generated_content,
          id: finalStatus.generated_content.id || `generated-${Date.now()}`
        };

        console.log('📋 Generated scenario:', { 
          id: generatedScenario.id, 
          name: generatedScenario.name,
          nodeCount: generatedScenario.nodes?.length || 0
        });
        
        setStudioState(prev => ({
          ...prev,
          generationStatus: 'completed',
          generatedContent: generatedScenario,
          activeStep: 3
        }));
      } else {
        console.error('❌ No content in final status response');
        throw new Error('No content was generated');
      }

    } catch (error) {
      console.error('💥 Generation failed:', error);
      setStudioState(prev => ({
        ...prev,
        generationStatus: 'error',
        error: error instanceof Error ? error.message : 'Generation failed'
      }));
    }
  };

  const handleOpenInFlowEditor = (scenario: NLJScenario) => {
    // Store the scenario for the Flow Editor to load
    localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
    
    // Navigate to Flow Editor with the scenario ID
    navigate(`/app/flow?scenario=${scenario.id}`, {
      state: { fromContentStudio: true, generatedScenario: scenario }
    });
  };

  const canProceedToGeneration = () => {
    return studioState.selectedDocuments.length > 0 && studioState.promptConfig !== null;
  };

  const renderPromptGeneration = () => (
    <Box>
      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2">
          The LLM Prompt Generator creates detailed prompts for external AI tools like ChatGPT, Claude, or other language models to generate NLJ scenario content.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PromptIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" component="h2">
                LLM Prompt Generator
              </Typography>
            </Box>
            
            <Typography variant="body1" paragraph>
              Create comprehensive, customized prompts for generating NLJ scenarios with external AI tools.
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph sx={{ fontWeight: 600 }}>
              How to use:
            </Typography>
            <Typography variant="body2" color="text.secondary" component="ol" sx={{ pl: 2, mb: 2 }}>
              <li>Generate a prompt using the tool below</li>
              <li>Go to your LLM of choice (Claude, ChatGPT, or NotebookLM)</li>
              <li>Paste the prompt and upload any source documents</li>
              <li>Copy the JSON response from the LLM</li>
              <li>Import it as a new activity using the Import feature</li>
            </Typography>
            
            <Box sx={{ mt: 'auto', pt: 2 }}>
              <Button
                variant="contained"
                startIcon={<GenerateIcon />}
                onClick={handleOpenPromptGenerator}
                fullWidth
              >
                Open Prompt Generator
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <StudioIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" component="h2">
                Integrated Content Studio
              </Typography>
              <Chip label="Now Available" size="small" color="success" sx={{ ml: 1 }} />
            </Box>
            
            <Typography variant="body1" paragraph>
              Direct integration with AI services for in-app content generation using your source documents.
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Chip label="Claude API" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
              <Chip label="Document Upload" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
              <Chip label="Context Awareness" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
              <Chip label="Flow Editor Integration" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
            </Box>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Features:
            </Typography>
            <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
              <li>Upload and manage source documents</li>
              <li>Generate content directly in the platform</li>
              <li>Automatic schema validation</li>
              <li>Seamless Flow Editor integration</li>
              <li>Progress tracking and error handling</li>
            </Typography>
            
            <Box sx={{ mt: 'auto', pt: 2 }}>
              <Button
                variant="contained"
                startIcon={<StudioIcon />}
                onClick={() => setActiveMode('studio')}
                fullWidth
              >
                Try Content Studio
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );

  const renderContentStudio = () => {
    if (studioState.activeStep === 3 && studioState.generatedContent) {
      return (
        <GenerationResults
          generatedContent={studioState.generatedContent}
          sessionId={studioState.sessionId}
          onOpenInFlowEditor={handleOpenInFlowEditor}
        />
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Source Selection */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SourceIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                1. Select Source Documents
              </Typography>
            </Box>
            <SourceLibrarySelection
              selectedDocuments={studioState.selectedDocuments}
              onSelectionChange={handleDocumentSelection}
            />
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ConfigIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                2. Configure Generation
              </Typography>
            </Box>
            <PromptConfiguration
              selectedDocuments={studioState.selectedDocuments}
              onConfigurationChange={handlePromptConfiguration}
            />
          </CardContent>
        </Card>

        {/* Generation */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PlayIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                3. Generate Content
              </Typography>
            </Box>
            {!canProceedToGeneration() && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Complete steps 1 and 2 to enable content generation
              </Alert>
            )}
            <GenerationProgress
              status={studioState.generationStatus}
              error={studioState.error}
              onStartGeneration={handleStartGeneration}
              selectedDocuments={studioState.selectedDocuments}
              promptConfig={studioState.promptConfig}
            />
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Content Generation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Choose your preferred method for creating learning content with AI assistance.
        </Typography>
      </Box>

      {/* Unified Interface - Show both options */}
      {activeMode === null && (
        <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Prompt Generator Option */}
          <Card 
            sx={{ 
              flex: 1,
              display: 'flex', 
              flexDirection: 'column',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4
              }
            }}
            onClick={() => setActiveMode('prompt')}
          >
            <CardContent sx={{ flexGrow: 1, p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PromptIcon color="primary" sx={{ mr: 2, fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  Prompt Generator
                </Typography>
              </Box>
              
              <Typography variant="body1" paragraph>
                Create comprehensive, customized prompts for external AI tools like ChatGPT, Claude, or NotebookLM.
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                Best for:
              </Typography>
              <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2, mb: 3 }}>
                <li>Using your preferred AI tool</li>
                <li>Maximum control over generation</li>
                <li>Custom prompting strategies</li>
                <li>Working with external documents</li>
              </Typography>

              <Box sx={{ mt: 'auto' }}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<GenerateIcon />}
                  sx={{ py: 1.5 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenPromptGenerator();
                  }}
                >
                  Create Prompt
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Content Studio Option */}
          <Card 
            sx={{ 
              flex: 1,
              display: 'flex', 
              flexDirection: 'column',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4
              }
            }}
            onClick={() => setActiveMode('studio')}
          >
            <CardContent sx={{ flexGrow: 1, p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <StudioIcon color="primary" sx={{ mr: 2, fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  Content Studio
                </Typography>
                <Chip label="Integrated" size="small" color="success" sx={{ ml: 2 }} />
              </Box>
              
              <Typography variant="body1" paragraph>
                Direct integration with Claude AI for in-app content generation using your uploaded documents.
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                Best for:
              </Typography>
              <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2, mb: 3 }}>
                <li>One-click content generation</li>
                <li>Document-based context</li>
                <li>Seamless Flow Editor integration</li>
                <li>Progress tracking & validation</li>
              </Typography>

              <Box sx={{ mt: 'auto' }}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<StudioIcon />}
                  sx={{ py: 1.5 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMode('studio');
                  }}
                >
                  Launch Studio
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Prompt Generator Mode */}
      {activeMode === 'prompt' && (
        <Box>
          {/* Back button */}
          <Button 
            startIcon={<PromptIcon />} 
            onClick={() => setActiveMode(null)}
            sx={{ mb: 3 }}
          >
            Back to Options
          </Button>
          {renderPromptGeneration()}
        </Box>
      )}

      {/* Content Studio Mode */}
      {activeMode === 'studio' && (
        <Box>
          {/* Back button */}
          <Button 
            startIcon={<StudioIcon />} 
            onClick={() => setActiveMode(null)}
            sx={{ mb: 3 }}
          >
            Back to Options
          </Button>
          {renderContentStudio()}
        </Box>
      )}

      {/* LLM Prompt Generator Modal */}
      <LLMPromptGenerator
        open={promptGeneratorOpen}
        onClose={handleClosePromptGenerator}
      />
    </Box>
  );
};

export default ContentGenerationPage;