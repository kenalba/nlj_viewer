import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import { Upload as UploadIcon, PlayArrow as PlayIcon } from '@mui/icons-material';
import type { NLJScenario } from '../types/nlj';
import { validateScenario } from '../utils/scenarioUtils';
import { parseTrivieExcel, convertTrivieToNLJ, validateTrivieQuiz } from '../utils/trivieInterpreter';
import { useGameContext } from '../contexts/GameContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio } from '../contexts/AudioContext';
import { ThemeToggle } from './ThemeToggle';
import { SoundToggle } from './SoundToggle';
import { ErrorModal, type ErrorDetails } from './ErrorModal';

// Sample scenarios for demo
const SAMPLE_SCENARIOS = [
  'nls.Markdown_and_Carousel_Test.json',
  'nls.FSA_102_1_40.json',
  'nls.FSA_102_2_10.json',
  'nls.FSA_102_3_20.json',
  'nls.FSA_102_4_30.json',
  'nls.Ioniq9_TestDrive_ProductKnowledge.json',
  'nls.Spend Now Save Later - Priscilla .json',
  'nls.Testing NLJ Images.json',
];

// Sample Trivie quizzes
const SAMPLE_TRIVIE_QUIZZES = [
  'quizzes_export_2025-07-15.xlsx',
];

// Sample surveys
const SAMPLE_SURVEYS = [
  'automotive_sales_department.json',
  'employee_engagement.json',
  'manager_effectiveness.json',
  'work_life_balance.json',
];

export const ScenarioLoader: React.FC = () => {
  const { loadScenario } = useGameContext();
  const { themeMode } = useTheme();
  const { playSound } = useAudio();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const createErrorDetails = (
    category: ErrorDetails['category'],
    message: string,
    details?: string,
    suggestions?: string[],
    file?: File,
    additionalData?: any
  ): ErrorDetails => ({
    category,
    message,
    details,
    suggestions,
    fileName: file?.name,
    fileSize: file?.size,
    fileType: file?.type,
    timestamp: Date.now(),
    ...additionalData,
  });

  const handleError = (errorDetails: ErrorDetails) => {
    setError(errorDetails.message);
    setErrorDetails(errorDetails);
    setShowErrorModal(true);
    playSound('error');
  };

  const loadScenarioFromFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setShowErrorModal(false);
    
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      let scenario: NLJScenario;
      let rawData: any;
      
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Handle Trivie Excel files
        try {
          const quizzes = await parseTrivieExcel(file);
          rawData = quizzes;
          
          if (quizzes.length === 0) {
            handleError(createErrorDetails(
              'content_validation',
              'No valid quizzes found in Excel file',
              'The Excel file was parsed successfully but no quiz data could be extracted. This may be due to missing headers, empty sheets, or unsupported format.',
              [
                'Verify the Excel file contains quiz data with proper headers',
                'Check if the file has been exported from Trivie correctly',
                'Ensure the first row contains column headers',
                'Try using a different Excel file format (.xlsx instead of .xls)',
              ],
              file,
              { rawData }
            ));
            return;
          }
          
          // Use the first quiz if multiple are found
          const quiz = quizzes[0];
          
          // Validate Trivie quiz
          const trivieErrors = validateTrivieQuiz(quiz);
          if (trivieErrors.length > 0) {
            handleError(createErrorDetails(
              'schema_validation',
              'Trivie quiz validation failed',
              `The Excel file contains ${trivieErrors.length} validation error(s) that prevent proper conversion.`,
              [
                'Check if all required columns are present in the Excel file',
                'Verify question types are supported (multiple choice, true/false, etc.)',
                'Ensure answer choices are properly formatted',
                'Check for empty or invalid question text',
              ],
              file,
              { 
                rawData,
                validationErrors: trivieErrors.map(error => ({ field: 'unknown', message: error }))
              }
            ));
            return;
          }
          
          // Convert to NLJ format
          scenario = convertTrivieToNLJ(quiz);
          
          // Validate converted scenario
          const validationErrors = validateScenario(scenario);
          if (validationErrors.length > 0) {
            handleError(createErrorDetails(
              'content_validation',
              'Scenario conversion validation failed',
              `The converted scenario contains ${validationErrors.length} validation error(s).`,
              [
                'The Excel file was processed but the resulting scenario has structural issues',
                'Try using a simpler Excel file to test',
                'Check if the quiz questions follow supported formats',
                'Report this issue if the Excel file looks correct',
              ],
              file,
              { 
                rawData: scenario,
                validationErrors: validationErrors.map(error => ({ field: 'scenario', message: error }))
              }
            ));
            return;
          }
        } catch (excelError) {
          handleError(createErrorDetails(
            'file_format',
            'Excel file parsing failed',
            `Unable to parse the Excel file: ${excelError instanceof Error ? excelError.message : 'Unknown error'}`,
            [
              'Verify the file is a valid Excel format (.xlsx or .xls)',
              'Check if the file is corrupted or password-protected',
              'Try saving the file in a different Excel format',
              'Ensure the file is not currently open in another application',
            ],
            file,
            { 
              stackTrace: excelError instanceof Error ? excelError.stack : undefined,
              rawData: undefined
            }
          ));
          return;
        }
      } else {
        // Handle JSON NLJ files
        try {
          const text = await file.text();
          try {
            scenario = JSON.parse(text);
            rawData = scenario;
          } catch (jsonError) {
            handleError(createErrorDetails(
              'file_format',
              'Invalid JSON format',
              `The file contains invalid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`,
              [
                'Check if the JSON file is properly formatted',
                'Validate the JSON syntax using a JSON validator',
                'Ensure the file is not corrupted',
                'Try using a different JSON file',
              ],
              file,
              { 
                stackTrace: jsonError instanceof Error ? jsonError.stack : undefined,
                rawData: text.substring(0, 1000) // First 1000 chars for debugging
              }
            ));
            return;
          }
          
          // Validate scenario
          const validationErrors = validateScenario(scenario);
          if (validationErrors.length > 0) {
            handleError(createErrorDetails(
              'schema_validation',
              'Scenario validation failed',
              `The JSON file contains ${validationErrors.length} validation error(s).`,
              [
                'Verify the JSON follows the NLJ scenario schema',
                'Check if all required fields are present',
                'Ensure node IDs are unique and properly referenced',
                'Validate that links reference existing nodes',
              ],
              file,
              { 
                rawData: scenario,
                validationErrors: validationErrors.map(error => ({ field: 'scenario', message: error }))
              }
            ));
            return;
          }
        } catch (readError) {
          handleError(createErrorDetails(
            'file_format',
            'Unable to read file',
            `Failed to read the file contents: ${readError instanceof Error ? readError.message : 'Unknown error'}`,
            [
              'Check if the file is corrupted',
              'Verify you have permission to read the file',
              'Try using a different file',
              'Ensure the file is not too large',
            ],
            file,
            { 
              stackTrace: readError instanceof Error ? readError.stack : undefined
            }
          ));
          return;
        }
      }
      
      // Store scenario data in localStorage
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      playSound('navigate');
      loadScenario(scenario);
    } catch (err) {
      handleError(createErrorDetails(
        'unknown',
        'Unexpected error occurred',
        `An unexpected error occurred while loading the file: ${err instanceof Error ? err.message : 'Unknown error'}`,
        [
          'Try refreshing the page and uploading the file again',
          'Check if your browser supports the file type',
          'Clear browser cache and try again',
          'Report this issue with the debug information',
        ],
        file,
        { 
          stackTrace: err instanceof Error ? err.stack : undefined
        }
      ));
    } finally {
      setLoading(false);
    }
  }, [loadScenario, playSound]);

  const loadSampleScenario = useCallback(async (filename: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}static/sample_nljs/${filename}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const scenario: NLJScenario = await response.json();
      
      // Validate scenario
      const validationErrors = validateScenario(scenario);
      if (validationErrors.length > 0) {
        playSound('error');
        setError(`Validation errors: ${validationErrors.join(', ')}`);
        return;
      }
      
      // Store scenario data in localStorage
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      playSound('navigate');
      loadScenario(scenario);
    } catch (err) {
      playSound('error');
      setError(err instanceof Error ? err.message : 'Failed to load sample scenario');
    } finally {
      setLoading(false);
    }
  }, [loadScenario, playSound]);

  const loadSampleTrivieQuiz = useCallback(async (filename: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}static/sample_trivie_quiz/${filename}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], filename, { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      // Use the existing file loading logic
      await loadScenarioFromFile(file);
    } catch (err) {
      playSound('error');
      setError(err instanceof Error ? err.message : 'Failed to load sample Trivie quiz');
    } finally {
      setLoading(false);
    }
  }, [loadScenarioFromFile, playSound]);

  const loadSampleSurvey = useCallback(async (filename: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}static/sample_surveys/${filename}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const scenario: NLJScenario = await response.json();
      
      // Validate scenario
      const validationErrors = validateScenario(scenario);
      if (validationErrors.length > 0) {
        playSound('error');
        setError(`Validation errors: ${validationErrors.join(', ')}`);
        return;
      }
      
      // Store scenario data in localStorage
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      playSound('navigate');
      loadScenario(scenario);
    } catch (err) {
      playSound('error');
      setError(err instanceof Error ? err.message : 'Failed to load sample survey');
    } finally {
      setLoading(false);
    }
  }, [loadScenario, playSound]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadScenarioFromFile(file);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      width: '100%',
      backgroundColor: 'background.default',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      py: 4 
    }}>
      <Container maxWidth="md" sx={{ 
        minHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Box sx={{ textAlign: 'center', mb: 4, position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center' }}>
            <SoundToggle />
            <ThemeToggle />
          </Box>
          <Typography gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
            {themeMode === 'unfiltered' ? 'Interactive Training' : 'NLJ Training'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {themeMode === 'unfiltered' ? 'Unfiltered Learning Experience' : 'Interactive Learning Experience'}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Load a Non-Linear Journey scenario to begin your personalized training experience.
          </Typography>
        </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress />
        </Box>
      )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* NLJ Scenarios Section */}
          <Box>
            <Typography gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              NLJ Scenarios
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              gap: 3, 
              alignItems: 'stretch',
              flexDirection: { xs: 'column', md: 'row' }
            }}>
              {/* Upload NLJ */}
              <Card sx={{ flex: 1 }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography gutterBottom sx={{ fontWeight: 600 }}>
                      Upload NLJ
                    </Typography>
                    <Typography color="text.secondary">
                      Upload a .json file containing an NLJ scenario
                    </Typography>
                  </Box>
                  <Button
                    
                    component="label"
                    startIcon={<UploadIcon />}
                    disabled={loading}
                    fullWidth
                    size="large"
                  >
                    Choose JSON File
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      hidden
                    />
                  </Button>
                </CardContent>
              </Card>

              {/* Sample Scenarios */}
              <Card sx={{ flex: 1 }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <PlayIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography gutterBottom sx={{ fontWeight: 600 }}>
                      Sample Scenarios
                    </Typography>
                    <Typography color="text.secondary">
                      Try one of the included NLJ demo scenarios
                    </Typography>
                  </Box>
                  <List>
                    {SAMPLE_SCENARIOS.map((filename) => (
                      <ListItem key={filename} disablePadding sx={{ mb: 1 }}>
                        <ListItemButton
                          onClick={() => loadSampleScenario(filename)}
                          disabled={loading}
                          sx={{ 
                            borderRadius: 2,
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <PlayIcon sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
                          <ListItemText 
                            primary={filename.replace('.json', '').replace(/^nls\./, '')}
                            slotProps={{
                              primary: {
                                style: {
                                  fontSize: '0.95rem',
                                  fontWeight: 500
                                }
                              }
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Trivie Quizzes Section */}
          <Box>
            <Typography gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Trivie Quizzes & Surveys
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              gap: 3, 
              alignItems: 'stretch',
              flexDirection: { xs: 'column', md: 'row' }
            }}>
              {/* Upload Trivie */}
              <Card sx={{ flex: 1 }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <UploadIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                    <Typography gutterBottom sx={{ fontWeight: 600 }}>
                      Upload Trivie Quiz
                    </Typography>
                    <Typography color="text.secondary">
                      Upload an .xlsx file containing a Trivie quiz
                    </Typography>
                  </Box>
                  <Button
                    
                    component="label"
                    startIcon={<UploadIcon />}
                    disabled={loading}
                    fullWidth
                    size="large"
                    color="secondary"
                  >
                    Choose Excel File
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      hidden
                    />
                  </Button>
                </CardContent>
              </Card>

              {/* Sample Trivie Quizzes */}
              <Card sx={{ flex: 1 }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <PlayIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                    <Typography gutterBottom sx={{ fontWeight: 600 }}>
                      Sample Quizzes
                    </Typography>
                    <Typography color="text.secondary">
                      Try converted Trivie quiz formats
                    </Typography>
                  </Box>
                  <List>
                    {SAMPLE_TRIVIE_QUIZZES.map((filename) => (
                      <ListItem key={filename} disablePadding sx={{ mb: 1 }}>
                        <ListItemButton
                          onClick={() => loadSampleTrivieQuiz(filename)}
                          disabled={loading}
                          sx={{ 
                            borderRadius: 2,
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <PlayIcon sx={{ mr: 2, fontSize: 20, color: 'secondary.main' }} />
                          <ListItemText 
                            primary={filename.replace('.xlsx', '').replace(/^quizzes_export_/, 'Quiz Export ')}
                            slotProps={{
                              primary: {
                                style: {
                                  fontSize: '0.95rem',
                                  fontWeight: 500
                                }
                              }
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Box>
            
            {/* Sample Surveys Subsection */}
            <Box sx={{ mt: 3 }}>
              <Typography gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                Sample Surveys
              </Typography>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <PlayIcon sx={{ fontSize: 40, color: 'info.main', mb: 2 }} />
                    <Typography gutterBottom sx={{ fontWeight: 600 }}>
                      Employee Feedback Surveys
                    </Typography>
                    <Typography color="text.secondary">
                      Try automotive and cross-industry survey examples
                    </Typography>
                  </Box>
                  <List>
                    {SAMPLE_SURVEYS.map((filename) => (
                      <ListItem key={filename} disablePadding sx={{ mb: 1 }}>
                        <ListItemButton
                          onClick={() => loadSampleSurvey(filename)}
                          disabled={loading}
                          sx={{ 
                            borderRadius: 2,
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <PlayIcon sx={{ mr: 2, fontSize: 20, color: 'info.main' }} />
                          <ListItemText 
                            primary={filename.replace('.json', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            slotProps={{
                              primary: {
                                style: {
                                  fontSize: '0.95rem',
                                  fontWeight: 500
                                }
                              }
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Enhanced Error Modal */}
      {errorDetails && (
        <ErrorModal
          open={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          error={errorDetails}
          onRetry={() => {
            setShowErrorModal(false);
            setError(null);
            setErrorDetails(null);
          }}
          onExportDebugInfo={() => {
            console.log('Debug info exported:', errorDetails);
          }}
        />
      )}
    </Box>
  );
};