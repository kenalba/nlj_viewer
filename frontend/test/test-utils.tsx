/**
 * Test utilities for components that require context providers
 */

import React from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { XAPIProvider } from '../contexts/XAPIContext';
import { ThemeProvider as CustomThemeProvider } from '../contexts/ThemeContext';
import { AudioProvider } from '../contexts/AudioContext';
import { GameProvider } from '../contexts/GameContext';
import { createTheme } from '@mui/material/styles';

// Create a default theme for testing
const defaultTheme = createTheme();

interface AllTheProvidersProps {
  children: React.ReactNode;
  themeMode?: 'hyundai' | 'unfiltered';
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children, themeMode = 'hyundai' }) => {
  return (
    <CustomThemeProvider initialTheme={themeMode}>
      <ThemeProvider theme={defaultTheme}>
        <CssBaseline />
        <AudioProvider>
          <XAPIProvider enabled={false}>
            <GameProvider>
              {children}
            </GameProvider>
          </XAPIProvider>
        </AudioProvider>
      </ThemeProvider>
    </CustomThemeProvider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  themeMode?: 'hyundai' | 'unfiltered';
}

const customRender = (
  ui: React.ReactElement,
  options?: CustomRenderOptions,
) => {
  const { themeMode, ...renderOptions } = options || {};
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AllTheProviders themeMode={themeMode}>{children}</AllTheProviders>
  );
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

export * from '@testing-library/react';
export { customRender as render, userEvent };