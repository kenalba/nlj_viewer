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
  TextField,
  Tooltip,
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
  AudioFile as AudioFileIcon,
  Check as CheckIcon,
  Close as CancelIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { 
  getSourceDocument, 
  uploadToClaudeAPI,
  generateDocumentSummary,
  deleteSourceDocument,
  updateSourceDocument,
  type SourceDocument 
} from '../client/sources';
import { apiClient } from '../client/client';
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
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

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

  // Cleanup polling interval on unmount
  React.useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Monitor document changes to detect summary completion during polling
  React.useEffect(() => {
    if (document && document.summary && isGeneratingSummary && pollingInterval) {
      console.log('Summary detected during polling, stopping...');
      clearInterval(pollingInterval);
      setPollingInterval(null);
      setIsGeneratingSummary(false);
    }
  }, [document, isGeneratingSummary, pollingInterval]);

  // Auto-analyze documents when analyze=true parameter is in URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldAnalyze = urlParams.get('analyze') === 'true';
    
    if (document && shouldAnalyze && !document.summary && !isGeneratingSummary) {
      console.log('Auto-analyzing document based on URL parameter');
      // Clear the URL parameter to prevent re-analyzing
      window.history.replaceState({}, '', window.location.pathname);
      handleGenerateSummary();
    }
  }, [document]);

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
    onMutate: () => {
      setIsGeneratingSummary(true);
    },
    onSuccess: (data) => {
      console.log('Generate summary completed successfully:', data);
      // Stop polling if it was active
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      queryClient.invalidateQueries({ queryKey: ['source', id] });
      setIsGeneratingSummary(false);
    },
    onError: (error) => {
      console.error('Generate summary failed:', error);
      // Stop polling if it was active
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      setIsGeneratingSummary(false);
    },
  });

  const handleGenerateSummary = async () => {
    if (!document) return;
    
    // Start the generation process
    generateSummaryMutation.mutate(document.id);
    
    // Set up polling to check for completion every 5 seconds
    const interval = setInterval(() => {
      console.log('Polling for summary completion...');
      queryClient.invalidateQueries({ queryKey: ['source', id] });
    }, 5000);
    
    setPollingInterval(interval);
    
    // Clear polling after 2 minutes (timeout safety)
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setPollingInterval(null);
        setIsGeneratingSummary(false);
        console.log('Summary generation timeout reached');
      }
    }, 120000);
  };

  // Update document mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { extracted_title: string } }) => 
      updateSourceDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['source', id] });
      setIsEditingTitle(false);
    },
    onError: (error) => {
      console.error('Failed to update document:', error);
    },
  });

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

  const handleStartEditTitle = () => {
    if (!document) return;
    setEditedTitle(document.extracted_title || document.original_filename);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (!document || !editedTitle.trim()) return;
    updateMutation.mutate({ 
      id: document.id, 
      data: { extracted_title: editedTitle.trim() } 
    });
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
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
      {/* App Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1">
            SOURCE DETAILS
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            size="small"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={async () => {
              try {
                // Use the API client to download the file with proper authentication
                const response = await apiClient.get(`/api/sources/${document.id}/download`, {
                  responseType: 'blob'
                });
                
                // Create blob URL and trigger download
                const blob = new Blob([response.data]);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = document.original_filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Failed to download file:', error);
                alert('Failed to download file. Please try again.');
              }
            }}
            size="small"
          >
            Download
          </Button>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={async () => {
              try {
                // Use the API client to get the file with proper authentication
                const response = await apiClient.get(`/api/sources/${document.id}/download`, {
                  responseType: 'blob'
                });
                
                // Create blob URL and open in new tab for preview
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                
                // Clean up the blob URL after a delay
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
              } catch (error) {
                console.error('Failed to preview file:', error);
                alert('Failed to preview file. Please try again.');
              }
            }}
            size="small"
          >
            Preview
          </Button>
          <Button
            variant="contained"
            startIcon={<GenerateIcon />}
            onClick={() => navigate(`/app/generate?source=${document.id}`)}
            size="small"
          >
            Generate
          </Button>
        </Stack>
      </Box>

      {/* Document Info Card with Source Header */}
      <Card sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, mt: 0.5 }}>
            <DocumentIcon />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            {/* Source Header - Line 1: Title */}
            {isEditingTitle ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <TextField
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  variant="outlined"
                  size="small"
                  fullWidth
                  autoFocus
                  disabled={updateMutation.isPending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <Tooltip title="Save">
                  <IconButton 
                    onClick={handleSaveTitle}
                    disabled={updateMutation.isPending || !editedTitle.trim()}
                    size="small"
                    color="primary"
                  >
                    {updateMutation.isPending ? <CircularProgress size={16} /> : <CheckIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton 
                    onClick={handleCancelEdit}
                    disabled={updateMutation.isPending}
                    size="small"
                  >
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                  {document.extracted_title || document.original_filename}
                </Typography>
                <Tooltip title="Edit title">
                  <IconButton 
                    onClick={handleStartEditTitle}
                    size="small"
                    sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {/* Source Header - Line 2: Details */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                {document.original_filename}
              </Typography>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Typography variant="body2" color="text.secondary">
                {document.file_type.toUpperCase()}
              </Typography>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatFileSize(document.file_size)}
              </Typography>
              {document.tags && document.tags.length > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary">•</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {document.tags.slice(0, 3).map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                    {document.tags.length > 3 && (
                      <Chip label={`+${document.tags.length - 3} more`} size="small" variant="outlined" />
                    )}
                  </Box>
                </>
              )}
            </Box>
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
          {/* Content Analysis Card */}
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 3 }}>
              <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Content Analysis</Typography>
                    <Button
                      variant="outlined"
                      startIcon={isGeneratingSummary ? <CircularProgress size={16} /> : <GenerateIcon />}
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary}
                    >
                      {isGeneratingSummary ? 'Analyzing...' : (document.summary ? 'Reanalyze' : 'Analyze')}
                    </Button>
                  </Box>
                  
                  {document.summary ? (
                    <Box>
                      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', mb: 3 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                          Summary
                        </Typography>
                        <Typography variant="body2">
                          {document.summary}
                        </Typography>
                      </Box>

                      {/* AI-Generated Metadata Sections - Flexbox layout */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Keywords */}
                        {document.keywords && document.keywords.length > 0 && (
                          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                              <TagIcon fontSize="small" />
                              Keywords
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {document.keywords.map((keyword, index) => (
                                <Chip key={index} label={keyword} size="small" variant="outlined" />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Row-based sections */}
                        {(() => {
                          const sections = [
                            document.learning_objectives && document.learning_objectives.length > 0 && {
                              title: 'Learning Objectives',
                              content: (
                                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                  {document.learning_objectives.map((objective, index) => (
                                    <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                      {objective}
                                    </Typography>
                                  ))}
                                </Box>
                              )
                            },
                            document.key_concepts && document.key_concepts.length > 0 && {
                              title: 'Key Concepts',
                              content: (
                                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                  {document.key_concepts.map((concept, index) => (
                                    <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                      {concept}
                                    </Typography>
                                  ))}
                                </Box>
                              )
                            },
                            document.actionable_items && document.actionable_items.length > 0 && {
                              title: 'Actionable Items',
                              content: (
                                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                  {document.actionable_items.map((item, index) => (
                                    <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                      {item}
                                    </Typography>
                                  ))}
                                </Box>
                              )
                            },
                            document.assessment_opportunities && document.assessment_opportunities.length > 0 && {
                              title: 'Assessment Opportunities',
                              content: (
                                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                  {document.assessment_opportunities.map((opportunity, index) => (
                                    <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                      {opportunity}
                                    </Typography>
                                  ))}
                                </Box>
                              )
                            },
                            document.content_gaps && document.content_gaps.length > 0 && {
                              title: 'Content Gaps',
                              content: (
                                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                  {document.content_gaps.map((gap, index) => (
                                    <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5, color: 'error.dark', fontWeight: 500 }}>
                                      {gap}
                                    </Typography>
                                  ))}
                                </Box>
                              )
                            }
                          ].filter(Boolean);

                          if (sections.length === 0) return null;

                          // Group sections into rows
                          const rows = [];
                          for (let i = 0; i < sections.length; i += 3) {
                            rows.push(sections.slice(i, i + 3));
                          }

                          return rows.map((row, rowIndex) => (
                            <Box key={rowIndex} sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                              {row.map((section, index) => (
                                <Box key={index} sx={{ 
                                  flex: 1, 
                                  minHeight: '120px', 
                                  p: 2, 
                                  border: '1px solid', 
                                  borderColor: 'divider', 
                                  borderRadius: 2, 
                                  bgcolor: 'background.paper' 
                                }}>
                                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                                    {section.title}
                                  </Typography>
                                  {section.content}
                                </Box>
                              ))}
                            </Box>
                          ));
                        })()}

                        {/* Subject Areas */}
                        {document.subject_matter_areas && document.subject_matter_areas.length > 0 && (
                          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                              Subject Areas
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {document.subject_matter_areas.map((area, index) => (
                                <Chip key={index} label={area} size="small" color="primary" variant="outlined" />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No content analysis available yet. Click "Generate Analysis" to create a comprehensive analysis of this document.
                      </Typography>
                    </Paper>
                  )}
              </Box>
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
                    Content Analysis
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
                  Analysis Integration
                </Typography>
                {document.claude_file_id ? (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Document is available for analysis
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Document not yet available for analysis
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
                    {uploadMutation.isPending ? 'Processing...' : 'Enable Analysis'}
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