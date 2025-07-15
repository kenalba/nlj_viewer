import React, { useState } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import type { TrueFalseNode as TrueFalseNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';

interface TrueFalseNodeProps {
  question: TrueFalseNodeType;
  onAnswer: (isCorrect: boolean) => void;
}

export const TrueFalseNode: React.FC<TrueFalseNodeProps> = ({ question, onAnswer }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const { playSound } = useAudio();

  const handleAnswer = (answer: boolean) => {
    setSelectedAnswer(answer);
    setShowFeedback(true);
    
    const isCorrect = answer === question.correctAnswer;
    
    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }
    
    // Delay the callback to show feedback
    setTimeout(() => {
      onAnswer(isCorrect);
    }, 1500);
  };

  const getFeedbackMessage = () => {
    if (selectedAnswer === null) return '';
    
    const isCorrect = selectedAnswer === question.correctAnswer;
    if (isCorrect) {
      return 'Correct! Well done.';
    } else {
      return `Incorrect. The correct answer is: ${question.correctAnswer ? 'True' : 'False'}`;
    }
  };

  const getFeedbackSeverity = () => {
    if (selectedAnswer === null) return 'info';
    return selectedAnswer === question.correctAnswer ? 'success' : 'error';
  };

  return (
    <NodeCard variant="question" animate={true}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {question.text}
        </Typography>
        
        {question.content && (
          <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
            {question.content}
          </Typography>
        )}
        
        {question.media && (
          <Box sx={{ mb: 3 }}>
            <MediaViewer media={question.media} size="medium" />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ mb: 3 }}>
            {question.additionalMediaList.map((media, index) => (
              <Box key={`${media.id}-${index}`} sx={{ mb: 2 }}>
                <MediaViewer media={media} size="small" />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'center' }}>
        <Button
          variant={selectedAnswer === true ? 'contained' : 'outlined'}
          onClick={() => handleAnswer(true)}
          disabled={showFeedback}
          startIcon={<CheckCircle />}
          sx={{
            minWidth: 120,
            borderRadius: 3,
            ...(selectedAnswer === true && {
              backgroundColor: selectedAnswer === question.correctAnswer ? 'success.main' : 'error.main',
              '&:hover': {
                backgroundColor: selectedAnswer === question.correctAnswer ? 'success.dark' : 'error.dark',
              },
            }),
          }}
        >
          True
        </Button>
        
        <Button
          variant={selectedAnswer === false ? 'contained' : 'outlined'}
          onClick={() => handleAnswer(false)}
          disabled={showFeedback}
          startIcon={<Cancel />}
          sx={{
            minWidth: 120,
            borderRadius: 3,
            ...(selectedAnswer === false && {
              backgroundColor: selectedAnswer === question.correctAnswer ? 'success.main' : 'error.main',
              '&:hover': {
                backgroundColor: selectedAnswer === question.correctAnswer ? 'success.dark' : 'error.dark',
              },
            }),
          }}
        >
          False
        </Button>
      </Box>

      {showFeedback && (
        <Alert 
          severity={getFeedbackSeverity() as 'success' | 'error' | 'info'} 
          sx={{ 
            mt: 2,
            borderRadius: 2,
            '& .MuiAlert-message': {
              width: '100%',
              textAlign: 'center'
            }
          }}
        >
          {getFeedbackMessage()}
        </Alert>
      )}
    </NodeCard>
  );
};