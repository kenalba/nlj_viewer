/**
 * Memoized cell renderers for ContentLibrary DataGrid
 * Optimized for performance to prevent unnecessary re-renders
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
// Removed DataGrid dependency
import {
  PlayArrow as PlayIcon,
  Quiz as QuizIcon,
  Games as GamesIcon,
  Assessment as AssessmentIcon,
  MoreVert as MoreVertIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import type { ContentItem } from '../../api/content';
import { workflowApi } from '../../api/workflow';
import type { ContentVersion } from '../../types/workflow';
import { ItemActionsMenu } from './ItemActionsMenu';
import { canEditContent } from '../../utils/permissions';
import type { User } from '../../api/auth';

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

export const TitleDescriptionCell = React.memo(({ item }: CellProps) => {
  const navigate = useNavigate();

  const handleTitleClick = useCallback(() => {
    navigate(`/app/activities/${item.id}`);
  }, [navigate, item.id]);

  return (
    <Box sx={{ py: 1, textAlign: 'left', width: '100%' }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          fontWeight: 600, 
          lineHeight: 1.2,
          mb: 0.5,
          cursor: 'pointer',
          color: 'primary.main',
          '&:hover': {
            textDecoration: 'underline',
            color: 'primary.dark'
          }
        }}
        onClick={handleTitleClick}
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
  );
});

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
      case 'archived': return 'default';
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

interface VersionInfoCellProps extends CellProps {
  versions?: ContentVersion[];
  versionsLoading?: boolean;
}

export const VersionInfoCell = React.memo(({ item, versions, versionsLoading }: VersionInfoCellProps) => {
  if (versionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={32}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        v1
      </Typography>
    );
  }

  // Sort versions by version number (descending) to get the latest
  const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);
  const latestVersion = sortedVersions[0];
  const totalVersions = versions.length;

  return (
    <Box display="flex" justifyContent="center" alignItems="center">
      <Tooltip title={`Version ${latestVersion.version_number} (${totalVersions} total versions)`}>
        <Chip
          label={`v${latestVersion.version_number}`}
          size="small"
          variant="outlined"
          color={latestVersion.version_status === 'published' ? 'success' : 'default'}
          sx={{
            minWidth: 50,
            height: 24,
            fontSize: '0.75rem',
            fontWeight: 500
          }}
        />
      </Tooltip>
    </Box>
  );
});

interface ActionsCellProps extends CellProps {
  user?: User | null;
  onPlay: (item: ContentItem) => void;
  onEdit: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
  onSubmitForReview?: (item: ContentItem) => void;
  onViewDetails?: (item: ContentItem) => void;
}

export const ActionsCell = React.memo(({ item, user, onPlay, onEdit, onDelete, onSubmitForReview, onViewDetails }: ActionsCellProps) => {
  const [moreActionsAnchor, setMoreActionsAnchor] = useState<HTMLElement | null>(null);

  const handlePlay = useCallback(() => {
    onPlay(item);
  }, [item, onPlay]);

  const handleMoreActionsClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // Prevent row selection when clicking actions
    setMoreActionsAnchor(event.currentTarget);
  }, []);

  const handleMoreActionsClose = useCallback(() => {
    setMoreActionsAnchor(null);
  }, []);

  const canEdit = canEditContent(user);

  return (
    <Box display="flex" gap={0.5} justifyContent="center" alignItems="center">
      {/* Primary Action: Play */}
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

      {/* Secondary Actions: More Menu (only if user can perform actions) */}
      {canEdit && (
        <>
          <Tooltip title="More actions">
            <IconButton
              size="small"
              onClick={handleMoreActionsClick}
              sx={{ 
                backgroundColor: 'grey.100',
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'grey.200',
                  color: 'text.primary'
                }
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <ItemActionsMenu
            anchorEl={moreActionsAnchor}
            open={Boolean(moreActionsAnchor)}
            onClose={handleMoreActionsClose}
            item={item}
            user={user}
            onEdit={onEdit}
            onDelete={onDelete}
            onSubmitForReview={onSubmitForReview}
            onViewDetails={onViewDetails}
          />
        </>
      )}
    </Box>
  );
});