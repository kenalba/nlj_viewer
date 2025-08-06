import React from 'react';
import { Typography, Box } from '@mui/material';
import type { QuestionNode } from '../types/nlj';
import { MediaViewer } from '../shared/MediaViewer';
import { NodeCard } from './NodeCard';

interface QuestionCardProps {
  question: QuestionNode;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question }) => {
  return (
    <NodeCard animate={true} sx={{ mb: 2 }}>
      {question.media && (
        <Box sx={{ mb: 2 }}>
          <MediaViewer 
            media={question.media} 
            alt={`Question: ${question.text}`}
            size="large"
          />
        </Box>
      )}
      <Typography component="h2" gutterBottom>
        {question.text}
      </Typography>
      {question.content && (
        <Typography color="text.secondary">
          {question.content}
        </Typography>
      )}
      {question.additionalMediaList && question.additionalMediaList.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {question.additionalMediaList.map((wrapper, index) => (
            <Box key={wrapper.media.id} sx={{ mb: 1 }}>
              <MediaViewer 
                media={wrapper.media} 
                alt={`Additional media ${index + 1}`}
                size="small"
              />
            </Box>
          ))}
        </Box>
      )}
    </NodeCard>
  );
};