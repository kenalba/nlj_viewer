/**
 * FeedbackSection - Feedback display and editing
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Alert,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../flow/types/flow';
import type { NLJNode } from '../../../../../types/nlj';
import { InlineTextEditor } from '../../editors/InlineTextEditor';

interface FeedbackSectionProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as any;
  const nodeType = node.data.nodeType;

  // Skip feedback section entirely for choice nodes
  if (nodeType === 'choice') {
    return null;
  }

  // Check if node has feedback fields
  const hasSuccessFeedback = 'successFeedback' in nljNode;
  const hasErrorFeedback = 'errorFeedback' in nljNode;
  const hasGeneralFeedback = 'feedback' in nljNode;

  // Check if any feedback exists
  const hasFeedback = hasSuccessFeedback || hasErrorFeedback || hasGeneralFeedback;

  if (!hasFeedback) {
    return null;
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" color="text.primary">
        Feedback
      </Typography>

      {/* Success Feedback */}
      {hasSuccessFeedback && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Success Feedback
          </Typography>
          
          <Alert 
            severity="success" 
            icon={<SuccessIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              This feedback shows when the user answers correctly.
            </Typography>
          </Alert>
          
          <InlineTextEditor
            value={nljNode.successFeedback || ''}
            onUpdate={(value) => onUpdate({ successFeedback: value } as any)}
            placeholder="Enter success feedback... (Markdown supported)"
            variant="body2"
            multiline
            rows={2}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'success.main',
              bgcolor: 'success.50',
              borderRadius: 1,
              '&:hover': {
                borderColor: 'success.dark',
              },
            }}
          />
          
        </Box>
      )}

      {/* Error Feedback */}
      {hasErrorFeedback && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Error Feedback
          </Typography>
          
          <Alert 
            severity="error" 
            icon={<ErrorIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              This feedback shows when the user answers incorrectly.
            </Typography>
          </Alert>
          
          <InlineTextEditor
            value={nljNode.errorFeedback || ''}
            onUpdate={(value) => onUpdate({ errorFeedback: value } as any)}
            placeholder="Enter error feedback... (Markdown supported)"
            variant="body2"
            multiline
            rows={2}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'error.main',
              bgcolor: 'error.50',
              borderRadius: 1,
              '&:hover': {
                borderColor: 'error.dark',
              },
            }}
          />
          
        </Box>
      )}

      {/* Remove General Feedback section as requested */}
    </Stack>
  );
};