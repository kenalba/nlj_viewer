import React, { useState, useEffect } from 'react';
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

    playSound('navigate');
    onAnswer(selectedValue);
  };

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
      
      // Handle Enter key to submit
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedValue, question.required]);

  const getScaleValues = () => {
    const values = [];
    const step = question.scale.step || 1;
    for (let i = question.scale.min; i <= question.scale.max; i += step) {
      values.push(i);
    }
    return values;
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
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, px: 1 }}>
        <ButtonGroup 
          variant="outlined" 
          size="large"
          orientation={scaleValues.length > 7 ? 'vertical' : 'horizontal'}
          sx={{ 
            gap: 1,
            '& .MuiButtonGroup-grouped': {
              borderRadius: 3,
              '&:not(:last-of-type)': {
                borderBottomRightRadius: 3,
                borderTopRightRadius: 3,
                borderRightColor: 'divider',
              },
              '&:not(:first-of-type)': {
                borderTopLeftRadius: 3,
                borderBottomLeftRadius: 3,
                borderLeftColor: 'divider',
              },
              '&:last-of-type': {
                borderRight: '1px solid',
                borderRightColor: 'divider',
              },
            },
            ...(scaleValues.length > 7 && {
              '& .MuiButtonGroup-grouped': {
                borderRadius: 3,
                '&:not(:last-of-type)': {
                  borderBottomRightRadius: 3,
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                },
                '&:not(:first-of-type)': {
                  borderTopLeftRadius: 3,
                  borderTop: '1px solid',
                  borderTopColor: 'divider',
                },
                '&:last-of-type': {
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
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
      
      {/* Keyboard Controls Helper */}
      <FormHelperText sx={{ textAlign: 'center', mt: 1, fontSize: '0.75rem', opacity: 0.7 }}>
        Use number keys (1-{getScaleValues().length}) or arrow keys to select • Enter to submit
      </FormHelperText>
    </NodeCard>
  );
};