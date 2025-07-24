import React, { useState, useRef } from 'react';
import { 
  Box, 
  IconButton, 
  Typography, 
  useTheme, 
  useMediaQuery,
  MobileStepper
} from '@mui/material';
import { 
  ChevronLeft, 
  ChevronRight, 
  KeyboardArrowLeft, 
  KeyboardArrowRight 
} from '@mui/icons-material';
import { MediaViewer } from './MediaViewer';
import type { Media } from '../types/nlj';

interface MediaCarouselProps {
  mediaList: Media[];
  size?: 'small' | 'medium' | 'large';
  showControls?: boolean;
  showCounter?: boolean;
  autoHeight?: boolean;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  mediaList,
  size = 'medium',
  showControls = true,
  showCounter = true,
  autoHeight = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // If only one media item, don't show carousel controls
  if (mediaList.length === 1) {
    return <MediaViewer media={mediaList[0]} size={size} />;
  }

  const handleNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === mediaList.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? mediaList.length - 1 : prevIndex - 1
    );
  };

  const handleDotClick = (index: number) => {
    if (index === currentIndex) return;
    setCurrentIndex(index);
  };

  const currentMedia = mediaList[currentIndex];

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Main Media Display */}
      <Box 
        ref={carouselRef}
        sx={{ 
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 1,
          backgroundColor: 'background.paper',
          ...(autoHeight ? {} : { 
            height: size === 'small' ? 250 : size === 'medium' ? 350 : 450 
          })
        }}
      >
        <Box sx={{ width: '100%', height: '100%' }}>
          <MediaViewer 
            media={currentMedia} 
            size={size}
            height={size === 'small' ? 250 : size === 'medium' ? 350 : 450}
            alt={`Media ${currentIndex + 1} of ${mediaList.length}`}
          />
        </Box>

        {/* Navigation Controls */}
        {showControls && !isMobile && (
          <>
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                },
              }}
            >
              <ChevronLeft />
            </IconButton>
            
            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                },
              }}
            >
              <ChevronRight />
            </IconButton>
          </>
        )}

        {/* Counter Badge */}
        {showCounter && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              fontWeight: 'medium',
            }}
          >
            {currentIndex + 1} / {mediaList.length}
          </Box>
        )}
      </Box>

      {/* Mobile Navigation */}
      {isMobile && showControls && (
        <MobileStepper
          variant="progress"
          steps={mediaList.length}
          position="static"
          activeStep={currentIndex}
          nextButton={
            <IconButton
              size="small"
              onClick={handleNext}
            >
              <KeyboardArrowRight />
            </IconButton>
          }
          backButton={
            <IconButton
              size="small"
              onClick={handlePrevious}
            >
              <KeyboardArrowLeft />
            </IconButton>
          }
          sx={{ 
            backgroundColor: 'transparent',
            pt: 1,
            '& .MuiMobileStepper-progress': {
              backgroundColor: 'divider',
            },
          }}
        />
      )}

      {/* Desktop Dot Navigation */}
      {!isMobile && showControls && mediaList.length > 1 && (
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 1, 
            mt: 2 
          }}
        >
          {mediaList.map((_, index) => (
            <Box
              key={index}
              onClick={() => handleDotClick(index)}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: index === currentIndex ? 'primary.main' : 'divider',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: index === currentIndex ? 'primary.dark' : 'text.secondary',
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Media Title/Description */}
      {currentMedia.title && (
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            textAlign: 'center', 
            mt: 1,
            color: 'text.secondary'
          }}
        >
          {currentMedia.title}
        </Typography>
      )}
    </Box>
  );
};