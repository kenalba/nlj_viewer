/**
 * Memoized cell renderers for ContentLibrary DataGrid
 * Optimized for performance to prevent unnecessary re-renders
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
// Removed DataGrid dependency
import {
  PlayArrow as PlayIcon,
  Quiz as QuizIcon,
  Games as GamesIcon,
  Assessment as AssessmentIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import type { ContentItem } from '../../api/content';

// Content type utilities
const getContentIcon = (type: string) => {
  switch (type) {
    case 'training':
      return <PlayIcon />;
    case 'survey':
      return <AssessmentIcon />;
    case 'game':
      return <GamesIcon />;
    default:
      return <QuizIcon />;
  }
};

const getContentTypeColor = (type: string) => {
  switch (type) {
    case 'training':
      return '#1565C0'; // Dark blue
    case 'survey':
      return '#F57C00'; // Dark amber
    case 'game':
      return '#AD1457'; // Dark pink
    case 'assessment':
      return '#2E7D32'; // Dark green
    default:
      return '#616161'; // Dark grey
  }
};

// Memoized cell components
interface CellProps {
  item: ContentItem;
  value?: any;
}

export const TitleDescriptionCell = React.memo(({ item }: CellProps) => (
  <Box sx={{ py: 1, textAlign: 'left', width: '100%' }}>
    <Typography 
      variant="subtitle2" 
      sx={{ 
        fontWeight: 600, 
        lineHeight: 1.2,
        mb: 0.5
      }}
    >
      {item.title}
    </Typography>
    <Typography 
      variant="body2" 
      color="text.secondary"
      sx={{
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        fontSize: '0.85rem',
        lineHeight: 1.3,
        wordBreak: 'break-word',
        maxHeight: '4rem'
      }}
    >
      {item.description || 'No description available'}
    </Typography>
  </Box>
));

export const ContentTypeCell = React.memo(({ item, value }: CellProps) => (
  <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
    <Box sx={{ color: getContentTypeColor(value || item.content_type), fontSize: '1.1rem' }}>
      {getContentIcon(value || item.content_type)}
    </Box>
    <Chip 
      label={value || item.content_type} 
      size="small" 
      sx={{
        backgroundColor: getContentTypeColor(value || item.content_type),
        color: 'white',
        fontWeight: 600,
        fontSize: '0.75rem',
        '& .MuiChip-label': {
          textTransform: 'capitalize'
        }
      }}
    />
  </Box>
));

export const LearningStyleCell = React.memo(({ item, value }: CellProps) => (
  <Chip 
    label={(value || item.learning_style)?.replace('_', '/') || 'N/A'} 
    size="small" 
    variant="outlined"
  />
));

export const CategoryCell = React.memo(({ item, value }: CellProps) => (
  <Chip 
    label={value || item.template_category || 'General'} 
    size="small" 
    variant="outlined"
  />
));

export const DateCell = React.memo(({ value }: CellProps) => (
  <Typography variant="body2">
    {new Date(value).toLocaleDateString()}
  </Typography>
));

export const WorkflowStatusCell = React.memo(({ item, value }: CellProps) => {
  const status = value || item.state || 'published';
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'submitted': return 'warning';
      case 'in_review': return 'info';
      case 'approved': return 'success';
      case 'published': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };
  
  return (
    <Chip 
      label={status.replace('_', ' ').toUpperCase()} 
      size="small" 
      color={getStatusColor(status) as any}
      variant="outlined"
    />
  );
});

interface ActionsCellProps extends CellProps {
  userRole?: string;
  onPlay: (item: ContentItem) => void;
  onEdit: (item: ContentItem) => void;
}

export const ActionsCell = React.memo(({ item, userRole, onPlay, onEdit }: ActionsCellProps) => {
  const handlePlay = React.useCallback(() => {
    onPlay(item);
  }, [item, onPlay]);

  const handleEdit = React.useCallback(() => {
    onEdit(item);
  }, [item, onEdit]);

  const canEdit = userRole && ['creator', 'reviewer', 'approver', 'admin'].includes(userRole);

  return canEdit ? (
    <Box display="flex" gap={0.5} justifyContent="center">
      <Tooltip title={
        item.content_type === 'game' ? 'Play Game' : 
        item.content_type === 'survey' ? 'Take Survey' : 'Start Training'
      }>
        <IconButton
          size="small"
          onClick={handlePlay}
          sx={{ 
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark'
            }
          }}
        >
          <PlayIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit Activity">
        <IconButton
          size="small"
          onClick={handleEdit}
          sx={{ 
            backgroundColor: 'grey.100',
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.50',
              color: 'primary.dark'
            }
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  ) : (
    <Tooltip title={
      item.content_type === 'game' ? 'Play Game' : 
      item.content_type === 'survey' ? 'Take Survey' : 'Start Training'
    }>
      <IconButton
        size="small"
        onClick={handlePlay}
        sx={{ 
          backgroundColor: 'primary.main',
          color: 'white',
          '&:hover': {
            backgroundColor: 'primary.dark'
          }
        }}
      >
        <PlayIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
});