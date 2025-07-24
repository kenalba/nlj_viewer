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

  // Check if node has different content fields
  const hasTextField = 'text' in nljNode;
  const hasContentField = 'content' in nljNode;
  const hasDescriptionField = 'description' in nljNode;

  // Get appropriate labels for different node types
  const getTextLabel = () => {
    switch (nodeType) {
      case 'question':
      case 'true_false':
      case 'short_answer':
      case 'likert_scale':
      case 'rating':
      case 'matrix':
      case 'slider':
      case 'text_area':
        return 'Question Text';
      case 'interstitial_panel':
        return 'Panel Content';
      case 'connections':
      case 'wordle':
        return 'Game Instructions';
      default:
        return 'Content';
    }
  };

  const getContentLabel = () => {
    switch (nodeType) {
      case 'question':
      case 'true_false':
      case 'short_answer':
        return 'Additional Information';
      case 'interstitial_panel':
        return 'Additional Content';
      default:
        return 'Additional Content';
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
        Content
      </Typography>

      {/* Node Title Field */}
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

      {/* Main Text Field */}
      {hasTextField && (
        <Box>
          <RichTextEditor
            value={nljNode.text || ''}
            onUpdate={(value) => onUpdate({ text: value })}
            placeholder={`Enter ${getTextLabel().toLowerCase()}... (Markdown supported)`}
            minHeight={100}
            showToolbar={true}
            autoFocus={false}
          />
        </Box>
      )}

      {/* Additional Content Field */}
      {hasContentField && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
            {getContentLabel()}
          </Typography>
          
          <RichTextEditor
            value={nljNode.content || ''}
            onUpdate={(value) => onUpdate({ content: value })}
            placeholder={`Enter ${getContentLabel().toLowerCase()}... (Markdown supported)`}
            minHeight={70}
            showToolbar={true}
            autoFocus={false}
          />
          
        </Box>
      )}

      {/* Description Field */}
      {hasDescriptionField && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
            Description
          </Typography>
          
          <RichTextEditor
            value={nljNode.description || ''}
            onUpdate={(value) => onUpdate({ description: value })}
            placeholder="Enter description for this node..."
            minHeight={50}
            showToolbar={false}
            autoFocus={false}
          />
        </Box>
      )}

      {/* Show message if no content fields */}
      {!hasTextField && !hasContentField && !hasDescriptionField && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}>
          This node type doesn't have editable content fields.
        </Typography>
      )}
    </Stack>
  );
};