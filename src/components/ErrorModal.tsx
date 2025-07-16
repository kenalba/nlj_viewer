import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  useTheme,
  useMediaQuery,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Close as CloseIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

export interface ErrorDetails {
  category: 'file_format' | 'schema_validation' | 'content_validation' | 'network' | 'permission' | 'unknown';
  message: string;
  details?: string;
  suggestions?: string[];
  rawData?: any;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  columnMappings?: Record<string, string>;
  validationErrors?: Array<{
    field: string;
    message: string;
    line?: number;
    column?: string;
  }>;
  stackTrace?: string;
  timestamp: number;
}

interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  error: ErrorDetails;
  onRetry?: () => void;
  onExportDebugInfo?: () => void;
}

const getCategoryInfo = (category: ErrorDetails['category']) => {
  switch (category) {
    case 'file_format':
      return {
        icon: <ErrorIcon />,
        color: 'error' as const,
        label: 'File Format Error',
        description: 'Invalid file format or corrupted file'
      };
    case 'schema_validation':
      return {
        icon: <WarningIcon />,
        color: 'warning' as const,
        label: 'Schema Validation Error',
        description: 'Missing required fields or invalid data types'
      };
    case 'content_validation':
      return {
        icon: <InfoIcon />,
        color: 'info' as const,
        label: 'Content Validation Error',
        description: 'Logical inconsistencies in the content'
      };
    case 'network':
      return {
        icon: <ErrorIcon />,
        color: 'error' as const,
        label: 'Network Error',
        description: 'Failed to load file from server'
      };
    case 'permission':
      return {
        icon: <ErrorIcon />,
        color: 'error' as const,
        label: 'Permission Error',
        description: 'Insufficient permissions to access file'
      };
    default:
      return {
        icon: <BugReportIcon />,
        color: 'error' as const,
        label: 'Unknown Error',
        description: 'An unexpected error occurred'
      };
  }
};

export const ErrorModal: React.FC<ErrorModalProps> = ({
  open,
  onClose,
  error,
  onRetry,
  onExportDebugInfo,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tabValue, setTabValue] = useState(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const categoryInfo = getCategoryInfo(error.category);

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleExportDebugInfo = () => {
    const debugInfo = {
      timestamp: new Date(error.timestamp).toISOString(),
      category: error.category,
      message: error.message,
      details: error.details,
      fileName: error.fileName,
      fileSize: error.fileSize,
      fileType: error.fileType,
      columnMappings: error.columnMappings,
      validationErrors: error.validationErrors,
      stackTrace: error.stackTrace,
      rawData: error.rawData,
    };

    const blob = new Blob([JSON.stringify(debugInfo, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onExportDebugInfo) {
      onExportDebugInfo();
    }
  };

  const renderSuggestions = () => {
    if (!error.suggestions || error.suggestions.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography gutterBottom>
          Suggested Solutions
        </Typography>
        <List dense>
          {error.suggestions.map((suggestion, index) => (
            <ListItem key={index} sx={{ px: 0 }}>
              <ListItemIcon>
                <InfoIcon color="info" />
              </ListItemIcon>
              <ListItemText primary={suggestion} />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  const renderValidationErrors = () => {
    if (!error.validationErrors || error.validationErrors.length === 0) return null;

    return (
      <Box>
        <Typography gutterBottom>
          Validation Errors
        </Typography>
        <List dense>
          {error.validationErrors.map((validationError, index) => (
            <ListItem key={index} sx={{ px: 0 }}>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary={validationError.message}
                secondary={
                  <Box>
                    <Typography color="text.secondary">
                      Field: {validationError.field}
                    </Typography>
                    {validationError.line && (
                      <Typography color="text.secondary">
                        Line: {validationError.line}
                      </Typography>
                    )}
                    {validationError.column && (
                      <Typography color="text.secondary">
                        Column: {validationError.column}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  const renderColumnMappings = () => {
    if (!error.columnMappings || Object.keys(error.columnMappings).length === 0) return null;

    return (
      <Box>
        <Typography gutterBottom>
          Detected Column Mappings
        </Typography>
        <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
          {Object.entries(error.columnMappings).map(([expected, actual]) => (
            <Box key={expected} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">
                {expected}:
              </Typography>
              <Typography fontWeight="medium">
                {actual}
              </Typography>
            </Box>
          ))}
        </Paper>
      </Box>
    );
  };

  const renderRawData = () => {
    if (!error.rawData) return null;

    const rawDataString = JSON.stringify(error.rawData, null, 2);

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography >
            Raw Data Preview
          </Typography>
          <Tooltip title={copiedText === 'rawData' ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton
              size="small"
              onClick={() => handleCopyToClipboard(rawDataString, 'rawData')}
            >
              <CopyIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Paper
          
          sx={{
            p: 2,
            backgroundColor: 'background.default',
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {rawDataString}
          </pre>
        </Paper>
      </Box>
    );
  };

  const renderStackTrace = () => {
    if (!error.stackTrace) return null;

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography >
            Stack Trace
          </Typography>
          <Tooltip title={copiedText === 'stackTrace' ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton
              size="small"
              onClick={() => handleCopyToClipboard(error.stackTrace!, 'stackTrace')}
            >
              <CopyIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Paper
          
          sx={{
            p: 2,
            backgroundColor: 'background.default',
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error.stackTrace}
          </pre>
        </Paper>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {categoryInfo.icon}
            <Typography >{categoryInfo.label}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ mt: 1 }}>
          <Chip
            label={categoryInfo.label}
            color={categoryInfo.color}
            size="small"
            sx={{ mr: 1 }}
          />
          {error.fileName && (
            <Chip
              label={error.fileName}
              
              size="small"
              sx={{ mr: 1 }}
            />
          )}
          {error.fileSize && (
            <Chip
              label={`${(error.fileSize / 1024).toFixed(1)} KB`}
              
              size="small"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity={categoryInfo.color} sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 'medium' }}>
            {categoryInfo.description}
          </Typography>
        </Alert>

        <Typography sx={{ mb: 2 }}>
          {error.message}
        </Typography>

        {error.details && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {error.details}
          </Typography>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="Solutions" />
            <Tab label="Details" />
            <Tab label="Debug Info" />
          </Tabs>
        </Box>

        {tabValue === 0 && (
          <Box>
            {renderSuggestions()}
            {renderValidationErrors()}
          </Box>
        )}

        {tabValue === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderColumnMappings()}
            {error.fileType && (
              <Box>
                <Typography gutterBottom>
                  File Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography >
                    <strong>Type:</strong> {error.fileType}
                  </Typography>
                  {error.fileSize && (
                    <Typography >
                      <strong>Size:</strong> {(error.fileSize / 1024).toFixed(1)} KB
                    </Typography>
                  )}
                  <Typography >
                    <strong>Timestamp:</strong> {new Date(error.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {tabValue === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderRawData()}
            {renderStackTrace()}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={<DownloadIcon />}
          onClick={handleExportDebugInfo}
          
        >
          Export Debug Info
        </Button>
        {onRetry && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            
          >
            Retry
          </Button>
        )}
        <Button onClick={onClose} >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};