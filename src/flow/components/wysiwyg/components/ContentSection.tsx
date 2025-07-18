/**
 * ContentSection - Text content editing with markdown preview
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
} from '@mui/material';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';
import { InlineTextEditor } from '../editors/InlineTextEditor';

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
    <Stack spacing={3}>
      <Typography variant="h6" color="text.primary">
        Content
      </Typography>

      {/* Main Text Field */}
      {hasTextField && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {getTextLabel()}
          </Typography>
          
          <InlineTextEditor
            value={nljNode.text || ''}
            onUpdate={(value) => onUpdate({ text: value })}
            placeholder={`Enter ${getTextLabel().toLowerCase()}... (Markdown supported)`}
            variant="body1"
            multiline
            rows={4}
            sx={{ 
              p: 2,
              minHeight: 120,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              '&:hover': {
                borderColor: 'primary.main',
              },
              '& .MuiTypography-root': { 
                lineHeight: 1.6,
                fontSize: '1rem',
              } 
            }}
          />
          
        </Box>
      )}

      {/* Additional Content Field */}
      {hasContentField && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {getContentLabel()}
          </Typography>
          
          <InlineTextEditor
            value={nljNode.content || ''}
            onUpdate={(value) => onUpdate({ content: value })}
            placeholder={`Enter ${getContentLabel().toLowerCase()}... (Markdown supported)`}
            variant="body2"
            multiline
            rows={3}
            sx={{
              p: 2,
              minHeight: 80,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              '&:hover': {
                borderColor: 'primary.main',
              },
            }}
          />
          
        </Box>
      )}

      {/* Description Field */}
      {hasDescriptionField && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Description
          </Typography>
          
          <InlineTextEditor
            value={nljNode.description || ''}
            onUpdate={(value) => onUpdate({ description: value })}
            placeholder="Enter description for this node..."
            variant="body2"
            multiline
            rows={2}
          />
        </Box>
      )}

      {/* Show message if no content fields */}
      {!hasTextField && !hasContentField && !hasDescriptionField && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          This node type doesn't have editable content fields.
        </Typography>
      )}
    </Stack>
  );
};