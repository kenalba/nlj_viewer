import React, { useState, useCallback } from 'react';
import { Box, Typography, TextField, Divider, Button, Alert } from '@mui/material';
import type { 
  LikertScaleNode, 
  RatingNode, 
  MatrixNode, 
  SliderNode, 
  TextAreaNode,
  SurveyFollowUpConfig 
} from '../types/nlj';
import { buildSurveyResponseStatement, createActor } from '../xapi';
import { useAudio } from '../contexts/AudioContext';

// Union type for all survey question types
export type SurveyQuestionNode = LikertScaleNode | RatingNode | MatrixNode | SliderNode | TextAreaNode;

interface UnifiedSurveyQuestionNodeProps {
  question: SurveyQuestionNode;
  children: React.ReactNode; // The actual question UI (LikertScale, Rating, etc.)
  onAnswer: (response: any) => void;
  response: any; // Current response value
  hasResponse: boolean; // Whether user has provided a response
}

export const UnifiedSurveyQuestionNode: React.FC<UnifiedSurveyQuestionNodeProps> = ({
  question,
  children,
  onAnswer,
  response,
  hasResponse
}) => {
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const { playSound } = useAudio();

  // Show follow-up when response is provided and follow-up is enabled
  React.useEffect(() => {
    if (hasResponse && question.followUp?.enabled && !showFollowUp) {
      setShowFollowUp(true);
    }
  }, [hasResponse, question.followUp?.enabled, showFollowUp]);

  const handleFinalSubmit = useCallback(() => {
    // Validate primary response
    if (question.required && !hasResponse) {
      setShowValidation(true);
      playSound('error');
      return;
    }

    // Validate follow-up response if required
    if (question.followUp?.enabled && question.followUp?.required && !followUpResponse.trim()) {
      setShowValidation(true);
      playSound('error');
      return;
    }

    playSound('navigate');

    // Create survey response statement with follow-up
    try {
      const actor = createActor({
        name: 'Anonymous User', // TODO: Get from auth context
        email: 'user@example.com'
      });

      const statement = buildSurveyResponseStatement({
        actor,
        surveyId: 'current-survey', // TODO: Get from survey context
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        response: response,
        followUpResponse: followUpResponse || undefined
      });

      console.log('Survey response statement:', statement);
    } catch (error) {
      console.error('Error creating survey response statement:', error);
    }

    onAnswer(response);
  }, [
    question.required,
    question.followUp,
    question.id,
    question.text,
    question.type,
    hasResponse,
    followUpResponse,
    response,
    playSound,
    onAnswer
  ]);

  // Render follow-up UI if enabled and response is provided
  const renderFollowUp = () => {
    if (!showFollowUp || !question.followUp?.enabled) {
      return null;
    }

    return (
      <Box sx={{ mt: 3, mb: 3 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" gutterBottom color="text.secondary">
          {question.followUp.prompt || "Please explain your answer:"}
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder={question.followUp.placeholder || "Enter your thoughts here..."}
          value={followUpResponse}
          onChange={(e) => {
            const value = e.target.value;
            if (!question.followUp?.maxLength || value.length <= question.followUp.maxLength) {
              setFollowUpResponse(value);
              setShowValidation(false);
            }
          }}
          error={showValidation && question.followUp.required && !followUpResponse.trim()}
          helperText={
            showValidation && question.followUp.required && !followUpResponse.trim() 
              ? "This follow-up response is required" 
              : question.followUp.maxLength 
                ? `${followUpResponse.length}/${question.followUp.maxLength} characters`
                : undefined
          }
          sx={{ 
            bgcolor: 'grey.50',
            borderRadius: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1,
            }
          }}
        />
      </Box>
    );
  };

  // Render validation errors
  const renderValidation = () => {
    if (!showValidation) return null;

    if (question.required && !hasResponse) {
      return (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          This question is required. Please provide a response.
        </Alert>
      );
    }

    return null;
  };

  // Render submit button
  const renderSubmitButton = () => {
    const isDisabled = 
      (question.required && !hasResponse) || 
      (question.followUp?.enabled && question.followUp?.required && !followUpResponse.trim());

    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleFinalSubmit}
          size="large"
          disabled={isDisabled}
          sx={{
            borderRadius: 3,
            minWidth: 120,
          }}
        >
          {hasResponse ? 'Submit' : 'Skip'}
        </Button>
      </Box>
    );
  };

  return (
    <Box>
      {/* Original question UI */}
      {children}

      {/* Follow-up response */}
      {renderFollowUp()}

      {/* Validation errors */}
      {renderValidation()}

      {/* Submit button */}
      {renderSubmitButton()}
    </Box>
  );
};

// Helper function to check if a question node has follow-up enabled
export const hasFollowUpEnabled = (question: SurveyQuestionNode): boolean => {
  return question.followUp?.enabled === true;
};

// Helper function to get follow-up config from a question
export const getFollowUpConfig = (question: SurveyQuestionNode): SurveyFollowUpConfig | undefined => {
  return question.followUp;
};