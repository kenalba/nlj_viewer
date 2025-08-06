/**
 * Media API client functions for podcast and media generation.
 */

import { apiClient } from './client';

export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  media_type: string;
  media_state: string;
  duration?: number;
  file_size?: number;
  mime_type?: string;
  transcript?: string;
  file_path?: string;
  source_document_id: string;
  media_style?: string;
  selected_keywords: string[];
  selected_objectives: string[];
  play_count: number;
  last_played_at?: string;
  is_public: boolean;
  generation_start_time?: string;
  generation_end_time?: string;
  generation_error?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  generation_config?: Record<string, any>;
  voice_config?: Record<string, any>;
}

export interface MediaGenerationRequest {
  source_document_id: string;
  media_type?: string;
  media_style?: string;
  selected_keywords?: string[];
  selected_objectives?: string[];
  generation_config?: Record<string, any>;
  voice_config?: Record<string, any>;
}

export interface PodcastScriptRequest {
  source_document_id: string;
  selected_keywords?: string[];
  selected_objectives?: string[];
  style?: string;
  length_preference?: string;
  conversation_depth?: string;
}

export interface PodcastScriptResponse {
  script: string;
  estimated_duration: number;
  word_count: number;
  speaker_count: number;
  key_topics: string[];
  source_attribution: string;
}

export interface VoiceOption {
  voice_id: string;
  name: string;
  gender: string;
  language: string;
  style: string;
  preview_url?: string;
}

export interface MediaListResponse {
  items: MediaItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface MediaShareResponse {
  share_token: string;
  share_url: string;
  qr_code_url?: string;
  expires_at?: string;
}

export interface MediaGenerationStatus {
  media_id: string;
  status: string;
  progress?: number;
  message?: string;
  error?: string;
  estimated_completion?: string;
}

/**
 * Generate a podcast from a source document
 */
export const generatePodcast = async (request: MediaGenerationRequest): Promise<MediaItem> => {
  const response = await apiClient.post<MediaItem>('/api/media/generate-podcast', request);
  return response.data;
};

/**
 * Generate a podcast script without audio (for preview/editing)
 */
export const generatePodcastScript = async (request: PodcastScriptRequest): Promise<PodcastScriptResponse> => {
  const response = await apiClient.post<PodcastScriptResponse>('/api/media/generate-script', request, {
    timeout: 120000 // 2 minutes timeout for script generation
  });
  return response.data;
};

/**
 * Get available TTS voices
 */
export const getAvailableVoices = async (): Promise<VoiceOption[]> => {
  const response = await apiClient.get<VoiceOption[]>('/api/media/voices');
  return response.data;
};

/**
 * Get user's media items with filtering
 */
export const getMediaItems = async (params?: {
  search?: string;
  media_type?: string;
  media_state?: string;
  source_document_id?: string;
  limit?: number;
  offset?: number;
}): Promise<MediaListResponse> => {
  const response = await apiClient.get<MediaListResponse>('/api/media', { params });
  return response.data;
};

/**
 * Get a specific media item by ID
 */
export const getMediaItem = async (mediaId: string): Promise<MediaItem> => {
  const response = await apiClient.get<MediaItem>(`/api/media/${mediaId}`);
  return response.data;
};

/**
 * Update media item metadata
 */
export const updateMediaItem = async (
  mediaId: string, 
  updates: { title?: string; description?: string; is_public?: boolean }
): Promise<MediaItem> => {
  const response = await apiClient.put<MediaItem>(`/api/media/${mediaId}`, updates);
  return response.data;
};

/**
 * Update media transcript
 */
export const updateMediaTranscript = async (mediaId: string, transcript: string): Promise<MediaItem> => {
  const response = await apiClient.put<MediaItem>(`/api/media/${mediaId}/transcript`, { transcript });
  return response.data;
};

/**
 * Delete a media item
 */
export const deleteMediaItem = async (mediaId: string): Promise<void> => {
  await apiClient.delete(`/api/media/${mediaId}`);
};

/**
 * Create a public share for a media item
 */
export const createMediaShare = async (mediaId: string): Promise<MediaShareResponse> => {
  const response = await apiClient.post<MediaShareResponse>(`/api/media/${mediaId}/share`);
  return response.data;
};

/**
 * Get generation status of a media item
 */
export const getGenerationStatus = async (mediaId: string): Promise<MediaGenerationStatus> => {
  const response = await apiClient.get<MediaGenerationStatus>(`/api/media/${mediaId}/status`);
  return response.data;
};

/**
 * Track media play event
 */
export const trackMediaPlay = async (
  mediaId: string, 
  playData: { play_duration?: number; completed?: boolean }
): Promise<void> => {
  await apiClient.post(`/api/media/${mediaId}/play`, playData);
};

/**
 * Get download URL for media file
 */
export const getMediaDownloadUrl = async (mediaId: string): Promise<{ download_url: string }> => {
  const response = await apiClient.get<{ download_url: string }>(`/api/media/${mediaId}/download`);
  return response.data;
};

/**
 * Helper function to format duration
 */
export const formatDuration = (seconds?: number): string => {
  if (!seconds) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Helper function to format file size
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
};

/**
 * Helper function to get media state color
 */
export const getMediaStateColor = (state: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (state) {
    case 'completed':
      return 'success';
    case 'generating':
      return 'info';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Helper function to check if media is audio
 */
export const isAudioMedia = (mediaType: string): boolean => {
  return ['podcast', 'audio_summary'].includes(mediaType);
};

/**
 * Helper function to check if media is video
 */
export const isVideoMedia = (mediaType: string): boolean => {
  return mediaType === 'video';
};

/**
 * Helper function to get media type icon name
 */
export const getMediaTypeIcon = (mediaType: string): string => {
  switch (mediaType) {
    case 'podcast':
    case 'audio_summary':
      return 'AudioFile';
    case 'video':
      return 'VideoFile';
    case 'image':
      return 'Image';
    case 'infographic':
      return 'Dashboard';
    default:
      return 'InsertDriveFile';
  }
};