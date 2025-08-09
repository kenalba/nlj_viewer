/**
 * Podcast Generation Page
 * Full-page workflow for creating NPR-style podcasts from source documents
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  LinearProgress,
  IconButton,
  Divider,
  Stack,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AudioFile as PodcastIcon,
  Source as SourceIcon,
  Settings as ConfigIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  VolumeUp as VoiceIcon,
  AutoAwesome as GenerateIcon
} from '@mui/icons-material';
import { 
  generatePodcastScript, 
  generatePodcast, 
  getGenerationStatus, 
  getAvailableVoices,
  type MediaItem,
  type PodcastScriptRequest,
  type PodcastScriptResponse,
  type VoiceOption,
  type MediaGenerationRequest 
} from '../client/media';
import { getSourceDocument, type SourceDocument } from '../client/sources';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface PodcastGenerationState {
  sourceDocument: SourceDocument | null;
  selectedKeywords: string[];
  selectedObjectives: string[];
  podcastConfig: {
    style: string;
    length: string;
    depth: string;
    voices: Record<string, string>;
  };
  generatedScript: PodcastScriptResponse | null;
  editedScript: string;
  generatedMedia: MediaItem | null;
  availableVoices: VoiceOption[];
  isGenerating: boolean;
  error: string | null;
}

const PODCAST_STYLES = [
  { value: 'npr_interview', label: 'NPR Interview', description: 'Conversational interview format with host and expert' },
  { value: 'educational_summary', label: 'Educational Summary', description: 'Structured educational overview with narrator' },
  { value: 'conversational_deep_dive', label: 'Deep Dive Discussion', description: 'In-depth analysis with multiple perspectives' },
  { value: 'technical_breakdown', label: 'Technical Breakdown', description: 'Detailed technical explanation with examples' }
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

export const PodcastGenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceDocumentId = searchParams.get('source');

  const [state, setState] = useState<PodcastGenerationState>({
    sourceDocument: null,
    selectedKeywords: [],
    selectedObjectives: [],
    podcastConfig: {
      style: 'npr_interview',
      length: 'medium',
      depth: 'balanced',
      voices: {
        host: 'female_professional',
        guest: 'male_professional',
        narrator: 'female_conversational'
      }
    },
    generatedScript: null,
    editedScript: '',
    generatedMedia: null,
    availableVoices: [],
    isGenerating: false,
    error: null
  });

  // Load source document if provided in URL
  useEffect(() => {
    if (sourceDocumentId && !state.sourceDocument) {
      loadSourceDocument(sourceDocumentId);
    }
  }, [sourceDocumentId]);

  // Load available voices
  useEffect(() => {
    loadAvailableVoices();
  }, []);

  const loadSourceDocument = async (id: string) => {
    try {
      const document = await getSourceDocument(id);
      setState(prev => ({ 
        ...prev, 
        sourceDocument: document,
        selectedKeywords: document.keywords?.slice(0, 5) || [],
        selectedObjectives: document.learning_objectives?.slice(0, 3) || []
      }));
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to load source document' }));
    }
  };

  const loadAvailableVoices = async () => {
    try {
      const voices = await getAvailableVoices();
      setState(prev => ({ ...prev, availableVoices: voices }));
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  };

  const handleGenerateScript = async () => {
    if (!state.sourceDocument) return;

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const scriptRequest: PodcastScriptRequest = {
        source_document_id: state.sourceDocument.id,
        selected_keywords: state.selectedKeywords,
        selected_objectives: state.selectedObjectives,
        style: state.podcastConfig.style,
        length_preference: state.podcastConfig.length,
        conversation_depth: state.podcastConfig.depth
      };

      const scriptResponse = await generatePodcastScript(scriptRequest);
      
      setState(prev => ({
        ...prev,
        generatedScript: scriptResponse,
        editedScript: scriptResponse.script,
        isGenerating: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to generate script',
        isGenerating: false
      }));
    }
  };

  const handleGenerateAudio = async () => {
    if (!state.sourceDocument || !state.editedScript) return;

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const generationRequest: MediaGenerationRequest = {
        source_document_id: state.sourceDocument.id,
        media_type: 'podcast',
        media_style: state.podcastConfig.style,
        selected_keywords: state.selectedKeywords,
        selected_objectives: state.selectedObjectives,
        voice_config: state.podcastConfig.voices,
        generation_config: {
          length_preference: state.podcastConfig.length,
          conversation_depth: state.podcastConfig.depth
        }
      };

      const mediaItem = await generatePodcast(generationRequest);
      
      setState(prev => ({
        ...prev,
        generatedMedia: mediaItem,
        isGenerating: false
      }));

      // Poll for completion
      pollGenerationCompletion(mediaItem.id);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to start audio generation',
        isGenerating: false
      }));
    }
  };

  const pollGenerationCompletion = async (mediaId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await getGenerationStatus(mediaId);
        
        if (status.status === 'completed') {
          clearInterval(pollInterval);
          setState(prev => ({
            ...prev,
            isGenerating: false
          }));
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setState(prev => ({
            ...prev,
            error: status.error || 'Audio generation failed',
            isGenerating: false
          }));
        }
      } catch (error) {
        clearInterval(pollInterval);
        setState(prev => ({
          ...prev,
          error: 'Failed to check generation status',
          isGenerating: false
        }));
      }
    }, 2000);

    // Clear interval after 10 minutes to prevent infinite polling
    setTimeout(() => clearInterval(pollInterval), 600000);
  };

  const handleBack = () => {
    if (sourceDocumentId) {
      navigate(`/app/sources/${sourceDocumentId}`);
    } else {
      navigate('/app/sources');
    }
  };

  const handleViewMedia = () => {
    if (state.generatedMedia) {
      navigate(`/app/media/${state.generatedMedia.id}`);
    }
  };

  const renderSourceSelection = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Select Source Document
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Choose a document to generate a podcast from, or upload a new document.
        </Typography>
        
        {state.sourceDocument ? (
          <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
            <Typography variant="subtitle1">
              {state.sourceDocument.extracted_title || state.sourceDocument.original_filename}
            </Typography>
            <Typography variant="body2">
              {state.sourceDocument.file_type.toUpperCase()} • {state.sourceDocument.page_count} pages
            </Typography>
          </Paper>
        ) : (
          <Button
            variant="outlined"
            startIcon={<SourceIcon />}
            onClick={() => navigate('/app/sources')}
          >
            Select Source Document
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const renderConfiguration = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Podcast Configuration
        </Typography>
        
        <Grid container spacing={3}>
          {/* Style Selection */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Podcast Style
            </Typography>
            <Grid container spacing={1}>
              {PODCAST_STYLES.map((style) => (
                <Grid item xs={12} sm={6} key={style.value}>
                  <Card
                    variant={state.podcastConfig.style === style.value ? 'outlined' : 'elevation'}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: state.podcastConfig.style === style.value ? 'primary.light' : 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => setState(prev => ({
                      ...prev,
                      podcastConfig: { ...prev.podcastConfig, style: style.value }
                    }))}
                  >
                    <CardContent sx={{ py: 1.5 }}>
                      <Typography variant="subtitle2">{style.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {style.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Length and Depth */}
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom>
              Length
            </Typography>
            {LENGTH_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                variant={state.podcastConfig.length === option.value ? 'filled' : 'outlined'}
                onClick={() => setState(prev => ({
                  ...prev,
                  podcastConfig: { ...prev.podcastConfig, length: option.value }
                }))}
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom>
              Depth
            </Typography>
            {DEPTH_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                variant={state.podcastConfig.depth === option.value ? 'filled' : 'outlined'}
                onClick={() => setState(prev => ({
                  ...prev,
                  podcastConfig: { ...prev.podcastConfig, depth: option.value }
                }))}
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Grid>

          {/* Keywords and Objectives */}
          {state.sourceDocument?.keywords && (
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                Focus Keywords ({state.selectedKeywords.length} selected)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {state.sourceDocument.keywords.map((keyword) => (
                  <Chip
                    key={keyword}
                    label={keyword}
                    size="small"
                    variant={state.selectedKeywords.includes(keyword) ? 'filled' : 'outlined'}
                    onClick={() => setState(prev => ({
                      ...prev,
                      selectedKeywords: prev.selectedKeywords.includes(keyword)
                        ? prev.selectedKeywords.filter(k => k !== keyword)
                        : [...prev.selectedKeywords, keyword]
                    }))}
                  />
                ))}
              </Box>
            </Grid>
          )}

          {state.sourceDocument?.learning_objectives && (
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                Learning Objectives ({state.selectedObjectives.length} selected)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {state.sourceDocument.learning_objectives.map((objective, index) => (
                  <Chip
                    key={index}
                    label={objective}
                    size="small"
                    variant={state.selectedObjectives.includes(objective) ? 'filled' : 'outlined'}
                    onClick={() => setState(prev => ({
                      ...prev,
                      selectedObjectives: prev.selectedObjectives.includes(objective)
                        ? prev.selectedObjectives.filter(o => o !== objective)
                        : [...prev.selectedObjectives, objective]
                    }))}
                    sx={{ 
                      height: 'auto',
                      '& .MuiChip-label': {
                        display: 'block',
                        whiteSpace: 'normal',
                        textAlign: 'left'
                      }
                    }}
                  />
                ))}
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderScriptGeneration = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Generate Podcast Script
          </Typography>
          {!state.generatedScript && (
            <Button
              variant="contained"
              startIcon={<GenerateIcon />}
              onClick={handleGenerateScript}
              disabled={state.isGenerating || !state.sourceDocument}
            >
              {state.isGenerating ? 'Generating...' : 'Generate Script'}
            </Button>
          )}
        </Box>

        {state.isGenerating && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Generating NPR-style script using Claude AI...
            </Typography>
          </Box>
        )}

        {state.generatedScript && (
          <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
            <Typography variant="subtitle1" gutterBottom>
              Script Generated Successfully!
            </Typography>
            <Typography variant="body2">
              • {state.generatedScript.word_count} words
              • ~{Math.round(state.generatedScript.estimated_duration / 60)} minutes
              • {state.generatedScript.speaker_count} speakers
            </Typography>
          </Paper>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Generate Podcast
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create NPR-style podcasts from your source documents
          </Typography>
        </Box>
      </Box>

      {/* Error Alert */}
      {state.error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setState(prev => ({ ...prev, error: null }))}>
          {state.error}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Stack spacing={3}>
          {!state.sourceDocument && renderSourceSelection()}
          {state.sourceDocument && !state.generatedScript && (
            <>
              {renderConfiguration()}
              {renderScriptGeneration()}
            </>
          )}
            
          {state.generatedScript && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    Review Script
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={handleGenerateAudio}
                    disabled={state.isGenerating}
                  >
                    Generate Audio
                  </Button>
                </Box>
                
                <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                    {state.editedScript}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          )}

          {state.isGenerating && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Audio Generation
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Generating audio with ElevenLabs TTS...
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}

          {state.generatedMedia && !state.isGenerating && (
            <Card>
              <CardContent>
                <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Podcast Generated Successfully!
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<PlayIcon />}
                      onClick={handleViewMedia}
                    >
                      View Podcast
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ShareIcon />} 
                      onClick={() => navigate('/app/media')}
                    >
                      Go to Media Library
                    </Button>
                  </Box>
                </Paper>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default PodcastGenerationPage;