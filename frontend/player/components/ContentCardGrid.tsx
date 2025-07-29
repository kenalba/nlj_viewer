/**
 * Card grid component for ContentLibrary
 * Displays content items in card format with memoization for performance
 */

import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Quiz as QuizIcon,
  Games as GamesIcon,
  Assessment as AssessmentIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import type { ContentItem } from '../../api/content';

// Content type utilities (duplicated from cells for standalone usage)
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

const getIconColor = (type: string) => {
  return getContentTypeColor(type);
};

interface ContentCardProps {
  item: ContentItem;
  userRole?: string;
  onPlay: (item: ContentItem) => void;
  onEdit: (item: ContentItem) => void;
}

const ContentCard = React.memo(({ item, userRole, onPlay, onEdit }: ContentCardProps) => {
  const handlePlay = useCallback(() => {
    onPlay(item);
  }, [item, onPlay]);

  const handleEdit = useCallback(() => {
    onEdit(item);
  }, [item, onEdit]);

  const canEdit = userRole && ['creator', 'reviewer', 'approver', 'admin'].includes(userRole);

  return (
    <Card 
      sx={{ 
        width: 340,
        height: 360,
        minWidth: 340,
        maxWidth: 340,
        flexShrink: 0,
        display: 'flex', 
        flexDirection: 'column',
        '&:hover': { 
          boxShadow: 6,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      <CardContent sx={{ 
        flexGrow: 1, 
        pb: 1,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100% - 64px)',
        overflow: 'hidden'
      }}>
        {/* Header row with icon, type, and views */}
        <Box 
          display="flex" 
          alignItems="center" 
          gap={1} 
          mb={2}
          sx={{ height: '32px', minHeight: '32px', flexShrink: 0 }}
        >
          <Box sx={{ color: getIconColor(item.content_type) }}>
            {getContentIcon(item.content_type)}
          </Box>
          <Chip 
            label={item.content_type} 
            size="small" 
            sx={{
              backgroundColor: getContentTypeColor(item.content_type),
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-label': {
                textTransform: 'capitalize'
              }
            }}
          />
          <Box flexGrow={1} />
          <Tooltip title={`${item.view_count} views`}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <ViewIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {item.view_count}
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Status row - Show content state for non-published content */}
        {item.state && item.state !== 'published' && (
          <Box 
            display="flex" 
            justifyContent="flex-end" 
            mb={1}
            sx={{ height: '24px', minHeight: '24px', flexShrink: 0 }}
          >
            <Chip 
              label={item.state.replace('_', ' ').toUpperCase()} 
              size="small" 
              color={
                item.state === 'draft' ? 'default' :
                item.state === 'submitted' ? 'warning' :
                item.state === 'in_review' ? 'info' :
                item.state === 'approved' ? 'success' :
                item.state === 'rejected' ? 'error' :
                'default'
              }
              variant="outlined"
              sx={{ 
                fontWeight: 600,
                fontSize: '0.7rem'
              }}
            />
          </Box>
        )}

        {/* Title */}
        <Typography 
          variant="h6" 
          component="h2" 
          sx={{
            fontSize: '1.1rem',
            lineHeight: 1.3,
            height: '2.6rem',
            minHeight: '2.6rem',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            flexShrink: 0,
            mb: 2
          }}
        >
          {item.title}
        </Typography>
        
        {/* Description */}
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{
            height: '4.8rem',
            minHeight: '4.8rem',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            mb: 2,
            flexShrink: 0
          }}
        >
          {item.description || 'No description available'}
        </Typography>

        {/* Tags */}
        <Box 
          display="flex" 
          gap={1} 
          mb={2} 
          sx={{ 
            height: '24px', 
            minHeight: '24px', 
            flexShrink: 0,
            overflow: 'hidden'
          }}
        >
          <Chip 
            label={item.learning_style?.replace('_', '/') || 'General'} 
            size="small" 
            variant="outlined"
            sx={{ maxWidth: '100px' }}
          />
          <Chip 
            label={item.template_category || 'Default'} 
            size="small" 
            variant="outlined"
            sx={{ maxWidth: '100px' }}
          />
        </Box>

        {/* Footer stats */}
        <Box 
          display="flex" 
          alignItems="center" 
          justifyContent="space-between" 
          mt="auto"
          sx={{ height: '20px', minHeight: '20px', flexShrink: 0 }}
        >
          <Box display="flex" alignItems="center" gap={0.5}>
            <TrendingIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {item.completion_count} completed
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {new Date(item.created_at).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ 
        pt: 0, 
        pb: 2, 
        px: 2,
        height: '64px',
        minHeight: '64px',
        flexShrink: 0
      }}>
        {canEdit ? (
          <Box display="flex" gap={1} width="100%">
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={handlePlay}
              sx={{ height: '40px', flex: 1 }}
            >
              {item.content_type === 'game' ? 'Play' : 
               item.content_type === 'survey' ? 'Take' : 'Start'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
              sx={{ height: '40px', minWidth: '80px' }}
            >
              Edit
            </Button>
          </Box>
        ) : (
          <Button
            fullWidth
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={handlePlay}
            sx={{ height: '40px' }}
          >
            {item.content_type === 'game' ? 'Play' : 
             item.content_type === 'survey' ? 'Take Survey' : 'Start Training'}
          </Button>
        )}
      </CardActions>
    </Card>
  );
});

interface ContentCardGridProps {
  content: ContentItem[];
  userRole?: string;
  onPlayContent: (item: ContentItem) => void;
  onEditContent: (item: ContentItem) => void;
}

export const ContentCardGrid = React.memo(({ 
  content, 
  userRole, 
  onPlayContent, 
  onEditContent 
}: ContentCardGridProps) => {
  return (
    <Box 
      sx={{ 
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
        justifyContent: 'flex-start'
      }}
    >
      {content.map((item) => (
        <ContentCard
          key={item.id}
          item={item}
          userRole={userRole}
          onPlay={onPlayContent}
          onEdit={onEditContent}
        />
      ))}
    </Box>
  );
});