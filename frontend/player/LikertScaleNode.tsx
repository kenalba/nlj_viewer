import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, FormHelperText } from '@mui/material';
import type { LikertScaleNode as LikertScaleNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { UnifiedSurveyQuestionNode } from './UnifiedSurveyQuestionNode';
import { useAudio } from '../contexts/AudioContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface LikertScaleNodeProps {
  question: LikertScaleNodeType;
  onAnswer: (response: number) => void;
}

export const LikertScaleNode: React.FC<LikertScaleNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [selectedValue, setSelectedValue] = useState<number | null>(question.defaultValue || null);
  const { playSound } = useAudio();
  const isMobile = useIsMobile();

  if (import.meta.env.DEV) {
    console.log(`LikertScaleNode ${question.id}: shuffleAnswerOrder=${settings.shuffleAnswerOrder}, reinforcementEligible=${settings.reinforcementEligible}`);
  }

  const handleValueSelect = useCallback((value: number) => {
    setSelectedValue(value);
    playSound('click');
  }, [playSound]);

  const getScaleValues = useCallback(() => {
    const values = [];
    const step = question.scale.step || 1;
    for (let i = question.scale.min; i <= question.scale.max; i += step) {
      values.push(i);
    }
    return values;
  }, [question.scale.min, question.scale.max, question.scale.step]);

  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard events for this component when it's active
      if (event.target !== document.body) return;
      
      const scaleValues = getScaleValues();
      
      // Handle number keys (1-9)
      if (event.key >= '1' && event.key <= '9') {
        const keyValue = parseInt(event.key, 10);
        if (scaleValues.includes(keyValue)) {
          event.preventDefault();
          handleValueSelect(keyValue);
        }
      }
      
      // Handle arrow keys for navigation
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const currentIndex = selectedValue ? scaleValues.indexOf(selectedValue) : -1;
        
        if (event.key === 'ArrowLeft' && currentIndex > 0) {
          handleValueSelect(scaleValues[currentIndex - 1]);
        } else if (event.key === 'ArrowRight' && currentIndex < scaleValues.length - 1) {
          handleValueSelect(scaleValues[currentIndex + 1]);
        } else if (event.key === 'ArrowRight' && currentIndex === -1) {
          // Select first value if none selected
          handleValueSelect(scaleValues[0]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedValue, getScaleValues, handleValueSelect]);

  const getButtonVariant = (value: number) => {
    return selectedValue === value ? 'contained' : 'outlined';
  };

  const getButtonStyles = (value: number) => {
    const isSelected = selectedValue === value;
    
    return {
      borderRadius: 3,
      minWidth: 60,
      minHeight: 48,
      borderColor: isSelected ? 'primary.main' : 'divider',
      color: isSelected ? 'primary.contrastText' : 'text.primary',
      backgroundColor: isSelected ? 'primary.main' : 'transparent',
      '&:hover': {
        borderColor: 'primary.main',
        backgroundColor: isSelected ? 'primary.dark' : 'primary.light',
        color: isSelected ? 'primary.contrastText' : 'primary.main',
      },
    };
  };

  const scaleValues = getScaleValues();

  // Pure render function for the Likert scale question UI
  const renderLikertScaleQuestion = () => (
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

      {/* Scale Labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, px: 1 }}>
        <Typography color="text.secondary" sx={{ textAlign: 'center', maxWidth: '30%' }}>
          {question.scale.labels.min}
        </Typography>
        {question.scale.labels.middle && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', maxWidth: '30%' }}>
            {question.scale.labels.middle}
          </Typography>
        )}
        <Typography color="text.secondary" sx={{ textAlign: 'center', maxWidth: '30%' }}>
          {question.scale.labels.max}
        </Typography>
      </Box>

      {/* Scale Buttons */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        mb: 3, 
        px: 2,
        ...(scaleValues.length > 7 && {
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }),
        ...((scaleValues.length <= 7) && {
          flexDirection: 'row',
          gap: 1,
          flexWrap: 'wrap',
        }),
      }}>
        {scaleValues.map((value) => (
          <Button
            key={value}
            variant={getButtonVariant(value)}
            onClick={() => handleValueSelect(value)}
            sx={getButtonStyles(value)}
          >
            {question.showNumbers !== false && (
              <Typography fontWeight="bold">
                {value}
              </Typography>
            )}
          </Button>
        ))}
      </Box>
      
      {/* Keyboard Controls Helper - Hide on mobile */}
      {!isMobile && (
        <FormHelperText sx={{ textAlign: 'center', mt: 1, fontSize: '0.75rem', opacity: 0.7 }}>
          Use number keys (1-{getScaleValues().length}) or arrow keys to select • Enter to submit
        </FormHelperText>
      )}
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
        response={selectedValue}
        hasResponse={selectedValue !== null}
      >
        {renderLikertScaleQuestion()}
      </UnifiedSurveyQuestionNode>
    );
  }

  // Otherwise render as regular training question with submit button
  return (
    <Box>
      {renderLikertScaleQuestion()}
      
      {/* Submit Button for non-survey questions */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={() => onAnswer(selectedValue || 0)}
          size="large"
          disabled={question.required && selectedValue === null}
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
          {selectedValue !== null ? 'Submit' : 'Skip'}
        </Button>
      </Box>

      {/* Helper Text */}
      {question.required && (
        <FormHelperText sx={{ textAlign: 'center', mt: 1 }}>
          * This question is required
        </FormHelperText>
      )}
    </Box>
  );
};