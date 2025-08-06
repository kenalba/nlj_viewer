/**
 * Unified Feedback Display Component
 * Provides consistent, prominent feedback across all question node types
 */

import React from 'react';
import { Alert, Typography, Box, useTheme as useMuiTheme } from '@mui/material';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useTheme } from '../contexts/ThemeContext';

export type FeedbackSeverity = 'success' | 'error' | 'warning' | 'info';

interface FeedbackDisplayProps {
  /** The feedback message content (supports markdown) */
  message: string;
  /** The severity level determining color and icon */
  severity: FeedbackSeverity;
  /** Additional content to show below the main message */
  additionalContent?: React.ReactNode;
  /** Whether to show markdown rendering (default: true) */
  renderMarkdown?: boolean;
  /** Custom styling overrides */
  sx?: any;
  /** Whether to center align the content (default: true) */
  centerAlign?: boolean;
}

/**
 * Get enhanced styling for better feedback visibility
 */
const getEnhancedFeedbackStyles = (severity: FeedbackSeverity, themeMode: string) => {
  const borderColor = {
    success: 'success.main',
    error: 'error.main', 
    warning: 'warning.main',
    info: 'info.main'
  }[severity];

  return {
    border: '2px solid',
    borderColor,
    borderRadius: 2,
    '& .MuiAlert-message': {
      width: '100%',
      ...(themeMode !== 'unfiltered' && {
        textAlign: 'center'
      })
    },
    '& .MuiAlert-icon': {
      fontSize: '1.5rem'
    },
    // Enhanced background for unfiltered theme
    ...(themeMode === 'unfiltered' && {
      backgroundColor: 'rgba(246, 250, 36, 0.08)',
      '& .MuiAlert-icon': {
        color: severity === 'success' ? 'success.main' : 
              severity === 'error' ? 'error.main' :
              severity === 'warning' ? 'warning.main' : 'info.main'
      }
    })
  };
};

/**
 * Enhanced typography styles for better readability
 */
const getMessageStyles = (centerAlign: boolean) => ({
  fontSize: '1.1rem',
  fontWeight: 600,
  color: 'text.primary',
  ...(centerAlign && { textAlign: 'center' }),
  '& p': {
    fontWeight: 600,
    fontSize: '1.1rem',
    margin: 0,
    ...(centerAlign && { textAlign: 'center' })
  }
});

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  message,
  severity,
  additionalContent,
  renderMarkdown = true,
  sx = {},
  centerAlign = true
}) => {
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();

  const enhancedStyles = getEnhancedFeedbackStyles(severity, themeMode);
  const messageStyles = getMessageStyles(centerAlign);

  return (
    <Alert 
      severity={severity}
      sx={{
        mt: 2,
        mb: 2,
        ...enhancedStyles,
        ...sx
      }}
    >
      <Box>
        {renderMarkdown ? (
          <MarkdownRenderer
            content={message}
            sx={messageStyles}
          />
        ) : (
          <Typography sx={messageStyles}>
            {message}
          </Typography>
        )}
        
        {additionalContent && (
          <Box sx={{ mt: 1 }}>
            {additionalContent}
          </Box>
        )}
      </Box>
    </Alert>
  );
};

/**
 * Specialized feedback for True/False questions
 */
export const TrueFalseFeedback: React.FC<{
  isCorrect: boolean;
  correctAnswer: boolean;
}> = ({ isCorrect, correctAnswer }) => {
  const message = isCorrect 
    ? 'Correct! Well done.'
    : `Incorrect. The correct answer is: ${correctAnswer ? 'True' : 'False'}`;
  
  return (
    <FeedbackDisplay
      message={message}
      severity={isCorrect ? 'success' : 'error'}
    />
  );
};

/**
 * Specialized feedback for Short Answer questions
 */
export const ShortAnswerFeedback: React.FC<{
  isCorrect: boolean;
  userAnswer: string;
  correctAnswers?: string[];
}> = ({ isCorrect, userAnswer, correctAnswers }) => {
  const message = isCorrect
    ? 'Correct! Well done.'
    : correctAnswers && correctAnswers.length > 0
    ? `Incorrect. Correct answers include: ${correctAnswers.slice(0, 3).join(', ')}${correctAnswers.length > 3 ? '...' : ''}`
    : 'Incorrect. Please review the material and try again.';

  const additionalContent = (
    <Typography sx={{ mt: 1, fontStyle: 'italic', fontSize: '0.95rem' }}>
      Your answer: "{userAnswer}"
    </Typography>
  );

  return (
    <FeedbackDisplay
      message={message}
      severity={isCorrect ? 'success' : 'error'}
      additionalContent={additionalContent}
      renderMarkdown={false}
    />
  );
};

/**
 * Specialized feedback for Multiple Choice questions
 */
export const MultipleChoiceFeedback: React.FC<{
  feedback: string;
  isCorrect: boolean;
  choiceType?: 'CORRECT' | 'INCORRECT' | 'NEUTRAL' | string;
}> = ({ feedback, isCorrect, choiceType }) => {
  // Determine severity based on choice type
  let severity: FeedbackSeverity = 'info';
  if (choiceType === 'CORRECT' || isCorrect) {
    severity = 'success';
  } else if (choiceType === 'INCORRECT') {
    severity = 'error';
  } else {
    // Default to info for neutral/undefined choice types
    severity = 'info';
  }

  return (
    <FeedbackDisplay
      message={feedback || 'Thank you for your response.'}
      severity={severity}
    />
  );
};

/**
 * Specialized feedback for Matching questions
 */
export const MatchingFeedback: React.FC<{
  score: number;
  totalMatches: number;
}> = ({ score, totalMatches }) => {
  const isCorrect = score === totalMatches;
  const message = isCorrect
    ? 'Excellent! All matches are correct.'
    : `You got ${score} out of ${totalMatches} matches correct.`;

  return (
    <FeedbackDisplay
      message={message}
      severity={isCorrect ? 'success' : 'warning'}
      renderMarkdown={false}
    />
  );
};

/**
 * Specialized feedback for Ordering questions
 */
export const OrderingFeedback: React.FC<{
  isCorrect: boolean;
  correctOrder?: { text: string; correctOrder: number }[];
}> = ({ isCorrect, correctOrder }) => {
  const message = isCorrect
    ? 'Correct! You have arranged the items in the proper order.'
    : correctOrder && correctOrder.length > 0
    ? `Incorrect. The correct order is: ${correctOrder.map(item => `${item.correctOrder}. ${item.text}`).join(', ')}`
    : 'Incorrect. Please review the correct order.';

  return (
    <FeedbackDisplay
      message={message}
      severity={isCorrect ? 'success' : 'error'}
      renderMarkdown={false}
    />
  );
};

/**
 * Specialized feedback for Checkbox questions
 */
export const CheckboxFeedback: React.FC<{
  isCorrect: boolean;
  selectedCount: number;
  correctOptions?: string[];
}> = ({ isCorrect, selectedCount, correctOptions }) => {
  const message = isCorrect
    ? `Correct! You selected ${selectedCount} option${selectedCount === 1 ? '' : 's'}.`
    : correctOptions && correctOptions.length > 0
    ? `Incorrect. The correct options are: ${correctOptions.join(', ')}`
    : 'Incorrect. Please review your selections.';

  return (
    <FeedbackDisplay
      message={message}
      severity={isCorrect ? 'success' : 'error'}
      renderMarkdown={false}
    />
  );
};