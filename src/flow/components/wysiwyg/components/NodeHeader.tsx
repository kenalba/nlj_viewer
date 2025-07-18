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
  Quiz as QuizIcon,
  Info as InfoIcon,
  Games as GameIcon,
  Poll as PollIcon,
  Assessment as AssessmentIcon,
  PlayArrow as StartIcon,
  Flag as EndIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../types/flow';
import { NODE_TYPE_INFO } from '../../../utils/flowUtils';

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
  const nodeTypeInfo = NODE_TYPE_INFO[nodeType];

  // Get node icon
  const getNodeIcon = () => {
    switch (nodeType) {
      case 'start':
        return <StartIcon />;
      case 'end':
        return <EndIcon />;
      case 'question':
      case 'true_false':
      case 'ordering':
      case 'matching':
      case 'short_answer':
      case 'multi_select':
      case 'checkbox':
        return <QuizIcon />;
      case 'interstitial_panel':
        return <InfoIcon />;
      case 'likert_scale':
      case 'rating':
      case 'matrix':
      case 'slider':
      case 'text_area':
        return <PollIcon />;
      case 'connections':
      case 'wordle':
        return <GameIcon />;
      default:
        return <AssessmentIcon />;
    }
  };

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
          icon={getNodeIcon()}
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