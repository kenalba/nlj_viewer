/**
 * NodeHeader - Header section of WYSIWYG editor with node type badge and title
 */

import React from 'react';
import {
  Box,
  Stack,
  Chip,
  IconButton,
  Alert,
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
import type { NLJNode } from '../../../../types/nlj';
import { NODE_TYPE_INFO } from '../../../utils/flowUtils';
import { InlineTextEditor } from '../editors/InlineTextEditor';

interface NodeHeaderProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  onClose: () => void;
  hasChanges: boolean;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const NodeHeader: React.FC<NodeHeaderProps> = ({
  node,
  onUpdate,
  onClose,
  hasChanges,
}) => {
  const nodeType = node.data.nodeType;
  const nljNode = node.data.nljNode;
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
    <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        
        {/* Node Type Badge */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Chip
            icon={getNodeIcon()}
            label={nodeTypeInfo?.label || nodeType}
            color={getCategoryColor()}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Close Button */}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Stack>

      {/* Node Title Editor */}
      <Box sx={{ mt: 1.5 }}>
        <InlineTextEditor
          value={nljNode.title || ''}
          onUpdate={(value) => onUpdate({ title: value })}
          placeholder="Enter node title..."
          variant="h6"
          sx={{ fontWeight: 'medium' }}
        />
      </Box>

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You have unsaved changes
        </Alert>
      )}
    </Box>
  );
};