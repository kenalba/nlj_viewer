import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Tabs,
  Tab,
  TextField,
  Divider,
  Stack,
} from '@mui/material';
import { 
  Upload as UploadIcon, 
  PlayArrow as PlayIcon,
  Quiz as QuizIcon,
  Poll as SurveyIcon,
  Assignment as NLJIcon,
  Link as ConnectionsIcon,
  Games as WordleIcon,
  Download as DownloadIcon,
  Code as LLMIcon,
  AccountTree as FlowIcon,
} from '@mui/icons-material';
import type { NLJScenario } from '../types/nlj';
import { validateScenario } from '../utils/scenarioUtils';
import { parseTrivieExcel, convertTrivieToNLJ, validateTrivieQuiz } from '../utils/trivieInterpreter';
import { useGameContext } from '../contexts/GameContext';
import { useAudio } from '../contexts/AudioContext';
import { ThemeToggle } from './ThemeToggle';
import { SoundToggle } from './SoundToggle';
import { ErrorModal, type ErrorDetails } from './ErrorModal';
import { LLMPromptGenerator } from './LLMPromptGenerator';
import { 
  generateSchemaDocumentation, 
  generateBloomsTaxonomyReference, 
  generateExampleScenarios 
} from '../utils/schemaDocGenerator';

// Activity Types
type ActivityType = 'nlj' | 'trivie' | 'survey' | 'connections' | 'wordle' | 'llm_docs';

// Activity Type Configuration
interface ActivityTypeConfig {
  id: ActivityType;
  name: string;
  icon: React.ReactElement;
  color: 'primary' | 'secondary' | 'info';
  uploadLabel: string;
  uploadDescription: string;
  uploadAccept: string;
  samplesLabel: string;
  samplesDescription: string;
  samples: string[];
  loadSampleFunction: (filename: string) => Promise<void>;
}

// Sample data arrays
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

const SAMPLE_TRIVIE_QUIZZES = [
  'quizzes_export_2025-07-15.xlsx',
];

const SAMPLE_SURVEYS = [
  'automotive_sales_department.json',
  'employee_engagement.json',
  'manager_effectiveness.json',
  'work_life_balance.json',
];

const SAMPLE_CONNECTIONS = [
  'sample_connections_game.json',
  'science_connections.json',
  'general_knowledge.json',
];

const SAMPLE_WORDLE = [
  'sample_wordle_game.json',
  'easy_wordle.json',
  'hard_wordle.json',
];

interface ScenarioLoaderProps {
  onFlowEdit?: (scenario: NLJScenario) => void;
}

export const ScenarioLoader: React.FC<ScenarioLoaderProps> = ({ onFlowEdit }) => {
  const { loadScenario } = useGameContext();
  const { playSound } = useAudio();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedScenario, setLoadedScenario] = useState<NLJScenario | null>(null);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>('nlj');
  const [showLLMPromptGenerator, setShowLLMPromptGenerator] = useState(false);
  const [pastedJson, setPastedJson] = useState<string>('');

  const createErrorDetails = (
    category: ErrorDetails['category'],
    message: string,
    details?: string,
    suggestions?: string[],
    file?: File,
    additionalData?: Record<string, unknown>
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

  const handleError = useCallback((errorDetails: ErrorDetails) => {
    setError(errorDetails.message);
    setErrorDetails(errorDetails);
    setShowErrorModal(true);
    playSound('error');
  }, [playSound]);

  const loadScenarioFromFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setShowErrorModal(false);
    
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      let scenario: NLJScenario;
      let rawData: unknown;
      
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
      setLoadedScenario(scenario);
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

  const handlePastedJson = useCallback(async () => {
    if (!pastedJson.trim()) {
      playSound('error');
      setError('Please paste JSON content in the text area');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Parse and validate JSON
      let scenario: NLJScenario;
      try {
        scenario = JSON.parse(pastedJson);
      } catch (jsonError) {
        handleError(createErrorDetails(
          'file_format',
          'Invalid JSON format',
          `The pasted content contains invalid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`,
          [
            'Check if the JSON is properly formatted',
            'Validate the JSON syntax using a JSON validator',
            'Ensure all brackets, quotes, and commas are correct',
            'Make sure there are no trailing commas',
          ],
          undefined,
          { 
            rawData: pastedJson.substring(0, 1000) + (pastedJson.length > 1000 ? '...' : '')
          }
        ));
        return;
      }

      // Validate scenario structure
      const validationErrors = validateScenario(scenario);
      if (validationErrors.length > 0) {
        handleError(createErrorDetails(
          'content_validation',
          'Scenario validation failed',
          `The pasted JSON contains ${validationErrors.length} validation error(s).`,
          [
            'Verify the JSON follows the NLJ scenario format',
            'Check that all required fields are present',
            'Ensure node IDs are unique and properly referenced',
            'Verify links connect existing nodes',
          ],
          undefined,
          { 
            rawData: scenario,
            validationErrors: validationErrors.map(error => ({ field: 'scenario', message: error }))
          }
        ));
        return;
      }

      // Store scenario data in localStorage
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      playSound('navigate');
      setLoadedScenario(scenario);
      loadScenario(scenario);
      
      // Clear the pasted JSON after successful load
      setPastedJson('');
      
    } catch (err) {
      handleError(createErrorDetails(
        'unknown',
        'Failed to process pasted JSON',
        `An error occurred while processing the pasted content: ${err instanceof Error ? err.message : 'Unknown error'}`,
        [
          'Try pasting the JSON again',
          'Verify the JSON is complete and not truncated',
          'Check for any special characters that might cause issues',
          'Try using the file upload option instead',
        ],
        undefined,
        { 
          stackTrace: err instanceof Error ? err.stack : undefined
        }
      ));
    } finally {
      setLoading(false);
    }
  }, [pastedJson, loadScenario, playSound, handleError]);

  const handlePastedJsonPreview = useCallback(async () => {
    if (!pastedJson.trim()) {
      playSound('error');
      setError('Please paste JSON content in the text area');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Parse and validate JSON
      let scenario: NLJScenario;
      try {
        scenario = JSON.parse(pastedJson);
      } catch (jsonError) {
        handleError(createErrorDetails(
          'file_format',
          'Invalid JSON format',
          `The pasted content contains invalid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`,
          [
            'Check if the JSON is properly formatted',
            'Validate the JSON syntax using a JSON validator',
            'Ensure all brackets, quotes, and commas are correct',
          ],
          undefined,
          { pastedContent: pastedJson }
        ));
        return;
      }

      // Validate scenario
      const validationErrors = validateScenario(scenario);
      if (validationErrors.length > 0) {
        handleError(createErrorDetails(
          'schema_validation',
          'Invalid NLJ scenario format',
          `The pasted JSON contains ${validationErrors.length} validation error(s) that prevent proper loading.`,
          [
            'Check that all required fields are present',
            'Ensure node IDs are unique and properly referenced',
            'Verify links connect existing nodes',
          ],
          undefined,
          { 
            rawData: scenario,
            validationErrors: validationErrors.map(error => ({ field: 'scenario', message: error }))
          }
        ));
        return;
      }

      // Store scenario data in localStorage for potential play later
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      playSound('navigate');
      setLoadedScenario(scenario);
      
      // Open flow editor instead of playing
      if (onFlowEdit) {
        onFlowEdit(scenario);
      }
      
      // Clear the pasted JSON after successful load
      setPastedJson('');
      
    } catch (err) {
      handleError(createErrorDetails(
        'unknown',
        'Failed to process pasted JSON',
        `An error occurred while processing the pasted content: ${err instanceof Error ? err.message : 'Unknown error'}`,
        [
          'Try pasting the JSON again',
          'Verify the JSON is complete and not truncated',
          'Check for any special characters that might cause issues',
          'Try using the file upload option instead',
        ],
        undefined,
        { 
          stackTrace: err instanceof Error ? err.stack : undefined
        }
      ));
    } finally {
      setLoading(false);
    }
  }, [pastedJson, playSound, handleError, onFlowEdit]);

  const loadSampleForPreview = useCallback(async (filename: string) => {
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
      setLoadedScenario(scenario);
      
      // Open flow editor instead of playing
      if (onFlowEdit) {
        onFlowEdit(scenario);
      }
      
    } catch (err) {
      playSound('error');
      setError(`Failed to load sample: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [playSound, onFlowEdit]);

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
      setLoadedScenario(scenario);
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
      setLoadedScenario(scenario);
      loadScenario(scenario);
    } catch (err) {
      playSound('error');
      setError(err instanceof Error ? err.message : 'Failed to load sample survey');
    } finally {
      setLoading(false);
    }
  }, [loadScenario, playSound]);

  const loadSampleConnections = useCallback(async (filename: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}static/sample_connections/${filename}`);
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
      setLoadedScenario(scenario);
      loadScenario(scenario);
    } catch (err) {
      playSound('error');
      setError(err instanceof Error ? err.message : 'Failed to load sample connections game');
    } finally {
      setLoading(false);
    }
  }, [loadScenario, playSound]);

  const loadSampleWordle = useCallback(async (filename: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}static/sample_wordle/${filename}`);
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
      setLoadedScenario(scenario);
      loadScenario(scenario);
    } catch (err) {
      playSound('error');
      setError(err instanceof Error ? err.message : 'Failed to load sample wordle game');
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

  const downloadSampleJSON = useCallback(async (activityType: ActivityType) => {
    try {
      let sampleData: unknown;
      let filename: string;
      
      switch (activityType) {
        case 'nlj': {
          // Download the first sample NLJ scenario
          const nlj = await fetch(`${import.meta.env.BASE_URL}static/sample_nljs/${SAMPLE_SCENARIOS[0]}`);
          sampleData = await nlj.json();
          filename = 'sample_nlj_scenario.json';
          break;
        }
          
        case 'survey': {
          // Download the first sample survey
          const survey = await fetch(`${import.meta.env.BASE_URL}static/sample_surveys/${SAMPLE_SURVEYS[0]}`);
          sampleData = await survey.json();
          filename = 'sample_survey.json';
          break;
        }
          
        case 'connections': {
          // Download the first sample connections game
          const connections = await fetch(`${import.meta.env.BASE_URL}static/sample_connections/${SAMPLE_CONNECTIONS[0]}`);
          sampleData = await connections.json();
          filename = 'sample_connections_game.json';
          break;
        }
          
        case 'wordle': {
          // Download the first sample wordle game
          const wordle = await fetch(`${import.meta.env.BASE_URL}static/sample_wordle/${SAMPLE_WORDLE[0]}`);
          sampleData = await wordle.json();
          filename = 'sample_wordle_game.json';
          break;
        }
          
        case 'trivie':
          // For Trivie, we'll create a simple template since it's Excel-based
          sampleData = {
            "note": "This is a JSON template for reference. Trivie quizzes should be uploaded as Excel (.xlsx) files with columns: Question, Type, Answer, Choice1, Choice2, Choice3, Choice4, etc.",
            "example_structure": {
              "question": "What is the capital of France?",
              "type": "multiple_choice",
              "correct_answer": "Paris",
              "choices": ["London", "Paris", "Berlin", "Madrid"]
            }
          };
          filename = 'trivie_quiz_template.json';
          break;
          
        default:
          return;
      }
      
      // Create and download the file
      const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      playSound('click');
    } catch (error) {
      console.error('Failed to download sample JSON:', error);
      playSound('error');
    }
  }, [playSound]);

  // Activity Type Configurations
  const activityTypes: ActivityTypeConfig[] = [
    {
      id: 'nlj',
      name: 'NLJs',
      icon: <NLJIcon />,
      color: 'primary',
      uploadLabel: 'Upload NLJ',
      uploadDescription: 'Upload a .json file containing an NLJ scenario',
      uploadAccept: '.json',
      samplesLabel: 'Sample Scenarios',
      samplesDescription: 'Try one of the included NLJ demo scenarios',
      samples: SAMPLE_SCENARIOS,
      loadSampleFunction: loadSampleScenario,
    },
    {
      id: 'trivie',
      name: 'Trivie Quizzes',
      icon: <QuizIcon />,
      color: 'secondary',
      uploadLabel: 'Upload Trivie Quiz',
      uploadDescription: 'Upload an .xlsx file containing a Trivie quiz',
      uploadAccept: '.xlsx,.xls',
      samplesLabel: 'Sample Quizzes',
      samplesDescription: 'Try converted Trivie quiz formats',
      samples: SAMPLE_TRIVIE_QUIZZES,
      loadSampleFunction: loadSampleTrivieQuiz,
    },
    {
      id: 'survey',
      name: 'Surveys',
      icon: <SurveyIcon />,
      color: 'info',
      uploadLabel: 'Upload Survey',
      uploadDescription: 'Upload a .json file containing a survey',
      uploadAccept: '.json',
      samplesLabel: 'Sample Surveys',
      samplesDescription: 'Try automotive and cross-industry survey examples',
      samples: SAMPLE_SURVEYS,
      loadSampleFunction: loadSampleSurvey,
    },
    {
      id: 'connections',
      name: 'Connections',
      icon: <ConnectionsIcon />,
      color: 'secondary',
      uploadLabel: 'Upload Connections Game',
      uploadDescription: 'Upload a .json file containing a Connections word puzzle',
      uploadAccept: '.json',
      samplesLabel: 'Sample Connections',
      samplesDescription: 'Try sample Connections word puzzle games',
      samples: SAMPLE_CONNECTIONS,
      loadSampleFunction: loadSampleConnections,
    },
    {
      id: 'wordle',
      name: 'Wordle',
      icon: <WordleIcon />,
      color: 'info',
      uploadLabel: 'Upload Wordle Game',
      uploadDescription: 'Upload a .json file containing a Wordle word puzzle',
      uploadAccept: '.json',
      samplesLabel: 'Sample Wordle',
      samplesDescription: 'Try sample Wordle word puzzle games',
      samples: SAMPLE_WORDLE,
      loadSampleFunction: loadSampleWordle,
    },
    {
      id: 'llm_docs',
      name: 'LLM Docs',
      icon: <LLMIcon />,
      color: 'primary',
      uploadLabel: 'Generate LLM Prompt',
      uploadDescription: 'Create customized prompts for LLM content generation',
      uploadAccept: '',
      samplesLabel: 'Documentation Tools',
      samplesDescription: 'Generate prompts and documentation for LLM-based content creation',
      samples: [],
      loadSampleFunction: async () => {},
    },
  ];

  const currentActivityType = activityTypes.find(type => type.id === selectedActivityType)!;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: ActivityType) => {
    setSelectedActivityType(newValue);
  };

  const renderUploadCard = () => {
    if (selectedActivityType === 'llm_docs') {
      return (
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <LLMIcon sx={{ fontSize: 48, color: `${currentActivityType.color}.main`, mb: 2 }} />
              <Typography gutterBottom sx={{ fontWeight: 600 }}>
                {currentActivityType.uploadLabel}
              </Typography>
              <Typography color="text.secondary">
                {currentActivityType.uploadDescription}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<LLMIcon />}
                disabled={loading}
                fullWidth
                size="large"
                color={currentActivityType.color}
                onClick={() => setShowLLMPromptGenerator(true)}
              >
                Generate LLM Prompt
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Create customized prompts for content generation with OpenAI, Claude, Gemini, and other LLMs
              </Typography>
            </Box>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card sx={{ width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <UploadIcon sx={{ fontSize: 48, color: `${currentActivityType.color}.main`, mb: 2 }} />
            <Typography gutterBottom sx={{ fontWeight: 600 }}>
              {currentActivityType.uploadLabel}
            </Typography>
            <Typography color="text.secondary">
              {currentActivityType.uploadDescription}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              component="label"
              variant="contained"
              startIcon={<UploadIcon />}
              disabled={loading}
              fullWidth
              size="large"
              color={currentActivityType.color}
            >
              Choose File
              <input
                type="file"
                accept={currentActivityType.uploadAccept}
                onChange={handleFileUpload}
                hidden
              />
            </Button>
            
            {/* Add paste functionality for JSON-based activities */}
            {(selectedActivityType === 'nlj' || selectedActivityType === 'survey') && (
              <>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    or
                  </Typography>
                </Divider>
                
                <TextField
                  label="Paste JSON Content"
                  multiline
                  rows={4}
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder="Paste your NLJ scenario JSON here..."
                  disabled={loading}
                  fullWidth
                  variant="outlined"
                  sx={{
                    '& .MuiInputBase-root': {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                    },
                  }}
                />
                
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={handlePastedJson}
                    disabled={loading || !pastedJson.trim()}
                    fullWidth
                    size="large"
                    color={currentActivityType.color}
                  >
                    Play Journey
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FlowIcon />}
                    onClick={handlePastedJsonPreview}
                    disabled={loading || !pastedJson.trim()}
                    fullWidth
                    size="large"
                    color="secondary"
                  >
                    Preview Nodes
                  </Button>
                </Stack>
              </>
            )}
            
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => downloadSampleJSON(currentActivityType.id)}
              disabled={loading}
              fullWidth
              size="large"
              color={currentActivityType.color}
              sx={{ textTransform: 'none' }}
            >
              Download Sample JSON
            </Button>
            
            {/* Flow Editor button for loaded scenarios */}
            {loadedScenario && onFlowEdit && (
              <Button
                variant="outlined"
                startIcon={<FlowIcon />}
                onClick={() => onFlowEdit(loadedScenario)}
                disabled={loading}
                fullWidth
                size="large"
                color="secondary"
                sx={{ textTransform: 'none' }}
              >
                Edit Flow Diagram
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderSamplesCard = () => {
    if (selectedActivityType === 'llm_docs') {
      return (
        <Card sx={{ width: '100%', height: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <DownloadIcon sx={{ fontSize: 48, color: `${currentActivityType.color}.main`, mb: 2 }} />
              <Typography gutterBottom sx={{ fontWeight: 600 }}>
                {currentActivityType.samplesLabel}
              </Typography>
              <Typography color="text.secondary">
                {currentActivityType.samplesDescription}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                disabled={loading}
                fullWidth
                size="large"
                color={currentActivityType.color}
                onClick={() => {
                  const doc = generateSchemaDocumentation();
                  const blob = new Blob([doc], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `nlj-schema-documentation-${Date.now()}.md`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                Download Schema Documentation
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                disabled={loading}
                fullWidth
                size="large"
                color={currentActivityType.color}
                onClick={() => {
                  const doc = generateBloomsTaxonomyReference();
                  const blob = new Blob([doc], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `nlj-blooms-taxonomy-${Date.now()}.md`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                Download Bloom's Taxonomy Guide
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                disabled={loading}
                fullWidth
                size="large"
                color={currentActivityType.color}
                onClick={() => {
                  const doc = generateExampleScenarios();
                  const blob = new Blob([doc], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `nlj-example-scenarios-${Date.now()}.md`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                Download Example Scenarios
              </Button>
            </Box>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card sx={{ width: '100%', height: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <PlayIcon sx={{ fontSize: 48, color: `${currentActivityType.color}.main`, mb: 2 }} />
            <Typography gutterBottom sx={{ fontWeight: 600 }}>
              {currentActivityType.samplesLabel}
            </Typography>
            <Typography color="text.secondary">
              {currentActivityType.samplesDescription}
            </Typography>
          </Box>
        <Box sx={{ 
          display: 'grid', 
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        }}>
          {currentActivityType.samples.map((filename) => (
            <Card key={filename} variant="outlined" sx={{ p: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  mb: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedActivityType === 'nlj' ? 
                  filename.replace('.json', '').replace(/^nls\./, '') :
                selectedActivityType === 'trivie' ?
                  filename.replace('.xlsx', '').replace(/^quizzes_export_/, 'Quiz Export ') :
                  filename.replace('.json', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                }
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={() => currentActivityType.loadSampleFunction(filename)}
                  disabled={loading}
                  variant="contained"
                  color={currentActivityType.color}
                  startIcon={<PlayIcon />}
                  size="small"
                  fullWidth
                  sx={{ textTransform: 'none' }}
                >
                  Play
                </Button>
                {selectedActivityType === 'nlj' && onFlowEdit && (
                  <Button
                    onClick={() => loadSampleForPreview(filename)}
                    disabled={loading}
                    variant="outlined"
                    color="secondary"
                    startIcon={<FlowIcon />}
                    size="small"
                    fullWidth
                    sx={{ textTransform: 'none' }}
                  >
                    Preview
                  </Button>
                )}
              </Stack>
            </Card>
          ))}
        </Box>
        
        {/* Flow Editor button for loaded scenarios */}
        {loadedScenario && onFlowEdit && (
          <Box sx={{ mt: 3, borderTop: 1, borderColor: 'divider', pt: 3 }}>
            <Button
              variant="outlined"
              startIcon={<FlowIcon />}
              onClick={() => onFlowEdit(loadedScenario)}
              disabled={loading}
              fullWidth
              size="large"
              color="secondary"
              sx={{ textTransform: 'none' }}
            >
              Edit Flow Diagram
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
    );
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      width: '100%',
      backgroundColor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Fixed Header */}
      <Box sx={{ 
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
        py: 2,
        px: 4
      }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Typography gutterBottom sx={{ fontWeight: 700, mb: 0 }}>
                NLJ Viewer - Internal Testing Tool
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SoundToggle />
              <ThemeToggle />
            </Box>
          </Box>
          
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography color="text.secondary" sx={{ fontSize: '0.9rem', maxWidth: 600, mx: 'auto' }}>
              This tool, which is VERY MUCH in beta, allows the user to play NLJs. This functionality works okay. It also has a crude NLJ editor/previewer, but that's EXTREMELY janky.
              This is a proof of concept. Do not assume features here will be in production within the next 3 months.
                       </Typography>
          </Box>
          
          {/* Activity Type Tabs */}
          <Box sx={{ width: '100%' }}>
            <Tabs
              value={selectedActivityType}
              onChange={handleTabChange}
              variant="fullWidth"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                '& .MuiTabs-indicator': {
                  height: 3,
                },
                '& .MuiTabs-flexContainer': {
                  justifyContent: 'center',
                },
                '& .MuiTab-root': {
                  minWidth: { xs: 80, sm: 120 },
                  minHeight: { xs: 56, sm: 64 },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  px: { xs: 1, sm: 2 },
                },
              }}
            >
              {activityTypes.map((type) => (
                <Tab
                  key={type.id}
                  value={type.id}
                  label={
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: { xs: 0.5, sm: 1 },
                      flexDirection: { xs: 'column', sm: 'row' }
                    }}>
                      <Box sx={{ 
                        fontSize: { xs: '1rem', sm: '1.2rem' },
                        lineHeight: 1
                      }}>
                        {type.icon}
                      </Box>
                      <Typography sx={{ 
                        fontWeight: 600,
                        fontSize: { xs: '0.65rem', sm: '0.875rem' },
                        lineHeight: { xs: 1.2, sm: 1.5 },
                        textAlign: 'center'
                      }}>
                        {type.name}
                      </Typography>
                    </Box>
                  }
                  sx={{
                    textTransform: 'none',
                    color: 'text.secondary', // Inactive color
                    '&.Mui-selected': {
                      color: 'primary.main', // Active color uses main theme color
                    },
                    '&:hover': {
                      color: 'primary.light', // Hover color uses theme color
                      backgroundColor: 'action.hover',
                    },
                  }}
                />
              ))}
            </Tabs>
          </Box>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, py: 4 }}>
        <Container maxWidth="md">
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

          {/* Side-by-Side Content */}
          <Box sx={{ 
            display: 'flex', 
            gap: 3, 
            alignItems: 'stretch',
            flexDirection: { xs: 'column', md: 'row' }
          }}>
            {/* Upload Section */}
            <Box sx={{ flex: 1 }}>
              {renderUploadCard()}
            </Box>

            {/* Samples Section */}
            <Box sx={{ flex: 1 }}>
              {renderSamplesCard()}
            </Box>
          </Box>
        </Container>
      </Box>

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
      
      {/* LLM Prompt Generator Modal */}
      <LLMPromptGenerator
        open={showLLMPromptGenerator}
        onClose={() => setShowLLMPromptGenerator(false)}
      />
    </Box>
  );
};