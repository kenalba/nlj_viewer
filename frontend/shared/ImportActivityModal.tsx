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
  ListItemSecondary,
  TextField,
  Grid
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  AccountTree as NLJIcon,
  Quiz as TrivieIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Description as FileIcon,
  ArrowForward as NextIcon,
  ContentPaste as PasteIcon
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
  const [jsonText, setJsonText] = useState('');

  // Reset state when modal opens/closes
  const handleClose = useCallback(() => {
    setImporting(false);
    setImportResult(null);
    setDragOver(false);
    setJsonText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  }, [onClose]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleProcessJsonText = useCallback(async () => {
    if (!jsonText.trim()) {
      setImportResult({
        success: false,
        fileName: 'pasted-json',
        fileType: 'ander-json',
        error: 'Please paste JSON content into the text area.'
      });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const result = await importJsonText(jsonText);
      setImportResult(result);
    } catch (error) {
      console.error('JSON paste import error:', error);
      setImportResult({
        success: false,
        fileName: 'pasted-json',
        fileType: 'ander-json',
        error: `Failed to process JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setImporting(false);
    }
  }, [jsonText]);

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
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file) {
      await processFile(file);
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
    return await importJsonText(text, file.name);
  };

  const importJsonText = async (text: string, fileName: string = 'pasted-json'): Promise<ImportResult> => {
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
      const validationErrors = validateScenario(scenario);
      const warnings: string[] = [];

      if (validationErrors.length > 0) {
        warnings.push(`Scenario validation warnings: ${validationErrors.join(', ')}`);
      }

      return {
        success: true,
        scenario,
        fileName,
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

  const renderJsonPaste = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', mb: 2 }}>
        Paste JSON Content
      </Typography>

      <Card sx={{ 
        flexGrow: 1,
        border: 1,
        borderColor: 'grey.300',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PasteIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="body2" color="text.secondary">
              Paste your Ander JSON scenario content directly below
            </Typography>
          </Box>
          
          <TextField
            multiline
            fullWidth
            variant="outlined"
            placeholder={`Paste your JSON content here...

Example:
{
  "id": "my-scenario",
  "name": "My Scenario",
  "nodes": [...],
  "links": [...]
}`}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            sx={{
              flexGrow: 1,
              '& .MuiOutlinedInput-root': {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                height: '100%',
                alignItems: 'flex-start',
                '& .MuiInputBase-input': {
                  height: '100% !important',
                  overflow: 'auto !important'
                }
              }
            }}
            disabled={importing}
            InputProps={{
              sx: { height: '100%', alignItems: 'flex-start' }
            }}
          />
        </CardContent>
      </Card>
      
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Button
          variant="contained"
          startIcon={<PasteIcon />}
          onClick={handleProcessJsonText}
          disabled={importing || !jsonText.trim()}
          sx={{ minWidth: 120 }}
        >
          Process JSON
        </Button>
      </Box>
    </Box>
  );

  const renderFileUpload = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.xlsx"
        style={{ display: 'none' }}
      />
      
      <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', mb: 2 }}>
        Upload Files
      </Typography>

      <Card 
        sx={{ 
          flexGrow: 1,
          cursor: 'pointer',
          border: 2,
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderStyle: dragOver ? 'solid' : 'dashed',
          bgcolor: dragOver ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          '&:hover': { 
            bgcolor: 'action.hover',
            borderColor: 'primary.light',
            borderStyle: 'solid'
          }
        }}
        onClick={handleFileSelect}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <UploadIcon sx={{ 
            fontSize: 48, 
            color: dragOver ? 'primary.main' : 'text.secondary', 
            mb: 2,
            transition: 'color 0.2s ease'
          }} />
          <Typography variant="body1" gutterBottom sx={{ fontWeight: 500 }}>
            {dragOver ? 'Drop your file here' : 'Drag & drop files here or click to browse'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We support multiple file formats:
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NLJIcon sx={{ fontSize: 20, color: 'primary.main' }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Ander JSON
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  .json scenario files
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrivieIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Trivie Excel
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  .xlsx quiz exports
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={handleFileSelect}
          disabled={importing}
          sx={{ minWidth: 120 }}
        >
          Browse Files
        </Button>
      </Box>
    </Box>
  );

  const renderImporting = () => (
    <Box sx={{ textAlign: 'center' }}>
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
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {warnings.map((warning, index) => (
                    <Box component="li" key={index}>
                      <Typography variant="body2">{warning}</Typography>
                    </Box>
                  ))}
                </Box>
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
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '800px',
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle>
        Import Activity
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Upload files (Ander JSON, Trivie Excel) or paste JSON content directly
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ 
        flex: 1, 
        p: 0, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {importing ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderImporting()}
          </Box>
        ) : importResult ? (
          <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
            {renderImportResult()}
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', height: '100%' }}>
            <Box sx={{ 
              flex: 1, 
              borderRight: 1, 
              borderColor: 'divider',
              p: 3,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {renderFileUpload()}
            </Box>
            <Box sx={{ 
              flex: 1,
              p: 3,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {renderJsonPaste()}
            </Box>
          </Box>
        )}
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