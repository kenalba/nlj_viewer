/**
 * Generation Results Component
 * Shows generation results and provides options to edit or save the generated content
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Grid,
  Paper,
  CircularProgress,
  Snackbar,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Visibility as PreviewIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  Quiz as QuizIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { NLJScenario } from '../../types/nlj';
import { apiClient } from '../../client/client';

interface GenerationResultsProps {
  generatedContent: NLJScenario | null;
  sessionId: string | null;
  onOpenInFlowEditor: (scenario: NLJScenario) => void;
}

export const GenerationResults: React.FC<GenerationResultsProps> = ({
  generatedContent,
  sessionId,
  onOpenInFlowEditor
}) => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activityTitle, setActivityTitle] = useState(generatedContent?.name || 'Generated Activity');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  if (!generatedContent) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="text.secondary">
          No generated content available
        </Typography>
      </Box>
    );
  }

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(generatedContent, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${generatedContent.name || 'generated-activity'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleSaveAsDraft = async () => {
    if (!generatedContent || !sessionId) {
      setSaveError('Cannot save: missing content or session information');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Create activity from generation session
      const response = await apiClient.post(`/api/generation/sessions/${sessionId}/create-activity`, {
        title: activityTitle.trim() || 'Generated Activity',
        description: generatedContent.description || 'Generated from Content Studio'
      });

      setSaveSuccess(true);
      
      // Navigate to the Flow Editor with the new activity
      if (response.data.activity_id) {
        setTimeout(() => {
          navigate(`/app/flow/edit/${response.data.activity_id}`);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Failed to save activity:', error);
      setSaveError(error.response?.data?.detail || 'Failed to save activity');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    // For now, just copy the generation session ID to clipboard
    // TODO: Integrate with sharing system after activity is saved
    setIsSharing(true);
    try {
      if (sessionId) {
        await navigator.clipboard.writeText(`${window.location.origin}/app/generation/session/${sessionId}`);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setActivityTitle(event.target.value);
  };

  const handlePreviewActivity = () => {
    if (!generatedContent) return;
    
    // Store the generated content in session storage for preview
    sessionStorage.setItem('preview_activity', JSON.stringify(generatedContent));
    
    // Navigate to a special preview route
    navigate('/app/preview-generated');
  };

  const getNodeTypeStats = () => {
    const stats: Record<string, number> = {};
    if (generatedContent?.nodes) {
      generatedContent.nodes.forEach(node => {
        stats[node.type] = (stats[node.type] || 0) + 1;
      });
    }
    return stats;
  };

  const getUserFriendlyStats = () => {
    if (!generatedContent?.nodes) return { learningSteps: 0, questions: 0, interactions: 0 };
    
    const questionTypes = ['question', 'true_false', 'multi_select', 'ordering'];
    const interactionTypes = ['choice', 'input', 'drag_drop'];
    
    let learningSteps = 0;
    let questions = 0;
    let interactions = 0;
    
    generatedContent.nodes.forEach(node => {
      if (questionTypes.includes(node.type)) {
        questions++;
      } else if (interactionTypes.includes(node.type)) {
        interactions++;
      } else if (!['start', 'end'].includes(node.type)) {
        learningSteps++;
      }
    });
    
    return { learningSteps, questions, interactions };
  };

  const nodeStats = getNodeTypeStats();
  const friendlyStats = getUserFriendlyStats();

  return (
    <Box>
      {/* Success Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <CheckIcon sx={{ color: 'success.main', mr: 2, fontSize: 32 }} />
        <Box>
          <Typography variant="h5" gutterBottom>
            Content Generated Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your learning activity is ready for review and customization.
          </Typography>
        </Box>
      </Box>

      {/* Hero Section - Title and Primary Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            variant="outlined"
            label="Activity Title"
            value={activityTitle}
            onChange={handleTitleChange}
            fullWidth
            sx={{ mb: 3 }}
            helperText="Give your activity a descriptive name"
          />
          
          <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
            <Button
              variant="contained"
              size="large"
              startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSaveAsDraft}
              disabled={isSaving || !sessionId || !activityTitle.trim()}
              sx={{ minWidth: 150 }}
            >
              {isSaving ? 'Saving...' : 'Save Activity'}
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              startIcon={<EditIcon />}
              onClick={() => onOpenInFlowEditor(generatedContent)}
              sx={{ minWidth: 150 }}
            >
              Edit in Flow Editor
            </Button>
            
            <Tooltip title="Copy shareable link">
              <Button
                variant="outlined"
                size="large"
                startIcon={isSharing ? <CircularProgress size={20} /> : <ShareIcon />}
                onClick={handleShare}
                disabled={isSharing}
                sx={{ minWidth: 120 }}
              >
                Share
              </Button>
            </Tooltip>

            <Button
              variant="outlined"
              size="large"
              startIcon={<PlayIcon />}
              onClick={handlePreviewActivity}
              sx={{ minWidth: 120 }}
            >
              Preview
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Activity Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <QuizIcon color="primary" />
            Activity Overview
          </Typography>
          
          <Grid container spacing={3} sx={{ textAlign: 'center' }}>
            <Grid size={{ xs: 4, md: 2 }}>
              <Box>
                <Typography variant="h3" color="primary" fontWeight="bold">
                  {friendlyStats.learningSteps}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Learning Steps
                </Typography>
              </Box>
            </Grid>
            
            <Grid size={{ xs: 4, md: 2 }}>
              <Box>
                <Typography variant="h3" color="secondary.main" fontWeight="bold">
                  {friendlyStats.questions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Questions
                </Typography>
              </Box>
            </Grid>
            
            <Grid size={{ xs: 4, md: 2 }}>
              <Box>
                <Typography variant="h3" color="info.main" fontWeight="bold">
                  {friendlyStats.interactions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Interactions
                </Typography>
              </Box>
            </Grid>
            
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="h3" color="success.main" fontWeight="bold">
                  {generatedContent?.links?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Connections
                </Typography>
              </Box>
            </Grid>
            
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="h3" color="warning.main" fontWeight="bold">
                  {generatedContent?.nodes?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Elements
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Secondary Actions */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Export & Share
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadJSON}
                  fullWidth
                >
                  Download JSON
                </Button>
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Save first to enable full sharing features with analytics and QR codes.
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generation Details
              </Typography>
              <List dense>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Generated"
                    secondary={new Date().toLocaleString()}
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="AI Model"
                    secondary="Claude-3.5-Sonnet"
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Schema"
                    secondary="NLJ v2.0"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Technical Details - Progressive Disclosure */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Technical Details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" gutterBottom>
            Node Type Breakdown
          </Typography>
          <Box sx={{ mb: 3 }}>
            {Object.entries(nodeStats).map(([nodeType, count]) => (
              <Chip
                key={nodeType}
                label={`${nodeType.replace(/_/g, ' ')}: ${count}`}
                sx={{ mr: 1, mb: 1 }}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>

          {/* Variables */}
          {generatedContent.variableDefinitions && generatedContent.variableDefinitions.length > 0 && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Variables Defined
              </Typography>
              <List dense>
                {generatedContent.variableDefinitions.map((variable, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemText
                      primary={variable.name}
                      secondary={`Type: ${variable.type}, Default: ${variable.initialValue}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Next Steps:</strong>
            </Typography>
            <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 0 }}>
              <li>Use the Flow Editor to visually customize connections and content</li>
              <li>Add images, videos, and rich media to enhance engagement</li>
              <li>Test your activity before publishing</li>
              <li>Use variables and branching for personalized learning paths</li>
            </Typography>
          </Alert>
        </AccordionDetails>
      </Accordion>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
      >
        <Alert severity="success" onClose={() => setSaveSuccess(false)}>
          Activity saved successfully! Redirecting to Flow Editor...
        </Alert>
      </Snackbar>

      <Snackbar
        open={shareSuccess}
        autoHideDuration={3000}
        onClose={() => setShareSuccess(false)}
      >
        <Alert severity="success" onClose={() => setShareSuccess(false)}>
          Link copied to clipboard! Share this with others to collaborate.
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!saveError}
        autoHideDuration={6000}
        onClose={() => setSaveError(null)}
      >
        <Alert severity="error" onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      </Snackbar>
    </Box>
  );
};