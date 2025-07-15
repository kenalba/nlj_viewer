import React, { useState } from 'react';
import { Box, Typography, Rating, Button, Alert, FormHelperText, ButtonGroup } from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import type { RatingNode as RatingNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';

interface RatingNodeProps {
  question: RatingNodeType;
  onAnswer: (response: number | null) => void;
}

export const RatingNode: React.FC<RatingNodeProps> = ({ question, onAnswer }) => {
  const [selectedValue, setSelectedValue] = useState<number | null>(question.defaultValue || null);
  const [showValidation, setShowValidation] = useState(false);
  const { playSound } = useAudio();
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();

  const handleValueSelect = (value: number) => {
    console.log('handleValueSelect:', value, typeof value);
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setSelectedValue(numValue);
      setShowValidation(false);
      playSound('click');
    }
  };

  const handleSubmit = () => {
    console.log('handleSubmit:', selectedValue, typeof selectedValue);
    if (question.required && selectedValue === null) {
      setShowValidation(true);
      playSound('error');
      return;
    }

    playSound('navigate');
    onAnswer(selectedValue);
  };

  const renderStarRating = () => {
    const isUnfiltered = themeMode === 'unfiltered';
    
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
              color: isUnfiltered ? '#F6FA24' : '#ffc107',
            },
            '& .MuiRating-iconEmpty': {
              color: isUnfiltered ? '#333333' : '#e0e0e0',
            },
            '& .MuiRating-iconHover': {
              color: isUnfiltered ? '#FFD700' : '#ffb300',
            },
          }}
        />
        {question.showValue && selectedValue !== null && selectedValue > 0 && (
          <Typography variant="h6" sx={{ ml: 2, alignSelf: 'center' }}>
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
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <ButtonGroup variant="outlined" size="large">
          {values.map((value) => (
            <Button
              key={value}
              variant={selectedValue === value ? 'contained' : 'outlined'}
              onClick={() => handleValueSelect(value)}
              sx={{
                borderRadius: 3,
                minWidth: 60,
                minHeight: 48,
                ...(themeMode === 'unfiltered' && {
                  borderColor: selectedValue === value ? '#F6FA24' : '#333333',
                  backgroundColor: selectedValue === value ? 'rgba(246, 250, 36, 0.1)' : 'transparent',
                  color: selectedValue === value ? '#F6FA24' : '#FFFFFF',
                  '&:hover': {
                    borderColor: '#F6FA24',
                    backgroundColor: 'rgba(246, 250, 36, 0.05)',
                  },
                }),
                ...(selectedValue === value && themeMode !== 'unfiltered' && {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                }),
              }}
            >
              {value}
            </Button>
          ))}
        </ButtonGroup>
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
              ...(themeMode === 'unfiltered' && {
                borderColor: selectedValue === index ? '#F6FA24' : '#333333',
                backgroundColor: selectedValue === index ? 'rgba(246, 250, 36, 0.1)' : 'transparent',
                color: selectedValue === index ? '#F6FA24' : '#FFFFFF',
                '&:hover': {
                  borderColor: '#F6FA24',
                  backgroundColor: 'rgba(246, 250, 36, 0.05)',
                },
              }),
              ...(selectedValue === index && themeMode !== 'unfiltered' && {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              }),
            }}
          >
            {category}
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

      {/* Rating Component */}
      {getRatingComponent()}

      {/* Validation Error */}
      {showValidation && question.required && selectedValue === null && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          This question is required. Please select a rating.
        </Alert>
      )}

      {/* Submit Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          size="large"
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
          {selectedValue !== null && selectedValue > 0 ? 'Submit' : 'Skip'}
        </Button>
      </Box>

      {/* Helper Text */}
      {question.required && (
        <FormHelperText sx={{ textAlign: 'center', mt: 1 }}>
          * This question is required
        </FormHelperText>
      )}
    </NodeCard>
  );
};