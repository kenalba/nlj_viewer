/**
 * Media Detail Page
 * Detailed view of a media item with playback, transcript, and sharing
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Image as ImageIcon,
  Dashboard as InfographicIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Timer as TimerIcon,
  Visibility as ViewsIcon,
  Source as SourceIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { 
  getMediaItem,
  deleteMediaItem,
  createMediaShare,
  trackMediaPlay,
  getMediaDownloadUrl,
  formatDuration,
  formatFileSize,
  getMediaStateColor,
  type MediaItem,
  type MediaShareResponse
} from '../api/media';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { API_BASE_URL } from '../api/config';
import { apiClient } from '../api/client';

// Audio Player Component
const AudioPlayer: React.FC<{ media: MediaItem }> = ({ media }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch audio file with authentication
  React.useEffect(() => {
    const fetchAudio = async () => {
      try {
        console.log('🎵 Fetching audio for media ID:', media.id);
        setIsLoadingAudio(true);
        const response = await apiClient.get(`/api/media/${media.id}/download`, {
          responseType: 'blob'
        });
        
        console.log('📁 Audio response received:', {
          status: response.status,
          contentType: response.headers['content-type'],
          size: response.data.size
        });
        
        const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('🔗 Created blob URL:', audioUrl);
        setAudioUrl(audioUrl);
      } catch (error) {
        console.error('❌ Failed to load audio:', error);
      } finally {
        setIsLoadingAudio(false);
      }
    };

    fetchAudio();

    // Cleanup blob URL on unmount
    return () => {
      if (audioUrl) {
        console.log('🧹 Cleaning up blob URL:', audioUrl);
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [media.id]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  if (!media.file_path) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Audio file not available
        </Typography>
      </Paper>
    );
  }

  if (isLoadingAudio) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Loading audio...
        </Typography>
      </Paper>
    );
  }

  if (!audioUrl) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Failed to load audio
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <IconButton
          onClick={handlePlayPause}
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            {media.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* Progress bar */}
      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        onChange={handleSeek}
        style={{ width: '100%', marginTop: '8px' }}
      />
    </Paper>
  );
};

const MediaDetailPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Extract ID from URL path since we're not using proper route parameters
  const pathSegments = window.location.pathname.split('/');
  const mediaIndex = pathSegments.indexOf('media');
  const mediaId = mediaIndex !== -1 ? pathSegments[mediaIndex + 1] : null;
  
  // Debug logging
  console.log('MediaDetailPage rendered with ID:', mediaId);
  console.log('Current pathname:', window.location.pathname);
  console.log('Path segments:', pathSegments);
  
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);
  const [shareData, setShareData] = useState<MediaShareResponse | null>(null);

  // Fetch media item
  const { data: media, isLoading, error } = useQuery({
    queryKey: ['media', mediaId],
    queryFn: async () => {
      console.log('🔍 Fetching media item:', mediaId);
      try {
        const result = await getMediaItem(mediaId!);
        console.log('✅ Media item loaded:', result);
        return result;
      } catch (error) {
        console.error('❌ Failed to load media item:', error);
        throw error;
      }
    },
    enabled: !!mediaId,
    retry: 1,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMediaItem,
    onSuccess: () => {
      navigate('/app/media');
    },
    onError: (error) => {
      console.error('Failed to delete media:', error);
    },
  });

  // Share mutation
  const shareMutation = useMutation({
    mutationFn: createMediaShare,
    onSuccess: (data) => {
      setShareData(data);
    },
    onError: (error) => {
      console.error('Failed to create share:', error);
    },
  });

  const handleBack = () => {
    navigate('/app/media');
  };

  const handleDelete = () => {
    if (!media) return;
    
    if (window.confirm(`Are you sure you want to delete "${media.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(media.id);
    }
  };

  const handleShare = () => {
    if (media && media.media_state === 'completed') {
      shareMutation.mutate(media.id);
    }
  };

  const handleDownload = async () => {
    if (!media) return;
    
    try {
      const { download_url } = await getMediaDownloadUrl(media.id);
      window.open(download_url, '_blank');
    } catch (error) {
      console.error('Failed to download media:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'podcast':
      case 'audio_summary':
        return <AudioIcon />;
      case 'video':
        return <VideoIcon />;
      case 'image':
        return <ImageIcon />;
      case 'infographic':
        return <InfographicIcon />;
      default:
        return <AudioIcon />;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading media..." />;
  }

  if (error || (!isLoading && !media)) {
    console.error('📊 Media loading error details:', { error, isLoading, media, mediaId });
    return (
      <Box p={3}>
        <Alert severity="error">
          Failed to load media item. Please try again.
          {error && <br />}
          {error && <Typography variant="caption" component="div" sx={{ mt: 1 }}>
            Error: {error instanceof Error ? error.message : 'Unknown error'}
          </Typography>}
        </Alert>
        <Box mt={2}>
          <Button variant="outlined" onClick={handleBack}>
            Back to Media Library
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {media.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Media Details
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {media.media_state === 'completed' && (
            <>
              <Button
                variant="contained"
                startIcon={<ShareIcon />}
                onClick={handleShare}
                disabled={shareMutation.isPending}
              >
                {shareMutation.isPending ? 'Sharing...' : 'Share'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
              >
                Download
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </Stack>
      </Box>

      {/* Share Success Alert */}
      {shareData && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setShareData(null)}>
          <Typography variant="subtitle2" gutterBottom>
            Share Link Created!
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {shareData.share_url}
          </Typography>
        </Alert>
      )}

      {/* Media Info Card */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 56, height: 56 }}>
            {getMediaTypeIcon(media.media_type)}
          </Avatar>
          <Box>
            <Typography variant="h5">
              {media.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {media.media_type.toUpperCase()} • {media.file_size ? formatFileSize(media.file_size) : 'Processing...'}
            </Typography>
          </Box>
        </Box>

        {/* Status and Info */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            label={media.media_state}
            color={getMediaStateColor(media.media_state)}
            size="small"
          />
          {media.duration && (
            <Chip
              label={formatDuration(media.duration)}
              size="small"
              variant="outlined"
              icon={<TimerIcon />}
            />
          )}
          <Chip
            label={`${media.play_count} plays`}
            size="small"
            variant="outlined"
            icon={<ViewsIcon />}
          />
        </Box>

        {/* Description */}
        {media.description && (
          <Typography variant="body2" paragraph>
            {media.description}
          </Typography>
        )}

        {/* Generation Info */}
        {media.selected_keywords?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Focus Keywords
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {media.selected_keywords.map((keyword, index) => (
                <Chip key={index} label={keyword} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
      </Card>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Left Column - Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <Card sx={{ mb: 3 }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}
            >
              <Tab 
                icon={<PlayIcon />} 
                label="Player" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
              <Tab 
                icon={<EditIcon />} 
                label="Transcript" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
            </Tabs>
            
            <Box sx={{ p: 3 }}>
              {/* Player Tab */}
              {currentTab === 0 && (
                <Box>
                  {media.media_state === 'completed' ? (
                    <AudioPlayer media={media} />
                  ) : media.media_state === 'generating' ? (
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                      <CircularProgress sx={{ mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Generating Audio...
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        This may take a few minutes. The page will update automatically when complete.
                      </Typography>
                    </Paper>
                  ) : (
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="h6" gutterBottom>
                        Audio Not Available
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {media.media_state === 'failed' 
                          ? `Generation failed: ${media.generation_error || 'Unknown error'}`
                          : 'Audio file is not ready for playback'
                        }
                      </Typography>
                    </Paper>
                  )}
                </Box>
              )}

              {/* Transcript Tab */}
              {currentTab === 1 && (
                <Box>
                  {media.transcript ? (
                    <Paper sx={{ p: 2, maxHeight: 600, overflow: 'auto', bgcolor: 'grey.50' }}>
                      <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        {media.transcript}
                      </Typography>
                    </Paper>
                  ) : (
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body1" color="text.secondary">
                        No transcript available for this media item.
                      </Typography>
                    </Paper>
                  )}
                </Box>
              )}
            </Box>
          </Card>
        </Box>

        {/* Right Column - Metadata */}
        <Box sx={{ width: { xs: '100%', md: '350px' }, flexShrink: 0 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Media Information
            </Typography>
            
            <Stack spacing={2} divider={<Divider />}>
              {/* File Information */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  File Details
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Type:</Typography>
                    <Typography variant="body2">{media.media_type.toUpperCase()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Size:</Typography>
                    <Typography variant="body2">
                      {media.file_size ? formatFileSize(media.file_size) : 'Unknown'}
                    </Typography>
                  </Box>
                  {media.duration && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Duration:</Typography>
                      <Typography variant="body2">{formatDuration(media.duration)}</Typography>
                    </Box>
                  )}
                  {media.mime_type && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Format:</Typography>
                      <Typography variant="body2">{media.mime_type}</Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Generation Information */}
              {media.media_style && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Generation Details
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Style:</Typography>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {media.media_style.replace('_', ' ')}
                      </Typography>
                    </Box>
                    {media.generation_start_time && media.generation_end_time && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Generation Time:</Typography>
                        <Typography variant="body2">
                          {Math.round((new Date(media.generation_end_time).getTime() - new Date(media.generation_start_time).getTime()) / 1000)}s
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Usage Statistics */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Usage Statistics
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Play Count:</Typography>
                    <Typography variant="body2">{media.play_count}</Typography>
                  </Box>
                  {media.last_played_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Last Played:</Typography>
                      <Typography variant="body2">
                        {new Date(media.last_played_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Timestamps */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon fontSize="small" />
                  Timestamps
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Created:</Typography>
                    <Typography variant="body2">
                      {new Date(media.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Modified:</Typography>
                    <Typography variant="body2">
                      {new Date(media.updated_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default MediaDetailPage;