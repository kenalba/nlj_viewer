/**
 * Content Generation Page
 * Provides access to the LLM Prompt Generator for creating content
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert
} from '@mui/material';
import {
  AutoAwesome as GenerateIcon,
  Description as PromptIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { LLMPromptGenerator } from '../shared/LLMPromptGenerator';

export const ContentGenerationPage: React.FC = () => {
  const [promptGeneratorOpen, setPromptGeneratorOpen] = useState(false);

  const handleOpenPromptGenerator = () => {
    setPromptGeneratorOpen(true);
  };

  const handleClosePromptGenerator = () => {
    setPromptGeneratorOpen(false);
  };

  return (
    <Box p={3}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Content Generation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Generate comprehensive prompts for AI-powered content creation or use integrated tools to create learning activities.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2">
          The LLM Prompt Generator creates detailed prompts for external AI tools like ChatGPT, Claude, or other language models to generate NLJ scenario content.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PromptIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="h2">
                  LLM Prompt Generator
                </Typography>
              </Box>
              
              <Typography variant="body1" paragraph>
                Create comprehensive, customized prompts for generating NLJ scenarios with external AI tools.
              </Typography>
              
              <Typography variant="body2" color="text.secondary" paragraph sx={{ fontWeight: 600 }}>
                How to use:
              </Typography>
              <Typography variant="body2" color="text.secondary" component="ol" sx={{ pl: 2, mb: 2 }}>
                <li>Generate a prompt using the tool below</li>
                <li>Go to your LLM of choice (Claude, ChatGPT, or NotebookLM)</li>
                <li>Paste the prompt and upload any source documents</li>
                <li>Copy the JSON response from the LLM</li>
                <li>Import it as a new activity using the Import feature</li>
              </Typography>
              
              <Box sx={{ mt: 'auto', pt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<GenerateIcon />}
                  onClick={handleOpenPromptGenerator}
                  fullWidth
                >
                  Open Prompt Generator
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: 0.6 }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <GenerateIcon color="disabled" sx={{ mr: 1 }} />
                <Typography variant="h6" component="h2" color="text.secondary">
                  Integrated AI Generation
                </Typography>
                <Chip label="Coming Soon" size="small" color="default" sx={{ ml: 1 }} />
              </Box>
              
              <Typography variant="body1" paragraph color="text.secondary">
                Direct integration with AI services for in-app content generation with RAG capabilities.
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Chip label="OpenWebUI Integration" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
                <Chip label="LangChain RAG" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
                <Chip label="Document Upload" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
                <Chip label="Context Awareness" size="small" variant="outlined" sx={{ mr: 1, mb: 1 }} />
              </Box>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Planned features:
              </Typography>
              <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
                <li>Upload training documents for context</li>
                <li>Generate content directly in the platform</li>
                <li>Automatic metadata generation</li>
                <li>Content recommendation system</li>
                <li>Real-time content suggestions</li>
              </Typography>
              
              <Box sx={{ mt: 'auto', pt: 2 }}>
                <Button
                  variant="outlined"
                  disabled
                  fullWidth
                >
                  Coming in Future Release
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <LLMPromptGenerator
        open={promptGeneratorOpen}
        onClose={handleClosePromptGenerator}
      />
    </Box>
  );
};

export default ContentGenerationPage;