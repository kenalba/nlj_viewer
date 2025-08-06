import React, { useState, useRef, useEffect } from 'react';
import { CardMedia, Skeleton, Box, useMediaQuery, useTheme, Dialog, DialogContent, IconButton, Tooltip, Typography } from '@mui/material';
import { ZoomIn as ZoomInIcon, Close as CloseIcon } from '@mui/icons-material';
import type { Media } from '../types/nlj';
import { getProxiedMediaUrl } from '../utils/mediaUtils';

// HLS Video Player Component
interface HLSVideoPlayerProps {
  media: Media;
  responsiveHeight: number;
  onLoad: () => void;
  onError: () => void;
  loaded: boolean;
}

const HLSVideoPlayer: React.FC<HLSVideoPlayerProps> = ({ media, responsiveHeight, onLoad, onError, loaded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initializeVideo = async () => {
      try {
        // Get the proxied URL to bypass CORS issues
        const proxiedUrl = getProxiedMediaUrl(media.fullPath);
        
        // Check if this is an HLS stream (.m3u8)
        if (media.fullPath.includes('.m3u8')) {
          // Try to use HLS.js for HLS streams
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = proxiedUrl;
            
            // Handle CORS errors for native HLS
            video.onerror = () => {
              setErrorMessage('Video cannot be loaded due to CORS restrictions. Please try accessing this content from the production environment.');
              onError();
            };
          } else {
            // Use HLS.js for other browsers
            const { default: Hls } = await import('hls.js');
            
            if (Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                  // Add CORS handling
                  xhr.withCredentials = false;
                }
              });
              
              hls.loadSource(proxiedUrl);
              hls.attachMedia(video);
              
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setErrorMessage(null);
                onLoad();
              });
              
              hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
                
                // Provide specific error messages based on error type
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                    setErrorMessage('Video cannot be loaded due to CORS restrictions. This video can only be accessed from the production environment.');
                  } else {
                    setErrorMessage('Network error loading video. Please check your internet connection.');
                  }
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                  setErrorMessage('Media error: Unable to decode video stream.');
                } else {
                  setErrorMessage('Unknown error occurred while loading video.');
                }
                
                onError();
              });
              
              // Cleanup function
              return () => {
                hls.destroy();
              };
            } else {
              setErrorMessage('HLS streaming is not supported in this browser.');
              onError();
            }
          }
        } else {
          // Regular video file
          video.src = proxiedUrl;
          video.onerror = () => {
            setErrorMessage('Unable to load video file.');
            onError();
          };
        }
      } catch (error) {
        console.error('Error initializing video:', error);
        setErrorMessage('Failed to initialize video player.');
        onError();
      }
    };

    initializeVideo();
  }, [media.fullPath, onLoad, onError]);

  return (
    <Box 
      position="relative" 
      sx={{ 
        p: 1,
        borderRadius: 2,
      }}
    >
      <Box sx={{ position: 'relative', height: responsiveHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!loaded && !errorMessage && (
          <Skeleton 
            variant="rectangular"
            width="100%" 
            height={responsiveHeight} 
            sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
          />
        )}
        
        {errorMessage ? (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              textAlign: 'center',
              p: 3,
              backgroundColor: 'error.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'error.200',
              width: '100%',
              height: '100%'
            }}
          >
            <Typography variant="h6" color="error.main" gutterBottom>
              Video Unavailable
            </Typography>
            <Typography variant="body2" color="error.dark" sx={{ mb: 2 }}>
              {errorMessage}
            </Typography>
            {media.fullPath.includes('.m3u8') && (
              <Typography variant="caption" color="text.secondary">
                HLS streaming videos require proper CORS configuration
              </Typography>
            )}
          </Box>
        ) : (
          <video
            ref={videoRef}
            controls
            onLoadedData={onLoad}
            onError={onError}
            style={{ 
              objectFit: 'contain',
              borderRadius: 4,
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            poster={media.fullThumbnail}
          />
        )}
      </Box>
    </Box>
  );
};

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
              image={error ? getProxiedMediaUrl(media.fullThumbnail || '/placeholder.svg') : getProxiedMediaUrl(media.fullPath)}
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
              src={getProxiedMediaUrl(media.fullPath)}
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
    return <HLSVideoPlayer media={media} responsiveHeight={responsiveHeight} onLoad={handleLoad} onError={handleError} loaded={loaded} />;
  }

  return null;
};