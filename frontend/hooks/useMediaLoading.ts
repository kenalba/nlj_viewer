import { useState, useCallback, useMemo } from 'react';
import type { Media } from '../types/nlj';

interface UseMediaLoadingOptions {
  strategy?: 'all' | 'critical' | 'progressive';
  criticalMediaIds?: string[];
  onAllLoaded?: () => void;
  onCriticalLoaded?: () => void;
}

interface MediaLoadingState {
  id: string;
  loaded: boolean;
  error: boolean;
  critical: boolean;
  loadTime?: number;
}

export const useMediaLoading = (
  mediaList: Media[] = [],
  options: UseMediaLoadingOptions = {}
) => {
  const {
    strategy = 'progressive',
    criticalMediaIds = [],
    onAllLoaded,
    onCriticalLoaded
  } = options;

  const [mediaStates, setMediaStates] = useState<Record<string, MediaLoadingState>>({});

  // Initialize media states
  const initializeMediaStates = useCallback(() => {
    const initialStates: Record<string, MediaLoadingState> = {};
    
    mediaList.forEach(media => {
      initialStates[media.id] = {
        id: media.id,
        loaded: false,
        error: false,
        critical: criticalMediaIds.includes(media.id),
      };
    });
    
    setMediaStates(initialStates);
  }, [mediaList, criticalMediaIds]);

  // Handle media load
  const handleMediaLoad = useCallback((mediaId: string) => {
    const loadTime = Date.now();
    
    setMediaStates(prev => ({
      ...prev,
      [mediaId]: {
        ...prev[mediaId],
        loaded: true,
        loadTime,
      }
    }));
  }, []);

  // Handle media error
  const handleMediaError = useCallback((mediaId: string) => {
    setMediaStates(prev => ({
      ...prev,
      [mediaId]: {
        ...prev[mediaId],
        error: true,
        loaded: true, // Mark as loaded even on error to prevent infinite loading
      }
    }));
  }, []);

  // Calculate loading statistics
  const stats = useMemo(() => {
    const states = Object.values(mediaStates);
    const totalMedia = states.length;
    const loadedMedia = states.filter(state => state.loaded).length;
    const errorMedia = states.filter(state => state.error).length;
    
    const criticalStates = states.filter(state => state.critical);
    const totalCritical = criticalStates.length;
    const loadedCritical = criticalStates.filter(state => state.loaded).length;
    const errorCritical = criticalStates.filter(state => state.error).length;
    
    return {
      totalMedia,
      loadedMedia,
      errorMedia,
      totalCritical,
      loadedCritical,
      errorCritical,
      overallProgress: totalMedia > 0 ? (loadedMedia / totalMedia) * 100 : 0,
      criticalProgress: totalCritical > 0 ? (loadedCritical / totalCritical) * 100 : 100,
      allLoaded: totalMedia > 0 && loadedMedia === totalMedia,
      criticalLoaded: totalCritical === 0 || loadedCritical === totalCritical,
      hasErrors: errorMedia > 0,
      hasCriticalErrors: errorCritical > 0,
    };
  }, [mediaStates]);

  // Determine content visibility based on strategy
  const shouldShowContent = useMemo(() => {
    switch (strategy) {
      case 'all':
        return stats.allLoaded;
      case 'critical':
        return stats.criticalLoaded;
      case 'progressive':
        return stats.criticalLoaded;
      default:
        return stats.criticalLoaded;
    }
  }, [strategy, stats]);

  // Create media handlers for components
  const mediaHandlers = useMemo(() => {
    const handlers: Record<string, { onLoad: () => void; onError: () => void }> = {};
    
    Object.keys(mediaStates).forEach(mediaId => {
      handlers[mediaId] = {
        onLoad: () => handleMediaLoad(mediaId),
        onError: () => handleMediaError(mediaId),
      };
    });
    
    return handlers;
  }, [mediaStates, handleMediaLoad, handleMediaError]);

  // Get loading phase
  const loadingPhase = useMemo(() => {
    if (stats.allLoaded) return 'complete';
    if (stats.criticalLoaded) return 'critical';
    return 'initial';
  }, [stats]);

  // Get media by category
  const mediaByCategory = useMemo(() => {
    const critical: Media[] = [];
    const supplementary: Media[] = [];
    
    mediaList.forEach(media => {
      if (criticalMediaIds.includes(media.id)) {
        critical.push(media);
      } else {
        supplementary.push(media);
      }
    });
    
    return { critical, supplementary };
  }, [mediaList, criticalMediaIds]);

  // Trigger callbacks when thresholds are met
  useState(() => {
    if (stats.criticalLoaded && loadingPhase === 'initial') {
      onCriticalLoaded?.();
    }
    if (stats.allLoaded && loadingPhase !== 'complete') {
      onAllLoaded?.();
    }
  });

  return {
    // State
    mediaStates,
    stats,
    loadingPhase,
    shouldShowContent,
    mediaByCategory,
    
    // Actions
    handleMediaLoad,
    handleMediaError,
    initializeMediaStates,
    mediaHandlers,
    
    // Utilities
    isMediaLoaded: (mediaId: string) => mediaStates[mediaId]?.loaded || false,
    isMediaError: (mediaId: string) => mediaStates[mediaId]?.error || false,
    isMediaCritical: (mediaId: string) => mediaStates[mediaId]?.critical || false,
    getMediaLoadTime: (mediaId: string) => mediaStates[mediaId]?.loadTime,
  };
};