import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Alert,
  Collapse,
  Typography,
  Button,
  Radio,
  Stack,
  useTheme as useMuiTheme,
} from '@mui/material';
import type { ChoiceNode } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { useTheme } from '../contexts/ThemeContext';
import { getAlertFeedbackColors } from '../utils/feedbackColors';

interface EnhancedChoiceSelectorProps {
  choices: ChoiceNode[];
  onChoiceSelect: (choice: ChoiceNode) => void;
  disabled?: boolean;
}

export const EnhancedChoiceSelector: React.FC<EnhancedChoiceSelectorProps> = ({
  choices,
  onChoiceSelect,
  disabled = false,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedChoiceNode, setSelectedChoiceNode] = useState<ChoiceNode | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();

  // Reset state when choices change (new question)
  useEffect(() => {
    setSelectedChoice('');
    setShowFeedback(false);
    setSelectedChoiceNode(null);
  }, [choices]);

  // Auto-scroll to feedback when it appears
  useEffect(() => {
    if (showFeedback && feedbackRef.current) {
      const timer = setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 350);
      
      return () => clearTimeout(timer);
    }
  }, [showFeedback]);

  const handleChoiceClick = (choice: ChoiceNode) => {
    if (disabled || showFeedback) return;
    setSelectedChoice(choice.id);
  };

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
    <Box sx={{ mt: 4 }}>
      <Typography 
        
        gutterBottom 
        sx={{ 
          fontWeight: 600, 
          mb: 3,
          textAlign: 'center',
          color: themeMode === 'unfiltered' ? 'text.primary' : 'text.primary'
        }}
      >
        Choose your response:
      </Typography>
      
      <Stack spacing={2} sx={{ mb: 3 }}>
        {choices.map((choice, index) => (
          <NodeCard
            key={choice.id}
            
            interactive={!disabled && !showFeedback}
            selected={selectedChoice === choice.id}
            onClick={() => handleChoiceClick(choice)}
            animate={true}
            sx={{
              cursor: (!disabled && !showFeedback) ? 'pointer' : 'default',
              opacity: disabled ? 0.6 : 1,
              animationDelay: `${index * 100}ms`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Radio
                checked={selectedChoice === choice.id}
                onChange={() => handleChoiceClick(choice)}
                disabled={disabled || showFeedback}
                sx={{
                  mt: 0.5,
                  color: themeMode === 'unfiltered' ? 'unfiltered.textSecondary' : 'text.secondary',
                  '&.Mui-checked': {
                    color: themeMode === 'unfiltered' ? 'unfiltered.brightYellow' : 'primary.main',
                  },
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography 
                  
                  sx={{ 
                    fontSize: '1rem',
                    lineHeight: 1.5,
                    color: 'text.primary',
                    fontWeight: selectedChoice === choice.id ? 600 : 400,
                  }}
                >
                  {choice.text}
                </Typography>
              </Box>
            </Box>
          </NodeCard>
        ))}
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Button
          
          onClick={handleSubmit}
          disabled={!selectedChoice || disabled || showFeedback}
          size="large"
          sx={{ 
            px: 4, 
            py: 1.5,
            borderRadius: themeMode === 'unfiltered' ? 24 : 2,
            boxShadow: themeMode === 'unfiltered' ? 
              '0 4px 16px rgba(246, 250, 36, 0.3)' : 
              'none',
            '&:hover': {
              ...(themeMode === 'unfiltered' && {
                boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                transform: 'translateY(-2px)',
              }),
            },
          }}
        >
          Submit Answer
        </Button>
      </Box>

      <Collapse in={showFeedback}>
        {selectedChoiceNode && (
          <Box ref={feedbackRef} sx={{ mt: 3 }}>
            <NodeCard animate={true}>
              <Alert 
                severity={getFeedbackSeverity(selectedChoiceNode.choiceType)}
                sx={{ 
                  ...getAlertFeedbackColors(
                    muiTheme,
                    themeMode,
                    getFeedbackSeverity(selectedChoiceNode.choiceType) as 'success' | 'error' | 'warning' | 'info'
                  ).backgroundStyle,
                  borderRadius: getAlertFeedbackColors(
                    muiTheme,
                    themeMode,
                    getFeedbackSeverity(selectedChoiceNode.choiceType) as 'success' | 'error' | 'warning' | 'info'
                  ).borderRadius,
                  mb: 2,
                  '& .MuiAlert-icon': {
                    color: getAlertFeedbackColors(
                      muiTheme,
                      themeMode,
                      getFeedbackSeverity(selectedChoiceNode.choiceType) as 'success' | 'error' | 'warning' | 'info'
                    ).iconColor,
                  },
                }}
              >
                <Typography sx={{ fontSize: '1rem' }}>
                  {selectedChoiceNode.feedback || 'Thank you for your response.'}
                </Typography>
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  
                  onClick={handleContinue}
                  size="large"
                  sx={{ 
                    px: 4, 
                    py: 1.5,
                    borderRadius: themeMode === 'unfiltered' ? 24 : 2,
                    boxShadow: themeMode === 'unfiltered' ? 
                      '0 4px 16px rgba(246, 250, 36, 0.3)' : 
                      'none',
                    '&:hover': {
                      ...(themeMode === 'unfiltered' && {
                        boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
                        transform: 'translateY(-2px)',
                      }),
                    },
                  }}
                >
                  Continue
                </Button>
              </Box>
            </NodeCard>
          </Box>
        )}
      </Collapse>
    </Box>
  );
};