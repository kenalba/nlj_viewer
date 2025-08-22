import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Grid,
  Divider,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Description as DocumentIcon,
  PictureAsPdf as PdfIcon,
  TextFields as TextIcon,
  Slideshow as PptIcon,
  CloudUpload as CloudUploadIcon,
  CloudDone as CloudDoneIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import { SourceDocument } from '../../client/sources';

interface SourceDetailModalProps {
  open: boolean;
  onClose: () => void;
  document: SourceDocument;
}

const SourceDetailModal: React.FC<SourceDetailModalProps> = ({
  open,
  onClose,
  document,
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const getFileIcon = () => {
    switch (document.file_type) {
      case 'pdf':
        return <PdfIcon sx={{ fontSize: 40, color: 'error.main' }} />;
      case 'docx':
        return <DocumentIcon sx={{ fontSize: 40, color: 'primary.main' }} />;
      case 'pptx':
        return <PptIcon sx={{ fontSize: 40, color: 'warning.main' }} />;
      case 'txt':
        return <TextIcon sx={{ fontSize: 40, color: 'info.main' }} />;
      default:
        return <DocumentIcon sx={{ fontSize: 40 }} />;
    }
  };

  const getStatusChip = () => {
    switch (document.conversion_status) {
      case 'pending':
        return <Chip label="Conversion Pending" color="warning" />;
      case 'converting':
        return <Chip label="Converting..." color="info" />;
      case 'converted':
        return <Chip label="Converted to PDF" color="success" />;
      case 'failed':
        return <Chip label="Conversion Failed" color="error" />;
      case 'not_required':
        return <Chip label="No Conversion Needed" color="success" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy \'at\' h:mm a');
  };

  const displayTitle = document.extracted_title || document.original_filename;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {getFileIcon()}
            <Box>
              <Typography variant="h6" component="div">
                {displayTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {document.original_filename}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Status Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {getStatusChip()}
            {document.claude_file_id ? (
              <Chip
                label="Uploaded"
                color="primary"
                icon={<CloudDoneIcon />}
              />
            ) : (
              <Chip
                label="Not Uploaded"
                variant="outlined"
                icon={<CloudUploadIcon />}
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Document Information */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Document Details
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">File Type:</Typography>
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
                  {document.extracted_author && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Author:</Typography>
                      <Typography variant="body2">{document.extracted_author}</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Usage & Dates
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Times Used:</Typography>
                    <Typography variant="body2">{document.usage_count}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Uploaded:</Typography>
                    <Typography variant="body2">{formatDate(document.created_at)}</Typography>
                  </Box>
                  {document.last_used_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Last Used:</Typography>
                      <Typography variant="body2">{formatDate(document.last_used_at)}</Typography>
                    </Box>
                  )}
                  {document.uploaded_to_claude_at && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Claude Upload:</Typography>
                      <Typography variant="body2">{formatDate(document.uploaded_to_claude_at)}</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Description */}
        {document.description && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {document.description}
            </Typography>
          </Box>
        )}

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {document.tags.map((tag) => (
                <Chip key={tag} label={tag} variant="outlined" />
              ))}
            </Box>
          </Box>
        )}

        {/* Claude Integration Info */}
        {document.claude_file_id && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Claude Integration
            </Typography>
            <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CloudDoneIcon color="primary" />
                  <Typography variant="body2" fontWeight={600}>
                    Available in Claude Files API
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  File ID: <code>{document.claude_file_id}</code>
                </Typography>
                {document.expires_at && (
                  <Typography variant="body2" color="text.secondary">
                    Expires: {formatDate(document.expires_at)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Error Messages */}
        {document.conversion_error && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="error" icon={<InfoIcon />}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Conversion Error
              </Typography>
              <Typography variant="body2">
                {document.conversion_error}
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={<EditIcon />}
          onClick={() => {/* TODO: Implement edit */}}
        >
          Edit Details
        </Button>
        
        {!document.claude_file_id && (
          <Button
            startIcon={<CloudUploadIcon />}
            onClick={() => {/* TODO: Implement Claude upload */}}
            disabled={isUploading}
          >
            Upload to Claude
          </Button>
        )}
        
        <Button
          startIcon={<DownloadIcon />}
          onClick={() => {/* TODO: Implement download */}}
        >
          Download
        </Button>
        
        <Button
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => {/* TODO: Implement delete */}}
        >
          Delete
        </Button>
        
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SourceDetailModal;