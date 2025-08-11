import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Rating, Button, FormHelperText, useTheme as useMuiTheme } from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import type { RatingNode as RatingNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { UnifiedSurveyQuestionNode } from './UnifiedSurveyQuestionNode';
import { useAudio } from '../contexts/AudioContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface RatingNodeProps {
  question: RatingNodeType;
  onAnswer: (response: number | null) => void;
}

export const RatingNode: React.FC<RatingNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [selectedValue, setSelectedValue] = useState<number | null>(question.defaultValue || null);
  const { playSound } = useAudio();
  const muiTheme = useMuiTheme();
  const isMobile = useIsMobile();

  if (import.meta.env.DEV) {
    console.log(`RatingNode ${question.id}: shuffleAnswerOrder=${settings.shuffleAnswerOrder}, reinforcementEligible=${settings.reinforcementEligible}`);
  }

  const handleValueSelect = useCallback((value: number) => {
    console.log('handleValueSelect:', value, typeof value);
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setSelectedValue(numValue);
      playSound('click');
    }
  }, [playSound]);


  // Add keyboard controls for rating questions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard events for this component when it's active
      if (event.target !== document.body) return;

      // Handle number keys based on rating type
      if (question.ratingType === 'stars') {
        if (event.key >= '1' && event.key <= '9') {
          const keyValue = parseInt(event.key);
          if (keyValue <= question.range.max) {
            event.preventDefault();
            handleValueSelect(keyValue);
          }
        }
      } else if (question.ratingType === 'numeric') {
        if (event.key >= '1' && event.key <= '9') {
          const keyValue = parseInt(event.key);
          const step = question.range.step || 1;
          const values = [];
          for (let i = question.range.min; i <= question.range.max; i += step) {
            values.push(i);
          }
          if (values.includes(keyValue)) {
            event.preventDefault();
            handleValueSelect(keyValue);
          }
        }
      } else if (question.ratingType === 'categorical') {
        if (event.key >= '1' && event.key <= '9') {
          const keyValue = parseInt(event.key) - 1; // Convert to 0-based index
          if (question.categories && keyValue < question.categories.length) {
            event.preventDefault();
            handleValueSelect(keyValue);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question, handleValueSelect]);

  const renderStarRating = () => {
    
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Rating
          value={selectedValue || 0}
          onChange={(_, newValue) => {
            console.log('Rating onChange:', newValue, typeof newValue);
            if (newValue !== null && !isNaN(newValue)) {
              handleValueSelect(Number(newValue));
            }
          }}
          max={question.range.max}
          precision={question.allowHalf ? 0.5 : 1}
          size="large"
          icon={<Star sx={{ fontSize: 40 }} />}
          emptyIcon={<StarBorder sx={{ fontSize: 40 }} />}
          aria-label="Rating"
          sx={{
            '& .MuiRating-iconFilled': {
              color: 'primary.main',
            },
            '& .MuiRating-iconEmpty': {
              color: 'action.disabled',
            },
            '& .MuiRating-iconHover': {
              color: 'primary.light',
            },
          }}
        />
        {question.showValue && selectedValue !== null && selectedValue > 0 && (
          <Typography sx={{ ml: 2, alignSelf: 'center' }}>
            {selectedValue}/{question.range.max}
          </Typography>
        )}
      </Box>
    );
  };

  const renderNumericRating = () => {
    const values = [];
    const step = question.range.step || 1;
    for (let i = question.range.min; i <= question.range.max; i += step) {
      values.push(i);
    }

    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        mb: 3,
        gap: 1,
        flexWrap: 'wrap',
        px: 2,
      }}>
        {values.map((value) => (
          <Button
            key={value}
            variant={selectedValue === value ? 'contained' : 'outlined'}
            onClick={() => handleValueSelect(value)}
            sx={{
              borderRadius: 3,
              minWidth: 60,
              minHeight: 48,
              borderColor: selectedValue === value ? 'primary.main' : 'divider',
              color: selectedValue === value ? 'primary.contrastText' : 'text.primary',
              backgroundColor: selectedValue === value ? 'primary.main' : 'transparent',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: selectedValue === value ? 'primary.dark' : 'primary.light',
                color: selectedValue === value ? 'primary.contrastText' : 'primary.main',
              },
            }}
            >
              {value}
            </Button>
          ))}
      </Box>
    );
  };

  const renderCategoricalRating = () => {
    if (!question.categories || question.categories.length === 0) {
      return null;
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        {question.categories.map((category, index) => (
          <Button
            key={index}
            variant={selectedValue === index ? 'contained' : 'outlined'}
            onClick={() => handleValueSelect(index)}
            sx={{
              borderRadius: 3,
              minHeight: 48,
              justifyContent: 'flex-start',
              textAlign: 'left',
              borderColor: selectedValue === index ? 'primary.main' : 'divider',
              color: selectedValue === index ? 'primary.contrastText' : 'text.primary',
              backgroundColor: selectedValue === index ? 'primary.main' : 'transparent',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: selectedValue === index ? 'primary.dark' : 'primary.light',
                color: selectedValue === index ? 'primary.contrastText' : 'primary.main',
              },
            }}
          >
            <MarkdownRenderer content={category} />
          </Button>
        ))}
      </Box>
    );
  };

  const getRatingComponent = () => {
    switch (question.ratingType) {
      case 'stars':
        return renderStarRating();
      case 'numeric':
        return renderNumericRating();
      case 'categorical':
        return renderCategoricalRating();
      default:
        return renderNumericRating();
    }
  };

  // Pure render function for the rating question UI
  const renderRatingQuestion = () => (
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

      {/* Rating Component */}
      {getRatingComponent()}
      
      {/* Keyboard Controls Helper - Hide on mobile */}
      {!isMobile && (
        <FormHelperText sx={{ textAlign: 'center', mt: 1, fontSize: '0.75rem', opacity: 0.7 }}>
          {question.ratingType === 'stars' ? `Use number keys (1-${question.range.max})` : 
           question.ratingType === 'categorical' ? `Use number keys (1-${question.categories?.length || 0})` :
           `Use number keys (${question.range.min}-${question.range.max})`} or click to select • Enter to submit
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
        hasResponse={selectedValue !== null && selectedValue > 0}
      >
        {renderRatingQuestion()}
      </UnifiedSurveyQuestionNode>
    );
  }

  // Otherwise render as regular training question with submit button
  return (
    <Box>
      {renderRatingQuestion()}
      
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
          {selectedValue !== null && selectedValue > 0 ? 'Submit' : 'Skip'}
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