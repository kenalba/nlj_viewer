/**
 * Survey Distribution Page
 * Full-screen multi-step workflow for distributing surveys to external users
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Alert,
  Divider,
  Stack,
  Paper,
  IconButton,
  InputAdornment,
  Switch,
  Tabs,
  Tab,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Send as SendIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Link as LinkIcon,
  Upload as UploadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  QrCode as QrCodeIcon,
  Schedule as ScheduleIcon,
  Notifications as ReminderIcon,
  Preview as PreviewIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';

import { contentApi, type ContentItem } from '../client/content';
import { surveysApi } from '../client/surveys';
import { generateQRCode } from '../client/sharing';
import { useAuth } from '../contexts/AuthContext';
import { useXAPI } from '../contexts/XAPIContext';
import { InlineEmailManager } from '../components/surveys/InlineEmailManager';

interface Recipient {
  id: string;
  email: string;
  name?: string;
  type: 'individual' | 'group';
}

interface DistributionConfig {
  recipients: Recipient[];
  method: 'email' | 'sms' | 'link' | 'upload';
  schedule: {
    startDate: Date | null;
    endDate: Date | null;
    timezone: string;
  };
  settings: {
    enableReminders: boolean;
    reminderInterval: number; // days
    maxResponses?: number;
    allowAnonymous: boolean;
    requireRegistration: boolean;
  };
  message: {
    subject: string;
    body: string;
    customizeByRecipient: boolean;
  };
}

const DISTRIBUTION_METHODS = [
  {
    id: 'email',
    label: 'Email Distribution',
    description: 'Send survey invitations via email',
    icon: <EmailIcon />,
    supported: true,
  },
  {
    id: 'sms',
    label: 'SMS Distribution',
    description: 'Send survey links via text message',
    icon: <SmsIcon />,
    supported: false, // Not implemented yet
  },
  {
    id: 'link',
    label: 'Public Link',
    description: 'Generate a shareable link for the survey',
    icon: <LinkIcon />,
    supported: true,
  },
  {
    id: 'upload',
    label: 'File Upload',
    description: 'Upload a file with recipient information',
    icon: <UploadIcon />,
    supported: false, // Not implemented yet
  },
];

const STEPS = [
  { label: 'Distribution Method', description: 'Choose how to distribute the survey' },
  { label: 'Schedule & Settings', description: 'Configure timing and survey settings' },
  { label: 'Review & Send', description: 'Review and send the survey' },
];

export const SurveyDistributionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { trackSurveyDistribution } = useXAPI();

  // Helper function to convert emails to recipients
  const emailsToRecipients = (emails: string[]): Recipient[] => {
    return emails.map((email, index) => ({
      id: `recipient-${Date.now()}-${index}`,
      email: email.toLowerCase(),
      type: 'individual' as const,
    }));
  };

  // Helper function to extract emails from recipients
  const recipientsToEmails = (recipients: Recipient[]): string[] => {
    return recipients.map(r => r.email);
  };
  const queryClient = useQueryClient();

  // Extract survey ID from URL path since we're not using proper route parameters
  // URL format: /app/surveys/[id]/send
  const surveyId = React.useMemo(() => {
    const pathSegments = location.pathname.split('/');
    const surveysIndex = pathSegments.indexOf('surveys');
    if (surveysIndex !== -1 && pathSegments[surveysIndex + 1]) {
      return pathSegments[surveysIndex + 1];
    }
    return null;
  }, [location.pathname]);

  // Debug logging
  console.log('SurveyDistributionPage mounted');
  console.log('Survey ID extracted from path:', surveyId);
  console.log('Current location:', location);
  console.log('User:', user);

  const [currentStep, setCurrentStep] = useState(0);
  const [generatedSurveyUrl, setGeneratedSurveyUrl] = useState<string | null>(null);
  const [qrCodeModalOpen, setQrCodeModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [config, setConfig] = useState<DistributionConfig>({
    recipients: [],
    method: 'link',
    schedule: {
      startDate: new Date(),
      endDate: addDays(new Date(), 30),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    settings: {
      enableReminders: true,
      reminderInterval: 7,
      allowAnonymous: true,
      requireRegistration: false,
    },
    message: {
      subject: '',
      body: '',
      customizeByRecipient: false,
    },
  });

  // Re-enabled useQuery with enhanced debugging
  const {
    data: survey,
    isLoading: isSurveyLoading,
    error: surveyError,
  } = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: async () => {
      if (!surveyId) {
        throw new Error('Survey ID is required');
      }
      
      console.log('=== SURVEY FETCH DEBUG ===');
      console.log('Survey ID:', surveyId);
      console.log('contentApi:', contentApi);
      console.log('API base URL:', import.meta.env.VITE_API_BASE_URL);
      console.log('Window location:', window.location.href);
      
      // Direct API call for debugging
      const { apiClient } = await import('../client/client');
      console.log('apiClient:', apiClient);
      console.log('apiClient baseURL:', apiClient.defaults.baseURL);
      
      // Make the direct API call to isolate the issue
      console.log('Making direct API call...');
      try {
        const response = await apiClient.get(`/api/content/${surveyId}`);
        console.log('Direct API response:', response);
        return response.data;
      } catch (error) {
        console.error('Direct API error:', error);
        throw error;
      }
    },
    enabled: !!surveyId,
    retry: 1,
  });

  // Set default subject when survey loads
  useEffect(() => {
    if (survey && !config.message.subject) {
      setConfig(prev => ({
        ...prev,
        message: {
          ...prev.message,
          subject: `You're invited: ${survey.title}`,
          body: `Hi there!\n\nYou've been invited to participate in our survey: "${survey.title}".\n\n${survey.description || 'Your feedback is important to us.'}\n\nThe survey should take about 5-10 minutes to complete.\n\nClick the link below to get started:\n\n[SURVEY_LINK]\n\nThank you for your participation!\n\nBest regards,\nThe Team`,
        },
      }));
    }
  }, [survey, config.message.subject]);

  // Distribution mutation
  const distributeMutation = useMutation({
    mutationFn: async (distributionConfig: DistributionConfig) => {
      if (!surveyId) {
        throw new Error('Survey ID is required');
      }

      // Use the surveys API to create a link
      const linkResponse = await surveysApi.createLink(surveyId, {
        description: `Survey distribution link - ${distributionConfig.method}`,
        expires_at: distributionConfig.schedule.endDate?.toISOString(),
      });

      const surveyUrl = linkResponse.data.url;

      // Track distribution event
      if (survey) {
        trackSurveyDistribution({
          surveyId: survey.id,
          surveyTitle: survey.title,
          method: distributionConfig.method,
          recipientCount: distributionConfig.recipients.length,
        });
      }

      return { 
        token: linkResponse.data.token,
        surveyUrl,
        linkData: linkResponse.data
      };
    },
    onSuccess: (result) => {
      // Store the generated survey URL for display
      setGeneratedSurveyUrl(result.surveyUrl);
      console.log('Survey distributed successfully:', result.surveyUrl);
    },
    onError: (error) => {
      console.error('Failed to distribute survey:', error);
    },
  });

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate(`/app/surveys`);
    }
  };

  const handleDistribute = () => {
    distributeMutation.mutate(config);
  };

  const handleGenerateQR = async () => {
    if (!generatedSurveyUrl) return;
    
    setIsGeneratingQR(true);
    setQrCodeModalOpen(true);
    
    try {
      const qrDataUrl = await generateQRCode(generatedSurveyUrl, { 
        width: 300, 
        margin: 2 
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Email validation helper
  const validateEmail = (email: string): boolean => {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return EMAIL_REGEX.test(email);
  };

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Distribution Method
        if (config.method === 'link') {
          return true;
        }
        // For email method, require at least one valid email
        const validEmails = config.recipients.filter(r => validateEmail(r.email));
        return validEmails.length > 0;
      case 1: // Schedule & Settings
        return !!config.schedule.startDate;
      case 2: // Review & Send
        return true;
      default:
        return false;
    }
  }, [currentStep, config]);

  if (isSurveyLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (surveyError || !survey) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load survey. Please try again.
          {surveyError && (
            <Box component="pre" sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.8 }}>
              {surveyError.message || JSON.stringify(surveyError, null, 2)}
            </Box>
          )}
        </Alert>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/app/surveys')} 
          sx={{ mt: 2 }}
        >
          Back to Surveys
        </Button>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          px: 3,
          py: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={handleBack} size="small">
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Send Survey
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {survey.title}
            </Typography>
          </Box>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={currentStep} sx={{ mt: 2 }}>
          {STEPS.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                optional={
                  <Typography variant="caption">{step.description}</Typography>
                }
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: 3 }}>
        {/* Step 0: Distribution Method & Recipients */}
        {currentStep === 0 && (
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                How would you like to distribute this survey?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Choose the method that works best for your audience.
              </Typography>

              <Stack spacing={3}>
                {/* Distribution Method Selection */}
                <FormControl component="fieldset">
                  <FormLabel component="legend">Distribution Method</FormLabel>
                  <RadioGroup
                    value={config.method}
                    onChange={(e) =>
                      setConfig(prev => ({ ...prev, method: e.target.value as any }))
                    }
                  >
                    <FormControlLabel
                      value="link"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1">Public Link</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Anyone with the link can access the survey
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="email"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1">Email Invitations</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Send personalized invitations to specific recipients
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>

                {/* Recipients Section (only for email method) */}
                {config.method === 'email' && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                      Recipients
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Add email addresses to send personalized survey invitations.
                    </Typography>
                    
                    <InlineEmailManager
                      emails={recipientsToEmails(config.recipients)}
                      onChange={(emails) => {
                        setConfig(prev => ({
                          ...prev,
                          recipients: emailsToRecipients(emails)
                        }));
                      }}
                      placeholder="Paste email addresses here (comma, space, or newline separated)..."
                      helperText="You can paste multiple emails from Excel, your contacts, or any text source"
                    />
                  </Box>
                )}

                {/* Public Link Preview */}
                {config.method === 'link' && (
                  <Alert severity="info" icon={<LinkIcon />}>
                    A public link will be generated that can be shared with anyone. 
                    The link will be valid until {format(config.schedule.endDate!, 'PPP')}.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Schedule & Settings */}
        {currentStep === 1 && (
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Survey Schedule
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Set when the survey will be available to respondents.
                </Typography>

                <Stack spacing={3}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                    <DateTimePicker
                      label="Start Date"
                      value={config.schedule.startDate}
                      onChange={(date) =>
                        setConfig(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, startDate: date },
                        }))
                      }
                      slotProps={{
                        textField: { fullWidth: true },
                      }}
                    />
                    <DateTimePicker
                      label="End Date"
                      value={config.schedule.endDate}
                      onChange={(date) =>
                        setConfig(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, endDate: date },
                        }))
                      }
                      slotProps={{
                        textField: { fullWidth: true },
                      }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Survey Settings
                </Typography>

                <Stack spacing={3}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body1">Allow Anonymous Responses</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Respondents don't need to sign in or provide their name
                      </Typography>
                    </Box>
                    <Switch
                      checked={config.settings.allowAnonymous}
                      onChange={(e) =>
                        setConfig(prev => ({
                          ...prev,
                          settings: { ...prev.settings, allowAnonymous: e.target.checked },
                        }))
                      }
                    />
                  </Box>

                  {config.method === 'email' && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body1">Send Reminders</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Automatically send reminder emails to non-respondents
                        </Typography>
                      </Box>
                      <Switch
                        checked={config.settings.enableReminders}
                        onChange={(e) =>
                          setConfig(prev => ({
                            ...prev,
                            settings: { ...prev.settings, enableReminders: e.target.checked },
                          }))
                        }
                      />
                    </Box>
                  )}

                  {config.settings.enableReminders && config.method === 'email' && (
                    <TextField
                      label="Reminder Interval (days)"
                      type="number"
                      value={config.settings.reminderInterval}
                      onChange={(e) =>
                        setConfig(prev => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            reminderInterval: parseInt(e.target.value) || 7,
                          },
                        }))
                      }
                      inputProps={{ min: 1, max: 30 }}
                      sx={{ maxWidth: 200 }}
                    />
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* Step 2: Review & Send */}
        {currentStep === 2 && (
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Review Survey Distribution
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Please review the details below before sending your survey.
                </Typography>

                <Stack spacing={3}>
                  {/* Survey Details */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      SURVEY
                    </Typography>
                    <Typography variant="h6">{survey.title}</Typography>
                    {survey.description && (
                      <Typography variant="body2" color="text.secondary">
                        {survey.description}
                      </Typography>
                    )}
                  </Box>

                  <Divider />

                  {/* Distribution Summary */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      DISTRIBUTION METHOD
                    </Typography>
                    <Typography variant="body1">
                      {DISTRIBUTION_METHODS.find(m => m.id === config.method)?.label}
                    </Typography>
                    {config.method === 'link' && (
                      <Typography variant="body2" color="text.secondary">
                        Public link - anyone with the link can respond
                      </Typography>
                    )}
                    {config.method === 'email' && (
                      <Typography variant="body2" color="text.secondary">
                        {config.recipients.length} recipients
                      </Typography>
                    )}
                  </Box>

                  <Divider />

                  {/* Schedule Summary */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      SCHEDULE
                    </Typography>
                    <Typography variant="body2">
                      <strong>Start:</strong>{' '}
                      {config.schedule.startDate
                        ? format(config.schedule.startDate, 'PPP p')
                        : 'Not set'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>End:</strong>{' '}
                      {config.schedule.endDate
                        ? format(config.schedule.endDate, 'PPP p')
                        : 'Not set'}
                    </Typography>
                  </Box>

                  <Divider />

                  {/* Settings Summary */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      SETTINGS
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        • Anonymous responses: {config.settings.allowAnonymous ? 'Enabled' : 'Disabled'}
                      </Typography>
                      {config.method === 'email' && (
                        <Typography variant="body2">
                          • Reminders: {config.settings.enableReminders ? 'Enabled' : 'Disabled'}
                          {config.settings.enableReminders && ` (every ${config.settings.reminderInterval} days)`}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Distribution Status */}
            {distributeMutation.isSuccess && generatedSurveyUrl && (
              <Alert severity="success" icon={<CheckIcon />}>
                <Typography variant="body1" gutterBottom sx={{ fontWeight: 600 }}>
                  Survey distributed successfully!
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Your survey is now available at this public link:
                </Typography>
                
                {/* Survey URL Display */}
                <Box 
                  sx={{ 
                    p: 2, 
                    backgroundColor: 'background.paper', 
                    borderRadius: 1, 
                    border: '1px solid',
                    borderColor: 'divider',
                    mb: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        flex: 1, 
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        fontSize: '0.875rem'
                      }}
                    >
                      {generatedSurveyUrl}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedSurveyUrl);
                        // TODO: Show toast notification
                        console.log('Survey URL copied to clipboard');
                      }}
                      title="Copy link"
                    >
                      <CopyIcon />
                    </IconButton>
                  </Box>
                </Box>
                
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => window.open(generatedSurveyUrl, '_blank')}
                  >
                    Open Survey
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<QrCodeIcon />}
                    onClick={handleGenerateQR}
                    disabled={!generatedSurveyUrl}
                  >
                    QR Code
                  </Button>
                </Stack>
              </Alert>
            )}

            {distributeMutation.error && (
              <Alert severity="error">
                Failed to distribute survey: {distributeMutation.error.message}
              </Alert>
            )}
          </Stack>
        )}
      </Box>

      {/* Actions */}
      <Box
        sx={{
          backgroundColor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={handleBack}
          disabled={distributeMutation.isLoading}
        >
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {currentStep === 2 && (
            <Button
              variant="outlined"
              startIcon={<PreviewIcon />}
              onClick={() => window.open(`/app/play/${surveyId}`, '_blank')}
            >
              Preview Survey
            </Button>
          )}
          
          {currentStep < 2 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleDistribute}
              disabled={distributeMutation.isLoading || distributeMutation.isSuccess}
            >
              {distributeMutation.isLoading ? 'Distributing...' : 'Send Survey'}
            </Button>
          )}
        </Box>
      </Box>

      {/* QR Code Modal */}
      <Dialog 
        open={qrCodeModalOpen} 
        onClose={() => setQrCodeModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <QrCodeIcon color="primary" />
              <Typography variant="h6">Survey QR Code</Typography>
            </Box>
            <IconButton onClick={() => setQrCodeModalOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} alignItems="center" py={2}>
            {qrCodeDataUrl ? (
              <>
                <Box textAlign="center">
                  <img 
                    src={qrCodeDataUrl} 
                    alt="QR Code for survey" 
                    style={{ 
                      maxWidth: '300px', 
                      width: '100%', 
                      height: 'auto',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: 'white'
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Scan this QR code with a mobile device to access the survey
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    backgroundColor: 'grey.50',
                    width: '100%',
                    wordBreak: 'break-all'
                  }}
                >
                  <Typography variant="body2" fontFamily="monospace">
                    {generatedSurveyUrl}
                  </Typography>
                </Paper>
              </>
            ) : isGeneratingQR ? (
              <Box textAlign="center" py={4}>
                <CircularProgress size={32} />
                <Typography variant="body2" mt={2}>
                  Generating QR code...
                </Typography>
              </Box>
            ) : (
              <Alert severity="error">
                Failed to generate QR code. Please try again.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrCodeModalOpen(false)}>
            Close
          </Button>
          {qrCodeDataUrl && (
            <Button 
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={() => {
                if (generatedSurveyUrl) {
                  navigator.clipboard.writeText(generatedSurveyUrl);
                  // Could add a toast notification here
                }
              }}
            >
              Copy Link
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
    </LocalizationProvider>
  );
};

export default SurveyDistributionPage;