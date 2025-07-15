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
import { useGameContext } from '../contexts/GameContext';

// Sample scenarios for demo
const SAMPLE_SCENARIOS = [
  'nls.FSA_102_1_40.json',
  'nls.FSA_102_2_10.json',
  'nls.FSA_102_3_20.json',
  'nls.FSA_102_4_30.json',
  'nls.Ioniq9_TestDrive_ProductKnowledge.json',
  'nls.Spend Now Save Later - Priscilla .json',
];

export const ScenarioLoader: React.FC = () => {
  const { loadScenario } = useGameContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScenarioFromFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    
    try {
      const text = await file.text();
      const scenario: NLJScenario = JSON.parse(text);
      
      // Validate scenario
      const validationErrors = validateScenario(scenario);
      if (validationErrors.length > 0) {
        setError(`Validation errors: ${validationErrors.join(', ')}`);
        return;
      }
      
      // Store scenario data in localStorage
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      loadScenario(scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
    } finally {
      setLoading(false);
    }
  }, [loadScenario]);

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
        setError(`Validation errors: ${validationErrors.join(', ')}`);
        return;
      }
      
      // Store scenario data in localStorage
      localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
      loadScenario(scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample scenario');
    } finally {
      setLoading(false);
    }
  }, [loadScenario]);

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
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h2" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
            Hyundai Training
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
            Interactive Learning Experience
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
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

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Upload Section */}
          <Card sx={{ flex: 1, height: 'fit-content' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                  Upload Scenario
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Upload a .json file containing an NLJ scenario
                </Typography>
              </Box>
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadIcon />}
                disabled={loading}
                fullWidth
                size="large"
              >
                Choose File
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
                <PlayIcon sx={{ fontSize: 48, color: 'hyundai.accent', mb: 2 }} />
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                  Sample Scenarios
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Try one of the included demo scenarios
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
                      <PlayIcon sx={{ mr: 2, fontSize: 20, color: 'hyundai.accent' }} />
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
      </Container>
    </Box>
  );
};