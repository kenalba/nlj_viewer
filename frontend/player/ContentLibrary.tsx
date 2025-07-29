/**
 * Activities Library Component
 * Now refactored to use optimized sub-components for improved performance
 */

import React from 'react';
import { ContentLibraryContainer } from './components/ContentLibraryContainer';

interface ContentLibraryProps {
  contentType: 'all' | 'training' | 'survey' | 'game' | 'recent';
}

export const ContentLibrary: React.FC<ContentLibraryProps> = ({ contentType }) => {
  return <ContentLibraryContainer contentType={contentType} />;
};

export default ContentLibrary;