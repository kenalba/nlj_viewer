import React from 'react';
import { Box, Skeleton, Typography, Card, CardContent, useTheme, Stack } from '@mui/material';
import { Image as ImageIcon, VideoFile as VideoIcon, Description as DocumentIcon } from '@mui/icons-material';

interface MediaSkeletonProps {
  mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  size?: 'small' | 'medium' | 'large';
  aspectRatio?: number; // width/height
  showPreview?: boolean;
  critical?: boolean;
  fileName?: string;
  animate?: boolean;
}

export const MediaSkeleton: React.FC<MediaSkeletonProps> = ({
  mediaType = 'IMAGE',
  size = 'medium',
  aspectRatio = 16/9,
  showPreview = true,
  critical = false,
  fileName,
  animate = true
}) => {
  const theme = useTheme();
  
  const getHeight = () => {
    switch (size) {
      case 'small': return 150;
      case 'medium': return 300;
      case 'large': return 450;
      default: return 300;
    }
  };

  const getWidth = () => {
    const height = getHeight();
    return Math.min(height * aspectRatio, window.innerWidth - 64);
  };

  const getIcon = () => {
    switch (mediaType) {
      case 'IMAGE': return <ImageIcon sx={{ fontSize: 48 }} />;
      case 'VIDEO': return <VideoIcon sx={{ fontSize: 48 }} />;
      case 'DOCUMENT': return <DocumentIcon sx={{ fontSize: 48 }} />;
      default: return <ImageIcon sx={{ fontSize: 48 }} />;
    }
  };

  const getTypeLabel = () => {
    switch (mediaType) {
      case 'IMAGE': return 'Loading image...';
      case 'VIDEO': return 'Loading video...';
      case 'DOCUMENT': return 'Loading document...';
      default: return 'Loading media...';
    }
  };

  const shimmerAnimation = {
    animation: animate ? 'shimmer 2s infinite linear' : 'none',
    '@keyframes shimmer': {
      '0%': { transform: 'translateX(-100%)' },
      '100%': { transform: 'translateX(100%)' }
    }
  };

  const pulseAnimation = {
    animation: animate ? 'pulse 2s ease-in-out infinite' : 'none',
    '@keyframes pulse': {
      '0%': { opacity: 0.4 },
      '50%': { opacity: 0.8 },
      '100%': { opacity: 0.4 }
    }
  };

  return (
    <Card 
      elevation={1} 
      sx={{ 
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        maxWidth: getWidth(),
        margin: '0 auto',
        border: critical ? `2px solid ${theme.palette.warning.main}` : 'none',
        backgroundColor: theme.palette.grey[50],
      }}
    >
      {/* Critical indicator */}
      {critical && (
        <Box sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          backgroundColor: theme.palette.warning.main,
          color: theme.palette.warning.contrastText,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          fontSize: '0.7rem',
          fontWeight: 'bold'
        }}>
          ESSENTIAL
        </Box>
      )}

      {/* Main skeleton area */}
      <Box sx={{ position: 'relative', height: getHeight() }}>
        <Skeleton 
          variant="rectangular" 
          width="100%" 
          height="100%"
          sx={{ 
            backgroundColor: theme.palette.grey[100],
            '&::after': {
              background: `linear-gradient(90deg, transparent, ${theme.palette.grey[50]}, transparent)`,
              ...shimmerAnimation
            }
          }}
        />
        
        {/* Overlay content */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(1px)',
          color: theme.palette.text.secondary,
          gap: 2
        }}>
          {/* Media type icon */}
          <Box sx={{ 
            color: theme.palette.primary.main,
            ...pulseAnimation
          }}>
            {getIcon()}
          </Box>
          
          {/* Loading text */}
          <Typography variant="body2" sx={{ 
            fontWeight: 'medium',
            textAlign: 'center',
            ...pulseAnimation
          }}>
            {getTypeLabel()}
          </Typography>
          
          {/* File name if provided */}
          {fileName && (
            <Typography variant="caption" sx={{ 
              opacity: 0.7,
              textAlign: 'center',
              px: 2,
              wordBreak: 'break-all'
            }}>
              {fileName}
            </Typography>
          )}
          
          {/* Loading progress bar */}
          <Box sx={{ 
            width: '60%', 
            height: 4, 
            backgroundColor: theme.palette.grey[200],
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative'
          }}>
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '30%',
              backgroundColor: theme.palette.primary.main,
              borderRadius: 2,
              animation: animate ? 'progressBar 2s ease-in-out infinite' : 'none',
              '@keyframes progressBar': {
                '0%': { left: '-30%' },
                '100%': { left: '100%' }
              }
            }} />
          </Box>
        </Box>
      </Box>
      
      {/* Enhanced preview section */}
      {showPreview && (
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1}>
            {/* Media metadata skeleton */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Skeleton variant="circular" width={24} height={24} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="40%" height={16} />
                <Skeleton variant="text" width="60%" height={14} />
              </Box>
              <Skeleton variant="text" width={80} height={14} />
            </Stack>
            
            {/* Media controls skeleton (for video) */}
            {mediaType === 'VIDEO' && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Skeleton variant="circular" width={32} height={32} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 1 }} />
                </Box>
                <Skeleton variant="text" width={60} height={14} />
              </Stack>
            )}
          </Stack>
        </CardContent>
      )}
      
      {/* Shimmer overlay */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)`,
        pointerEvents: 'none',
        ...shimmerAnimation
      }} />
    </Card>
  );
};