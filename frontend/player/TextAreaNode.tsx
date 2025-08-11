import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, TextField, Button, FormHelperText } from '@mui/material';
import type { TextAreaNode as TextAreaNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { UnifiedSurveyQuestionNode } from './UnifiedSurveyQuestionNode';
import { useAudio } from '../contexts/AudioContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface TextAreaNodeProps {
  question: TextAreaNodeType;
  onAnswer: (response: string) => void;
}

export const TextAreaNode: React.FC<TextAreaNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [textValue, setTextValue] = useState<string>('');
  const { playSound } = useAudio();
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  if (import.meta.env.DEV) {
    console.log(`TextAreaNode ${question.id}: shuffleAnswerOrder=${settings.shuffleAnswerOrder}, reinforcementEligible=${settings.reinforcementEligible}`);
  }

  // Auto-focus the text field when component mounts
  useEffect(() => {
    if (textFieldRef.current) {
      textFieldRef.current.focus();
    }
  }, []);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setTextValue(value);
  };

  const isValidResponse = (): boolean => {
    if (question.required && textValue.trim().length === 0) {
      return false;
    }
    
    if (question.minLength && textValue.length < question.minLength) {
      return false;
    }
    
    if (question.maxLength && textValue.length > question.maxLength) {
      return false;
    }
    
    return true;
  };

  const getWordCount = () => {
    if (!question.wordCount) return null;
    const words = textValue.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  };

  const getCharacterCount = () => {
    return textValue.length;
  };

  // Pure render function for the text area question UI
  const renderTextAreaQuestion = () => (
    <NodeCard animate={true}>
      <Box sx={{ mb: 3 }}>
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

      {/* Text Area */}
      <Box sx={{ mb: 3 }}>
        <TextField
          multiline
          rows={question.rows || 4}
          value={textValue}
          onChange={handleTextChange}
          placeholder={question.placeholder || 'Type your response here...'}
          fullWidth
          inputRef={textFieldRef}
          inputProps={{
            spellCheck: question.spellCheck !== false,
            style: { 
              resize: question.resizable !== false ? 'vertical' : 'none',
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              '& fieldset': {
                borderColor: 'divider',
              },
              '&:hover fieldset': {
                borderColor: 'primary.main',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
              '& .MuiInputBase-input': {
                color: 'text.primary',
                '&::placeholder': {
                  color: 'text.disabled',
                },
              },
            },
          }}
        />
      </Box>

      {/* Character/Word Count */}
      {(question.wordCount || question.maxLength) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          {question.wordCount && (
            <Typography color="text.secondary">
              Words: {getWordCount()}
            </Typography>
          )}
          {question.maxLength && (
            <Typography 
              color={getCharacterCount() > question.maxLength * 0.9 ? 'warning.main' : 'text.secondary'}
            >
              Characters: {getCharacterCount()}/{question.maxLength}
            </Typography>
          )}
        </Box>
      )}

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

  // Check if this is a survey question (has followUp capability)
  const isSurveyQuestion = question.followUp !== undefined;

  // If it's a survey question, wrap with UnifiedSurveyQuestionNode
  if (isSurveyQuestion) {
    return (
      <UnifiedSurveyQuestionNode
        question={question}
        onAnswer={onAnswer}
        response={textValue.trim()}
        hasResponse={textValue.trim().length > 0}
      >
        {renderTextAreaQuestion()}
      </UnifiedSurveyQuestionNode>
    );
  }

  // Otherwise render as regular training question with submit button
  return (
    <Box>
      {renderTextAreaQuestion()}
      
      {/* Submit Button for non-survey questions */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={() => onAnswer(textValue.trim())}
          size="large"
          disabled={question.required && !isValidResponse()}
          sx={{
            borderRadius: 3,
            minWidth: 120,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '&:disabled': {
              backgroundColor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          {textValue.trim().length > 0 ? 'Submit' : 'Skip'}
        </Button>
      </Box>
    </Box>
  );
};