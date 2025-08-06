import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider as CustomThemeProvider } from '../contexts/ThemeContext';
import { AudioProvider } from '../contexts/AudioContext';
import { GameProvider } from '../contexts/GameContext';
import type { GameState } from '../types/nlj';


// Mock audio context
const MockAudioProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AudioProvider>
      {children}
    </AudioProvider>
  );
};

// Mock game context
const MockGameProvider = ({ 
  children
}: { 
  children: React.ReactNode;
}) => {
  return (
    <GameProvider>
      {children}
    </GameProvider>
  );
};

// All providers wrapper
const AllProvidersWrapper = ({ 
  children
}: { 
  children: React.ReactNode;
}) => {
  return (
    <CustomThemeProvider>
      <MockAudioProvider>
        <MockGameProvider>
          {children}
        </MockGameProvider>
      </MockAudioProvider>
    </CustomThemeProvider>
  );
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    themeMode?: 'hyundai' | 'unfiltered';
    gameState?: Partial<GameState>;
  }
) => {
  const { ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProvidersWrapper>
        {children}
      </AllProvidersWrapper>
    ),
    ...renderOptions,
  });
};

// Mock survey question factory
export const createMockLikertQuestion = (overrides = {}) => ({
  id: 'test-likert',
  type: 'likert_scale' as const,
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  text: 'How satisfied are you with your job?',
  content: 'Please rate your satisfaction level',
  scale: {
    min: 1,
    max: 5,
    labels: {
      min: 'Very Dissatisfied',
      max: 'Very Satisfied',
    },
  },
  required: true,
  showNumbers: true,
  showLabels: true,
  ...overrides,
});

export const createMockRatingQuestion = (overrides = {}) => ({
  id: 'test-rating',
  type: 'rating' as const,
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  text: 'Rate your overall experience',
  ratingType: 'stars' as const,
  range: {
    min: 1,
    max: 5,
  },
  required: true,
  allowHalf: false,
  showValue: true,
  ...overrides,
});

export const createMockSliderQuestion = (overrides = {}) => ({
  id: 'test-slider',
  type: 'slider' as const,
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  text: 'What percentage of your time is spent on customer service?',
  range: {
    min: 0,
    max: 100,
    step: 1,
  },
  labels: {
    min: '0%',
    max: '100%',
  },
  required: true,
  showValue: true,
  showTicks: true,
  ...overrides,
});

export const createMockTextAreaQuestion = (overrides = {}) => ({
  id: 'test-textarea',
  type: 'text_area' as const,
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  text: 'Please describe your experience',
  placeholder: 'Type your response here...',
  required: true,
  rows: 4,
  maxLength: 500,
  wordCount: true,
  ...overrides,
});

export const createMockMatrixQuestion = (overrides = {}) => ({
  id: 'test-matrix',
  type: 'matrix' as const,
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  text: 'Please rate the following aspects of your job',
  matrixType: 'single' as const,
  rows: [
    { id: 'satisfaction', text: 'Job Satisfaction' },
    { id: 'growth', text: 'Growth Opportunities' },
    { id: 'support', text: 'Management Support' },
  ],
  columns: [
    { id: 'poor', text: 'Poor' },
    { id: 'fair', text: 'Fair' },
    { id: 'good', text: 'Good' },
    { id: 'excellent', text: 'Excellent' },
  ],
  required: true,
  ...overrides,
});

// Export everything needed for tests
export * from '@testing-library/react';
export { customRender as render };
export { default as userEvent } from '@testing-library/user-event';
export { vi } from 'vitest';