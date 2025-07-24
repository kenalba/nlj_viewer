import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Radio,
  Stack,
  Alert,
  Collapse,
  Divider,
  useTheme as useMuiTheme,
} from '@mui/material';
import type { QuestionNode, ChoiceNode } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { useTheme } from '../contexts/ThemeContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { getAlertFeedbackColors } from '../utils/feedbackColors';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { MediaDisplay } from '../shared/MediaDisplay';

interface UnifiedQuestionNodeProps {
  question: QuestionNode;
  choices: ChoiceNode[];
  onChoiceSelect: (choice: ChoiceNode) => void;
  disabled?: boolean;
}

export const UnifiedQuestionNode: React.FC<UnifiedQuestionNodeProps> = ({
  question,
  choices,
  onChoiceSelect,
  disabled = false,
}) => {
  const settings = useNodeSettings(question.id);
  const [shuffledChoices] = useState<ChoiceNode[]>(() => {
    // Use settings to determine if choices should be shuffled
    const shouldShuffle = settings.shuffleAnswerOrder;
    if (import.meta.env.DEV) {
      console.log(`UnifiedQuestionNode ${question.id}: shuffleAnswerOrder=${shouldShuffle}, reinforcementEligible=${settings.reinforcementEligible}`);
    }
    return shouldShuffle 
      ? [...choices].sort(() => Math.random() - 0.5) 
      : choices;
  });
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedChoiceNode, setSelectedChoiceNode] = useState<ChoiceNode | null>(null);
  const [questionStartTime] = useState(new Date());
  const feedbackRef = useRef<HTMLDivElement>(null);
  const { themeMode } = useTheme();
  const { trackQuestionAnswered } = useXAPI();
  const muiTheme = useMuiTheme();
  const isMobile = useIsMobile();

  // Reset state when question changes (not when choices re-render)
  useEffect(() => {
    setSelectedChoice('');
    setShowFeedback(false);
    setSelectedChoiceNode(null);
  }, [question.id]);

  // Auto-scroll to feedback when it appears
  useEffect(() => {
    if (showFeedback && feedbackRef.current) {
      const timer = setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 350);
      
      return () => clearTimeout(timer);
    }
  }, [showFeedback]);

  const handleChoiceClick = (choice: ChoiceNode) => {
    if (disabled || showFeedback) return;
    setSelectedChoice(choice.id);
  };

  const handleSubmit = () => {
    const choice = choices.find(c => c.id === selectedChoice);
    
    if (choice) {
      setSelectedChoiceNode(choice);
      setShowFeedback(true);
      
      // Track question interaction
      const timeSpent = Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000);
      const isCorrect = choice.choiceType === 'CORRECT';
      
      trackQuestionAnswered(
        question.id,
        'multiple-choice',
        choice.text,
        isCorrect,
        timeSpent,
        1 // First attempt
      );
    }
  };

  const handleContinue = () => {
    if (selectedChoiceNode) {
      onChoiceSelect(selectedChoiceNode);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard events when this component is active
      if (disabled) return;
      
      // Handle number keys (1-9) to select choices (only when not showing feedback)
      if (!showFeedback && event.key >= '1' && event.key <= '9') {
        const choiceIndex = parseInt(event.key, 10) - 1;
        if (choiceIndex < shuffledChoices.length) {
          event.preventDefault();
          handleChoiceClick(shuffledChoices[choiceIndex]);
        }
      }
      
      // Handle Enter key
      if (event.key === 'Enter') {
        event.preventDefault();
        if (showFeedback) {
          // Continue to next question when showing feedback
          handleContinue();
        } else if (selectedChoice) {
          // Submit answer when choice is selected
          handleSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [disabled, showFeedback, shuffledChoices, selectedChoice, handleChoiceClick, handleSubmit, handleContinue]);

  const getFeedbackSeverity = (choiceType: string) => {
    switch (choiceType) {
      case 'CORRECT':
        return 'success';
      case 'INCORRECT':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <NodeCard animate={false}>
      {/* Question Media */}
      {question.media && (
        <Box sx={{ mb: 3 }}>
          <MediaViewer 
            media={question.media} 
            alt={`Question: ${question.text}`}
            size="large"
          />
        </Box>
      )}

      {/* Question Text */}
      <MarkdownRenderer
        content={question.text}
        sx={{ mb: 2, color: 'text.primary' }}
      />

      {/* Question Content */}
      {question.content && (
        <MarkdownRenderer
          content={question.content}
          sx={{ mb: 3, color: 'text.secondary' }}
        />
      )}

      {/* Additional Media */}
      {question.additionalMediaList && question.additionalMediaList.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <MediaDisplay 
            mediaList={question.additionalMediaList.map(wrapper => wrapper.media)}
            size="medium"
            showControls={true}
            showCounter={true}
          />
        </Box>
      )}

      {/* Divider before choices - only if we have content above */}
      {choices.length > 0 && (question.text || question.content || question.media || (question.additionalMediaList && question.additionalMediaList.length > 0)) && (
        <Divider sx={{ my: 3, borderColor: themeMode === 'unfiltered' ? '#333333' : 'divider' }} />
      )}

      {/* Choices Section */}
      {choices.length > 0 && (
        <Box>
          <Typography 
            
            gutterBottom 
            sx={{ 
              mb: 2,
              color: 'text.primary',
              fontSize: '1.1rem',
            }}
          >
            Choose your response:
          </Typography>
          
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            {shuffledChoices.map((choice) => (
              <Box
                key={choice.id}
                onClick={() => handleChoiceClick(choice)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  border: '1px solid',
                  borderColor: selectedChoice === choice.id ? 
                    (themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main') : 
                    (themeMode === 'unfiltered' ? '#333333' : 'divider'),
                  borderRadius: (muiTheme.shape.borderRadius as number) * 0.75,
                  backgroundColor: selectedChoice === choice.id ? 
                    (themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.1)' : 'action.selected') : 
                    'transparent',
                  cursor: (!disabled && !showFeedback) ? 'pointer' : 'default',
                  opacity: disabled ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    ...((!disabled && !showFeedback) && {
                      backgroundColor: selectedChoice === choice.id ? 
                        (themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.15)' : 'action.selected') : 
                        (themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.05)' : 'action.hover'),
                      borderColor: themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.5)' : 'primary.light',
                    }),
                  },
                }}
              >
                <Radio
                  checked={selectedChoice === choice.id}
                  onChange={() => handleChoiceClick(choice)}
                  disabled={disabled || showFeedback}
                  sx={{
                    mt: 0.5,
                    color: themeMode === 'unfiltered' ? '#666666' : 'text.secondary',
                    '&.Mui-checked': {
                      color: themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main',
                    },
                  }}
                />
                <MarkdownRenderer
                  content={choice.text}
                  sx={{ 
                    fontSize: '0.95rem',
                    lineHeight: 1.5,
                    color: 'text.primary',
                    fontWeight: selectedChoice === choice.id ? 500 : 400,
                  }}
                />
              </Box>
            ))}
          </Stack>

          {/* Submit Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!selectedChoice || disabled || showFeedback}
              size="large"
              sx={{ 
                px: 4, 
                py: 1.5,
                borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                boxShadow: themeMode === 'unfiltered' ? 
                  '0 4px 16px rgba(246, 250, 36, 0.3)' : 
                  'none',
                '&:hover': {
                  ...(themeMode === 'unfiltered' && {
                    boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                    transform: 'translateY(-2px)',
                  }),
                },
              }}
            >
              Submit Answer
            </Button>
          </Box>

          {/* Feedback Section - Unfolds from bottom */}
          <Collapse 
            in={showFeedback}
            timeout={400}
            sx={{
              position: 'relative',
              '& .MuiCollapse-wrapper': {
                borderRadius: { xs: 0, sm: `0 0 ${muiTheme.shape.borderRadius}px ${muiTheme.shape.borderRadius}px` },
                overflow: 'hidden',
              }
            }}
          >
            {selectedChoiceNode ? (
              <Box 
                ref={feedbackRef}
                sx={{
                  mt: 2,
                  p: 3,
                  backgroundColor: themeMode === 'unfiltered' ? 
                    'rgba(246, 250, 36, 0.05)' : 
                    'rgba(0, 0, 0, 0.02)',
                  borderTop: `1px solid ${themeMode === 'unfiltered' ? '#333333' : 'divider'}`,
                  borderRadius: { xs: 0, sm: `0 0 ${muiTheme.shape.borderRadius}px ${muiTheme.shape.borderRadius}px` },
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: themeMode === 'unfiltered' ? 
                      'linear-gradient(90deg, #F6FA24 0%, #FFD700 100%)' : 
                      'linear-gradient(90deg, #0078D4 0%, #00BCF2 100%)',
                    opacity: 0.6,
                  },
                }}
              >
                <Alert 
                  severity={getFeedbackSeverity(selectedChoiceNode.choiceType)}
                  sx={{ 
                    borderRadius: (muiTheme.shape.borderRadius as number) * 1.5,
                    mb: 2,
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    p: 0,
                    '& .MuiAlert-icon': {
                      color: getAlertFeedbackColors(
                        muiTheme, 
                        themeMode, 
                        getFeedbackSeverity(selectedChoiceNode.choiceType) as 'success' | 'error' | 'warning' | 'info'
                      ).iconColor,
                    },
                  }}
                >
                  <MarkdownRenderer
                    content={selectedChoiceNode.feedback || 'Thank you for your response.'}
                    sx={{ fontSize: '0.95rem', color: 'text.primary' }}
                  />
                </Alert>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleContinue}
                    size="large"
                    sx={{ 
                      px: 4, 
                      py: 1.5,
                      borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                      boxShadow: themeMode === 'unfiltered' ? 
                        '0 4px 16px rgba(246, 250, 36, 0.3)' : 
                        'none',
                      '&:hover': {
                        ...(themeMode === 'unfiltered' && {
                          boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                          transform: 'translateY(-2px)',
                        }),
                      },
                    }}
                  >
                    Continue
                  </Button>
                </Box>
              </Box>
            ) : null}
          </Collapse>
        </Box>
      )}
      
      {/* Keyboard Controls Helper - Hide on mobile */}
      {!isMobile && shuffledChoices.length > 0 && !showFeedback && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Use number keys (1-{Math.min(shuffledChoices.length, 9)}) to select • Enter to submit
          </Typography>
        </Box>
      )}
    </NodeCard>
  );
};