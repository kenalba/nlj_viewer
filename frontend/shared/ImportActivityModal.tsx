/**
 * Import Activity Modal
 * Supports importing from Ander JSON and Trivie XLSX files
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondary
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  AccountTree as NLJIcon,
  Quiz as TrivieIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Description as FileIcon,
  ArrowForward as NextIcon
} from '@mui/icons-material';
import type { NLJScenario } from '../types/nlj';
import { validateScenario } from '../utils/scenarioUtils';
import { parseTrivieExcel, convertTrivieToNLJ } from '../utils/trivieInterpreter';

interface ImportActivityModalProps {
  open: boolean;
  onClose: () => void;
  onActivityImported: (scenario: NLJScenario, fileName: string) => void;
}

interface ImportResult {
  success: boolean;
  scenario?: NLJScenario;
  fileName: string;
  fileType: 'ander-json' | 'trivie-xlsx';
  error?: string;
  warnings?: string[];
}

export const ImportActivityModal: React.FC<ImportActivityModalProps> = ({
  open,
  onClose,
  onActivityImported
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragOverCard, setDragOverCard] = useState<'ander' | 'trivie' | null>(null);

  // Reset state when modal opens/closes
  const handleClose = useCallback(() => {
    setImporting(false);
    setImportResult(null);
    setDragOver(false);
    setDragOverCard(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  }, [onClose]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragOver to false if we're leaving the modal area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
      setDragOverCard(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragOver(false);
    setDragOverCard(null);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file) {
      await processFile(file);
    }
  }, []);

  const handleCardDragEnter = useCallback((cardType: 'ander' | 'trivie') => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCard(cardType);
  }, []);

  const handleCardDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if we're actually leaving the card
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCard(null);
    }
  }, []);

  const processFile = async (file: File) => {
    setImporting(true);
    setImportResult(null);

    try {
      let result: ImportResult;

      if (file.name.toLowerCase().endsWith('.json')) {
        // Handle Ander JSON import
        result = await importAnderJSON(file);
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        // Handle Trivie XLSX import
        result = await importTrivieXLSX(file);
      } else {
        result = {
          success: false,
          fileName: file.name,
          fileType: 'ander-json', // Default
          error: 'Unsupported file type. Please select a .json or .xlsx file.'
        };
      }

      setImportResult(result);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        fileName: file.name,
        fileType: 'ander-json', // Default
        error: `Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }, []);

  const importAnderJSON = async (file: File): Promise<ImportResult> => {
    const text = await file.text();
    
    try {
      const parsed = JSON.parse(text);
      
      // Validate that this looks like an Ander NLJ scenario
      if (!parsed.id || !parsed.name || !Array.isArray(parsed.nodes)) {
        throw new Error('Invalid Ander JSON format. Missing required fields: id, name, or nodes array.');
      }

      // Convert to our NLJ format if needed (Ander format should be compatible)
      const scenario: NLJScenario = {
        id: parsed.id,
        name: parsed.name,
        description: parsed.description || '',
        nodes: parsed.nodes || [],
        links: parsed.links || [],
        variableDefinitions: parsed.variableDefinitions || [],
        orientation: parsed.orientation || 'vertical',
        activityType: parsed.activityType || 'training'
      };

      // Validate the scenario structure
      const validation = validateScenario(scenario);
      const warnings: string[] = [];

      if (!validation.isValid) {
        warnings.push(`Scenario validation warnings: ${validation.errors.join(', ')}`);
      }

      return {
        success: true,
        scenario,
        fileName: file.name,
        fileType: 'ander-json',
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  };

  const importTrivieXLSX = async (file: File): Promise<ImportResult> => {
    try {
      // Use existing Trivie interpreter
      const trivieQuizzes = await parseTrivieExcel(file);
      
      if (trivieQuizzes.length === 0) {
        throw new Error('No valid quizzes found in the Excel file.');
      }

      // Convert first quiz to NLJ format
      const firstQuiz = trivieQuizzes[0];
      const scenario = convertTrivieToNLJ(firstQuiz);

      const warnings: string[] = [];
      if (trivieQuizzes.length > 1) {
        warnings.push(`File contains ${trivieQuizzes.length} quizzes. Only the first quiz "${firstQuiz.title}" was imported.`);
      }

      return {
        success: true,
        scenario,
        fileName: file.name,
        fileType: 'trivie-xlsx',
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      throw new Error(`Failed to parse Trivie Excel file: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  };

  const handleImport = useCallback(() => {
    if (importResult?.success && importResult.scenario) {
      onActivityImported(importResult.scenario, importResult.fileName);
      handleClose();
    }
  }, [importResult, onActivityImported, handleClose]);

  const renderFileUpload = () => (
    <Box 
      sx={{ textAlign: 'center', py: 4 }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.xlsx"
        style={{ display: 'none' }}
      />
      
      <Box sx={{ mb: 3 }}>
        <UploadIcon sx={{ 
          fontSize: 64, 
          color: dragOver ? 'primary.dark' : 'primary.main', 
          mb: 2,
          transition: 'color 0.2s ease'
        }} />
        <Typography variant="h6" gutterBottom>
          Import Activity from File
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
          {dragOver 
            ? 'Drop your file here to import' 
            : 'Drag & drop files here or click the cards below. We support Ander JSON scenarios and Trivie Excel quiz files.'
          }
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
        <Card 
          sx={{ 
            width: 200, 
            cursor: 'pointer',
            border: 2,
            borderColor: dragOverCard === 'ander' ? 'primary.main' : 'transparent',
            bgcolor: dragOverCard === 'ander' ? 'primary.50' : 'background.paper',
            transition: 'all 0.2s ease',
            '&:hover': { 
              bgcolor: 'action.hover',
              borderColor: 'primary.light'
            }
          }}
          onClick={handleFileSelect}
          onDragEnter={handleCardDragEnter('ander')}
          onDragLeave={handleCardDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <NLJIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              Ander JSON
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {dragOverCard === 'ander' ? 'Drop .json file here' : '.json files from the Ander system'}
            </Typography>
          </CardContent>
        </Card>

        <Card 
          sx={{ 
            width: 200, 
            cursor: 'pointer',
            border: 2,
            borderColor: dragOverCard === 'trivie' ? 'secondary.main' : 'transparent',
            bgcolor: dragOverCard === 'trivie' ? 'secondary.50' : 'background.paper',
            transition: 'all 0.2s ease',
            '&:hover': { 
              bgcolor: 'action.hover',
              borderColor: 'secondary.light'
            }
          }}
          onClick={handleFileSelect}
          onDragEnter={handleCardDragEnter('trivie')}
          onDragLeave={handleCardDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <TrivieIcon sx={{ fontSize: 32, color: 'secondary.main', mb: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              Trivie Excel
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {dragOverCard === 'trivie' ? 'Drop .xlsx file here' : '.xlsx quiz export files'}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Button
        variant="contained"
        size="large"
        startIcon={<UploadIcon />}
        onClick={handleFileSelect}
        disabled={importing}
        sx={{
          bgcolor: dragOver ? 'primary.dark' : 'primary.main',
          '&:hover': {
            bgcolor: 'primary.dark'
          }
        }}
      >
        {dragOver ? 'Drop File Here' : 'Choose File to Import'}
      </Button>
    </Box>
  );

  const renderImporting = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CircularProgress sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Importing Activity...
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Please wait while we process your file
      </Typography>
      <LinearProgress sx={{ mt: 2, maxWidth: 300, mx: 'auto' }} />
    </Box>
  );

  const renderImportResult = () => {
    if (!importResult) return null;

    const { success, scenario, fileName, fileType, error, warnings } = importResult;

    return (
      <Box sx={{ py: 2 }}>
        {success ? (
          <>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Import Successful!
              </Typography>
              <Typography variant="body2">
                Your activity has been successfully processed and is ready to import.
              </Typography>
            </Alert>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FileIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {fileName}
                  </Typography>
                  <Chip 
                    label={fileType === 'ander-json' ? 'Ander JSON' : 'Trivie Excel'}
                    color={fileType === 'ander-json' ? 'primary' : 'secondary'}
                    size="small"
                  />
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="h6" gutterBottom>
                  {scenario?.name}
                </Typography>
                {scenario?.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {scenario.description}
                  </Typography>
                )}

                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${scenario?.nodes?.length || 0} nodes`}
                      secondary="Activity content nodes"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${scenario?.links?.length || 0} connections`}
                      secondary="Node relationships"
                    />
                  </ListItem>
                  {scenario?.variableDefinitions && scenario.variableDefinitions.length > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${scenario.variableDefinitions.length} variables`}
                        secondary="Dynamic content variables"
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>

            {warnings && warnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Import Warnings:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {warnings.map((warning, index) => (
                    <li key={index}>
                      <Typography variant="body2">{warning}</Typography>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </>
        ) : (
          <Alert severity="error">
            <Typography variant="subtitle2" gutterBottom>
              Import Failed
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
          </Alert>
        )}
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '500px',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h5">
          Import Activity
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Import activities from Ander JSON or Trivie Excel files
        </Typography>
      </DialogTitle>

      <DialogContent>
        {importing ? renderImporting() : 
         importResult ? renderImportResult() : 
         renderFileUpload()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={handleClose} size="medium">
          {importResult?.success ? 'Cancel' : 'Close'}
        </Button>
        
        {importResult?.success && (
          <Button 
            onClick={handleImport}
            variant="contained"
            size="medium"
            startIcon={<NextIcon />}
          >
            Import Activity
          </Button>
        )}
        
        {importResult && !importResult.success && (
          <Button 
            onClick={() => setImportResult(null)}
            variant="outlined"
            size="medium"
          >
            Try Again
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};