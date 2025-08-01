/**
 * Source Detail Page
 * Detailed view of a source document with metadata, content summary, and actions
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AutoAwesome as GenerateIcon,
  Description as DocumentIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Folder as FolderIcon,
  Tag as TagIcon,
  Preview as PreviewIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { 
  getSourceDocument, 
  uploadToClaudeAPI,
  generateDocumentSummary,
  deleteSourceDocument,
  type SourceDocument 
} from '../api/sources';
import { LoadingSpinner } from '../shared/LoadingSpinner';

// PDF Preview Component
const PDFPreview: React.FC<{ document: SourceDocument }> = ({ document }) => {
  if (document.file_type !== 'pdf') {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Preview is only available for PDF files.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Current file type: {document.file_type.toUpperCase()}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, height: '600px', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Box sx={{ textAlign: 'center' }}>
          <PreviewIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            PDF Preview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            PDF preview functionality will be implemented with PSPDFKit
          </Typography>
          <Button variant="outlined" startIcon={<DownloadIcon />}>
            Download to View
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

const SourceDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);

  // Extract ID from URL path since we're not using proper route parameters
  const pathSegments = window.location.pathname.split('/');
  const sourcesIndex = pathSegments.indexOf('sources');
  const id = sourcesIndex !== -1 ? pathSegments[sourcesIndex + 1] : null;

  // Debug logging
  console.log('SourceDetailPage rendered with ID:', id);
  console.log('Current pathname:', window.location.pathname);
  console.log('Path segments:', pathSegments);

  // Fetch source document
  const { data: document, isLoading, error } = useQuery({
    queryKey: ['source', id],
    queryFn: () => {
      console.log('Fetching source document with ID:', id);
      return getSourceDocument(id!);
    },
    enabled: !!id,
  });

  // Log error if it occurs
  React.useEffect(() => {
    if (error) {
      console.error('Failed to fetch source document:', error);
    }
  }, [error]);

  // Upload to Claude mutation
  const uploadMutation = useMutation({
    mutationFn: uploadToClaudeAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['source', id] });
    },
  });

  const handleBack = () => {
    navigate('/app/sources');
  };

  const handleUploadToClaudeAPI = () => {
    if (document) {
      uploadMutation.mutate(document.id);
    }
  };

  // Generate summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: generateDocumentSummary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['source', id] });
    },
  });

  const handleGenerateSummary = async () => {
    if (!document) return;
    generateSummaryMutation.mutate(document.id);
  };

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSourceDocument,
    onSuccess: () => {
      // Navigate back to sources list after successful deletion
      navigate('/app/sources');
    },
    onError: (error) => {
      console.error('Failed to delete document:', error);
    },
  });

  const handleDelete = () => {
    if (!document) return;
    
    // Show confirmation dialog
    if (window.confirm(`Are you sure you want to delete "${document.original_filename}"? This action cannot be undone.`)) {
      deleteMutation.mutate(document.id);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted':
        return 'success';
      case 'converting':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading source document..." />;
  }

  if (error || (!isLoading && !document)) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load source document. Please try again.'}
        </Alert>
        <Box mt={2}>
          <Button variant="outlined" onClick={handleBack}>
            Back to Source Library
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {document.extracted_title || document.original_filename}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Source Document Details
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<GenerateIcon />}
            onClick={() => console.log('Generate activity')}
          >
            Generate Activity
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => console.log('Edit document')}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => console.log('Download document')}
          >
            Download
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </Stack>
      </Box>

      {/* Document Info Card */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            <DocumentIcon />
          </Avatar>
          <Box>
            <Typography variant="h6">
              {document.original_filename}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {document.file_type.toUpperCase()} • {formatFileSize(document.file_size)}
            </Typography>
          </Box>
        </Box>

        {/* Status and Conversion Info */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            label={document.conversion_status}
            color={getStatusColor(document.conversion_status) as any}
            size="small"
          />
          {document.claude_file_id && (
            <Chip
              label="Uploaded to Claude"
              color="success"
              size="small"
              icon={<UploadIcon />}
            />
          )}
        </Box>

        {/* Document Description */}
        {document.description && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Description
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {document.description}
            </Typography>
          </Box>
        )}

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TagIcon fontSize="small" />
              Tags
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {document.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
      </Card>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Left Column - Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <Card sx={{ mb: 3 }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}
            >
              <Tab 
                icon={<DescriptionIcon />} 
                label="Content Analysis" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
              <Tab 
                icon={<PreviewIcon />} 
                label="Preview" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
            </Tabs>
            
            <Box sx={{ p: 3 }}>
              {/* Content Analysis Tab */}
              {currentTab === 0 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">AI-Generated Content Analysis</Typography>
                    <Button
                      variant="outlined"
                      startIcon={generateSummaryMutation.isPending ? <CircularProgress size={16} /> : <GenerateIcon />}
                      onClick={handleGenerateSummary}
                      disabled={generateSummaryMutation.isPending}
                    >
                      {generateSummaryMutation.isPending ? 'Generating...' : 'Generate Analysis'}
                    </Button>
                  </Box>
                  
                  {document.summary ? (
                    <Box>
                      <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 3 }}>
                        <Typography variant="body2">
                          {document.summary}
                        </Typography>
                      </Paper>

                      {/* AI-Generated Metadata Sections */}
                      <Grid container spacing={2}>
                        {/* Keywords */}
                        {document.keywords && document.keywords.length > 0 && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <TagIcon fontSize="small" />
                              Keywords
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {document.keywords.map((keyword, index) => (
                                <Chip key={index} label={keyword} size="small" variant="outlined" />
                              ))}
                            </Box>
                          </Grid>
                        )}

                        {/* Learning Objectives */}
                        {document.learning_objectives && document.learning_objectives.length > 0 && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>
                              Learning Objectives
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, m: 0 }}>
                              {document.learning_objectives.map((objective, index) => (
                                <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                  {objective}
                                </Typography>
                              ))}
                            </Box>
                          </Grid>
                        )}

                        {/* Key Concepts */}
                        {document.key_concepts && document.key_concepts.length > 0 && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>
                              Key Concepts
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, m: 0 }}>
                              {document.key_concepts.map((concept, index) => (
                                <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                  {concept}
                                </Typography>
                              ))}
                            </Box>
                          </Grid>
                        )}

                        {/* Subject Matter Areas */}
                        {document.subject_matter_areas && document.subject_matter_areas.length > 0 && (
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>
                              Subject Areas
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {document.subject_matter_areas.map((area, index) => (
                                <Chip key={index} label={area} size="small" color="primary" variant="outlined" />
                              ))}
                            </Box>
                          </Grid>
                        )}

                        {/* Actionable Items */}
                        {document.actionable_items && document.actionable_items.length > 0 && (
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom>
                              Actionable Items
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, m: 0 }}>
                              {document.actionable_items.map((item, index) => (
                                <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                  {item}
                                </Typography>
                              ))}
                            </Box>
                          </Grid>
                        )}

                        {/* Assessment Opportunities */}
                        {document.assessment_opportunities && document.assessment_opportunities.length > 0 && (
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom>
                              Assessment Opportunities
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, m: 0 }}>
                              {document.assessment_opportunities.map((opportunity, index) => (
                                <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                  {opportunity}
                                </Typography>
                              ))}
                            </Box>
                          </Grid>
                        )}

                        {/* Content Gaps */}
                        {document.content_gaps && document.content_gaps.length > 0 && (
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom>
                              Content Gaps
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, m: 0 }}>
                              {document.content_gaps.map((gap, index) => (
                                <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5, color: 'warning.main' }}>
                                  {gap}
                                </Typography>
                              ))}
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  ) : (
                    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No content analysis available yet. Click "Generate Analysis" to create an AI-powered analysis of this document using Claude.
                      </Typography>
                    </Paper>
                  )}
                </Box>
              )}

              {/* Preview Tab */}
              {currentTab === 1 && (
                <PDFPreview document={document} />
              )}
            </Box>
          </Card>
        </Box>

        {/* Right Column - Metadata */}
        <Box sx={{ width: { xs: '100%', md: '350px' }, flexShrink: 0 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Document Metadata
            </Typography>
            
            <Stack spacing={2} divider={<Divider />}>
              {/* File Information */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon fontSize="small" />
                  File Information
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Original Type:</Typography>
                    <Typography variant="body2">{document.original_file_type.toUpperCase()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Current Type:</Typography>
                    <Typography variant="body2">{document.file_type.toUpperCase()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">File Size:</Typography>
                    <Typography variant="body2">{formatFileSize(document.file_size)}</Typography>
                  </Box>
                  {document.page_count && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Pages:</Typography>
                      <Typography variant="body2">{document.page_count}</Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Author Information */}
              {document.extracted_author && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon fontSize="small" />
                    Author
                  </Typography>
                  <Typography variant="body2">{document.extracted_author}</Typography>
                </Box>
              )}

              {/* AI Classification */}
              {(document.content_type_classification || document.difficulty_level || document.estimated_reading_time || document.target_audience) && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GenerateIcon fontSize="small" />
                    AI Analysis
                  </Typography>
                  <Stack spacing={1}>
                    {document.content_type_classification && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Content Type:</Typography>
                        <Chip label={document.content_type_classification} size="small" />
                      </Box>
                    )}
                    {document.difficulty_level && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Difficulty:</Typography>
                        <Chip 
                          label={document.difficulty_level} 
                          size="small" 
                          color={
                            document.difficulty_level === 'beginner' ? 'success' :
                            document.difficulty_level === 'intermediate' ? 'warning' : 'error'
                          }
                        />
                      </Box>
                    )}
                    {document.estimated_reading_time && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Reading Time:</Typography>
                        <Typography variant="body2">{document.estimated_reading_time} min</Typography>
                      </Box>
                    )}
                    {document.target_audience && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">Target Audience:</Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>{document.target_audience}</Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Usage Information */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Usage Statistics
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Times Used:</Typography>
                    <Typography variant="body2">{document.usage_count}</Typography>
                  </Box>
                  {document.last_used_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Last Used:</Typography>
                      <Typography variant="body2">
                        {new Date(document.last_used_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Timestamps */}
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon fontSize="small" />
                  Timestamps
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Uploaded:</Typography>
                    <Typography variant="body2">
                      {new Date(document.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Modified:</Typography>
                    <Typography variant="body2">
                      {new Date(document.updated_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                  {document.uploaded_to_claude_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Claude Upload:</Typography>
                      <Typography variant="body2">
                        {new Date(document.uploaded_to_claude_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                  {document.expires_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Expires:</Typography>
                      <Typography variant="body2">
                        {new Date(document.expires_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Claude Integration */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Claude Integration
                </Typography>
                {document.claude_file_id ? (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Document is uploaded to Claude API
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Document not yet uploaded to Claude API
                  </Alert>
                )}
                
                {!document.claude_file_id && (
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={uploadMutation.isPending ? <CircularProgress size={16} /> : <UploadIcon />}
                    onClick={handleUploadToClaudeAPI}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload to Claude'}
                  </Button>
                )}
              </Box>
            </Stack>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default SourceDetailPage;