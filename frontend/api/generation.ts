/**
 * Content generation API client for Content Studio.
 * Handles integrated AI content generation with document context.
 */

import { apiClient } from './client';

export interface PromptConfiguration {
  audience_persona: string;
  learning_objective: string;
  content_style: 'conversational' | 'formal' | 'gamified' | 'scenario_based';
  complexity_level: number;
  scenario_length: number;
  include_variables: boolean;
  include_branching: boolean;  
  node_types_enabled: Record<string, string[]>;
  custom_instructions?: string;
}

export interface GenerateContentRequest {
  source_document_ids: string[];
  prompt_config: PromptConfiguration;
  generated_prompt?: string;
  activity_name?: string;
  activity_description?: string;
}

export interface GenerationProgressResponse {
  session_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage?: number;
  current_step?: string;
  error_message?: string;
  generated_content?: Record<string, unknown>;
}

/**
 * Start content generation using Content Studio workflow
 */
export const generateContent = async (request: GenerateContentRequest): Promise<GenerationProgressResponse> => {
  console.log('🚀 Starting content generation with request:', {
    document_count: request.source_document_ids.length,
    activity_name: request.activity_name,
    config: request.prompt_config
  });
  
  const response = await apiClient.post('/api/generation/content-studio/generate', request);
  console.log('✅ Generation started successfully:', response.data);
  return response.data;
};

/**
 * Get generation status for polling
 */
export const getGenerationStatus = async (sessionId: string): Promise<GenerationProgressResponse> => {
  const response = await apiClient.get(`/api/generation/content-studio/sessions/${sessionId}/status`);
  console.log(`📊 Polling status for session ${sessionId.substring(0, 8)}...`, {
    status: response.data.status,
    progress: response.data.progress_percentage,
    step: response.data.current_step
  });
  return response.data;
};

/**
 * Poll generation status until completion
 */
export const pollGenerationStatus = async (
  sessionId: string,
  onProgress?: (progress: GenerationProgressResponse) => void,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<GenerationProgressResponse> => {
  let attempts = 0;
  const sessionIdShort = sessionId.substring(0, 8);
  
  console.log(`🔄 Starting polling for session ${sessionIdShort} (max ${maxAttempts} attempts, ${intervalMs}ms interval)`);
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        console.log(`🔍 Poll attempt ${attempts + 1}/${maxAttempts} for session ${sessionIdShort}`);
        const status = await getGenerationStatus(sessionId);
        
        if (onProgress) {
          onProgress(status);
        }
        
        if (status.status === 'completed') {
          console.log(`✅ Generation completed for session ${sessionIdShort}`);
          resolve(status);
          return;
        }
        
        if (status.status === 'failed') {
          console.error(`❌ Generation failed for session ${sessionIdShort}:`, status.error_message);
          reject(new Error(status.error_message || 'Generation failed'));
          return;
        }
        
        if (status.status === 'cancelled') {
          console.warn(`⚠️ Generation cancelled for session ${sessionIdShort}`);
          reject(new Error('Generation was cancelled'));
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`⏰ Generation timeout for session ${sessionIdShort} after ${attempts} attempts`);
          reject(new Error('Generation timeout - maximum polling attempts reached'));
          return;
        }
        
        // Continue polling
        console.log(`⏳ Continuing poll for session ${sessionIdShort}, next attempt in ${intervalMs}ms...`);
        setTimeout(poll, intervalMs);
        
      } catch (error) {
        console.error(`💥 Polling error for session ${sessionIdShort}:`, error);
        reject(error);
      }
    };
    
    // Start polling
    poll();
  });
};