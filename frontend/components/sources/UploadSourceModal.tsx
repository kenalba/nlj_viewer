import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Chip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

interface UploadSourceModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, title?: string, description?: string, tags?: string, analyze?: boolean) => void;
  isUploading: boolean;
}

const UploadSourceModal: React.FC<UploadSourceModalProps> = ({
  open,
  onClose,
  onUpload,
  isUploading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [analyze, setAnalyze] = useState(true);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError('');
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File size must be less than 500MB');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Only PDF, DOCX, PPTX, and TXT files are supported');
      } else {
        setError('Invalid file. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      // Set title to filename without extension
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExtension);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.ms-powerpoint': ['.ppt'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false,
  });

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile, title || undefined, description || undefined, tags || undefined, analyze);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setTags('');
      setAnalyze(true);
      setError('');
      onClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return <DocumentIcon color={extension === 'pdf' ? 'error' : 'primary'} />;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UploadIcon />
          Upload Source Document
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* File Drop Zone */}
        {!selectedFile ? (
          <Paper
            {...getRootProps()}
            sx={{
              p: 4,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              bgcolor: isDragActive ? 'action.hover' : 'background.default',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              mb: 3,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <input {...getInputProps()} />
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop your document here' : 'Drag & drop or click to select'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supports PDF, DOCX, PPTX, and TXT files up to 500MB
            </Typography>
          </Paper>
        ) : (
          /* Selected File Display */
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'action.selected' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getFileIcon(selectedFile.name)}
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1" fontWeight={600}>
                  {selectedFile.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown'}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSelectedFile(null);
                  setTitle('');
                }}
                disabled={isUploading}
              >
                Change
              </Button>
            </Box>
          </Paper>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Uploading document...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Title Field */}
        <TextField
          fullWidth
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a title for this document..."
          disabled={isUploading}
          sx={{ mb: 2 }}
        />

        {/* Description Field */}
        <TextField
          fullWidth
          label="Description (Optional)"
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this document contains or how it should be used..."
          disabled={isUploading}
          sx={{ mb: 2 }}
        />

        {/* Tags Field */}
        <TextField
          fullWidth
          label="Tags (Optional)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="training, product-info, FAQ (comma-separated)"
          disabled={isUploading}
          helperText="Add tags to help organize and find your documents"
          sx={{ mb: 2 }}
        />

        {/* Analyze Checkbox */}
        <FormControlLabel
          control={
            <Checkbox
              checked={analyze}
              onChange={(e) => setAnalyze(e.target.checked)}
              disabled={isUploading}
            />
          }
          label={
            <Box>
              <Typography variant="body2">
                Analyze document
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Extract keywords, learning objectives, and generate metadata
              </Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', mb: 1 }}
        />

      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          startIcon={<UploadIcon />}
        >
          {isUploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadSourceModal;