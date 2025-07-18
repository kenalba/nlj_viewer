/**
 * NodeHeader - Header section of WYSIWYG editor with node type badge and title
 */

import React from 'react';
import {
  Box,
  Stack,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../types/flow';
// NODE_TYPE_INFO is now imported via getNodeTypeInfo utility
import { getNodeIcon, getNodeTypeInfo } from '../../../utils/nodeTypeUtils.tsx';

interface NodeHeaderProps {
  node: FlowNode;
  onClose: () => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const NodeHeader: React.FC<NodeHeaderProps> = ({
  node,
  onClose,
}) => {
  const nodeType = node.data.nodeType;
  const nodeTypeInfo = getNodeTypeInfo(nodeType as any);

  // Get node icon using shared utility
  const nodeIcon = getNodeIcon(nodeType as any);

  // Get node category color
  const getCategoryColor = () => {
    const category = nodeTypeInfo?.category || 'structure';
    switch (category) {
      case 'structure':
        return 'default';
      case 'question':
        return 'primary';
      case 'assessment':
        return 'success';
      case 'survey':
        return 'warning';
      case 'game':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        
        {/* Node Type Badge */}
        <Chip
          icon={nodeIcon}
          label={nodeTypeInfo?.label || nodeType}
          color={getCategoryColor()}
          size="small"
          variant="outlined"
          sx={{ 
            fontSize: '0.75rem',
            height: '24px',
            '& .MuiChip-icon': {
              fontSize: '0.875rem',
            },
          }}
        />

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Close Button */}
        <IconButton onClick={onClose} size="small" sx={{ p: 0.5 }}>
          <CloseIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Stack>

    </Box>
  );
};