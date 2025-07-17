import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  FormHelperText, 
  FormGroup, 
  FormControlLabel, 
  Checkbox 
} from '@mui/material';
import type { CheckboxNode as CheckboxNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from './MarkdownRenderer';

interface CheckboxNodeProps {
  question: CheckboxNodeType;
  onAnswer: (isCorrect: boolean) => void;
}

export const CheckboxNode: React.FC<CheckboxNodeProps> = ({ question, onAnswer }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
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
    const minSelections = question.minSelections || 1;
    const maxSelections = question.maxSelections || question.options.length;
    
    if (count === 0) {
      return 'Please select at least one option';
    }
    
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
    
    onAnswer(isCorrect);
  }, [selectedIds, validateSelections, calculateCorrectness, playSound, trackQuestionAnswered, question.id, questionStartTime, onAnswer]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  const validationError = validateSelections();
  const minSelections = question.minSelections || 1;
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
          {question.options.map((option) => (
            <FormControlLabel
              key={option.id}
              control={
                <Checkbox
                  checked={selectedIds.includes(option.id)}
                  onChange={(e) => handleValueChange(option.id, e.target.checked)}
                  color="primary"
                />
              }
              label={option.text}
              sx={{
                mb: 1,
                '& .MuiFormControlLabel-label': {
                  fontSize: isMobile ? '0.875rem' : '1rem',
                },
              }}
            />
          ))}
        </FormGroup>
      </Box>

      {/* Selection counter */}
      <Box sx={{ mb: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {selectedIds.length} selected
          {minSelections === maxSelections 
            ? ` (select exactly ${minSelections})` 
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
          size="large"
          disabled={selectedIds.length === 0}
          sx={{
            minWidth: '120px',
            borderRadius: 3,
            ...(themeMode === 'unfiltered' && {
              background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
              '&:hover': {
                background: 'linear-gradient(45deg, #FF5252, #26C6DA)',
              },
            }),
          }}
        >
          Submit
        </Button>
      </Box>

      <FormHelperText sx={{ textAlign: 'center', mt: 2 }}>
        Press Enter to submit
      </FormHelperText>
    </NodeCard>
  );
};