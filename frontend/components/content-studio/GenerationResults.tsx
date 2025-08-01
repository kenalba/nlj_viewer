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
  Snackbar
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Visibility as PreviewIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { NLJScenario } from '../../types/nlj';
import { apiClient } from '../../api/client';

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
        title: generatedContent.name || 'Generated Activity',
        description: generatedContent.description || 'Generated from Content Studio'
      });

      setSaveSuccess(true);
      
      // Navigate to the Flow Editor with the new activity
      if (response.data.activity_id) {
        setTimeout(() => {
          navigate(`/app/flow/${response.data.activity_id}`);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Failed to save activity:', error);
      setSaveError(error.response?.data?.detail || 'Failed to save activity');
    } finally {
      setIsSaving(false);
    }
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

  const nodeStats = getNodeTypeStats();

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

      <Grid container spacing={3}>
        {/* Generated Content Overview */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {generatedContent.name}
              </Typography>
              
              {/* Content Statistics */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {generatedContent.nodes.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Nodes
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {generatedContent.links.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Connections
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {generatedContent.variableDefinitions?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Variables
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {Object.keys(nodeStats).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Node Types
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Node Type Breakdown */}
              <Typography variant="subtitle1" gutterBottom>
                Content Breakdown
              </Typography>
              <Box sx={{ mb: 3 }}>
                {Object.entries(nodeStats).map(([nodeType, count]) => (
                  <Chip
                    key={nodeType}
                    label={`${nodeType.replace('_', ' ')}: ${count}`}
                    sx={{ mr: 1, mb: 1 }}
                    size="small"
                  />
                ))}
              </Box>

              {/* Variables */}
              {generatedContent.variableDefinitions && generatedContent.variableDefinitions.length > 0 && (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    Variables
                  </Typography>
                  <List dense>
                    {generatedContent.variableDefinitions.map((variable, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={variable.name}
                          secondary={`Type: ${variable.type}, Default: ${variable.initialValue}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Next Steps
              </Typography>
              
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Your content has been generated and validated against the NLJ schema.
                </Typography>
              </Alert>

              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<EditIcon />}
                  onClick={() => onOpenInFlowEditor(generatedContent)}
                  fullWidth
                >
                  Open in Flow Editor
                </Button>

                <Button
                  variant="outlined"
                  startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSaveAsDraft}
                  disabled={isSaving || !sessionId}
                  fullWidth
                >
                  {isSaving ? 'Saving...' : 'Save as Draft'}
                </Button>

                <Divider />

                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadJSON}
                  fullWidth
                >
                  Download JSON
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<PreviewIcon />}
                  onClick={handlePreviewActivity}
                  fullWidth
                >
                  Preview Activity
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Generation Details */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generation Details
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Generated"
                    secondary={new Date().toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Model"
                    secondary="Claude-3.5-Sonnet"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Schema Version"
                    secondary="NLJ v2.0"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tips for editing */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" gutterBottom>
          <strong>Pro Tips:</strong>
        </Typography>
        <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 0 }}>
          <li>Use the Flow Editor to visually customize node connections and content</li>
          <li>Add images, videos, and rich media to enhance engagement</li>
          <li>Test your activity before publishing to ensure smooth user experience</li>
          <li>Use variables and branching to create personalized learning paths</li>
        </Typography>
      </Alert>

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