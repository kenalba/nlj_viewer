/**
 * Node Synchronization Utilities
 * Utilities for synchronizing nodes between activities and the node-first architecture
 */

import { Node } from '../services/nodeService';
import { NLJNode, NLJScenario } from '../types/nlj';

export interface NodeSyncResult {
  success: boolean;
  updatedNodes: Node[];
  errors: string[];
  warnings: string[];
}

export interface SyncStrategy {
  strategy: 'immediate' | 'lazy' | 'event-driven' | 'manual';
  conflictResolution: 'prefer-node' | 'prefer-activity' | 'merge' | 'ask-user';
  autoUpdate: boolean;
}

/**
 * Default sync strategy configuration
 */
export const DEFAULT_SYNC_STRATEGY: SyncStrategy = {
  strategy: 'lazy',
  conflictResolution: 'prefer-node',
  autoUpdate: true,
};

/**
 * Generate SHA-256 hash for node content to detect changes
 */
export const generateContentHash = async (content: Record<string, unknown>): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(content, Object.keys(content).sort()));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Extract metadata from node content for analysis
 */
export const extractNodeMetadata = (node: NLJNode): {
  title: string;
  description: string;
  difficulty: number;
  estimatedTime: number;
} => {
  let title = '';
  let description = '';
  let difficulty = 1;
  let estimatedTime = 30000; // Default 30 seconds

  // Extract title and description based on node type
  switch (node.type) {
    case 'true_false':
    case 'multiple_choice':
    case 'short_answer':
      title = (node as any).text?.slice(0, 50) || `${node.type} Question`;
      description = (node as any).text || '';
      break;
    
    case 'likert_scale':
      title = (node as any).text?.slice(0, 50) || 'Likert Scale Question';
      description = (node as any).text || '';
      // Estimate difficulty based on scale complexity
      const scaleRange = (node as any).scale?.max - (node as any).scale?.min || 5;
      difficulty = Math.min(Math.max(Math.ceil(scaleRange / 2), 1), 5);
      break;
    
    case 'rating':
      title = (node as any).text?.slice(0, 50) || 'Rating Question';
      description = (node as any).text || '';
      difficulty = 2;
      break;
    
    case 'matrix':
      title = (node as any).text?.slice(0, 50) || 'Matrix Question';
      description = (node as any).text || '';
      difficulty = Math.min(((node as any).rows?.length || 3) + ((node as any).columns?.length || 3), 8);
      estimatedTime = 60000; // Matrix questions take longer
      break;
    
    case 'slider':
      title = (node as any).text?.slice(0, 50) || 'Slider Question';
      description = (node as any).text || '';
      difficulty = 2;
      break;
    
    case 'text_area':
      title = (node as any).text?.slice(0, 50) || 'Text Response';
      description = (node as any).text || '';
      difficulty = 3;
      estimatedTime = 90000; // Text areas take longer
      break;
    
    case 'interstitial':
      title = (node as any).title || 'Information Panel';
      description = (node as any).text || (node as any).content || '';
      difficulty = 1;
      estimatedTime = 15000; // Quick read
      break;
    
    case 'connections':
      title = (node as any).title || 'Connections Game';
      description = 'Group words into categories';
      difficulty = 4;
      estimatedTime = 120000; // Games take longer
      break;
    
    case 'wordle':
      title = (node as any).title || 'Word Game';
      description = 'Guess the hidden word';
      difficulty = 3;
      estimatedTime = 180000; // Word games can take a while
      break;
    
    default:
      title = `${node.type.replace('_', ' ')} Node`;
      description = JSON.stringify(node).slice(0, 100);
  }

  return {
    title: title.trim(),
    description: description.trim(),
    difficulty: Math.max(1, Math.min(10, difficulty)),
    estimatedTime: Math.max(5000, Math.min(600000, estimatedTime)), // 5s to 10min
  };
};

/**
 * Compare two node versions to detect conflicts
 */
export const detectNodeConflicts = (nodeVersion: Node, activityVersion: NLJNode): {
  hasConflict: boolean;
  conflictTypes: string[];
  recommendations: string[];
} => {
  const conflicts: string[] = [];
  const recommendations: string[] = [];

  // Check content hash difference
  const extractedMeta = extractNodeMetadata(activityVersion);
  
  if (nodeVersion.title && extractedMeta.title && nodeVersion.title !== extractedMeta.title) {
    conflicts.push('title_mismatch');
    recommendations.push(`Title differs: Node "${nodeVersion.title}" vs Activity "${extractedMeta.title}"`);
  }

  if (nodeVersion.difficulty_level && extractedMeta.difficulty !== nodeVersion.difficulty_level) {
    conflicts.push('difficulty_mismatch');
    recommendations.push(`Difficulty differs: Node level ${nodeVersion.difficulty_level} vs Activity level ${extractedMeta.difficulty}`);
  }

  // Check for structural changes in content
  const nodeContent = JSON.stringify(nodeVersion.content, Object.keys(nodeVersion.content).sort());
  const activityContent = JSON.stringify(activityVersion, Object.keys(activityVersion).sort());
  
  if (nodeContent !== activityContent) {
    conflicts.push('content_structure_change');
    recommendations.push('Content structure has been modified in activity');
  }

  return {
    hasConflict: conflicts.length > 0,
    conflictTypes: conflicts,
    recommendations,
  };
};

/**
 * Resolve conflicts between node and activity versions
 */
export const resolveConflicts = (
  nodeVersion: Node,
  activityVersion: NLJNode,
  strategy: SyncStrategy['conflictResolution']
): {
  resolvedNode: Partial<Node>;
  resolutionActions: string[];
} => {
  const resolutionActions: string[] = [];
  let resolvedNode: Partial<Node> = { ...nodeVersion };

  const extractedMeta = extractNodeMetadata(activityVersion);
  const conflicts = detectNodeConflicts(nodeVersion, activityVersion);

  if (!conflicts.hasConflict) {
    return { resolvedNode, resolutionActions: ['no_conflicts'] };
  }

  switch (strategy) {
    case 'prefer-node':
      resolutionActions.push('keeping_node_version');
      // No changes needed, keep node version
      break;

    case 'prefer-activity':
      resolutionActions.push('updating_from_activity');
      resolvedNode = {
        ...nodeVersion,
        title: extractedMeta.title,
        difficulty_level: extractedMeta.difficulty,
        content: activityVersion as Record<string, unknown>,
      };
      break;

    case 'merge':
      resolutionActions.push('merging_versions');
      // Intelligent merge: prefer non-empty values
      resolvedNode = {
        ...nodeVersion,
        title: extractedMeta.title || nodeVersion.title,
        description: extractedMeta.description || nodeVersion.description,
        difficulty_level: extractedMeta.difficulty || nodeVersion.difficulty_level,
        // Always update content to match activity
        content: activityVersion as Record<string, unknown>,
      };
      break;

    case 'ask-user':
      resolutionActions.push('user_intervention_required');
      // Return current node, user will need to make decision
      break;
  }

  return { resolvedNode, resolutionActions };
};

/**
 * Validate node data integrity
 */
export const validateNodeIntegrity = (node: Partial<Node>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!node.node_type) {
    errors.push('Node type is required');
  }

  if (!node.content) {
    errors.push('Node content is required');
  } else if (typeof node.content !== 'object') {
    errors.push('Node content must be an object');
  }

  // Optional field validation
  if (node.difficulty_level && (node.difficulty_level < 1 || node.difficulty_level > 10)) {
    warnings.push('Difficulty level should be between 1 and 10');
  }

  if (node.success_rate && (node.success_rate < 0 || node.success_rate > 1)) {
    errors.push('Success rate must be between 0 and 1');
  }

  if (node.title && node.title.length > 255) {
    warnings.push('Title is very long, consider shortening');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Batch synchronize multiple nodes from a scenario
 */
export const batchSyncNodes = async (
  scenario: NLJScenario,
  existingNodes: Node[],
  strategy: SyncStrategy = DEFAULT_SYNC_STRATEGY
): Promise<NodeSyncResult> => {
  const updatedNodes: Node[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    for (const activityNode of scenario.nodes) {
      // Find existing node by content hash or ID
      const existingNode = existingNodes.find(node => 
        node.id === activityNode.id || 
        node.content_hash === await generateContentHash(activityNode as Record<string, unknown>)
      );

      if (existingNode) {
        // Update existing node
        const conflicts = detectNodeConflicts(existingNode, activityNode);
        
        if (conflicts.hasConflict) {
          const { resolvedNode, resolutionActions } = resolveConflicts(
            existingNode, 
            activityNode, 
            strategy.conflictResolution
          );

          // Validate resolved node
          const validation = validateNodeIntegrity(resolvedNode);
          
          if (!validation.isValid) {
            errors.push(`Node ${activityNode.id}: ${validation.errors.join(', ')}`);
            continue;
          }

          warnings.push(...validation.warnings.map(w => `Node ${activityNode.id}: ${w}`));
          warnings.push(`Node ${activityNode.id}: ${resolutionActions.join(', ')}`);

          updatedNodes.push(resolvedNode as Node);
        } else {
          // No conflicts, keep existing
          updatedNodes.push(existingNode);
        }
      } else {
        // Create new node from activity data
        const extractedMeta = extractNodeMetadata(activityNode);
        const contentHash = await generateContentHash(activityNode as Record<string, unknown>);

        const newNode: Partial<Node> = {
          id: activityNode.id,
          node_type: activityNode.type,
          content: activityNode as Record<string, unknown>,
          content_hash: contentHash,
          title: extractedMeta.title,
          description: extractedMeta.description,
          difficulty_level: extractedMeta.difficulty,
          base_language: 'en-US',
          // Performance metrics will be populated by analytics
          avg_completion_time: extractedMeta.estimatedTime,
          success_rate: null,
          difficulty_score: null,
          engagement_score: null,
        };

        const validation = validateNodeIntegrity(newNode);
        
        if (!validation.isValid) {
          errors.push(`New node ${activityNode.id}: ${validation.errors.join(', ')}`);
          continue;
        }

        warnings.push(...validation.warnings.map(w => `New node ${activityNode.id}: ${w}`));
        updatedNodes.push(newNode as Node);
      }
    }

    return {
      success: errors.length === 0,
      updatedNodes,
      errors,
      warnings,
    };

  } catch (error) {
    return {
      success: false,
      updatedNodes: [],
      errors: [error instanceof Error ? error.message : 'Unknown error during sync'],
      warnings,
    };
  }
};

/**
 * Create sync report for user review
 */
export const generateSyncReport = (syncResult: NodeSyncResult): {
  summary: string;
  details: string[];
  recommendations: string[];
} => {
  const { success, updatedNodes, errors, warnings } = syncResult;

  const summary = success
    ? `Successfully synchronized ${updatedNodes.length} nodes`
    : `Synchronization failed with ${errors.length} errors`;

  const details = [
    `Nodes processed: ${updatedNodes.length}`,
    `Errors: ${errors.length}`,
    `Warnings: ${warnings.length}`,
    ...errors.map(e => `❌ ${e}`),
    ...warnings.map(w => `⚠️ ${w}`),
  ];

  const recommendations = [];
  
  if (errors.length > 0) {
    recommendations.push('Review and fix errors before proceeding');
  }
  
  if (warnings.length > 0) {
    recommendations.push('Consider addressing warnings for better data quality');
  }
  
  if (success && updatedNodes.length > 0) {
    recommendations.push('Sync completed successfully - consider running analytics refresh');
  }

  return { summary, details, recommendations };
};

export default {
  generateContentHash,
  extractNodeMetadata,
  detectNodeConflicts,
  resolveConflicts,
  validateNodeIntegrity,
  batchSyncNodes,
  generateSyncReport,
  DEFAULT_SYNC_STRATEGY,
};