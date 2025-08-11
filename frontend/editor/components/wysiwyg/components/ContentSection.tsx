/**
 * ContentSection - Text content editing with markdown preview
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
} from '@mui/material';

import type { FlowNode } from '../../../flow/types/flow';
import type { NLJNode } from '../../../../../types/nlj';
import { RichTextEditor } from '../../editors/RichTextEditor';

interface ContentSectionProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode;
  const nodeType = node.data.nodeType;

  // Handle legacy text/content field consolidation
  const hasLegacyTextField = 'text' in nljNode && nljNode.text && nljNode.text.trim() !== '';
  const hasContentField = 'content' in nljNode;
  
  // Consolidate legacy text into content if both exist
  React.useEffect(() => {
    if (hasLegacyTextField && nljNode.text && nljNode.text.trim() !== '') {
      const consolidatedContent = [nljNode.content, nljNode.text]
        .filter(content => content && content.trim() !== '')
        .join('\n\n');
      
      if (consolidatedContent !== nljNode.content) {
        onUpdate({ 
          content: consolidatedContent,
          text: undefined // Clear the legacy text field
        });
      }
    }
  }, [hasLegacyTextField, nljNode.text, nljNode.content, onUpdate]);

  // Get appropriate labels for different node types
  const getContentLabel = () => {
    switch (nodeType) {
      case 'question':
      case 'true_false':
      case 'short_answer':
      case 'likert_scale':
      case 'rating':
      case 'matrix':
      case 'slider':
      case 'text_area':
        return 'Question Content';
      case 'interstitial_panel':
        return 'Panel Content';
      case 'connections':
      case 'wordle':
        return 'Game Instructions';
      default:
        return 'Content';
    }
  };

  return (
    <Stack spacing={2}>

      {/* Node Title Field - Skip for choice nodes */}
      {nodeType !== 'choice' && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
            Node Title
          </Typography>
          
          <RichTextEditor
            value={nljNode.title || ''}
            onUpdate={(value) => onUpdate({ title: value })}
            placeholder="Enter node title..."
            minHeight={40}
            showToolbar={false}
            autoFocus={false}
          />
        </Box>
      )}

      {/* Main Content Field */}
      <Box>
        <RichTextEditor
          value={nljNode.content || ''}
          onUpdate={(value) => onUpdate({ content: value })}
          placeholder={`Enter ${getContentLabel().toLowerCase()}... (Markdown supported)`}
          minHeight={100}
          showToolbar={true}
          autoFocus={false}
        />
      </Box>

    </Stack>
  );
};