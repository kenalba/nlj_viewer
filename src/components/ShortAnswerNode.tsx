import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { Edit } from '@mui/icons-material';
import type { ShortAnswerNode as ShortAnswerNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ShortAnswerNodeProps {
  question: ShortAnswerNodeType;
  onAnswer: (isCorrect: boolean) => void;
}

export const ShortAnswerNode: React.FC<ShortAnswerNodeProps> = ({ question, onAnswer }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const { playSound } = useAudio();
  const textFieldRef = useRef<HTMLInputElement>(null);

  // Auto-focus the text field when component mounts
  useEffect(() => {
    if (textFieldRef.current) {
      textFieldRef.current.focus();
    }
  }, []);

  const normalizeAnswer = (answer: string) => {
    let normalized = answer.trim();
    if (!question.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  };

  const isAnswerCorrect = (answer: string) => {
    const normalizedAnswer = normalizeAnswer(answer);
    return question.correctAnswers.some(correctAnswer => {
      const normalizedCorrect = normalizeAnswer(correctAnswer);
      return normalizedCorrect === normalizedAnswer;
    });
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) {
      playSound('error');
      return;
    }
    
    setShowFeedback(true);
    
    const isCorrect = isAnswerCorrect(userAnswer);
    
    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }
    
    // Delay the callback to show feedback
    setTimeout(() => {
      onAnswer(isCorrect);
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showFeedback && userAnswer.trim()) {
      handleSubmit();
    }
  };

  const getFeedbackMessage = () => {
    const isCorrect = isAnswerCorrect(userAnswer);
    
    if (isCorrect) {
      return 'Correct! Well done.';
    } else {
      // Show the first correct answer as an example
      const exampleAnswer = question.correctAnswers[0];
      if (question.correctAnswers.length === 1) {
        return `Incorrect. The correct answer is: "${exampleAnswer}"`;
      } else {
        return `Incorrect. One correct answer is: "${exampleAnswer}"`;
      }
    }
  };

  const getFeedbackSeverity = () => {
    const isCorrect = isAnswerCorrect(userAnswer);
    return isCorrect ? 'success' : 'error';
  };

  return (
    <NodeCard animate={true}>
      <Box sx={{ mb: 3 }}>
        <MarkdownRenderer
          content={question.text}
          sx={{ mb: 1, color: 'text.primary' }}
        />
        
        {question.content && (
          <Typography sx={{ mb: 2, color: 'text.secondary' }}>
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
            {question.additionalMediaList.map((wrapper, index) => (
              <Box key={`${wrapper.media.id}-${index}`} sx={{ mb: 2 }}>
                <MediaViewer media={wrapper.media} size="small" />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Typography sx={{ mb: 2, color: 'text.secondary' }}>
        {question.caseSensitive ? 
          'Type your answer below (case-sensitive):' : 
          'Type your answer below (case-insensitive):'
        }
      </Typography>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={showFeedback}
          placeholder="Enter your answer here..."
          inputRef={textFieldRef}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              '&:hover fieldset': {
                borderColor: 'primary.main',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                <Edit color="action" fontSize="small" />
              </Box>
            ),
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={showFeedback || !userAnswer.trim()}
          sx={{ 
            borderRadius: 3, 
            minWidth: 120,
            '&:disabled': {
              opacity: 0.6,
            }
          }}
        >
          Submit Answer
        </Button>
      </Box>

      {showFeedback && (
        <Alert 
          severity={getFeedbackSeverity() as 'success' | 'error'} 
          sx={{ 
            mt: 2,
            borderRadius: 2,
            '& .MuiAlert-message': {
              width: '100%',
              textAlign: 'center'
            }
          }}
        >
          <Box>
            <Typography gutterBottom>
              {getFeedbackMessage()}
            </Typography>
            <Typography sx={{ mt: 1, fontStyle: 'italic' }}>
              Your answer: "{userAnswer}"
            </Typography>
          </Box>
        </Alert>
      )}
    </NodeCard>
  );
};