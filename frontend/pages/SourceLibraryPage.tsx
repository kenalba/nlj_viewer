import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Fab,
  Alert,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
  FilterList as FilterIcon,
  ViewModule as CardViewIcon,
  TableRows as TableViewIcon,
  CloudUpload as CloudIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { SourceDocument, getSourceDocuments, uploadSourceDocument } from '../api/sources';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import SourceDocumentCard from '../components/sources/SourceDocumentCard';
import UploadSourceModal from '../components/sources/UploadSourceModal';

const SourceLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<string>('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('nlj-sources-view-mode');
    return (saved === 'card' || saved === 'table') ? saved : 'card';
  });

  const queryClient = useQueryClient();

  // Fetch source documents with search and filtering
  const { data: documentsResponse, isLoading, error } = useQuery({
    queryKey: ['sources', { search: searchQuery, file_type: selectedFileType }],
    queryFn: () => getSourceDocuments({
      search: searchQuery || undefined,
      file_type: selectedFileType || undefined,
      limit: 50,
    }),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadSourceDocument,
    onSuccess: (data) => {
      setSuccessMessage(`Document "${data.original_filename}" uploaded successfully!`);
      setUploadModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.detail || 'Failed to upload document');
    },
  });

  const handleDocumentClick = (document: SourceDocument) => {
    navigate(`/app/sources/${document.id}`);
  };

  const handleUpload = async (file: File, description?: string, tags?: string) => {
    uploadMutation.mutate({ file, description, tags });
  };

  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newView: 'card' | 'table' | null) => {
    if (newView) {
      setViewMode(newView);
      localStorage.setItem('nlj-sources-view-mode', newView);
    }
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

  const fileTypes = ['pdf', 'txt', 'docx', 'pptx'];
  const documents = documentsResponse?.items || [];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Failed to load source library. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Source Library
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your documents for Content Studio generation
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadModalOpen(true)}
          sx={{ height: 'fit-content' }}
        >
          Upload Document
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={3} md={3}>
            <FormControl fullWidth>
              <InputLabel>File Type</InputLabel>
              <Select
                value={selectedFileType}
                onChange={(e) => setSelectedFileType(e.target.value)}
                label="File Type"
              >
                <MenuItem value="">All Types</MenuItem>
                {fileTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {documentsResponse?.total || 0} documents
              </Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewModeChange}
                aria-label="view mode"
                size="small"
              >
                <ToggleButton value="card" aria-label="card view">
                  <CardViewIcon sx={{ mr: 0.5 }} />
                  Cards
                </ToggleButton>
                <ToggleButton value="table" aria-label="table view">
                  <TableViewIcon sx={{ mr: 0.5 }} />
                  Table
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Documents Display */}
      {documents.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <DocumentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No documents found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || selectedFileType
              ? 'Try adjusting your search or filters'
              : 'Upload your first document to get started with Content Studio'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setUploadModalOpen(true)}
          >
            Upload Document
          </Button>
        </Card>
      ) : viewMode === 'card' ? (
        <Grid container spacing={3}>
          {documents.map((document) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={document.id}>
              <SourceDocumentCard
                document={document}
                onClick={() => handleDocumentClick(document)}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell align="center">Type</TableCell>
                  <TableCell align="center">Size</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Claude</TableCell>
                  <TableCell align="center">Created</TableCell>
                  <TableCell align="center">Usage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((document) => (
                  <TableRow
                    key={document.id}
                    hover
                    onClick={() => handleDocumentClick(document)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <DocumentIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" noWrap>
                            {document.extracted_title || document.original_filename}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {document.original_filename}
                          </Typography>
                          {document.description && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {document.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={document.file_type.toUpperCase()} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {formatFileSize(document.file_size)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={document.conversion_status}
                        color={getStatusColor(document.conversion_status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {document.claude_file_id ? (
                        <Chip
                          label="Uploaded"
                          color="success"
                          size="small"
                          icon={<CloudIcon />}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not uploaded
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {new Date(document.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {document.usage_count} times
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Floating Action Button for mobile */}
      <Fab
        color="primary"
        aria-label="upload"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: { xs: 'flex', sm: 'none' },
        }}
        onClick={() => setUploadModalOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Upload Modal */}
      <UploadSourceModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        isUploading={uploadMutation.isPending}
      />


      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
      >
        <Alert severity="success" onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
      >
        <Alert severity="error" onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SourceLibraryPage;