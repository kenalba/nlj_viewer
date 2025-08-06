/**
 * Simple Error Boundary to catch React errors
 */

import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      hasError: true,
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
          <Typography variant="h4" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" gutterBottom>
            There was an error loading this page:
          </Typography>
          <Box sx={{ 
            mt: 2, 
            p: 2, 
            bgcolor: 'grey.100', 
            borderRadius: 1,
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            overflow: 'auto'
          }}>
            <Typography variant="body2" color="error">
              {this.state.error?.message}
            </Typography>
            {this.state.error?.stack && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {this.state.error.stack}
              </Typography>
            )}
          </Box>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()} 
            sx={{ mt: 2 }}
          >
            Reload Page
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => {
              localStorage.clear();
              window.location.href = '/app';
            }} 
            sx={{ mt: 2, ml: 2 }}
          >
            Clear Data & Reload
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}