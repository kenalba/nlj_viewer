import React, { useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { XAPIProvider } from './contexts/XAPIContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AudioProvider } from './contexts/AudioContext';
import { AuthProvider } from './contexts/AuthContext';
import { QueryProvider } from './contexts/QueryContext';
import { AppRouter } from './AppRouter';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { debugLog, isDebugEnabled } from './utils/debug';

const AppWithTheme: React.FC = () => {
  const { currentTheme, themeMode } = useTheme();

  useEffect(() => {
    if (isDebugEnabled()) {
      console.log('🐛 NLJ Debug mode is ACTIVE');
      console.log('💡 To disable: localStorage.setItem("nlj_debug", "false") or nlj_debug.disable()');
    }
    
    debugLog('App', 'NLJ Platform initialized', {
      version: '2.0.0',
      theme: themeMode,
      debugMode: isDebugEnabled(),
      environment: import.meta.env.DEV ? 'development' : 'production',
      timestamp: new Date().toISOString(),
    });
  }, [themeMode]);

  return (
    <MuiThemeProvider theme={currentTheme}>
      <CssBaseline />
      <ErrorBoundary>
        <QueryProvider>
          <AuthProvider>
            <AudioProvider>
              <XAPIProvider enabled={true}>
                <AppRouter />
              </XAPIProvider>
            </AudioProvider>
          </AuthProvider>
        </QueryProvider>
      </ErrorBoundary>
    </MuiThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppWithTheme />
    </ThemeProvider>
  );
};

export default App;