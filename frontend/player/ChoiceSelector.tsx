import React, { useState, useEffect, useRef } from 'react';
import {
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Box,
  Alert,
  Collapse,
  Typography,
} from '@mui/material';
import type { ChoiceNode } from '../types/nlj';

interface ChoiceSelectorProps {
  choices: ChoiceNode[];
  onChoiceSelect: (choice: ChoiceNode) => void;
  disabled?: boolean;
}

export const ChoiceSelector: React.FC<ChoiceSelectorProps> = ({
  choices,
  onChoiceSelect,
  disabled = false,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedChoiceNode, setSelectedChoiceNode] = useState<ChoiceNode | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Reset state when choices change (new question)
  useEffect(() => {
    setSelectedChoice('');
    setShowFeedback(false);
    setSelectedChoiceNode(null);
  }, [choices]);

  // Auto-scroll to feedback when it appears
  useEffect(() => {
    if (showFeedback && feedbackRef.current) {
      // Delay scroll to allow Collapse animation to complete
      const timer = setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 350); // Material-UI Collapse animation duration
      
      return () => clearTimeout(timer);
    }
  }, [showFeedback]);

  const handleSubmit = () => {
    const choice = choices.find(c => c.id === selectedChoice);
    if (choice) {
      setSelectedChoiceNode(choice);
      setShowFeedback(true);
    }
  };

  const handleContinue = () => {
    if (selectedChoiceNode) {
      onChoiceSelect(selectedChoiceNode);
    }
  };

  const getFeedbackSeverity = (choiceType: string) => {
    switch (choiceType) {
      case 'CORRECT':
        return 'success';
      case 'INCORRECT':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Choose your response:
      </Typography>
      
      <FormControl component="fieldset" fullWidth disabled={disabled || showFeedback}>
        <RadioGroup
          value={selectedChoice}
          onChange={(e) => setSelectedChoice(e.target.value)}
        >
          {choices.map((choice) => (
            <FormControlLabel
              key={choice.id}
              value={choice.id}
              control={<Radio />}
              label={choice.text}
              sx={{ 
                alignItems: 'flex-start',
                mb: 2,
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: selectedChoice === choice.id ? 'hyundai.accent' : 'secondary.main',
                backgroundColor: selectedChoice === choice.id ? 'hyundai.light' : 'transparent',
                '&:hover': {
                  backgroundColor: selectedChoice === choice.id ? 'hyundai.light' : 'action.hover',
                },
                '& .MuiFormControlLabel-label': {
                  pt: 0.5,
                  fontSize: '1rem',
                  lineHeight: 1.5,
                }
              }}
            />
          ))}
        </RadioGroup>
      </FormControl>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          
          onClick={handleSubmit}
          disabled={!selectedChoice || disabled || showFeedback}
          size="large"
          sx={{ px: 4, py: 1.5 }}
        >
          Submit Answer
        </Button>
      </Box>

      <Collapse in={showFeedback}>
        {selectedChoiceNode && (
          <Box ref={feedbackRef} sx={{ mt: 3 }}>
            <Alert 
              severity={getFeedbackSeverity(selectedChoiceNode.choiceType)}
              sx={{ borderRadius: 2, mb: 2 }}
            >
              <Typography sx={{ fontSize: '1rem' }}>
                {selectedChoiceNode.feedback || 'Thank you for your response.'}
              </Typography>
            </Alert>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                
                onClick={handleContinue}
                size="large"
                sx={{ px: 4, py: 1.5 }}
              >
                Continue
              </Button>
            </Box>
          </Box>
        )}
      </Collapse>
    </Box>
  );
};