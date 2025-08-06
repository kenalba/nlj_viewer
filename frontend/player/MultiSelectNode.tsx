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
import type { MultiSelectNode as MultiSelectNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface MultiSelectNodeProps {
  question: MultiSelectNodeType;
  onAnswer: (response: string[]) => void;
}

export const MultiSelectNode: React.FC<MultiSelectNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const { playSound } = useAudio();
  const { themeMode } = useTheme();
  const { trackSurveyResponse } = useXAPI();
  const isMobile = useIsMobile();

  if (import.meta.env.DEV) {
    console.log(`MultiSelectNode ${question.id}: shuffleAnswerOrder=${settings.shuffleAnswerOrder}, reinforcementEligible=${settings.reinforcementEligible}`);
  }

  const handleValueChange = useCallback((optionValue: string, checked: boolean) => {
    setSelectedValues(prev => {
      const newValues = checked 
        ? [...prev, optionValue]
        : prev.filter(v => v !== optionValue);
      
      setShowValidation(false);
      playSound('click');
      return newValues;
    });
  }, [playSound]);

  const validateSelections = useCallback(() => {
    const count = selectedValues.length;
    const minSelections = question.minSelections || 1;
    const maxSelections = question.maxSelections || question.options.length;
    
    if (question.required && count === 0) {
      return 'Please select at least one option';
    }
    
    if (count < minSelections) {
      return `Please select at least ${minSelections} option${minSelections > 1 ? 's' : ''}`;
    }
    
    if (count > maxSelections) {
      return `Please select no more than ${maxSelections} option${maxSelections > 1 ? 's' : ''}`;
    }
    
    return null;
  }, [selectedValues, question.minSelections, question.maxSelections, question.required, question.options.length]);

  const handleSubmit = useCallback(() => {
    const validationError = validateSelections();
    if (validationError) {
      setShowValidation(true);
      playSound('error');
      return;
    }

    playSound('navigate');
    
    // Track survey response
    trackSurveyResponse(
      'current-survey', // surveyId
      question.id,      // questionId
      selectedValues.join(', ') // response as string
    );
    
    onAnswer(selectedValues);
  }, [selectedValues, validateSelections, playSound, trackSurveyResponse, question.id, question.text, onAnswer]);

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
                  checked={selectedValues.includes(option.value?.toString() || option.id)}
                  onChange={(e) => handleValueChange(option.value?.toString() || option.id, e.target.checked)}
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
          {selectedValues.length} selected
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
          disabled={selectedValues.length === 0 && question.required}
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
          {selectedValues.length === 0 && !question.required ? 'Skip' : 'Continue'}
        </Button>
      </Box>

      <FormHelperText sx={{ textAlign: 'center', mt: 2 }}>
        Press Enter to continue
      </FormHelperText>
    </NodeCard>
  );
};