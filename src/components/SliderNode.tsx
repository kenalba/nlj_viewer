import React, { useState } from 'react';
import { Box, Typography, Slider, Button, Alert, FormHelperText } from '@mui/material';
import type { SliderNode as SliderNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';

interface SliderNodeProps {
  question: SliderNodeType;
  onAnswer: (response: number | null) => void;
}

export const SliderNode: React.FC<SliderNodeProps> = ({ question, onAnswer }) => {
  const [selectedValue, setSelectedValue] = useState<number | null>(
    question.defaultValue !== undefined ? question.defaultValue : 
    question.required ? null : null
  );
  const [showValidation, setShowValidation] = useState(false);
  const { playSound } = useAudio();
  const { themeMode } = useTheme();

  const handleValueChange = (_event: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    setSelectedValue(value);
    setShowValidation(false);
    playSound('click');
  };

  const handleSubmit = () => {
    if (question.required && selectedValue === null) {
      setShowValidation(true);
      playSound('error');
      return;
    }

    playSound('navigate');
    onAnswer(selectedValue);
  };

  const formatValue = (value: number) => {
    if (question.range.precision !== undefined) {
      return value.toFixed(question.range.precision);
    }
    return value.toString();
  };

  const getValueLabel = (value: number) => {
    // Check for custom labels
    if (question.labels.custom && question.labels.custom[value]) {
      return question.labels.custom[value];
    }
    
    // Default behavior
    if (question.showValue !== false) {
      return formatValue(value);
    }
    
    return null;
  };

  const generateMarks = () => {
    if (!question.showTicks) return [];
    
    const marks = [];
    const step = question.range.step || 1;
    const markStep = Math.max(step, (question.range.max - question.range.min) / 10);
    
    for (let i = question.range.min; i <= question.range.max; i += markStep) {
      marks.push({
        value: i,
        label: question.labels.custom?.[i] || (question.showValue !== false ? formatValue(i) : ''),
      });
    }
    
    return marks;
  };

  const marks = generateMarks();

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

      {/* Slider Labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, px: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {question.labels.min}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {question.labels.max}
        </Typography>
      </Box>

      {/* Current Value Display */}
      {question.showValue !== false && selectedValue !== null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Typography variant="h6" color="primary">
            {getValueLabel(selectedValue)}
          </Typography>
        </Box>
      )}

      {/* Slider Component */}
      <Box sx={{ px: 2, mb: 4 }}>
        <Slider
          value={selectedValue || question.range.min}
          onChange={handleValueChange}
          min={question.range.min}
          max={question.range.max}
          step={question.range.step || 1}
          marks={marks}
          valueLabelDisplay={question.showValue !== false ? "auto" : "off"}
          valueLabelFormat={(value) => formatValue(value)}
          track={question.continuous !== false ? "normal" : false}
          sx={{
            height: 8,
            '& .MuiSlider-track': {
              border: 'none',
              ...(themeMode === 'unfiltered' && {
                backgroundColor: '#F6FA24',
              }),
            },
            '& .MuiSlider-thumb': {
              height: 24,
              width: 24,
              backgroundColor: themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main',
              border: '2px solid currentColor',
              '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                boxShadow: `0px 0px 0px 8px ${
                  themeMode === 'unfiltered' ? 'rgba(246, 250, 36, 0.16)' : 'inherit'
                }`,
              },
              '&:before': {
                display: 'none',
              },
            },
            '& .MuiSlider-valueLabel': {
              lineHeight: 1.2,
              fontSize: 12,
              background: 'unset',
              padding: 0,
              width: 32,
              height: 32,
              borderRadius: '50% 50% 50% 0',
              backgroundColor: themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main',
              color: themeMode === 'unfiltered' ? '#000000' : '#ffffff',
              transformOrigin: 'bottom left',
              transform: 'translate(50%, -100%) rotate(-45deg) scale(0)',
              '&:before': { display: 'none' },
              '&.MuiSlider-valueLabelOpen': {
                transform: 'translate(50%, -100%) rotate(-45deg) scale(1)',
              },
              '& > *': {
                transform: 'rotate(45deg)',
              },
            },
            '& .MuiSlider-rail': {
              color: themeMode === 'unfiltered' ? '#333333' : '#d0d0d0',
              opacity: 1,
            },
            '& .MuiSlider-mark': {
              backgroundColor: themeMode === 'unfiltered' ? '#666666' : '#bfbfbf',
              height: 8,
              width: 1,
              '&.MuiSlider-markActive': {
                opacity: 1,
                backgroundColor: 'currentColor',
              },
            },
            '& .MuiSlider-markLabel': {
              color: 'text.secondary',
              fontSize: '0.75rem',
            },
          }}
        />
      </Box>

      {/* Validation Error */}
      {showValidation && question.required && selectedValue === null && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          This question is required. Please select a value.
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
          {selectedValue !== null ? 'Submit' : 'Skip'}
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