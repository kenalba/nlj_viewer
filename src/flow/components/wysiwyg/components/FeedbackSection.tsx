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
  Info as InfoIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';
import { InlineTextEditor } from '../editors/InlineTextEditor';

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

      {/* General Feedback */}
      {hasGeneralFeedback && !hasSuccessFeedback && !hasErrorFeedback && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            General Feedback
          </Typography>
          
          <Alert 
            severity="info" 
            icon={<InfoIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              This feedback shows to all users after they answer.
            </Typography>
          </Alert>
          
          <InlineTextEditor
            value={nljNode.feedback || ''}
            onUpdate={(value) => onUpdate({ feedback: value })}
            placeholder="Enter feedback... (Markdown supported)"
            variant="body2"
            multiline
            rows={2}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'info.main',
              bgcolor: 'info.50',
              borderRadius: 1,
              '&:hover': {
                borderColor: 'info.dark',
              },
            }}
          />
          
        </Box>
      )}

      {/* Instructions */}
      <Alert severity="info">
        <Typography variant="body2">
          <strong>Feedback Tips:</strong> Use markdown formatting to make feedback more engaging. 
          Include explanations, links to resources, or encouragement for learners.
        </Typography>
      </Alert>
    </Stack>
  );
};