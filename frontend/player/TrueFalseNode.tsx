import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import type { TrueFalseNode as TrueFalseNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { MediaDisplay } from '../shared/MediaDisplay';

interface TrueFalseNodeProps {
  question: TrueFalseNodeType;
  onAnswer: (isCorrect: boolean) => void;
}

export const TrueFalseNode: React.FC<TrueFalseNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [questionStartTime] = useState(new Date());
  const { playSound } = useAudio();
  const { trackQuestionAnswered } = useXAPI();
  const isMobile = useIsMobile();

  if (import.meta.env.DEV) {
    console.log(`TrueFalseNode ${question.id}: shuffleAnswerOrder=${settings.shuffleAnswerOrder}, reinforcementEligible=${settings.reinforcementEligible}`);
  }

  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard events when this component is active
      if (showFeedback) {
        // Handle Enter key to continue after feedback
        if (event.key === 'Enter') {
          event.preventDefault();
          handleContinue();
        }
        return;
      }
      
      // Handle number keys to select answers
      if (event.key === '1') {
        event.preventDefault();
        handleChoiceSelection(true);
      } else if (event.key === '2') {
        event.preventDefault();
        handleChoiceSelection(false);
      }
      
      // Handle Enter key to submit when answer is selected
      if (event.key === 'Enter' && selectedAnswer !== null) {
        event.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showFeedback, selectedAnswer]);

  const handleChoiceSelection = (answer: boolean) => {
    if (showFeedback) return;
    setSelectedAnswer(answer);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null || showFeedback) return;
    
    setShowFeedback(true);
    
    const isCorrect = selectedAnswer === question.correctAnswer;
    
    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }
    
    // Track question interaction
    const timeSpent = Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000);
    trackQuestionAnswered(
      question.id,
      'true-false',
      selectedAnswer.toString(),
      isCorrect,
      timeSpent,
      1 // First attempt
    );
  };

  const handleContinue = () => {
    if (selectedAnswer === null) return;
    const isCorrect = selectedAnswer === question.correctAnswer;
    onAnswer(isCorrect);
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
    <NodeCard animate={true}>
      <Box sx={{ mb: 3 }}>
        {question.media && (
          <Box sx={{ mb: 3 }}>
            <MediaViewer media={question.media} size="medium" />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <MediaDisplay 
              mediaList={question.additionalMediaList.map(wrapper => wrapper.media)}
              size="small"
              showControls={true}
              showCounter={true}
            />
          </Box>
        )}
        
        <MarkdownRenderer
          content={question.text}
          sx={{ mb: 1, color: 'text.primary' }}
        />
        
        {question.content && (
          <MarkdownRenderer
            content={question.content}
            sx={{ mb: 2, color: 'text.secondary' }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'center' }}>
        <Button
          variant={selectedAnswer === true ? 'contained' : 'outlined'}
          onClick={() => handleChoiceSelection(true)}
          disabled={showFeedback}
          startIcon={<CheckCircle />}
          sx={{
            minWidth: 120,
            borderRadius: 3,
            ...(selectedAnswer === true && showFeedback && {
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
          onClick={() => handleChoiceSelection(false)}
          disabled={showFeedback}
          startIcon={<Cancel />}
          sx={{
            minWidth: 120,
            borderRadius: 3,
            ...(selectedAnswer === false && showFeedback && {
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

      {/* Submit Button */}
      {!showFeedback && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={selectedAnswer === null}
            size="large"
            sx={{ 
              px: 4, 
              py: 1.5,
              borderRadius: 3,
            }}
          >
            Submit Answer
          </Button>
        </Box>
      )}

      {showFeedback && (
        <Box>
          <Alert 
            severity={getFeedbackSeverity() as 'success' | 'error' | 'info'} 
            sx={{ 
              mt: 2,
              mb: 2,
              borderRadius: 2,
              '& .MuiAlert-message': {
                width: '100%',
                textAlign: 'center'
              }
            }}
          >
            {getFeedbackMessage()}
          </Alert>
          
          {/* Continue Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleContinue}
              size="large"
              sx={{ 
                px: 4, 
                py: 1.5,
                borderRadius: 3,
              }}
            >
              Continue
            </Button>
          </Box>
        </Box>
      )}

      {/* Keyboard Controls Helper - Hide on mobile */}
      {!isMobile && !showFeedback && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Press 1 for True, 2 for False • Enter to submit
          </Typography>
        </Box>
      )}
    </NodeCard>
  );
};