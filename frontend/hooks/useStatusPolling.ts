/**
 * Custom hook for polling operation status
 * Provides real-time status checking for async event-driven operations
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PollingOptions {
  intervalMs?: number;
  maxAttempts?: number;
  immediate?: boolean;
  onStatusChange?: (status: any) => void;
  onComplete?: (finalStatus: any) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
}

export interface PollingState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  attempts: number;
  isPolling: boolean;
}

/**
 * Hook for polling status of async operations
 * @param fetchFn Function that fetches the current status
 * @param isComplete Function to determine if polling should stop
 * @param options Polling configuration options
 */
export function useStatusPolling<T>(
  fetchFn: () => Promise<T>,
  isComplete: (data: T) => boolean,
  options: PollingOptions = {}
) {
  const {
    intervalMs = 1000,
    maxAttempts = 30,
    immediate = false,
    onStatusChange,
    onComplete,
    onError,
    onTimeout,
  } = options;

  const [state, setState] = useState<PollingState<T>>({
    data: null,
    loading: false,
    error: null,
    attempts: 0,
    isPolling: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const attemptsRef = useRef(0);
  const isPollingRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    isPollingRef.current = false;
    setState(prev => ({ ...prev, isPolling: false }));
  }, []);

  const startPolling = useCallback(async () => {
    if (isPollingRef.current) {
      return; // Already polling
    }

    isPollingRef.current = true;
    attemptsRef.current = 0;
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      isPolling: true,
      attempts: 0,
    }));

    const poll = async () => {
      if (!isPollingRef.current) {
        return; // Polling was stopped
      }

      try {
        attemptsRef.current++;
        setState(prev => ({ ...prev, attempts: attemptsRef.current }));

        const data = await fetchFn();
        
        setState(prev => ({ 
          ...prev, 
          data, 
          error: null,
          attempts: attemptsRef.current,
        }));

        onStatusChange?.(data);

        if (isComplete(data)) {
          // Operation completed successfully
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            isPolling: false 
          }));
          isPollingRef.current = false;
          onComplete?.(data);
          return;
        }

        if (attemptsRef.current >= maxAttempts) {
          // Max attempts reached
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            isPolling: false,
            error: 'Status polling timeout - maximum attempts reached'
          }));
          isPollingRef.current = false;
          onTimeout?.();
          return;
        }

        // Schedule next poll
        timeoutRef.current = setTimeout(poll, intervalMs);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          isPolling: false,
          error: errorMessage 
        }));
        isPollingRef.current = false;
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    };

    await poll();
  }, [fetchFn, isComplete, intervalMs, maxAttempts, onStatusChange, onComplete, onError, onTimeout]);

  const stopPolling = useCallback(() => {
    clearPolling();
  }, [clearPolling]);

  const resetPolling = useCallback(() => {
    clearPolling();
    setState({
      data: null,
      loading: false,
      error: null,
      attempts: 0,
      isPolling: false,
    });
    attemptsRef.current = 0;
  }, [clearPolling]);

  // Start polling immediately if requested
  useEffect(() => {
    if (immediate) {
      startPolling();
    }
    
    // Cleanup on unmount
    return () => {
      clearPolling();
    };
  }, [immediate, startPolling, clearPolling]);

  return {
    ...state,
    startPolling,
    stopPolling,
    resetPolling,
  };
}

/**
 * Hook specifically for booking status polling
 */
export function useBookingStatusPolling(
  bookingId: string | null,
  options: Omit<PollingOptions, 'onComplete'> & {
    onBookingConfirmed?: (status: any) => void;
    onBookingWaitlisted?: (status: any) => void;
    onBookingFailed?: (status: any) => void;
  } = {}
) {
  const { onBookingConfirmed, onBookingWaitlisted, onBookingFailed, ...pollingOptions } = options;

  const fetchBookingStatus = useCallback(async () => {
    if (!bookingId) {
      throw new Error('No booking ID provided');
    }
    
    // This would use the registrationAPI
    const { registrationAPI } = await import('../api/training');
    return registrationAPI.getBookingStatus(bookingId);
  }, [bookingId]);

  const isComplete = useCallback((data: any) => {
    return data && data.status !== 'processing';
  }, []);

  const handleComplete = useCallback((finalStatus: any) => {
    switch (finalStatus.status) {
      case 'confirmed':
        onBookingConfirmed?.(finalStatus);
        break;
      case 'waitlisted':
        onBookingWaitlisted?.(finalStatus);
        break;
      case 'failed':
        onBookingFailed?.(finalStatus);
        break;
    }
  }, [onBookingConfirmed, onBookingWaitlisted, onBookingFailed]);

  return useStatusPolling(
    fetchBookingStatus,
    isComplete,
    {
      ...pollingOptions,
      onComplete: handleComplete,
    }
  );
}

/**
 * Hook specifically for program creation status polling
 */
export function useProgramStatusPolling(
  programId: string | null,
  options: PollingOptions = {}
) {
  const fetchProgramStatus = useCallback(async () => {
    if (!programId) {
      throw new Error('No program ID provided');
    }
    
    // This would use the trainingProgramsAPI
    const { trainingProgramsAPI } = await import('../api/training');
    return trainingProgramsAPI.getStatus(programId);
  }, [programId]);

  const isComplete = useCallback((data: any) => {
    // Program creation is complete when we can successfully fetch the program
    return data && data.id;
  }, []);

  return useStatusPolling(
    fetchProgramStatus,
    isComplete,
    options
  );
}