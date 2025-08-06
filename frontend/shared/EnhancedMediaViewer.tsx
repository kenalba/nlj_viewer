import React, { useState } from 'react';
import { CardMedia, Skeleton, Box, useMediaQuery, useTheme, Dialog, DialogContent, IconButton, Tooltip, Typography } from '@mui/material';
import { ZoomIn as ZoomInIcon, Close as CloseIcon, Image as ImageIcon, VideoFile as VideoIcon } from '@mui/icons-material';
import type { Media } from '../types/nlj';

interface EnhancedMediaViewerProps {
  media: Media;
  alt?: string;
  height?: number;
  size?: 'small' | 'medium' | 'large';
  critical?: boolean;
  onLoad?: (mediaId: string) => void;
  onError?: (mediaId: string) => void;
  mediaLoadHandlers?: Record<string, { onLoad: () => void; onError: () => void }>;
  showMetadata?: boolean;
}

export const EnhancedMediaViewer: React.FC<EnhancedMediaViewerProps> = ({ 
  media, 
  alt, 
  height,
  size = 'medium',
  critical = false,
  onLoad,
  onError,
  mediaLoadHandlers,
  showMetadata = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadStartTime] = useState(Date.now());

  const handleLoad = () => {
    setLoaded(true);
    
    // Call handlers in order of priority
    if (mediaLoadHandlers?.[media.id]) {
      mediaLoadHandlers[media.id].onLoad();
    } else if (onLoad) {
      onLoad(media.id);
    }
  };

  const handleError = () => {
    setError(true);
    setLoaded(true);
    
    // Call handlers in order of priority
    if (mediaLoadHandlers?.[media.id]) {
      mediaLoadHandlers[media.id].onError();
    } else if (onError) {
      onError(media.id);
    }
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
    if (height) return height;
    
    // Adjust heights based on importance
    const multiplier = critical ? 1.2 : 1.0;
    
    if (isMobile) {
      switch (size) {
        case 'small': return Math.round(150 * multiplier);
        case 'medium': return Math.round(250 * multiplier);
        case 'large': return Math.round(300 * multiplier);
        default: return Math.round(250 * multiplier);
      }
    } else {
      switch (size) {
        case 'small': return Math.round(250 * multiplier);
        case 'medium': return Math.round(400 * multiplier);
        case 'large': return Math.round(500 * multiplier);
        default: return Math.round(400 * multiplier);
      }
    }
  };

  const responsiveHeight = getResponsiveHeight();

  // Enhanced skeleton with better loading hints
  const renderLoadingSkeleton = () => {
    return (
      <Box sx={{ position: 'relative' }}>
        <Skeleton 
          
          width="100%" 
          height={responsiveHeight}
          sx={{ 
            position: error ? 'static' : 'absolute', 
            top: 0, 
            left: 0,
            borderRadius: 1,
          }}
        />
        
        {/* Loading indicator overlay */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          color: 'text.secondary',
          zIndex: 1,
        }}>
          {media.type === 'IMAGE' ? (
            <ImageIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          ) : (
            <VideoIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          )}
          <Typography sx={{ opacity: 0.7 }}>
            Loading {media.type.toLowerCase()}...
          </Typography>
          {critical && (
            <Typography sx={{ 
              opacity: 0.5, 
              fontSize: '0.7rem',
              color: 'warning.main'
            }}>
              Essential content
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  // Metadata display
  const renderMetadata = () => {
    if (!showMetadata) return null;
    
    const loadTime = loaded ? Date.now() - loadStartTime : 0;
    
    return (
      <Box sx={{ 
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        px: 1,
        py: 0.5,
        borderRadius: 1,
        fontSize: '0.7rem',
        opacity: 0.8,
      }}>
        {media.type} • {loaded ? `${loadTime}ms` : 'Loading...'}
      </Box>
    );
  };

  if (media.type === 'IMAGE') {
    return (
      <>
        <Box 
          position="relative" 
          sx={{ 
            p: 2,
            cursor: loaded ? 'pointer' : 'default',
            '&:hover': loaded ? {
              backgroundColor: 'action.hover',
            } : {},
            '&:hover .zoom-icon': {
              opacity: 1,
            },
            borderRadius: 2,
            border: critical ? '2px solid' : 'none',
            borderColor: critical ? 'warning.main' : 'transparent',
          }}
          onClick={loaded ? handleImageClick : undefined}
        >
          {!loaded && renderLoadingSkeleton()}
          
          <CardMedia
            component="img"
            height={responsiveHeight}
            image={error ? media.fullThumbnail || '/placeholder.svg' : media.fullPath}
            alt={alt || media.title || 'Training content'}
            onLoad={handleLoad}
            onError={handleError}
            sx={{ 
              display: loaded ? 'block' : 'none',
              objectFit: 'contain',
              borderRadius: 1,
              maxWidth: '100%',
              width: 'auto',
              margin: '0 auto',
            }}
          />
          
          {loaded && !error && (
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
          )}
          
          {renderMetadata()}
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
          p: 2,
          borderRadius: 2,
          border: critical ? '2px solid' : 'none',
          borderColor: critical ? 'warning.main' : 'transparent',
        }}
      >
        {!loaded && renderLoadingSkeleton()}
        
        <CardMedia
          component="video"
          height={responsiveHeight}
          src={media.fullPath}
          controls={loaded}
          onLoadedData={handleLoad}
          onError={handleError}
          sx={{ 
            display: loaded ? 'block' : 'none',
            objectFit: 'contain',
            borderRadius: 1,
            maxWidth: '100%',
            width: 'auto',
            margin: '0 auto',
          }}
        />
        
        {renderMetadata()}
      </Box>
    );
  }

  return null;
};