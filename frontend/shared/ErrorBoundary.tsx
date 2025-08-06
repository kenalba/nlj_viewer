import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Alert, Paper } from '@mui/material';
import { ErrorModal, type ErrorDetails } from './ErrorModal';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showErrorModal: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showErrorModal: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      showErrorModal: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showErrorModal: false,
    });
  };

  handleShowDetails = () => {
    this.setState({ showErrorModal: true });
  };

  handleCloseModal = () => {
    this.setState({ showErrorModal: false });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorDetails: ErrorDetails = {
        category: 'unknown',
        message: this.state.error?.message || 'An unexpected error occurred',
        details: 'A React component error occurred during rendering. This may be due to invalid props, state corruption, or a bug in the component logic.',
        suggestions: [
          'Try refreshing the page',
          'Clear your browser cache and cookies',
          'Check if you\'re using a supported browser version',
          'If the problem persists, please report this issue with the debug information',
        ],
        stackTrace: this.state.error?.stack,
        rawData: this.state.errorInfo ? {
          componentStack: this.state.errorInfo.componentStack,
        } : undefined,
        timestamp: Date.now(),
      };

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            p: 4,
            backgroundColor: 'background.default',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            <Typography gutterBottom color="error">
              Something went wrong
            </Typography>
            
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography >
                {this.state.error?.message || 'An unexpected error occurred'}
              </Typography>
            </Alert>

            <Typography color="text.secondary" sx={{ mb: 3 }}>
              A technical error occurred while rendering this page. This has been logged 
              and you can help us fix it by providing the error details below.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                
                onClick={this.handleRetry}
                color="primary"
              >
                Try Again
              </Button>
              <Button
                
                onClick={this.handleShowDetails}
                color="secondary"
              >
                Show Error Details
              </Button>
              <Button
                
                onClick={() => window.location.reload()}
                color="info"
              >
                Reload Page
              </Button>
            </Box>

            <Typography color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Error ID: {Date.now().toString(36)}
            </Typography>
          </Paper>

          <ErrorModal
            open={this.state.showErrorModal}
            onClose={this.handleCloseModal}
            error={errorDetails}
            onRetry={this.handleRetry}
          />
        </Box>
      );
    }

    return this.props.children;
  }
}