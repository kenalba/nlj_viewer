/**
 * MediaSection - Media preview and management
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Button,
  TextField,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  AudioFile as AudioIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';
import type { Media } from '../../../../types/nlj';

interface MediaSectionProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const MediaSection: React.FC<MediaSectionProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as any; // Type assertion for media fields

  // Check if node has media fields
  const hasMediaField = 'media' in nljNode;
  const hasAdditionalMediaField = 'additionalMediaList' in nljNode;

  // Get media icon
  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'IMAGE':
        return <ImageIcon />;
      case 'VIDEO':
        return <VideoIcon />;
      case 'AUDIO':
        return <AudioIcon />;
      default:
        return <ImageIcon />;
    }
  };

  // Handle primary media removal
  const handleRemoveMedia = () => {
    onUpdate({ media: undefined });
  };

  // Handle additional media removal
  const handleRemoveAdditionalMedia = (index: number) => {
    if (!nljNode.additionalMediaList) return;
    
    const newMediaList = nljNode.additionalMediaList.filter((_: any, i: number) => i !== index);
    onUpdate({ additionalMediaList: newMediaList });
  };

  // Update media properties
  const handleUpdateMedia = (updates: Partial<Media>) => {
    if (!nljNode.media) return;
    
    const updatedMedia = { ...nljNode.media, ...updates };
    onUpdate({ media: updatedMedia });
  };

  // Update additional media properties
  const handleUpdateAdditionalMedia = (index: number, updates: Partial<Media>) => {
    if (!nljNode.additionalMediaList) return;
    
    const newMediaList = [...nljNode.additionalMediaList];
    newMediaList[index] = {
      ...newMediaList[index],
      media: { ...newMediaList[index].media, ...updates }
    };
    onUpdate({ additionalMediaList: newMediaList });
  };

  // Don't show media section if node doesn't support media
  if (!hasMediaField && !hasAdditionalMediaField) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
        Media
      </Typography>

      {/* Primary Media */}
      {hasMediaField && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
            Primary Media
          </Typography>
          
          {nljNode.media ? (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              
              {/* Media Details */}
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  {getMediaIcon(nljNode.media.type)}
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {nljNode.media.type}
                  </Typography>
                </Stack>
                
                <TextField
                  label="Media Title"
                  value={nljNode.media.title || ''}
                  onChange={(e) => handleUpdateMedia({ title: e.target.value })}
                  size="small"
                  fullWidth
                />
                
                <TextField
                  label="Media Path"
                  value={nljNode.media.fullPath || ''}
                  onChange={(e) => handleUpdateMedia({ fullPath: e.target.value })}
                  size="small"
                  fullWidth
                />
                
                <Button
                  onClick={handleRemoveMedia}
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                >
                  Remove Media
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                textAlign: 'center',
                borderStyle: 'dashed',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ImageIcon sx={{ fontSize: 36, color: 'action.disabled', mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Click to add media or drag & drop files here
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Supports images, videos, and audio files
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Additional Media (Carousel) */}
      {hasAdditionalMediaField && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem' }}>
            Additional Media (Carousel)
          </Typography>
          
          {(nljNode as any)?.additionalMediaList && (nljNode as any).additionalMediaList.length > 0 ? (
            <Stack spacing={1.5}>
              
              {/* Individual Media Items */}
              {(nljNode as any).additionalMediaList.map((mediaItem: any, index: number) => (
                <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                    {getMediaIcon(mediaItem.media.type)}
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Item {index + 1}: {mediaItem.media.type}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <IconButton
                      onClick={() => handleRemoveAdditionalMedia(index)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                  
                  <Stack spacing={1.5}>
                    <TextField
                      label="Title"
                      value={mediaItem.media.title || ''}
                      onChange={(e) => handleUpdateAdditionalMedia(index, { title: e.target.value })}
                      size="small"
                      fullWidth
                    />
                    
                    <TextField
                      label="Path"
                      value={mediaItem.media.fullPath || ''}
                      onChange={(e) => handleUpdateAdditionalMedia(index, { fullPath: e.target.value })}
                      size="small"
                      fullWidth
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                textAlign: 'center',
                borderStyle: 'dashed',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <VideoIcon sx={{ fontSize: 36, color: 'action.disabled', mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Click to add media carousel
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Multiple media items with navigation controls
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Media Upload Instructions */}
      <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
          <strong>Media Upload:</strong> Currently you can edit media paths directly. 
          Drag & drop upload functionality will be added in a future update.
        </Typography>
      </Alert>
    </Stack>
  );
};