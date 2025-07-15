import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, FormHelperText } from '@mui/material';
import type { TextAreaNode as TextAreaNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';

interface TextAreaNodeProps {
  question: TextAreaNodeType;
  onAnswer: (response: string) => void;
}

export const TextAreaNode: React.FC<TextAreaNodeProps> = ({ question, onAnswer }) => {
  const [textValue, setTextValue] = useState<string>('');
  const [showValidation, setShowValidation] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const { playSound } = useAudio();
  const { themeMode } = useTheme();

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setTextValue(value);
    setShowValidation(false);
    setValidationError('');
  };

  const validateInput = (value: string): string | null => {
    if (question.required && value.trim().length === 0) {
      return 'This question is required. Please enter a response.';
    }
    
    if (question.minLength && value.length < question.minLength) {
      return `Response must be at least ${question.minLength} characters long.`;
    }
    
    if (question.maxLength && value.length > question.maxLength) {
      return `Response must not exceed ${question.maxLength} characters.`;
    }
    
    return null;
  };

  const handleSubmit = () => {
    const trimmedValue = textValue.trim();
    const error = validateInput(textValue); // Use original value for length validation
    
    if (error) {
      setValidationError(error);
      setShowValidation(true);
      playSound('error');
      return;
    }

    playSound('navigate');
    onAnswer(trimmedValue);
  };

  const getWordCount = () => {
    if (!question.wordCount) return null;
    const words = textValue.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  };

  const getCharacterCount = () => {
    return textValue.length;
  };

  const isSubmitDisabled = () => {
    // Don't disable button to allow validation error display
    return false;
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

      {/* Text Area */}
      <Box sx={{ mb: 3 }}>
        <TextField
          multiline
          rows={question.rows || 4}
          value={textValue}
          onChange={handleTextChange}
          placeholder={question.placeholder || 'Type your response here...'}
          fullWidth
          variant="outlined"
          inputProps={{
            spellCheck: question.spellCheck !== false,
            style: { 
              resize: question.resizable !== false ? 'vertical' : 'none',
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              ...(themeMode === 'unfiltered' && {
                '& fieldset': {
                  borderColor: '#333333',
                },
                '&:hover fieldset': {
                  borderColor: '#F6FA24',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#F6FA24',
                },
                '& .MuiInputBase-input': {
                  color: '#FFFFFF',
                  '&::placeholder': {
                    color: '#666666',
                  },
                },
              }),
            },
          }}
        />
      </Box>

      {/* Character/Word Count */}
      {(question.wordCount || question.maxLength) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          {question.wordCount && (
            <Typography variant="caption" color="text.secondary">
              Words: {getWordCount()}
            </Typography>
          )}
          {question.maxLength && (
            <Typography 
              variant="caption" 
              color={getCharacterCount() > question.maxLength * 0.9 ? 'warning.main' : 'text.secondary'}
            >
              Characters: {getCharacterCount()}/{question.maxLength}
            </Typography>
          )}
        </Box>
      )}

      {/* Validation Error */}
      {showValidation && validationError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {validationError}
        </Alert>
      )}

      {/* Submit Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          size="large"
          disabled={isSubmitDisabled()}
          sx={{
            borderRadius: 3,
            minWidth: 120,
            ...(themeMode === 'unfiltered' && {
              backgroundColor: '#F6FA24',
              color: '#000000',
              '&:hover': {
                backgroundColor: '#FFD700',
              },
              '&:disabled': {
                backgroundColor: '#333333',
                color: '#666666',
              },
            }),
          }}
        >
          {textValue.trim().length > 0 ? 'Submit' : 'Skip'}
        </Button>
      </Box>

      {/* Helper Text */}
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        {question.required && (
          <FormHelperText>
            * This question is required
          </FormHelperText>
        )}
        {question.minLength && (
          <FormHelperText>
            Minimum {question.minLength} characters required
          </FormHelperText>
        )}
      </Box>
    </NodeCard>
  );
};