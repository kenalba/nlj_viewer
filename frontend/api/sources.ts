/**
 * Source library API client for Content Studio.
 * Handles document upload, management, and Claude integration.
 */

import { apiClient } from './client';

export interface SourceDocument {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  original_file_type: string;
  conversion_status: 'pending' | 'converting' | 'converted' | 'failed' | 'not_required';
  file_size: number;
  extracted_title?: string;
  extracted_author?: string;
  page_count?: number;
  description?: string;
  tags: string[];
  
  // AI-generated metadata
  summary?: string;
  keywords?: string[];
  learning_objectives?: string[];
  content_type_classification?: string;
  difficulty_level?: string;
  estimated_reading_time?: number;
  key_concepts?: string[];
  target_audience?: string;
  subject_matter_areas?: string[];
  actionable_items?: string[];
  assessment_opportunities?: string[];
  content_gaps?: string[];
  
  usage_count: number;
  last_used_at?: string;
  claude_file_id?: string;
  uploaded_to_claude_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  conversion_error?: string;
  user_id: string;
}

export interface SourceDocumentListResponse {
  items: SourceDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateSourceRequest {
  file: File;
  title?: string;
  description?: string;
  tags?: string;
  analyze?: boolean;
}

export interface UpdateSourceRequest {
  extracted_title?: string;
  description?: string;
  tags?: string[];
}

/**
 * Upload a new source document to the library.
 */
export const uploadSourceDocument = async (request: CreateSourceRequest): Promise<SourceDocument> => {
  const formData = new FormData();
  formData.append('file', request.file);
  
  if (request.title) {
    formData.append('title', request.title);
  }
  
  if (request.description) {
    formData.append('description', request.description);
  }
  
  if (request.tags) {
    formData.append('tags', request.tags);
  }
  
  if (request.analyze !== undefined) {
    formData.append('analyze', request.analyze.toString());
  }

  const response = await apiClient.post('/api/sources/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

/**
 * Get a paginated list of source documents.
 */
export const getSourceDocuments = async (params?: {
  limit?: number;
  offset?: number;
  search?: string;
  file_type?: string;
  conversion_status?: string;
  tags?: string[];
}): Promise<SourceDocumentListResponse> => {
  const response = await apiClient.get('/api/sources/', { params });
  return response.data;
};

/**
 * Get a specific source document by ID.
 */
export const getSourceDocument = async (id: string): Promise<SourceDocument> => {
  const response = await apiClient.get(`/api/sources/${id}`);
  return response.data;
};

/**
 * Update source document metadata.
 */
export const updateSourceDocument = async (
  id: string, 
  request: UpdateSourceRequest
): Promise<SourceDocument> => {
  const response = await apiClient.put(`/api/sources/${id}`, request);
  return response.data;
};

/**
 * Delete a source document.
 */
export const deleteSourceDocument = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/sources/${id}`);
};

/**
 * Upload document to Claude Files API.
 */
export const uploadToClaudeAPI = async (id: string): Promise<SourceDocument> => {
  const response = await apiClient.post(`/api/sources/${id}/upload-to-claude`);
  return response.data;
};

/**
 * Generate document summary using Claude.
 */
export const generateDocumentSummary = async (id: string): Promise<SourceDocument> => {
  const response = await apiClient.post(`/api/sources/${id}/generate-summary`);
  return response.data;
};

/**
 * Get documents that need Claude re-upload (expired or not uploaded).
 */
export const getDocumentsNeedingReupload = async (): Promise<SourceDocument[]> => {
  const response = await apiClient.get('/api/sources/needing-reupload');
  return response.data;
};