/**
 * Generation Progress Component
 * Shows generation progress and handles the actual AI content generation
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Upload as UploadIcon,
  Settings as ConfigIcon,
  AutoAwesome as GenerateIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RetryIcon,
  Description as DocumentIcon
} from '@mui/icons-material';
import { SourceDocument } from '../../client/sources';
import { formatBytes } from '../../utils/formatters';

interface GenerationProgressProps {
  status: 'idle' | 'generating' | 'completed' | 'error';
  error: string | null;
  onStartGeneration: () => void;
  selectedDocuments: SourceDocument[];
  promptConfig: any;
}

const generationSteps = [
  { label: 'Uploading documents to Claude', description: 'Ensuring documents are available for analysis' },
  { label: 'Analyzing source content', description: 'AI is reading and understanding your documents' },
  { label: 'Generating scenario structure', description: 'Creating learning objectives and flow' },
  { label: 'Creating interactive elements', description: 'Building questions and activities' },
  { label: 'Validating output', description: 'Ensuring generated content meets NLJ schema requirements' }
];

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  status,
  error,
  onStartGeneration,
  selectedDocuments,
  promptConfig
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Simulate step progression during generation
  React.useEffect(() => {
    if (status === 'generating') {
      const stepInterval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev < generationSteps.length - 1) {
            return prev + 1;
          }
          clearInterval(stepInterval);
          return prev;
        });
      }, 1000);

      return () => clearInterval(stepInterval);
    } else {
      setCurrentStep(0);
    }
  }, [status]);

  const renderReadyToGenerate = () => (
    <Box textAlign="center" py={4}>
      <GenerateIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        Ready to Generate Content
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Your configuration is complete. Click below to start AI content generation.
      </Typography>

      {/* Generation Summary */}
      <Card sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Generation Summary
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <DocumentIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Source Documents"
                secondary={`${selectedDocuments.length} documents selected`}
              />
              <Box>
                {selectedDocuments.map(doc => (
                  <Chip 
                    key={doc.id}
                    label={doc.original_filename}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            </ListItem>
            
            <Divider />
            
            <ListItem>
              <ListItemIcon>
                <ConfigIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Configuration"
                secondary={`${promptConfig?.contentStyle || 'Default'} style, complexity ${promptConfig?.complexityLevel || 3}/5`}
              />
            </ListItem>
            
            {promptConfig?.audiencePersona && (
              <>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="Target Audience"
                    secondary={promptConfig.audiencePersona}
                  />
                </ListItem>
              </>
            )}
            
            {promptConfig?.learningObjective && (
              <>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="Learning Objective"
                    secondary={promptConfig.learningObjective}
                  />
                </ListItem>
              </>
            )}
          </List>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="body2">
          Generation typically takes 30-60 seconds depending on document size and complexity.
        </Typography>
      </Alert>

      <Button
        variant="contained"
        size="large"
        startIcon={<StartIcon />}
        onClick={onStartGeneration}
        sx={{ px: 4 }}
      >
        Start Generation
      </Button>
    </Box>
  );

  const renderGenerating = () => (
    <Box py={4}>
      <Box textAlign="center" mb={4}>
        <CircularProgress size={60} />
        <Typography variant="h5" gutterBottom sx={{ mt: 2 }}>
          Generating Your Learning Activity
        </Typography>
        <Typography variant="body1" color="text.secondary">
          AI is analyzing your documents and creating engaging content...
        </Typography>
      </Box>

      <Card sx={{ maxWidth: 800, mx: 'auto' }}>
        <CardContent>
          <LinearProgress sx={{ mb: 3 }} />
          
          <Stepper activeStep={currentStep} orientation="vertical">
            {generationSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>
                  {step.label}
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>
    </Box>
  );

  const renderCompleted = () => (
    <Box textAlign="center" py={4}>
      <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        Content Generated Successfully!
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Your learning activity has been created and is ready for review.
      </Typography>
    </Box>
  );

  const renderError = () => (
    <Box textAlign="center" py={4}>
      <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        Generation Failed
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        {error || 'An unexpected error occurred during content generation.'}
      </Typography>
      
      <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="body2">
          Common issues: Document format not supported, content too complex, or API rate limits exceeded.
        </Typography>
      </Alert>

      <Button
        variant="contained"
        startIcon={<RetryIcon />}
        onClick={onStartGeneration}
      >
        Retry Generation
      </Button>
    </Box>
  );

  switch (status) {
    case 'idle':
      return renderReadyToGenerate();
    case 'generating':
      return renderGenerating();
    case 'completed':
      return renderCompleted();
    case 'error':
      return renderError();
    default:
      return renderReadyToGenerate();
  }
};