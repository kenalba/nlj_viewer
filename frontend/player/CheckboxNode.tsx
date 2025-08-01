import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  FormHelperText, 
  FormGroup, 
  Checkbox 
} from '@mui/material';
import type { CheckboxNode as CheckboxNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { CheckboxFeedback } from '../shared/FeedbackDisplay';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface CheckboxNodeProps {
  question: CheckboxNodeType;
  onAnswer: (isCorrect: boolean) => void;
}

export const CheckboxNode: React.FC<CheckboxNodeProps> = ({ question, onAnswer }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [questionStartTime] = useState(new Date());
  const { playSound } = useAudio();
  const { themeMode } = useTheme();
  const { trackQuestionAnswered } = useXAPI();
  const isMobile = useIsMobile();

  const handleValueChange = useCallback((optionId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newIds = checked 
        ? [...prev, optionId]
        : prev.filter(id => id !== optionId);
      
      setShowValidation(false);
      playSound('click');
      return newIds;
    });
  }, [playSound]);

  const validateSelections = useCallback(() => {
    const count = selectedIds.length;
    const minSelections = question.minSelections || 0; // Changed from 1 to 0
    const maxSelections = question.maxSelections || question.options.length;
    
    if (count < minSelections) {
      return `Please select at least ${minSelections} option${minSelections > 1 ? 's' : ''}`;
    }
    
    if (count > maxSelections) {
      return `Please select no more than ${maxSelections} option${maxSelections > 1 ? 's' : ''}`;
    }
    
    return null;
  }, [selectedIds, question.minSelections, question.maxSelections, question.options.length]);

  const calculateCorrectness = useCallback(() => {
    const correctOptions = question.options.filter(opt => opt.isCorrect);
    const correctIds = correctOptions.map(opt => opt.id);
    
    // All correct options selected and no incorrect options selected
    const allCorrectSelected = correctIds.every(id => selectedIds.includes(id));
    const noIncorrectSelected = selectedIds.every(id => correctIds.includes(id));
    
    return allCorrectSelected && noIncorrectSelected;
  }, [selectedIds, question.options]);

  const handleSubmit = useCallback(() => {
    const validationError = validateSelections();
    if (validationError) {
      setShowValidation(true);
      playSound('error');
      return;
    }

    const isCorrect = calculateCorrectness();
    playSound(isCorrect ? 'correct' : 'incorrect');
    
    // Track question response
    const timeSpent = Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000);
    trackQuestionAnswered(
      question.id,
      'checkbox',
      selectedIds.join(', '),
      isCorrect,
      timeSpent
    );
    
    // Show feedback instead of immediately calling onAnswer
    setShowFeedback(true);
  }, [selectedIds, validateSelections, calculateCorrectness, playSound, trackQuestionAnswered, question.id, questionStartTime]);

  const handleContinue = useCallback(() => {
    const isCorrect = calculateCorrectness();
    playSound('navigate');
    onAnswer(isCorrect);
  }, [calculateCorrectness, playSound, onAnswer]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle number keys (1-9) to toggle options
      if (event.key >= '1' && event.key <= '9') {
        const optionIndex = parseInt(event.key, 10) - 1;
        if (optionIndex < question.options.length) {
          event.preventDefault();
          const option = question.options[optionIndex];
          // Get current state to avoid stale closure
          setSelectedIds(currentSelected => {
            const isCurrentlySelected = currentSelected.includes(option.id);
            const newIds = isCurrentlySelected
              ? currentSelected.filter(id => id !== option.id)
              : [...currentSelected, option.id];
            
            setShowValidation(false);
            playSound('click');
            return newIds;
          });
        }
      }
      
      // Handle Enter key
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (showFeedback) {
          handleContinue();
        } else {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, handleContinue, playSound, question.options, showFeedback]);

  const validationError = validateSelections();
  const minSelections = question.minSelections || 0;
  const maxSelections = question.maxSelections || question.options.length;

  return (
    <NodeCard animate={true}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {question.text}
        </Typography>
        {question.content && (
          <MarkdownRenderer content={question.content} />
        )}
      </Box>

      {question.media && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <MediaViewer media={question.media} />
        </Box>
      )}

      <Box sx={{ mb: 3 }}>
        <FormGroup>
          {question.options.map((option, index) => (
            <Box
              key={option.id}
              onClick={() => handleValueChange(option.id, !selectedIds.includes(option.id))}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                mb: 1,
                border: '1px solid',
                borderColor: selectedIds.includes(option.id) ? 
                  (themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main') : 
                  (themeMode === 'unfiltered' ? '#333333' : 'divider'),
                borderRadius: 2,
                backgroundColor: selectedIds.includes(option.id) ? 
                  (themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.1)' : 'action.selected') : 
                  'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: selectedIds.includes(option.id) ? 
                    (themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.15)' : 'action.selected') : 
                    (themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.05)' : 'action.hover'),
                  borderColor: themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.5)' : 'primary.light',
                },
              }}
            >
              <Checkbox
                checked={selectedIds.includes(option.id)}
                onChange={(e) => handleValueChange(option.id, e.target.checked)}
                color="primary"
                sx={{
                  color: themeMode === 'unfiltered' ? '#666666' : 'text.secondary',
                  '&.Mui-checked': {
                    color: themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main',
                  },
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: themeMode === 'unfiltered' ? '#333333' : 'action.selected',
                    color: themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}
                >
                  {index + 1}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: isMobile ? '0.875rem' : '1rem',
                    fontWeight: selectedIds.includes(option.id) ? 500 : 400,
                    color: 'text.primary',
                  }}
                >
                  {option.text}
                </Typography>
              </Box>
            </Box>
          ))}
        </FormGroup>
      </Box>

      {/* Selection counter */}
      <Box sx={{ mb: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {selectedIds.length} selected
          {minSelections === maxSelections 
            ? (minSelections === 0 ? ` (select 0-${maxSelections})` : ` (select exactly ${minSelections})`)
            : ` (select ${minSelections}-${maxSelections})`
          }
        </Typography>
      </Box>

      {showValidation && validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={showFeedback}
          size="large"
          sx={{
            minWidth: '120px',
            borderRadius: 3,
            px: 4,
            py: 1.5,
            ...(themeMode === 'unfiltered' && {
              background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
              boxShadow: '0 4px 16px rgba(246, 250, 36, 0.3)',
              '&:hover': {
                background: 'linear-gradient(45deg, #FF5252, #26C6DA)',
                boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                transform: 'translateY(-2px)',
              },
            }),
          }}
        >
          Submit Answer
        </Button>
      </Box>

      <FormHelperText sx={{ textAlign: 'center', mt: 2 }}>
        Press 1-{Math.min(9, question.options.length)} to toggle options • Press Enter to {showFeedback ? 'continue' : 'submit'}
      </FormHelperText>

      {showFeedback && (
        <Box sx={{ mt: 3 }}>
          <CheckboxFeedback
            isCorrect={calculateCorrectness()}
            selectedCount={selectedIds.length}
            correctOptions={question.options.filter(opt => opt.isCorrect).map(opt => opt.text)}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleContinue}
              size="large"
              sx={{
                minWidth: '120px',
                borderRadius: 3,
                px: 4,
                py: 1.5,
                ...(themeMode === 'unfiltered' && {
                  background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                  boxShadow: '0 4px 16px rgba(246, 250, 36, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #FF5252, #26C6DA)',
                    boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                    transform: 'translateY(-2px)',
                  },
                }),
              }}
            >
              Continue
            </Button>
          </Box>
        </Box>
      )}
    </NodeCard>
  );
};