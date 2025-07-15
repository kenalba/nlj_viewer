import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { ThemeContext } from '../contexts/ThemeContext';
import { AudioContext } from '../contexts/AudioContext';
import { GameContext } from '../contexts/GameContext';
import { createTheme } from '../theme/theme';
import type { GameState } from '../types/nlj';

// Mock theme context
const MockThemeProvider = ({ children, themeMode = 'hyundai' }: { children: React.ReactNode; themeMode?: 'hyundai' | 'unfiltered' }) => {
  const theme = createTheme(themeMode);
  
  return (
    <ThemeContext.Provider value={{ 
      themeMode, 
      toggleTheme: () => {},
      setTheme: () => {},
    }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

// Mock audio context
const MockAudioProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AudioContext.Provider value={{
      playSound: () => {},
      isEnabled: true,
      toggleSound: () => {},
      setEnabled: () => {},
    }}>
      {children}
    </AudioContext.Provider>
  );
};

// Mock game context
const MockGameProvider = ({ 
  children, 
  initialState 
}: { 
  children: React.ReactNode; 
  initialState?: Partial<GameState>;
}) => {
  const defaultState: GameState = {
    scenarioId: 'test-scenario',
    currentNodeId: 'test-node',
    variables: {},
    visitedNodes: new Set(),
    completed: false,
    activityType: 'survey',
    responses: {},
    sessionId: 'test-session',
    startTime: new Date(),
    ...initialState,
  };

  return (
    <GameContext.Provider value={{
      state: defaultState,
      dispatch: () => {},
      loadScenario: () => {},
      navigateToNode: () => {},
      updateVariable: () => {},
      completeScenario: () => {},
      resetGame: () => {},
    }}>
      {children}
    </GameContext.Provider>
  );
};

// All providers wrapper
const AllProvidersWrapper = ({ 
  children, 
  themeMode = 'hyundai',
  gameState 
}: { 
  children: React.ReactNode; 
  themeMode?: 'hyundai' | 'unfiltered';
  gameState?: Partial<GameState>;
}) => {
  return (
    <MockThemeProvider themeMode={themeMode}>
      <MockAudioProvider>
        <MockGameProvider initialState={gameState}>
          {children}
        </MockGameProvider>
      </MockAudioProvider>
    </MockThemeProvider>
  );
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper') & {
    themeMode?: 'hyundai' | 'unfiltered';
    gameState?: Partial<GameState>;
  }
) => {
  const { themeMode, gameState, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProvidersWrapper themeMode={themeMode} gameState={gameState}>
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