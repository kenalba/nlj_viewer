import React, { useState } from 'react';
import { Box, Typography, ButtonGroup, Button, Alert, FormHelperText } from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import type { LikertScaleNode as LikertScaleNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';

interface LikertScaleNodeProps {
  question: LikertScaleNodeType;
  onAnswer: (response: number) => void;
}

export const LikertScaleNode: React.FC<LikertScaleNodeProps> = ({ question, onAnswer }) => {
  const [selectedValue, setSelectedValue] = useState<number | null>(question.defaultValue || null);
  const [showValidation, setShowValidation] = useState(false);
  const { playSound } = useAudio();
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();

  const handleValueSelect = (value: number) => {
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

    if (selectedValue !== null) {
      playSound('navigate');
      onAnswer(selectedValue);
    }
  };

  const getScaleValues = () => {
    const values = [];
    const step = question.scale.step || 1;
    for (let i = question.scale.min; i <= question.scale.max; i += step) {
      values.push(i);
    }
    return values;
  };

  const getValueLabel = (value: number) => {
    // Check for custom labels first
    if (question.scale.labels.custom && question.scale.labels.custom[value]) {
      return question.scale.labels.custom[value];
    }
    
    // Default labels for min/max/middle
    if (value === question.scale.min) return question.scale.labels.min;
    if (value === question.scale.max) return question.scale.labels.max;
    if (question.scale.labels.middle) {
      const middle = Math.floor((question.scale.min + question.scale.max) / 2);
      if (value === middle) return question.scale.labels.middle;
    }
    
    return question.showNumbers !== false ? value.toString() : '';
  };

  const getButtonVariant = (value: number) => {
    return selectedValue === value ? 'contained' : 'outlined';
  };

  const getButtonStyles = (value: number) => {
    const isSelected = selectedValue === value;
    const isUnfiltered = themeMode === 'unfiltered';
    
    return {
      borderRadius: 3,
      minWidth: 60,
      minHeight: 48,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
      ...(isUnfiltered && {
        borderColor: isSelected ? '#F6FA24' : '#333333',
        backgroundColor: isSelected ? 'rgba(246, 250, 36, 0.1)' : 'transparent',
        color: isSelected ? '#F6FA24' : '#FFFFFF',
        '&:hover': {
          borderColor: '#F6FA24',
          backgroundColor: 'rgba(246, 250, 36, 0.05)',
        },
      }),
      ...(isSelected && !isUnfiltered && {
        backgroundColor: 'primary.main',
        color: 'primary.contrastText',
        '&:hover': {
          backgroundColor: 'primary.dark',
        },
      }),
    };
  };

  const scaleValues = getScaleValues();

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

      {/* Scale Labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, px: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: '30%' }}>
          {question.scale.labels.min}
        </Typography>
        {question.scale.labels.middle && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: '30%' }}>
            {question.scale.labels.middle}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: '30%' }}>
          {question.scale.labels.max}
        </Typography>
      </Box>

      {/* Scale Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <ButtonGroup 
          variant="outlined" 
          size="large"
          orientation={scaleValues.length > 7 ? 'vertical' : 'horizontal'}
          sx={{ 
            gap: 1,
            ...(scaleValues.length > 7 && {
              '& .MuiButtonGroup-grouped': {
                borderRadius: 3,
                '&:not(:last-of-type)': {
                  borderBottomRightRadius: 3,
                },
                '&:not(:first-of-type)': {
                  borderTopLeftRadius: 3,
                },
              },
            }),
          }}
        >
          {scaleValues.map((value) => (
            <Button
              key={value}
              variant={getButtonVariant(value)}
              onClick={() => handleValueSelect(value)}
              sx={getButtonStyles(value)}
            >
              {question.showNumbers !== false && (
                <Typography variant="body2" fontWeight="bold">
                  {value}
                </Typography>
              )}
              {question.showLabels !== false && getValueLabel(value) && (
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  {getValueLabel(value)}
                </Typography>
              )}
            </Button>
          ))}
        </ButtonGroup>
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
          disabled={question.required && selectedValue === null}
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