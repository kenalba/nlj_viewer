import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Description as DocumentIcon,
  PictureAsPdf as PdfIcon,
  TextFields as TextIcon,
  Slideshow as PptIcon,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

import { SourceDocument } from '../../api/sources';

interface SourceDocumentCardProps {
  document: SourceDocument;
  onClick?: () => void;
}

const SourceDocumentCard: React.FC<SourceDocumentCardProps> = ({ document, onClick }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getFileIcon = () => {
    switch (document.file_type) {
      case 'pdf':
        return <PdfIcon color="error" />;
      case 'docx':
        return <DocumentIcon color="primary" />;
      case 'pptx':
        return <PptIcon color="warning" />;
      case 'txt':
        return <TextIcon color="info" />;
      default:
        return <DocumentIcon />;
    }
  };

  const getStatusChip = () => {
    switch (document.conversion_status) {
      case 'pending':
        return <Chip label="Pending" size="small" color="warning" icon={<ScheduleIcon />} />;
      case 'converting':
        return <Chip label="Converting" size="small" color="info" icon={<ScheduleIcon />} />;
      case 'converted':
        return <Chip label="Converted" size="small" color="success" />;
      case 'failed':
        return <Chip label="Failed" size="small" color="error" icon={<ErrorIcon />} />;
      case 'not_required':
        return <Chip label="Ready" size="small" color="success" />;
      default:
        return null;
    }
  };

  const getClaudeStatus = () => {
    if (document.claude_file_id) {
      return (
        <Chip
          label="In Claude"
          size="small"
          color="primary"
          icon={<CloudDoneIcon />}
          variant="outlined"
        />
      );
    }
    return (
      <Chip
        label="Not Uploaded"
        size="small"
        color="default"
        icon={<CloudOffIcon />}
        variant="outlined"
      />
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const displayTitle = document.extracted_title || document.original_filename;
  const createdDate = formatDistanceToNow(new Date(document.created_at), { addSuffix: true });

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header with icon and menu */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getFileIcon()}
            <Typography variant="body2" color="text.secondary">
              {document.file_type.toUpperCase()}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreVertIcon />
          </IconButton>
        </Box>

        {/* Title and description */}
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontSize: '1rem',
            fontWeight: 600,
            mb: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.3,
          }}
        >
          {displayTitle}
        </Typography>

        {document.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {document.description}
          </Typography>
        )}

        {/* Status chips */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {getStatusChip()}
          {getClaudeStatus()}
        </Box>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
            {document.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
            {document.tags.length > 3 && (
              <Chip label={`+${document.tags.length - 3}`} size="small" variant="outlined" />
            )}
          </Box>
        )}

        {/* Progress bar for converting status */}
        {document.conversion_status === 'converting' && (
          <LinearProgress sx={{ mb: 2 }} />
        )}
      </CardContent>

      {/* Footer */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(document.file_size)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {createdDate}
          </Typography>
        </Box>
        
        {document.usage_count > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Used {document.usage_count} time{document.usage_count !== 1 ? 's' : ''}
          </Typography>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleMenuClose}>Edit Details</MenuItem>
        <MenuItem onClick={handleMenuClose}>Upload to Claude</MenuItem>
        <MenuItem onClick={handleMenuClose}>Download</MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default SourceDocumentCard;