import React, { useState } from 'react';
import { CardMedia, Skeleton, Box, useMediaQuery, useTheme, Dialog, DialogContent, IconButton, Tooltip } from '@mui/material';
import { ZoomIn as ZoomInIcon, Close as CloseIcon } from '@mui/icons-material';
import type { Media } from '../types/nlj';

interface MediaViewerProps {
  media: Media;
  alt?: string;
  height?: number;
  size?: 'small' | 'medium' | 'large';
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ 
  media, 
  alt, 
  height,
  size = 'medium'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleLoad = () => setLoaded(true);
  const handleError = () => {
    setError(true);
    setLoaded(true);
  };

  const handleImageClick = () => {
    if (media.type === 'IMAGE') {
      setDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  // Calculate responsive height based on size and screen
  const getResponsiveHeight = () => {
    if (height) return height - 16; // Subtract padding (8px top + 8px bottom)
    
    if (isMobile) {
      // Mobile heights
      switch (size) {
        case 'small': return 150;
        case 'medium': return 250;
        case 'large': return 300;
        default: return 250;
      }
    } else {
      // Desktop heights - much larger
      switch (size) {
        case 'small': return 250;
        case 'medium': return 400;
        case 'large': return 500;
        default: return 400;
      }
    }
  };

  const responsiveHeight = getResponsiveHeight();

  if (media.type === 'IMAGE') {
    return (
      <>
        <Box 
          position="relative" 
          sx={{ 
            p: 1,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            '&:hover .zoom-icon': {
              opacity: 1,
            },
            borderRadius: 2,
          }}
          onClick={handleImageClick}
        >
          <Box sx={{ position: 'relative', height: responsiveHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!loaded && (
              <Skeleton 
                
                width="100%" 
                height={responsiveHeight} 
                sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
              />
            )}
            <CardMedia
              component="img"
              image={error ? media.fullThumbnail || '/placeholder.svg' : media.fullPath}
              alt={alt || media.title || 'Training content'}
              onLoad={handleLoad}
              onError={handleError}
              sx={{ 
                objectFit: 'contain',
                borderRadius: 1,
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                opacity: loaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            />
          </Box>
          <Tooltip title="Click to enlarge">
            <IconButton
              className="zoom-icon"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                opacity: 0,
                transition: 'opacity 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
              }}
              size="small"
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Dialog 
          open={dialogOpen} 
          onClose={handleCloseDialog}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              boxShadow: 'none',
            }
          }}
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <IconButton
              onClick={handleCloseDialog}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1,
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
            <Box
              component="img"
              src={media.fullPath}
              alt={alt || media.title || 'Training content'}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '90vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (media.type === 'VIDEO') {
    return (
      <Box 
        position="relative" 
        sx={{ 
          p: 1,
          borderRadius: 2,
        }}
      >
        <Box sx={{ position: 'relative', height: responsiveHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!loaded && (
            <Skeleton 
              
              width="100%" 
              height={responsiveHeight} 
              sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
            />
          )}
          <CardMedia
            component="video"
            src={media.fullPath}
            controls
            onLoadedData={handleLoad}
            onError={handleError}
            sx={{ 
              objectFit: 'contain',
              borderRadius: 1,
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />
        </Box>
      </Box>
    );
  }

  return null;
};