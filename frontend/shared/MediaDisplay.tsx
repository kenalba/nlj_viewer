import React from 'react';
import { MediaViewer } from './MediaViewer';
import { MediaCarousel } from './MediaCarousel';
import type { Media } from '../types/nlj';

interface MediaDisplayProps {
  mediaList: Media[];
  size?: 'small' | 'medium' | 'large';
  showControls?: boolean;
  showCounter?: boolean;
  autoHeight?: boolean;
}

export const MediaDisplay: React.FC<MediaDisplayProps> = ({
  mediaList,
  size = 'medium',
  showControls = true,
  showCounter = true,
  autoHeight = false,
}) => {
  // Handle empty media list
  if (!mediaList || mediaList.length === 0) {
    return null;
  }

  // Single media item - use MediaViewer
  if (mediaList.length === 1) {
    return <MediaViewer media={mediaList[0]} size={size} />;
  }

  // Multiple media items - use MediaCarousel
  return (
    <MediaCarousel
      mediaList={mediaList}
      size={size}
      showControls={showControls}
      showCounter={showCounter}
      autoHeight={autoHeight}
    />
  );
};