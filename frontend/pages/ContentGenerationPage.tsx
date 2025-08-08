/**
 * Unified Content Studio
 * Single interface for generating Activities and Media content
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Divider,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Stack,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  AutoAwesome as GenerateIcon,
  Source as SourceIcon,
  Settings as ConfigIcon,
  PlayArrow as PlayIcon,
  AudioFile as PodcastIcon,
  Assignment as ActivityIcon,
  Mic as MediaIcon,
  RecordVoiceOver as InterviewIcon,
  School as EducationalIcon,
  Forum as DiscussionIcon,
  Engineering as TechnicalIcon
} from '@mui/icons-material';
import { SourceLibrarySelection } from '../components/content-studio/SourceLibrarySelection';
import { PromptConfiguration } from '../components/content-studio/PromptConfiguration';
import { GenerationProgress } from '../components/content-studio/GenerationProgress';
import { GenerationResults } from '../components/content-studio/GenerationResults';
import { type SourceDocument, getSourceDocument } from '../api/sources';
import { generateContent, pollGenerationStatus, type PromptConfiguration as ApiPromptConfiguration } from '../api/generation';
import { generatePodcastScript, generatePodcast, getGenerationStatus, type PodcastScriptRequest, type MediaGenerationRequest } from '../api/media';
import { generateUnifiedPrompt, type ContentStudioConfig } from '../utils/promptGenerator';
import type { NLJScenario } from '../types/nlj';

interface ContentGenerationState {
  selectedDocuments: SourceDocument[];
  selectedKeywords: string[];
  selectedObjectives: string[];
  contentType: 'activity' | 'media' | null;
  mediaType: 'podcast' | 'video';
  podcastStyle: string;
  podcastLength: string;
  podcastDepth: string;
  customInstructions: string;
  promptConfig: ApiPromptConfiguration | null;
  generationStatus: 'idle' | 'generating' | 'transcript-generated' | 'audio-generating' | 'completed' | 'error';
  generatedContent: NLJScenario | null;
  generatedTranscript: string | null;
  editedTranscript: string;
  generatedMediaId: string | null;
  audioGenerationProgress: string | null;
  error: string | null;
  sessionId: string | null;
}

// Podcast template options with icons
const PODCAST_STYLES = [
  { 
    value: 'npr_interview', 
    label: 'NPR Interview', 
    description: 'Conversational interview format with host and expert',
    icon: InterviewIcon
  },
  { 
    value: 'educational_summary', 
    label: 'Educational Summary', 
    description: 'Structured educational overview with narrator',
    icon: EducationalIcon
  },
  { 
    value: 'conversational_deep_dive', 
    label: 'Deep Dive Discussion', 
    description: 'In-depth analysis with multiple perspectives',
    icon: DiscussionIcon
  },
  { 
    value: 'technical_breakdown', 
    label: 'Technical Breakdown', 
    description: 'Detailed technical explanation with examples',
    icon: TechnicalIcon
  }
];

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short (3-5 min)', description: '500-800 words' },
  { value: 'medium', label: 'Medium (5-8 min)', description: '800-1200 words' },
  { value: 'long', label: 'Long (8-12 min)', description: '1200-1800 words' }
];

const DEPTH_OPTIONS = [
  { value: 'surface', label: 'Surface Level', description: 'High-level overview with key points' },
  { value: 'balanced', label: 'Balanced', description: 'Moderate detail with examples' },
  { value: 'deep', label: 'Deep Analysis', description: 'Thorough analysis with nuanced discussion' }
];

export const ContentGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Unified Content Studio state
  const [state, setState] = useState<ContentGenerationState>({
    selectedDocuments: [],
    selectedKeywords: [],
    selectedObjectives: [],
    contentType: null,
    mediaType: 'podcast',
    podcastStyle: 'npr_interview',
    podcastLength: 'medium',
    podcastDepth: 'balanced',
    customInstructions: '',
    promptConfig: null,
    generationStatus: 'idle',
    generatedContent: null,
    generatedTranscript: null,
    editedTranscript: '',
    generatedMediaId: null,
    audioGenerationProgress: null,
    error: null,
    sessionId: null
  });

  // Handle URL parameters for pre-selecting documents
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sourceId = urlParams.get('source');
    
    if (sourceId && state.selectedDocuments.length === 0) {
      console.log('Pre-selecting document from URL:', sourceId);
      // Fetch the document by ID and add to selection
      getSourceDocument(sourceId)
        .then(document => {
          setState(prev => ({
            ...prev,
            selectedDocuments: [document]
          }));
          console.log('Document pre-selected:', document.extracted_title || document.original_filename);
        })
        .catch(error => {
          console.error('Failed to load document from URL parameter:', error);
        });
    }
  }, [location.search, state.selectedDocuments.length]);

  // Extract all keywords and objectives from selected documents
  const availableKeywords = useMemo(() => {
    const allKeywords = state.selectedDocuments.flatMap(doc => doc.keywords || []);
    return [...new Set(allKeywords)]; // Remove duplicates
  }, [state.selectedDocuments]);

  const availableObjectives = useMemo(() => {
    const allObjectives = state.selectedDocuments.flatMap(doc => doc.learning_objectives || []);
    return [...new Set(allObjectives)]; // Remove duplicates
  }, [state.selectedDocuments]);

  // Document selection handler
  const handleDocumentSelection = (documents: SourceDocument[]) => {
    setState(prev => ({ 
      ...prev, 
      selectedDocuments: documents
    }));
  };
  
  // Auto-select keywords and objectives when available keywords/objectives change
  useEffect(() => {
    if (availableKeywords.length > 0 && state.selectedKeywords.length === 0) {
      setState(prev => ({
        ...prev,
        selectedKeywords: availableKeywords.slice(0, 5)
      }));
    }
  }, [availableKeywords]);
  
  useEffect(() => {
    if (availableObjectives.length > 0 && state.selectedObjectives.length === 0) {
      setState(prev => ({
        ...prev,
        selectedObjectives: availableObjectives.slice(0, 3)
      }));
    }
  }, [availableObjectives]);

  const handlePromptConfiguration = useCallback((config: any) => {
    console.log('🔧 Prompt configuration updated:', {
      audience: config.audience_persona ? 'set' : 'empty',
      objective: config.learning_objective ? 'set' : 'empty',
      style: config.content_style,
      nodeTypes: Object.values(config.node_types_enabled || {}).flat().length
    });
    setState(prev => ({ ...prev, promptConfig: config }));
  }, []);

  const handleStartGeneration = async () => {
    console.log('🎨 Content generation requested', {
      documents: state.selectedDocuments.length,
      contentType: state.contentType,
      config: state.promptConfig ? 'configured' : 'missing'
    });
    
    if (state.selectedDocuments.length === 0) {
      console.error('❌ Generation prerequisites not met');
      setState(prev => ({
        ...prev,
        generationStatus: 'error',
        error: 'Please select at least one source document'
      }));
      return;
    }

    // For media generation, generate transcript first
    if (state.contentType === 'media' && state.mediaType === 'podcast') {
      console.log('🎙️ Starting podcast transcript generation...');
      setState(prev => ({ ...prev, generationStatus: 'generating', error: null }));

      try {
        const scriptRequest: PodcastScriptRequest = {
          source_document_id: state.selectedDocuments[0].id, // Use first document for now
          selected_keywords: state.selectedKeywords,
          selected_objectives: state.selectedObjectives,
          style: state.podcastStyle,
          length_preference: state.podcastLength,
          conversation_depth: state.podcastDepth
        };

        const scriptResponse = await generatePodcastScript(scriptRequest);
        
        setState(prev => ({
          ...prev,
          generationStatus: 'transcript-generated',
          generatedTranscript: scriptResponse.script,
          editedTranscript: scriptResponse.script
        }));

        console.log('✅ Podcast transcript generated successfully');
        return;
      } catch (error) {
        console.error('💥 Transcript generation failed:', error);
        setState(prev => ({
          ...prev,
          generationStatus: 'error',
          error: error instanceof Error ? error.message : 'Failed to generate transcript'
        }));
        return;
      }
    }

    // For activity generation, check if prompt config is required
    if (!state.promptConfig) {
      console.error('❌ Activity generation requires configuration');
      setState(prev => ({
        ...prev,
        generationStatus: 'error',
        error: 'Please configure generation settings for activities'
      }));
      return;
    }

    console.log('🚀 Starting activity generation process...');
    setState(prev => ({ ...prev, generationStatus: 'generating', error: null }));

    try {
      // Generate unified prompt from configuration
      console.log('📝 Generating unified prompt from configuration...');
      const unifiedPrompt = generateUnifiedPrompt(state.promptConfig as ContentStudioConfig);
      console.log(`✅ Generated unified prompt (${unifiedPrompt.length} chars)`);

      // Start generation
      console.log('📝 Generating content with documents:', state.selectedDocuments.map(d => d.original_filename));
      const response = await generateContent({
        source_document_ids: state.selectedDocuments.map(doc => doc.id),
        prompt_config: state.promptConfig,
        generated_prompt: unifiedPrompt,
        activity_name: `Generated Activity - ${new Date().toLocaleDateString()}`,
        activity_description: `Generated from ${state.selectedDocuments.length} source document(s)`
      });

      console.log('✅ Generation initiated, session ID:', response.session_id);
      setState(prev => ({
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
          setState(prev => ({
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
        
        setState(prev => ({
          ...prev,
          generationStatus: 'completed',
          generatedContent: generatedScenario
        }));
      } else {
        console.error('❌ No content in final status response');
        throw new Error('No content was generated');
      }

    } catch (error) {
      console.error('💥 Generation failed:', error);
      setState(prev => ({
        ...prev,
        generationStatus: 'error',
        error: error instanceof Error ? error.message : 'Generation failed'
      }));
    }
  };

  const handleGenerateAudio = async () => {
    if (!state.editedTranscript || state.selectedDocuments.length === 0) {
      setState(prev => ({
        ...prev,
        error: 'Missing transcript or source documents for audio generation'
      }));
      return;
    }

    console.log('🎵 Starting audio generation from transcript...');
    setState(prev => ({ ...prev, generationStatus: 'audio-generating', audioGenerationProgress: 'Starting audio generation...', error: null }));

    try {
      const generationRequest: MediaGenerationRequest = {
        source_document_id: state.selectedDocuments[0].id,
        media_type: 'podcast',
        media_style: state.podcastStyle,
        selected_keywords: state.selectedKeywords,
        selected_objectives: state.selectedObjectives,
        voice_config: {
          host: 'female_professional',
          guest: 'male_professional',
          narrator: 'female_conversational'
        },
        generation_config: {
          length_preference: state.podcastLength,
          conversation_depth: state.podcastDepth,
          custom_script: state.editedTranscript // Pass the edited transcript
        }
      };

      // Start audio generation (this creates the media item and starts background processing)
      const mediaItem = await generatePodcast(generationRequest);
      console.log('📝 Audio generation started, polling for completion...', mediaItem.id);

      // Poll for completion status
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max (5 second intervals)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;
        
        // Update progress indicator
        const progressText = `Generating audio... ${attempts}/${maxAttempts} (${Math.round(attempts / maxAttempts * 100)}%)`;
        setState(prev => ({ ...prev, audioGenerationProgress: progressText }));
        
        try {
          const statusResponse = await getGenerationStatus(mediaItem.id);
          console.log(`🔄 Audio generation status check ${attempts}/${maxAttempts}:`, statusResponse.status);
          
          if (statusResponse.status === 'completed') {
            console.log('✅ Audio generation completed successfully');
            setState(prev => ({
              ...prev,
              generationStatus: 'completed',
              generatedMediaId: mediaItem.id,
              audioGenerationProgress: null
            }));
            return;
          } else if (statusResponse.status === 'failed') {
            throw new Error(statusResponse.error || 'Audio generation failed');
          }
          // Continue polling if status is 'generating'
        } catch (statusError) {
          console.error('💥 Status check failed:', statusError);
          // Continue polling unless it's a clear failure
          if (attempts >= maxAttempts) {
            throw statusError;
          }
        }
      }
      
      // Timeout reached
      throw new Error('Audio generation timed out after 5 minutes');

    } catch (error) {
      console.error('💥 Audio generation failed:', error);
      setState(prev => ({
        ...prev,
        generationStatus: 'transcript-generated', // Return to transcript state
        audioGenerationProgress: null,
        error: error instanceof Error ? error.message : 'Failed to generate audio'
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
    if (state.selectedDocuments.length === 0) return false;
    // Content type must be selected first
    if (state.contentType === null) return false;
    
    // For activity generation, require prompt config
    if (state.contentType === 'activity') {
      return state.promptConfig !== null;
    }
    // For media generation, just need documents
    if (state.contentType === 'media') {
      return true;
    }
    return false;
  };


  // Render Focus section (keywords and objectives)
  const renderFocusSection = () => (
    <Card>
      <CardContent>
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6">
            2. Focus & Objectives
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Choose keywords and learning objectives to focus your content generation. These will guide the AI to create more targeted and relevant content.
        </Typography>
        
        {availableKeywords.length === 0 && availableObjectives.length === 0 ? (
          <Alert severity="info">
            No keywords or learning objectives found in selected documents. You can proceed to the next step.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {availableKeywords.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Focus Keywords ({state.selectedKeywords.length} selected)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {availableKeywords.map((keyword) => (
                    <Paper 
                      key={keyword} 
                      variant="outlined" 
                      sx={{ 
                        py: 0.75,
                        px: 1.5,
                        cursor: 'pointer',
                        bgcolor: state.selectedKeywords.includes(keyword) ? 'primary.light' : 'background.paper',
                        borderColor: state.selectedKeywords.includes(keyword) ? 'primary.main' : 'divider',
                        '&:hover': { 
                          bgcolor: state.selectedKeywords.includes(keyword) ? 'primary.light' : 'action.hover'
                        }
                      }}
                      onClick={() => setState(prev => ({
                        ...prev,
                        selectedKeywords: prev.selectedKeywords.includes(keyword)
                          ? prev.selectedKeywords.filter(k => k !== keyword)
                          : [...prev.selectedKeywords, keyword]
                      }))}
                    >
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: state.selectedKeywords.includes(keyword) ? 'primary.contrastText' : 'text.primary',
                          fontWeight: state.selectedKeywords.includes(keyword) ? 600 : 400,
                          fontSize: '0.875rem'
                        }}
                      >
                        {keyword}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}

            {availableObjectives.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Learning Objectives ({state.selectedObjectives.length} selected)
                </Typography>
                <Stack spacing={1}>
                  {availableObjectives.map((objective, index) => (
                    <Paper 
                      key={index} 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5, 
                        cursor: 'pointer',
                        bgcolor: state.selectedObjectives.includes(objective) ? 'primary.light' : 'background.paper',
                        borderColor: state.selectedObjectives.includes(objective) ? 'primary.main' : 'divider',
                        '&:hover': { 
                          bgcolor: state.selectedObjectives.includes(objective) ? 'primary.light' : 'action.hover'
                        }
                      }}
                      onClick={() => setState(prev => ({
                        ...prev,
                        selectedObjectives: prev.selectedObjectives.includes(objective)
                          ? prev.selectedObjectives.filter(o => o !== objective)
                          : [...prev.selectedObjectives, objective]
                      }))}
                    >
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: state.selectedObjectives.includes(objective) ? 'primary.contrastText' : 'text.primary',
                          fontWeight: state.selectedObjectives.includes(objective) ? 600 : 400
                        }}
                      >
                        {objective}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  // Render Content Type selection
  const renderContentTypeSection = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            3. Content Type
          </Typography>
        </Box>
        
        <FormControl component="fieldset">
          <FormLabel component="legend">What would you like to generate?</FormLabel>
          <RadioGroup
            row
            value={state.contentType || ''}
            onChange={(e) => setState(prev => ({ ...prev, contentType: e.target.value as 'activity' | 'media' }))}
            sx={{ mt: 1 }}
          >
            <FormControlLabel
              value="activity"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ActivityIcon />
                  <Typography variant="body1">Activity</Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="media"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MediaIcon />
                  <Typography variant="body1">Media</Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        {state.contentType === 'media' && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Media Type
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant={state.mediaType === 'podcast' ? 'contained' : 'outlined'}
                startIcon={<PodcastIcon />}
                onClick={() => setState(prev => ({ ...prev, mediaType: 'podcast' }))}
              >
                Podcast
              </Button>
              {/* Video generation will be added in a future release */}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // Render Configuration section
  const renderConfigurationSection = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ConfigIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6">
            4. Configuration
          </Typography>
        </Box>
        
        {state.contentType === 'activity' && (
          <PromptConfiguration
            selectedDocuments={state.selectedDocuments}
            onConfigurationChange={handlePromptConfiguration}
          />
        )}
        
        {state.contentType === 'media' && state.mediaType === 'podcast' && (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure your podcast generation settings below.
            </Typography>
            
            {/* Podcast Style Selection */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Podcast Style
              </Typography>
              <Grid container spacing={1.5}>
                {PODCAST_STYLES.map((style) => {
                  const IconComponent = style.icon;
                  const isSelected = state.podcastStyle === style.value;
                  
                  return (
                    <Grid item xs={6} key={style.value}>
                      <Card
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          border: isSelected ? '2px solid' : '1px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'background.paper',
                          '&:hover': { 
                            borderColor: isSelected ? 'primary.main' : 'primary.light',
                            boxShadow: 2
                          },
                          transition: 'all 0.2s ease',
                          height: '100%'
                        }}
                        onClick={() => setState(prev => ({
                          ...prev,
                          podcastStyle: style.value
                        }))}
                      >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <IconComponent 
                              color={isSelected ? 'primary' : 'action'} 
                              sx={{ mt: 0.25, fontSize: 20 }}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography 
                                variant="subtitle2" 
                                sx={{ 
                                  color: 'text.primary',
                                  fontWeight: 600,
                                  fontSize: '0.875rem',
                                  mb: 0.5
                                }}
                              >
                                {style.label}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: 'text.secondary',
                                  fontSize: '0.75rem',
                                  lineHeight: 1.3
                                }}
                              >
                                {style.description}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

            {/* Length and Depth Configuration */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Length
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                  {LENGTH_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      variant={state.podcastLength === option.value ? 'filled' : 'outlined'}
                      onClick={() => setState(prev => ({
                        ...prev,
                        podcastLength: option.value
                      }))}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Depth
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                  {DEPTH_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      variant={state.podcastDepth === option.value ? 'filled' : 'outlined'}
                      onClick={() => setState(prev => ({
                        ...prev,
                        podcastDepth: option.value
                      }))}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Grid>
            </Grid>
            
            <TextField
              fullWidth
              label="Custom Instructions (Optional)"
              placeholder="Additional instructions for podcast generation..."
              multiline
              rows={3}
              value={state.customInstructions}
              onChange={(e) => setState(prev => ({ ...prev, customInstructions: e.target.value }))}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // Render the unified Content Studio
  const renderUnifiedStudio = () => {
    // Show results if generation is completed
    if (state.generationStatus === 'completed' && state.generatedContent) {
      return (
        <GenerationResults
          generatedContent={state.generatedContent}
          sessionId={state.sessionId}
          onOpenInFlowEditor={handleOpenInFlowEditor}
        />
      );
    }

    // Show transcript editing if transcript has been generated
    if ((state.generationStatus === 'transcript-generated' || state.generationStatus === 'audio-generating') && state.generatedTranscript) {
      return (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  Review & Edit Transcript
                </Typography>
                <Chip 
                  label="Transcript Generated" 
                  color="success" 
                  size="small" 
                />
              </Box>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Review the generated transcript and make any edits before creating the audio. You can modify the content, adjust the conversation flow, or add additional context.
              </Typography>
              
              <TextField
                fullWidth
                multiline
                value={state.editedTranscript}
                onChange={(e) => setState(prev => ({ ...prev, editedTranscript: e.target.value }))}
                placeholder="Edit your podcast transcript here..."
                sx={{ 
                  mb: 3,
                  '& .MuiInputBase-root': {
                    minHeight: 'calc(100vh - 400px)', // Use viewport height minus space for header/buttons
                    alignItems: 'flex-start'
                  },
                  '& .MuiInputBase-inputMultiline': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    minHeight: 'calc(100vh - 450px) !important', // Ensure textarea fills the space
                    resize: 'vertical'
                  }
                }}
              />
              
              {state.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {state.error}
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => setState(prev => ({ 
                    ...prev, 
                    generationStatus: 'idle',
                    generatedTranscript: null,
                    editedTranscript: '',
                    audioGenerationProgress: null,
                    error: null
                  }))}
                  disabled={state.generationStatus === 'generating' || state.generationStatus === 'audio-generating'}
                >
                  Start Over
                </Button>
                <Button
                  variant="contained"
                  onClick={handleGenerateAudio}
                  disabled={!state.editedTranscript.trim() || state.generationStatus === 'audio-generating'}
                  startIcon={state.generationStatus === 'audio-generating' ? <CircularProgress size={16} /> : <PlayIcon />}
                >
                  {state.generationStatus === 'audio-generating' 
                    ? (state.audioGenerationProgress || 'Generating Audio...') 
                    : 'Generate Audio'
                  }
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      );
    }

    // Show completion screen for media generation
    if (state.generationStatus === 'completed' && state.generatedMediaId) {
      return (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  🎉 Podcast Generated Successfully!
                </Typography>
                <Chip 
                  label="Audio Generated" 
                  color="success" 
                  size="small" 
                />
              </Box>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Your podcast has been generated and is ready to listen to. You can find it in your Media Library or listen to it directly.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => setState(prev => ({ 
                    ...prev, 
                    generationStatus: 'idle',
                    generatedTranscript: null,
                    editedTranscript: '',
                    generatedMediaId: null,
                    audioGenerationProgress: null,
                    error: null
                  }))}
                >
                  Generate Another
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate('/app/media')}
                  startIcon={<PodcastIcon />}
                >
                  Go to Media Library
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate(`/app/media/${state.generatedMediaId}`)}
                  startIcon={<PlayIcon />}
                >
                  Listen Now
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      );
    }

    return (
      <Stack spacing={1}>
        {/* Step 1: Source Selection */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SourceIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                1. Select Source Documents
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose one or more documents from your library to use as source material for content generation. Selected documents will be analyzed for keywords and learning objectives.
            </Typography>
            <SourceLibrarySelection
              selectedDocuments={state.selectedDocuments}
              onSelectionChange={handleDocumentSelection}
            />
          </CardContent>
        </Card>

        {/* Step 2: Focus & Objectives - Only show when documents are selected */}
        {state.selectedDocuments.length > 0 && renderFocusSection()}

        {/* Step 3: Content Type - Only show when documents are selected */}
        {state.selectedDocuments.length > 0 && renderContentTypeSection()}

        {/* Step 4: Configuration - Only show when content type is selected and documents are selected */}
        {state.selectedDocuments.length > 0 && state.contentType !== null && renderConfigurationSection()}

        {/* Step 5: Generate - Only show when ready to generate */}
        {state.selectedDocuments.length > 0 && state.contentType !== null && (
          (state.contentType === 'activity' ? state.promptConfig !== null : true)
        ) && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PlayIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6">
                5. Generate Content
              </Typography>
            </Box>
            
            {!canProceedToGeneration() && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {state.selectedDocuments.length === 0 
                  ? 'Please select source documents to continue'
                  : state.contentType === null
                    ? 'Please select a content type to continue'
                    : state.contentType === 'activity' 
                      ? 'Please configure generation settings for activities'
                      : 'Ready to generate media content'
                }
              </Alert>
            )}
            
            <Box>
              {state.generationStatus === 'generating' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {state.contentType === 'media' 
                      ? 'Generating podcast transcript with Claude AI...'
                      : 'Generating activity content...'
                    }
                  </Typography>
                  <Box sx={{ width: '100%' }}>
                    <div style={{ 
                      height: '4px', 
                      backgroundColor: '#e0e0e0', 
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        backgroundColor: '#1976d2',
                        animation: 'progress 2s infinite linear',
                        transformOrigin: '0% 50%'
                      }} />
                    </div>
                  </Box>
                  <style>
                    {`@keyframes progress {
                      0% { transform: translateX(-100%) scaleX(0); }
                      40% { transform: translateX(-100%) scaleX(0.4); }
                      100% { transform: translateX(100%) scaleX(0.5); }
                    }`}
                  </style>
                </Box>
              )}
              
              <Button
                variant="contained"
                size="large"
                onClick={handleStartGeneration}
                disabled={!canProceedToGeneration() || state.generationStatus === 'generating'}
                startIcon={state.contentType === 'media' ? <PodcastIcon /> : <GenerateIcon />}
                sx={{ minWidth: 200 }}
              >
                {state.generationStatus === 'generating' 
                  ? 'Generating...'
                  : state.contentType === 'media' 
                    ? 'Generate Transcript'
                    : 'Generate Activity'
                }
              </Button>
            </Box>
          </CardContent>
        </Card>
        )}
      </Stack>
    );
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Content Studio
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Generate Activities and Media content from your source documents using AI.
        </Typography>
      </Box>

      {/* Unified Content Studio Interface */}
      {renderUnifiedStudio()}
    </Box>
  );
};

export default ContentGenerationPage;