import React, { useState, useEffect } from 'react';
import { Box, Typography, Slider, Button, Alert, FormHelperText } from '@mui/material';
import type { SliderNode as SliderNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface SliderNodeProps {
  question: SliderNodeType;
  onAnswer: (response: number | null) => void;
}

export const SliderNode: React.FC<SliderNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [selectedValue, setSelectedValue] = useState<number | null>(
    question.defaultValue !== undefined ? question.defaultValue : 
    question.required ? null : null
  );
  const [showValidation, setShowValidation] = useState(false);
  const { playSound } = useAudio();

  if (import.meta.env.DEV) {
    console.log(`SliderNode ${question.id}: shuffleAnswerOrder=${settings.shuffleAnswerOrder}, reinforcementEligible=${settings.reinforcementEligible}`);
  }

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

  // Add keyboard controls for slider
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const range = question.range.max - question.range.min;
      
      // Handle number keys (1-9) for percentage-based positioning
      if (event.key >= '1' && event.key <= '9') {
        event.preventDefault();
        const percentage = parseInt(event.key) / 10; // 1 = 10%, 2 = 20%, etc.
        const newValue = question.range.min + (range * percentage);
        const clampedValue = Math.min(Math.max(newValue, question.range.min), question.range.max);
        
        // Respect the step value if it exists
        const step = question.range.step || 1;
        const steppedValue = Math.round(clampedValue / step) * step;
        const finalValue = Math.min(Math.max(steppedValue, question.range.min), question.range.max);
        
        setSelectedValue(finalValue);
        playSound('click');
        return;
      }
      
      // Handle other keys
      switch (event.key) {
        case '0':
          event.preventDefault();
          setSelectedValue(question.range.max); // 0 = 100%
          playSound('click');
          break;
        case 'Enter':
          event.preventDefault();
          handleSubmit();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedValue, question.range, playSound, handleSubmit]);

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

      {/* Current Value Display */}
      {question.showValue !== false && selectedValue !== null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Typography variant="h6" color="primary">
            {getValueLabel(selectedValue)}
          </Typography>
        </Box>
      )}

      {/* Slider Labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, px: 3 }}>
        <Typography color="text.secondary">
          {question.labels.min}
        </Typography>
        <Typography color="text.secondary">
          {question.labels.max}
        </Typography>
      </Box>

      {/* Slider Component */}
      <Box sx={{ 
        px: 2, 
        mb: 8, // Increased from 6 to 8 to prevent halo cutoff
        pt: 4, // Add top padding to prevent halo cutoff
        position: 'relative',
        overflow: 'visible', // Changed from 'hidden' to 'visible' for halo
        width: '100%',
        boxSizing: 'border-box'
      }}>
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
            width: 'calc(100% - 48px)', // Account for thumb width and halo
            margin: '0 24px', // Center the slider and provide thumb + halo space
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
          }}
        >
          {selectedValue !== null ? 'Submit' : 'Skip'}
        </Button>
      </Box>

      {/* Helper Text */}
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        {question.required && (
          <FormHelperText sx={{ mb: 0.5 }}>
            * This question is required
          </FormHelperText>
        )}
        <FormHelperText sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          Use number keys 1-9 for 10%-90%, 0 for 100%, Enter to submit
        </FormHelperText>
      </Box>
    </NodeCard>
  );
};