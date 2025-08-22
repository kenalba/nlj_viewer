/**
 * Create Activity Modal with Template Selection
 * Enhanced content creation experience with activity type templates
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  TextField,
  Chip,
  Step,
  Stepper,
  StepLabel,
  useTheme,
  alpha
} from '@mui/material';
import {
  DesignServices as DesignServicesIcon,
  Poll as PollIcon,
  Quiz as QuizIcon,
  AccountTree as AccountTreeIcon,
  Games as GamesIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import type { NLJScenario } from '../types/nlj';
import { ACTIVITY_TEMPLATES, type ActivityTemplate } from '../utils/activityTemplates';

interface CreateActivityModalProps {
  open: boolean;
  onClose: () => void;
  onActivityCreated: (template: ActivityTemplate, name: string, description?: string) => void;
}

const MODAL_STEPS = ['Select Template', 'Activity Details'];

export const CreateActivityModal: React.FC<CreateActivityModalProps> = ({
  open,
  onClose,
  onActivityCreated
}) => {
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null);
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');

  // Reset modal state when opened/closed
  const handleClose = useCallback(() => {
    setCurrentStep(0);
    setSelectedTemplate(null);
    setActivityName('');
    setActivityDescription('');
    onClose();
  }, [onClose]);

  const handleTemplateSelect = useCallback((template: ActivityTemplate) => {
    setSelectedTemplate(template);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep === 0 && selectedTemplate) {
      setCurrentStep(1);
      // Auto-populate activity name based on template
      if (!activityName) {
        setActivityName(`New ${selectedTemplate.name}`);
      }
    }
  }, [currentStep, selectedTemplate, activityName]);

  const handleBack = useCallback(() => {
    if (currentStep === 1) {
      setCurrentStep(0);
    }
  }, [currentStep]);

  const handleCreate = useCallback(() => {
    if (selectedTemplate && activityName.trim()) {
      onActivityCreated(selectedTemplate, activityName.trim(), activityDescription.trim() || undefined);
      handleClose();
    }
  }, [selectedTemplate, activityName, activityDescription, onActivityCreated, handleClose]);

  const renderTemplateSelection = () => (
    <>
      <DialogContent sx={{ px: 4, py: 2 }}>
        <Grid container spacing={2} sx={{ maxWidth: '100%' }}>
          {ACTIVITY_TEMPLATES.map((template) => (
            <Grid key={template.id} size={{ xs: 6, sm: 4 }}>
              <Card 
                sx={{ 
                  cursor: 'pointer', 
                  height: 110,
                  border: 2,
                  borderColor: selectedTemplate?.id === template.id 
                    ? `${template.color}.main` 
                    : 'divider',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: `${template.color}.main`,
                    backgroundColor: alpha(theme.palette[template.color].main, 0.04),
                    transform: 'translateY(-1px)',
                    boxShadow: theme.shadows[4]
                  }
                }}
                onClick={() => handleTemplateSelect(template)}
              >
                <CardContent sx={{ 
                  textAlign: 'center', 
                  p: 1.5,
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column'
                }}>
                  <Box sx={{ color: `${template.color}.main`, fontSize: 24, mb: 0.5 }}>
                    {template.icon}
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {template.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ 
                    flexGrow: 1,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {template.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 4, pb: 2, pt: 1, justifyContent: 'space-between' }}>
        <Button onClick={handleClose} size="medium" sx={{ minWidth: 120 }}>
          Cancel
        </Button>
        <Button 
          onClick={handleNext}
          variant="contained"
          disabled={!selectedTemplate}
          size="medium"
          sx={{ minWidth: 120 }}
        >
          Next
        </Button>
      </DialogActions>
    </>
  );

  const renderActivityDetails = () => (
    <>
      <DialogContent sx={{ px: 4, py: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={3}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            size="small"
            variant="text"
            sx={{ mr: 'auto' }}
          >
            Back to Templates
          </Button>
          {selectedTemplate && (
            <Chip 
              icon={selectedTemplate.icon} 
              label={selectedTemplate.name}
              color={selectedTemplate.color}
              variant="outlined"
              sx={{ fontWeight: 500 }}
            />
          )}
        </Box>

        <TextField
          autoFocus
          label="Activity Name"
          fullWidth
          required
          value={activityName}
          onChange={(e) => setActivityName(e.target.value)}
          sx={{ mb: 3 }}
          placeholder={selectedTemplate ? `New ${selectedTemplate.name}` : 'Enter activity name'}
          helperText="Give your activity a clear, descriptive name"
        />
        
        <TextField
          label="Description (Optional)"
          fullWidth
          multiline
          rows={4}
          value={activityDescription}
          onChange={(e) => setActivityDescription(e.target.value)}
          placeholder="Describe the purpose and objectives of this activity"
          helperText="This description will help other users understand the activity's purpose"
        />
      </DialogContent>

      <DialogActions sx={{ px: 4, pb: 2, pt: 1, justifyContent: 'space-between' }}>
        <Button onClick={handleClose} size="medium" sx={{ minWidth: 120 }}>
          Cancel
        </Button>
        <Button 
          onClick={handleCreate}
          variant="contained"
          disabled={!activityName.trim()}
          size="medium"
          sx={{ minWidth: 160 }}
        >
          Create Activity
        </Button>
      </DialogActions>
    </>
  );

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          height: 'auto',
          maxHeight: '85vh',
          mx: 2
        }
      }}
    >
      {/* Header Section */}
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ mb: 0.5 }}>
            Create New Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose a starting template for your learning activity
          </Typography>
        </Box>
      </DialogTitle>

      {/* Progress Stepper */}
      <Box sx={{ px: 4, py: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Stepper activeStep={currentStep} alternativeLabel sx={{ width: '100%' }}>
          {MODAL_STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {currentStep === 0 ? renderTemplateSelection() : renderActivityDetails()}
    </Dialog>
  );
};