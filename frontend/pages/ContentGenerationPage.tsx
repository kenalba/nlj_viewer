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
  Engineering as TechnicalIcon,
  Tag as TagIcon,
  Psychology as ObjectiveIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Quiz as AssessmentIcon,
  Poll as SurveyIcon,
  SportsEsports as GamesIcon,
  Psychology as SimulationIcon,
  Slideshow as PresentationIcon,
  Analytics as ReportIcon,
  MenuBook as CourseIcon,
  VideoLibrary as VideoIcon,
  Summarize as SummaryIcon,
  HourglassEmpty as ComingSoonIcon
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
  selectedAudiences: string[];
  customKeywords: string[];
  customObjectives: string[];
  customAudiences: string[];
  editingKeyword: boolean;
  editingObjective: boolean;
  editingAudience: boolean;
  newKeywordValue: string;
  newObjectiveValue: string;
  newAudienceValue: string;
  contentCategory: 'interactive' | 'media' | 'reports' | null;
  contentType: 'activity' | 'assessment' | 'survey' | 'game' | 'simulation' | 'podcast' | 'video' | 'presentation' | 'report' | 'summary' | 'course' | null;
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
    selectedAudiences: [],
    customKeywords: [],
    customObjectives: [],
    customAudiences: [],
    editingKeyword: false,
    editingObjective: false,
    editingAudience: false,
    newKeywordValue: '',
    newObjectiveValue: '',
    newAudienceValue: '',
    contentCategory: null,
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

  // Extract all keywords and objectives from selected documents + custom ones
  const availableKeywords = useMemo(() => {
    const allKeywords = state.selectedDocuments.flatMap(doc => doc.keywords || []);
    const allCombined = [...allKeywords, ...state.customKeywords];
    return [...new Set(allCombined)]; // Remove duplicates
  }, [state.selectedDocuments, state.customKeywords]);

  const availableObjectives = useMemo(() => {
    const allObjectives = state.selectedDocuments.flatMap(doc => doc.learning_objectives || []);
    const allCombined = [...allObjectives, ...state.customObjectives];
    return [...new Set(allCombined)]; // Remove duplicates
  }, [state.selectedDocuments, state.customObjectives]);

  const availableAudiences = useMemo(() => {
    // Parse target_audience strings into individual audiences
    const allAudiences = state.selectedDocuments.flatMap(doc => {
      if (!doc.target_audience) return [];
      
      // Split by common separators and clean up
      return doc.target_audience
        .split(/[,;|&\n]|and\s+|or\s+/i) // Split by comma, semicolon, pipe, ampersand, newlines, "and", "or"
        .map(audience => audience.trim()) // Remove whitespace
        .filter(audience => audience.length > 2) // Filter out very short strings
        .map(audience => {
          // Clean up common prefixes/suffixes
          audience = audience.replace(/^(for\s+|to\s+|targeting\s+)/i, '');
          audience = audience.replace(/\s+(users|people|individuals|learners|students|employees|staff)$/i, '');
          // Capitalize first letter
          return audience.charAt(0).toUpperCase() + audience.slice(1);
        });
    });
    
    const allCombined = [...allAudiences, ...state.customAudiences];
    return [...new Set(allCombined)]; // Remove duplicates
  }, [state.selectedDocuments, state.customAudiences]);

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

  useEffect(() => {
    if (availableAudiences.length > 0 && state.selectedAudiences.length === 0) {
      setState(prev => ({
        ...prev,
        selectedAudiences: availableAudiences.slice(0, 2) // Usually 1-2 distinct audiences
      }));
    }
  }, [availableAudiences]);

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

    // For podcast generation, generate transcript first
    if (state.contentType === 'podcast') {
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
    // Both category and content type must be selected
    if (state.contentCategory === null || state.contentType === null) return false;
    
    // Only implemented content types can proceed to generation
    if (!isContentTypeImplemented(state.contentType)) return false;
    
    // For activity generation, require prompt config
    if (state.contentType === 'activity') {
      return state.promptConfig !== null;
    }
    // For podcast generation, just need documents
    if (state.contentType === 'podcast') {
      return true;
    }
    // Other implemented types are ready
    return true;
  };


  // Render Focus section (audience, keywords and objectives)
  const renderFocusSection = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <TagIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6">
            2. Focus & Objectives
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Define your target audience, choose keywords, and set learning objectives to focus your content generation. These will guide the AI to create more targeted and relevant content.
        </Typography>
        
        {availableKeywords.length === 0 && availableObjectives.length === 0 && availableAudiences.length === 0 ? (
          <Alert severity="info">
            No audience, keywords, or learning objectives found in selected documents. You can proceed to the next step.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* Target Audience Section */}
            {(availableAudiences.length > 0 || state.selectedDocuments.length > 0) && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon sx={{ fontSize: 20 }} />
                  Target Audience ({state.selectedAudiences.length} selected)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {availableAudiences.map((audience) => {
                    const isCustom = state.customAudiences.includes(audience);
                    return (
                      <Paper 
                        key={audience} 
                        variant="outlined" 
                        sx={{ 
                          py: 0.75,
                          px: 1.5,
                          cursor: 'pointer',
                          bgcolor: state.selectedAudiences.includes(audience) ? 'primary.light' : 'background.paper',
                          borderColor: state.selectedAudiences.includes(audience) ? 'primary.main' : 'divider',
                          '&:hover': { 
                            bgcolor: state.selectedAudiences.includes(audience) ? 'primary.light' : 'action.hover'
                          }
                        }}
                        onClick={() => setState(prev => ({
                          ...prev,
                          selectedAudiences: prev.selectedAudiences.includes(audience)
                            ? prev.selectedAudiences.filter(a => a !== audience)
                            : [...prev.selectedAudiences, audience]
                        }))}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: state.selectedAudiences.includes(audience) ? 'primary.contrastText' : 'text.primary',
                              fontWeight: state.selectedAudiences.includes(audience) ? 600 : 400,
                              fontSize: '0.875rem'
                            }}
                          >
                            {audience}
                          </Typography>
                          {isCustom && (
                            <CloseIcon
                              sx={{ 
                                fontSize: 16,
                                color: state.selectedAudiences.includes(audience) ? 'primary.contrastText' : 'text.secondary',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setState(prev => ({
                                  ...prev,
                                  customAudiences: prev.customAudiences.filter(a => a !== audience),
                                  selectedAudiences: prev.selectedAudiences.filter(a => a !== audience)
                                }));
                              }}
                            />
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                  
                  {/* Add Custom Audience */}
                  {state.editingAudience ? (
                    <Paper variant="outlined" sx={{ p: 0.5, minWidth: 150 }}>
                      <TextField
                        size="small"
                        value={state.newAudienceValue}
                        onChange={(e) => setState(prev => ({ ...prev, newAudienceValue: e.target.value }))}
                        placeholder="e.g., Sales professionals, New employees"
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          endAdornment: (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <CheckIcon
                                sx={{ fontSize: 16, cursor: 'pointer', color: 'success.main' }}
                                onClick={() => {
                                  if (state.newAudienceValue.trim()) {
                                    setState(prev => ({
                                      ...prev,
                                      customAudiences: [...prev.customAudiences, prev.newAudienceValue.trim()],
                                      selectedAudiences: [...prev.selectedAudiences, prev.newAudienceValue.trim()],
                                      editingAudience: false,
                                      newAudienceValue: ''
                                    }));
                                  }
                                }}
                              />
                              <CloseIcon
                                sx={{ fontSize: 16, cursor: 'pointer', color: 'error.main' }}
                                onClick={() => setState(prev => ({ 
                                  ...prev, 
                                  editingAudience: false, 
                                  newAudienceValue: '' 
                                }))}
                              />
                            </Box>
                          )
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && state.newAudienceValue.trim()) {
                            setState(prev => ({
                              ...prev,
                              customAudiences: [...prev.customAudiences, prev.newAudienceValue.trim()],
                              selectedAudiences: [...prev.selectedAudiences, prev.newAudienceValue.trim()],
                              editingAudience: false,
                              newAudienceValue: ''
                            }));
                          } else if (e.key === 'Escape') {
                            setState(prev => ({ 
                              ...prev, 
                              editingAudience: false, 
                              newAudienceValue: '' 
                            }));
                          }
                        }}
                        sx={{ minWidth: 180 }}
                        autoFocus
                      />
                    </Paper>
                  ) : (
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        py: 0.75,
                        px: 1.5,
                        cursor: 'pointer',
                        bgcolor: 'action.hover',
                        borderStyle: 'dashed',
                        '&:hover': { 
                          bgcolor: 'action.selected'
                        }
                      }}
                      onClick={() => setState(prev => ({ ...prev, editingAudience: true }))}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AddIcon sx={{ fontSize: 16 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          Add Audience
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                </Box>
              </Box>
            )}

            {(availableKeywords.length > 0 || state.selectedDocuments.length > 0) && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Focus Keywords ({state.selectedKeywords.length} selected)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {availableKeywords.map((keyword) => {
                    const isCustom = state.customKeywords.includes(keyword);
                    return (
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                          {isCustom && (
                            <CloseIcon
                              sx={{ 
                                fontSize: 16,
                                color: state.selectedKeywords.includes(keyword) ? 'primary.contrastText' : 'text.secondary',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setState(prev => ({
                                  ...prev,
                                  customKeywords: prev.customKeywords.filter(k => k !== keyword),
                                  selectedKeywords: prev.selectedKeywords.filter(k => k !== keyword)
                                }));
                              }}
                            />
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                  
                  {/* Add Custom Keyword */}
                  {state.editingKeyword ? (
                    <Paper variant="outlined" sx={{ p: 0.5, minWidth: 150 }}>
                      <TextField
                        size="small"
                        value={state.newKeywordValue}
                        onChange={(e) => setState(prev => ({ ...prev, newKeywordValue: e.target.value }))}
                        placeholder="Enter keyword..."
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          endAdornment: (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <CheckIcon
                                sx={{ fontSize: 16, cursor: 'pointer', color: 'success.main' }}
                                onClick={() => {
                                  if (state.newKeywordValue.trim()) {
                                    setState(prev => ({
                                      ...prev,
                                      customKeywords: [...prev.customKeywords, prev.newKeywordValue.trim()],
                                      selectedKeywords: [...prev.selectedKeywords, prev.newKeywordValue.trim()],
                                      editingKeyword: false,
                                      newKeywordValue: ''
                                    }));
                                  }
                                }}
                              />
                              <CloseIcon
                                sx={{ fontSize: 16, cursor: 'pointer', color: 'error.main' }}
                                onClick={() => setState(prev => ({ 
                                  ...prev, 
                                  editingKeyword: false, 
                                  newKeywordValue: '' 
                                }))}
                              />
                            </Box>
                          )
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && state.newKeywordValue.trim()) {
                            setState(prev => ({
                              ...prev,
                              customKeywords: [...prev.customKeywords, prev.newKeywordValue.trim()],
                              selectedKeywords: [...prev.selectedKeywords, prev.newKeywordValue.trim()],
                              editingKeyword: false,
                              newKeywordValue: ''
                            }));
                          } else if (e.key === 'Escape') {
                            setState(prev => ({ 
                              ...prev, 
                              editingKeyword: false, 
                              newKeywordValue: '' 
                            }));
                          }
                        }}
                        sx={{ minWidth: 120 }}
                        autoFocus
                      />
                    </Paper>
                  ) : (
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        py: 0.75,
                        px: 1.5,
                        cursor: 'pointer',
                        bgcolor: 'action.hover',
                        borderStyle: 'dashed',
                        '&:hover': { 
                          bgcolor: 'action.selected'
                        }
                      }}
                      onClick={() => setState(prev => ({ ...prev, editingKeyword: true }))}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AddIcon sx={{ fontSize: 16 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          Add Keyword
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                </Box>
              </Box>
            )}

            {(availableObjectives.length > 0 || state.selectedDocuments.length > 0) && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Learning Objectives ({state.selectedObjectives.length} selected)
                </Typography>
                <Stack spacing={1}>
                  {availableObjectives.map((objective, index) => {
                    const isCustom = state.customObjectives.includes(objective);
                    return (
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
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: state.selectedObjectives.includes(objective) ? 'primary.contrastText' : 'text.primary',
                              fontWeight: state.selectedObjectives.includes(objective) ? 600 : 400,
                              flex: 1
                            }}
                          >
                            {objective}
                          </Typography>
                          {isCustom && (
                            <CloseIcon
                              sx={{ 
                                fontSize: 16,
                                color: state.selectedObjectives.includes(objective) ? 'primary.contrastText' : 'text.secondary',
                                cursor: 'pointer',
                                ml: 1,
                                flexShrink: 0
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setState(prev => ({
                                  ...prev,
                                  customObjectives: prev.customObjectives.filter(o => o !== objective),
                                  selectedObjectives: prev.selectedObjectives.filter(o => o !== objective)
                                }));
                              }}
                            />
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                  
                  {/* Add Custom Objective */}
                  {state.editingObjective ? (
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={state.newObjectiveValue}
                        onChange={(e) => setState(prev => ({ ...prev, newObjectiveValue: e.target.value }))}
                        placeholder="Enter learning objective..."
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          endAdornment: (
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, ml: 1 }}>
                              <CheckIcon
                                sx={{ fontSize: 20, cursor: 'pointer', color: 'success.main' }}
                                onClick={() => {
                                  if (state.newObjectiveValue.trim()) {
                                    setState(prev => ({
                                      ...prev,
                                      customObjectives: [...prev.customObjectives, prev.newObjectiveValue.trim()],
                                      selectedObjectives: [...prev.selectedObjectives, prev.newObjectiveValue.trim()],
                                      editingObjective: false,
                                      newObjectiveValue: ''
                                    }));
                                  }
                                }}
                              />
                              <CloseIcon
                                sx={{ fontSize: 20, cursor: 'pointer', color: 'error.main' }}
                                onClick={() => setState(prev => ({ 
                                  ...prev, 
                                  editingObjective: false, 
                                  newObjectiveValue: '' 
                                }))}
                              />
                            </Box>
                          )
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && state.newObjectiveValue.trim()) {
                            setState(prev => ({
                              ...prev,
                              customObjectives: [...prev.customObjectives, prev.newObjectiveValue.trim()],
                              selectedObjectives: [...prev.selectedObjectives, prev.newObjectiveValue.trim()],
                              editingObjective: false,
                              newObjectiveValue: ''
                            }));
                          } else if (e.key === 'Escape') {
                            setState(prev => ({ 
                              ...prev, 
                              editingObjective: false, 
                              newObjectiveValue: '' 
                            }));
                          }
                        }}
                        autoFocus
                      />
                    </Paper>
                  ) : (
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5,
                        cursor: 'pointer',
                        bgcolor: 'action.hover',
                        borderStyle: 'dashed',
                        '&:hover': { 
                          bgcolor: 'action.selected'
                        }
                      }}
                      onClick={() => setState(prev => ({ ...prev, editingObjective: true }))}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AddIcon sx={{ fontSize: 20 }} />
                        <Typography variant="body2">
                          Add Learning Objective
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  // Main content categories
  const contentCategories = [
    {
      id: 'interactive',
      label: 'Interactive Content',
      description: 'Engaging activities that require user participation',
      icon: ActivityIcon,
      popular: true,
      subtypes: [
        {
          id: 'activity',
          label: 'Learning Activity',
          description: 'Multi-step scenarios with questions and branching',
          icon: ActivityIcon,
          implemented: true
        },
        {
          id: 'assessment',
          label: 'Assessment',
          description: 'Quizzes, tests, and formal evaluations',
          icon: AssessmentIcon,
          implemented: false
        },
        {
          id: 'survey',
          label: 'Survey',
          description: 'Feedback forms and questionnaires',
          icon: SurveyIcon,
          implemented: false
        },
        {
          id: 'game',
          label: 'Learning Game',
          description: 'Interactive games like Connections and Wordle',
          icon: GamesIcon,
          implemented: false
        },
        {
          id: 'simulation',
          label: 'Simulation',
          description: 'Role-playing scenarios and interactive experiences',
          icon: SimulationIcon,
          implemented: false
        }
      ]
    },
    {
      id: 'media',
      label: 'Media Content',
      description: 'Audio, video, and multimedia presentations',
      icon: MediaIcon,
      popular: true,
      subtypes: [
        {
          id: 'podcast',
          label: 'Podcast',
          description: 'AI-generated audio conversations and narrations',
          icon: PodcastIcon,
          implemented: true
        },
        {
          id: 'video',
          label: 'Video',
          description: 'AI-generated video content and tutorials',
          icon: VideoIcon,
          implemented: false
        },
        {
          id: 'presentation',
          label: 'Presentation',
          description: 'Visual slide decks and multimedia presentations',
          icon: PresentationIcon,
          implemented: false
        }
      ]
    },
    {
      id: 'reports',
      label: 'Reports & Analysis',
      description: 'Document analysis, summaries, and structured reports',
      icon: ReportIcon,
      subtypes: [
        {
          id: 'report',
          label: 'Analysis Report',
          description: 'Comprehensive analysis and insights from your documents',
          icon: ReportIcon,
          implemented: false
        },
        {
          id: 'summary',
          label: 'Document Summary',
          description: 'Concise summaries of key points and findings',
          icon: SummaryIcon,
          implemented: false
        },
        {
          id: 'course',
          label: 'Learning Path',
          description: 'Structured multi-module learning curricula',
          icon: CourseIcon,
          implemented: false
        }
      ]
    }
  ];

  // Render Content Type selection
  const renderContentTypeSection = () => {
    const selectedCategory = contentCategories.find(cat => cat.id === state.contentCategory);
    
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ActivityIcon color="primary" sx={{ mr: 1.5 }} />
            <Typography variant="h6">
              3. Content Type
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose what type of content you'd like to generate from your source documents.
          </Typography>
          
          {/* Categories Row */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            {contentCategories.map((category) => {
              const IconComponent = category.icon;
              const isSelected = state.contentCategory === category.id;
              
              return (
                <Card
                  key={category.id}
                  variant="outlined"
                  sx={{
                    flex: 1,
                    cursor: 'pointer',
                    border: isSelected ? '2px solid' : '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'background.paper',
                    '&:hover': { 
                      borderColor: isSelected ? 'primary.main' : 'primary.light',
                      boxShadow: 2
                    },
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setState(prev => ({
                    ...prev,
                    contentCategory: category.id as typeof state.contentCategory,
                    contentType: null // Reset subtype when category changes
                  }))}
                >
                  <CardContent sx={{ p: 2 }}>
                    {/* Header with icon and badges */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                      <IconComponent 
                        color={isSelected ? 'primary' : 'action'} 
                        sx={{ fontSize: 28 }}
                      />
                      <Box>
                        {category.popular && (
                          <Chip 
                            label="Popular" 
                            size="small" 
                            color="primary" 
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </Box>
                    
                    {/* Content */}
                    <Box>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          color: 'text.primary',
                          fontWeight: 600,
                          mb: 1,
                          lineHeight: 1.3
                        }}
                      >
                        {category.label}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'text.secondary',
                          fontSize: '0.875rem',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {category.description}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>

          {/* Subtypes - Show when category is selected */}
          {selectedCategory && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                Choose a specific type from <strong>{selectedCategory.label}</strong>:
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {selectedCategory.subtypes.map((subtype) => {
                  const isSelected = state.contentType === subtype.id;
                  const SubtypeIcon = subtype.icon;
                  
                  return (
                    <Card
                      key={subtype.id}
                      variant="outlined"
                      sx={{
                        width: 200,
                        height: 100,
                        cursor: 'pointer',
                        border: isSelected ? '2px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'background.paper',
                        '&:hover': { 
                          borderColor: isSelected ? 'primary.main' : 'primary.light',
                          boxShadow: 2
                        },
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                      onClick={() => {
                        setState(prev => ({ 
                          ...prev, 
                          contentType: subtype.id as typeof state.contentType
                        }));
                      }}
                    >
                      <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                        {/* Header with icon and title on same line */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <SubtypeIcon 
                            color={isSelected ? 'primary' : 'action'} 
                            sx={{ fontSize: 18 }}
                          />
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              color: 'text.primary',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              lineHeight: 1.2
                            }}
                          >
                            {subtype.label}
                          </Typography>
                        </Box>
                        
                        {/* Description */}
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {subtype.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render Configuration section
  // Helper function to check if content type is implemented
  const isContentTypeImplemented = (contentType: string | null): boolean => {
    if (!contentType || !state.contentCategory) return false;
    
    const category = contentCategories.find(cat => cat.id === state.contentCategory);
    if (!category) return false;
    
    const subtype = category.subtypes.find(sub => sub.id === contentType);
    return subtype?.implemented ?? false;
  };

  // Coming Soon Widget Component
  const ComingSoonWidget = () => (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Box sx={{ 
        fontSize: 64, 
        mb: 2, 
        filter: 'grayscale(100%)', 
        opacity: 0.6 
      }}>
        🚧
      </Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
        Coming Soon!
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: 400, mx: 'auto' }}>
        We're working hard to bring you this feature. Configuration options for this content type will be available in a future update.
      </Typography>
      <Box sx={{ mt: 3 }}>
        <Chip 
          label="In Development" 
          color="warning" 
          variant="outlined"
          sx={{ 
            fontWeight: 600,
            fontSize: '0.875rem'
          }}
        />
      </Box>
    </Box>
  );

  const renderConfigurationSection = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ConfigIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6">
            4. Configuration
          </Typography>
        </Box>
        
        {/* Check if content type is implemented */}
        {!isContentTypeImplemented(state.contentType) ? (
          <ComingSoonWidget />
        ) : (
          <>
            {state.contentType === 'activity' && (
              <PromptConfiguration
                selectedDocuments={state.selectedDocuments}
                onConfigurationChange={handlePromptConfiguration}
              />
            )}
            
            {state.contentType === 'podcast' && (
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
          </>
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
        {state.selectedDocuments.length > 0 && state.contentCategory !== null && state.contentType !== null && renderConfigurationSection()}

        {/* Step 5: Generate - Only show when ready to generate */}
        {canProceedToGeneration() && (
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
                startIcon={state.contentType === 'podcast' ? <PodcastIcon /> : <GenerateIcon />}
                sx={{ minWidth: 200 }}
              >
                {state.generationStatus === 'generating' 
                  ? 'Generating...'
                  : state.contentType === 'podcast' 
                    ? 'Generate Transcript'
                    : 'Generate Content'
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