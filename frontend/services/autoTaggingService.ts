/**
 * Auto-Tagging Service
 * 
 * Client service for intelligent content tagging and analysis.
 * Integrates with NodeAutoTaggerService and ConceptAnalyzer backend APIs.
 */

import { getApiClient } from '../client/api';

export interface TagSuggestion {
  id: string;
  text: string;
  confidence: number;
  reasoning?: string;
  category?: string;
  domain?: string;
}

export interface ContentAnalysisResult {
  suggestedKeywords: TagSuggestion[];
  suggestedObjectives: TagSuggestion[];
  analysisInsights?: {
    contentComplexity: 'low' | 'medium' | 'high';
    taggabilityScore: number;
    recommendedStrategy: 'conservative' | 'balanced' | 'comprehensive';
    suggestedFocus?: string;
    confidenceAdjustment: number;
  };
  performanceContext?: {
    averageSuccessRate?: number;
    recommendedDifficulty?: number;
    similarContentCount?: number;
  };
}

export interface ContentAnalysisOptions {
  existingKeywords?: string[];
  existingObjectives?: string[];
  strategy?: 'conservative' | 'balanced' | 'comprehensive';
  includePerformanceContext?: boolean;
  confidenceThreshold?: number;
}

export interface AutoTaggingRequest {
  strategy?: 'CONSERVATIVE' | 'BALANCED' | 'COMPREHENSIVE';
  force_retag?: boolean;
}

export interface BatchAutoTaggingRequest {
  node_ids: string[];
  strategy?: 'CONSERVATIVE' | 'BALANCED' | 'COMPREHENSIVE';
  force_retag?: boolean;
}

export interface NodeTagSummary {
  node_id: string;
  node_type: string;
  title?: string;
  current_tags: {
    objectives: Array<{
      id: string;
      text: string;
      relevance_score: number;
      auto_tagged: boolean;
      tagged_at: string;
    }>;
    keywords: Array<{
      id: string;
      text: string;
      relevance_score: number;
      auto_tagged: boolean;
      tagged_at: string;
    }>;
    total_count: number;
  };
  auto_tag_suggestions: {
    available: boolean;
    recommended_objectives?: TagSuggestion[];
    recommended_keywords?: TagSuggestion[];
    confidence_threshold?: number;
    suggestion_count?: number;
    error?: string;
  };
  quality_assessment: {
    complexity_level: string;
    taggability_score: number;
    recommended_strategy: string;
    suggested_focus: string;
    confidence_adjustment: number;
  };
  last_tagged?: string;
}

export interface TaggingCandidates {
  candidates: Array<{
    node_id: string;
    node_type: string;
    content_length: number;
    estimated_taggability: number;
    last_activity?: string;
  }>;
  total_untagged: number;
  recommended_batch_size: number;
}

/**
 * Analyze document content for intelligent tag suggestions.
 * This simulates analysis by extracting content from source documents.
 */
export const analyzeDocumentContent = async (
  documentIds: string[],
  options: ContentAnalysisOptions = {}
): Promise<ContentAnalysisResult> => {
  try {
    const api = getApiClient();
    
    // For content generation context, we'll simulate analysis based on document content
    // In a real implementation, this would call a dedicated content analysis endpoint
    
    // Get document content
    const documents = await Promise.all(
      documentIds.map(id => api.get(`/api/sources/${id}`))
    );
    
    // Simulate content analysis (in production, this would be a backend API call)
    const combinedContent = documents.map(doc => 
      `${doc.data.title || ''} ${doc.data.summary || ''} ${doc.data.description || ''}`
    ).join(' ');
    
    // Mock analysis result with realistic suggestions
    // This would be replaced with actual backend analysis
    const mockAnalysis = simulateContentAnalysis(combinedContent, options);
    
    return mockAnalysis;
    
  } catch (error) {
    console.error('Document content analysis failed:', error);
    throw new Error(`Failed to analyze document content: ${error}`);
  }
};

/**
 * Get auto-tagging suggestions for a specific node.
 */
export const getNodeTagSuggestions = async (
  nodeId: string,
  includeSuggestions = true
): Promise<NodeTagSummary> => {
  try {
    const api = getApiClient();
    const response = await api.get(`/api/nodes/${nodeId}/tag-summary`, {
      params: { include_suggestions: includeSuggestions }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get node tag suggestions:', error);
    throw error;
  }
};

/**
 * Trigger auto-tagging for a single node.
 */
export const triggerNodeAutoTagging = async (
  nodeId: string,
  request: AutoTaggingRequest = {}
): Promise<{ message: string; tagging_id: string; status_endpoint: string }> => {
  try {
    const api = getApiClient();
    const response = await api.post(`/api/nodes/${nodeId}/auto-tag`, request);
    return response.data;
  } catch (error) {
    console.error('Failed to trigger auto-tagging:', error);
    throw error;
  }
};

/**
 * Trigger batch auto-tagging for multiple nodes.
 */
export const triggerBatchAutoTagging = async (
  request: BatchAutoTaggingRequest
): Promise<{ message: string; batch_id: string; status_endpoint: string }> => {
  try {
    const api = getApiClient();
    const response = await api.post('/api/nodes/batch/auto-tag', request);
    return response.data;
  } catch (error) {
    console.error('Failed to trigger batch auto-tagging:', error);
    throw error;
  }
};

/**
 * Get nodes that are good candidates for auto-tagging.
 */
export const getTaggingCandidates = async (
  limit = 50,
  options: {
    min_content_length?: number;
    exclude_recently_tagged?: boolean;
  } = {}
): Promise<TaggingCandidates> => {
  try {
    const api = getApiClient();
    const response = await api.get('/api/nodes/tagging-candidates', {
      params: {
        limit,
        ...options
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get tagging candidates:', error);
    throw error;
  }
};

/**
 * Approve auto-tag suggestions and apply them to a node.
 */
export const approveSuggestions = async (
  nodeId: string,
  request: {
    approved_objectives: Array<{ entity_id: string; confidence: number }>;
    approved_keywords: Array<{ entity_id: string; confidence: number }>;
    rejected_items: string[];
  }
): Promise<{ message: string; applied_count: number }> => {
  try {
    const api = getApiClient();
    const response = await api.post(`/api/nodes/${nodeId}/approve-suggestions`, request);
    return response.data;
  } catch (error) {
    console.error('Failed to approve suggestions:', error);
    throw error;
  }
};

/**
 * Extract keywords and objectives from generated content.
 * Used during content generation to provide intelligent suggestions.
 */
export const extractTagsFromContent = async (
  content: string,
  options: {
    contentType?: string;
    existingTags?: { keywords: string[]; objectives: string[] };
    strategy?: 'conservative' | 'balanced' | 'comprehensive';
  } = {}
): Promise<ContentAnalysisResult> => {
  // In production, this would call a dedicated content analysis endpoint
  // For now, we'll simulate tag extraction from generated content
  return simulateContentAnalysis(content, {
    existingKeywords: options.existingTags?.keywords,
    existingObjectives: options.existingTags?.objectives,
    strategy: options.strategy
  });
};

/**
 * Simulate content analysis for development.
 * This would be replaced with actual LLM-based analysis in production.
 */
const simulateContentAnalysis = (
  content: string,
  options: ContentAnalysisOptions
): ContentAnalysisResult => {
  // Basic content analysis simulation
  const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const wordFreq = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Common domain-specific terms for suggestions
  const domainKeywords = {
    automotive: ['brakes', 'engine', 'safety', 'maintenance', 'vehicle', 'tire', 'transmission'],
    sales: ['objection', 'closing', 'rapport', 'negotiation', 'customer', 'value', 'pitch'],
    technical: ['system', 'process', 'documentation', 'troubleshooting', 'configuration'],
    training: ['learning', 'skill', 'knowledge', 'competency', 'assessment', 'development']
  };

  const domainObjectives = {
    automotive: [
      'Understand automotive safety systems',
      'Demonstrate proper maintenance procedures',
      'Identify common vehicle issues',
      'Apply troubleshooting methodologies'
    ],
    sales: [
      'Handle customer objections effectively',
      'Build rapport with potential customers',
      'Present value propositions clearly',
      'Close sales using proven techniques'
    ],
    technical: [
      'Configure system settings correctly',
      'Document processes thoroughly',
      'Troubleshoot technical issues',
      'Follow established procedures'
    ],
    training: [
      'Apply learning principles effectively',
      'Assess knowledge and skills',
      'Develop competency in key areas',
      'Transfer knowledge to practice'
    ]
  };

  // Detect likely domain
  let primaryDomain = 'technical';
  let maxDomainScore = 0;
  
  Object.entries(domainKeywords).forEach(([domain, keywords]) => {
    const score = keywords.reduce((sum, keyword) => 
      sum + (wordFreq[keyword] || 0), 0
    );
    if (score > maxDomainScore) {
      maxDomainScore = score;
      primaryDomain = domain;
    }
  });

  // Generate keyword suggestions
  const suggestedKeywords: TagSuggestion[] = [];
  const existingKeywords = new Set((options.existingKeywords || []).map(k => k.toLowerCase()));
  
  domainKeywords[primaryDomain].forEach((keyword, index) => {
    if (!existingKeywords.has(keyword) && (wordFreq[keyword] || 0) > 0) {
      const frequency = wordFreq[keyword] || 0;
      const confidence = Math.min(0.95, 0.6 + (frequency * 0.1) + (Math.random() * 0.2));
      
      suggestedKeywords.push({
        id: `kw-${keyword}-${index}`,
        text: keyword,
        confidence,
        category: primaryDomain,
        reasoning: `Found ${frequency} occurrence${frequency !== 1 ? 's' : ''} in content`
      });
    }
  });

  // Generate objective suggestions
  const suggestedObjectives: TagSuggestion[] = [];
  const existingObjectives = new Set((options.existingObjectives || []).map(o => o.toLowerCase()));
  
  domainObjectives[primaryDomain].forEach((objective, index) => {
    if (!existingObjectives.has(objective.toLowerCase())) {
      const relevantKeywords = domainKeywords[primaryDomain].filter(kw => 
        objective.toLowerCase().includes(kw) || (wordFreq[kw] || 0) > 0
      );
      
      if (relevantKeywords.length > 0) {
        const confidence = Math.min(0.9, 0.5 + (relevantKeywords.length * 0.1) + (Math.random() * 0.25));
        
        suggestedObjectives.push({
          id: `obj-${index}`,
          text: objective,
          confidence,
          domain: primaryDomain,
          reasoning: `Related to ${relevantKeywords.length} key concept${relevantKeywords.length !== 1 ? 's' : ''}`
        });
      }
    }
  });

  // Sort by confidence
  suggestedKeywords.sort((a, b) => b.confidence - a.confidence);
  suggestedObjectives.sort((a, b) => b.confidence - a.confidence);

  // Limit suggestions based on strategy
  const strategy = options.strategy || 'balanced';
  const limits = {
    conservative: { keywords: 3, objectives: 2 },
    balanced: { keywords: 5, objectives: 3 },
    comprehensive: { keywords: 8, objectives: 5 }
  };

  return {
    suggestedKeywords: suggestedKeywords.slice(0, limits[strategy].keywords),
    suggestedObjectives: suggestedObjectives.slice(0, limits[strategy].objectives),
    analysisInsights: {
      contentComplexity: content.length > 500 ? 'high' : content.length > 200 ? 'medium' : 'low',
      taggabilityScore: Math.min(1.0, Math.max(0.3, (suggestedKeywords.length + suggestedObjectives.length) / 10)),
      recommendedStrategy: strategy,
      suggestedFocus: primaryDomain,
      confidenceAdjustment: 1.0
    },
    performanceContext: {
      averageSuccessRate: 0.72 + (Math.random() * 0.15), // Mock performance data
      recommendedDifficulty: Math.floor(Math.random() * 5) + 3, // 3-7 range
      similarContentCount: Math.floor(Math.random() * 20) + 5
    }
  };
};