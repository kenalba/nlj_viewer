/**
 * Flow Editor component that wraps FlowViewer with additional editing capabilities
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Chip,
  Alert,
  Snackbar,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Restore as RestoreIcon,
  Info as InfoIcon,
  AutoFixHigh as AutoLayoutIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import { FlowViewer } from '../flow';
import type { NLJScenario } from '../types/nlj';
import type { ActivitySettings } from '../types/settings';
import { useTheme } from '../contexts/ThemeContext';
import { useGameContext } from '../contexts/GameContext';

interface FlowEditorProps {
  scenario: NLJScenario;
  onBack: () => void;
  onPlay?: (scenario: NLJScenario) => void;
  onSave?: (scenario: NLJScenario) => void;
  onExport?: (scenario: NLJScenario) => void;
}

export const FlowEditor: React.FC<FlowEditorProps> = ({
  scenario,
  onBack,
  onPlay,
  onSave,
  onExport,
}) => {
  const [editedScenario, setEditedScenario] = useState<NLJScenario>(scenario);
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(120);
  const headerRef = useRef<HTMLDivElement>(null);
  const { themeMode } = useTheme();
  const { loadScenario } = useGameContext();

  const handleScenarioChange = useCallback((updatedScenario: NLJScenario) => {
    setEditedScenario(updatedScenario);
    setIsDirty(true);
  }, []);

  const handleActivitySettingsChange = useCallback((settings: ActivitySettings) => {
    const updatedScenario = {
      ...editedScenario,
      settings,
    };
    setEditedScenario(updatedScenario);
    setIsDirty(true);
  }, [editedScenario]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(editedScenario);
    }
    
    // Save to localStorage for consistency with current app flow
    localStorage.setItem(`scenario_${editedScenario.id}`, JSON.stringify(editedScenario));
    
    setIsDirty(false);
    setShowSaveSuccess(true);
  }, [editedScenario, onSave]);

  const handleExport = useCallback((format: 'png' | 'svg' | 'json', data?: any) => {
    if (format === 'json') {
      const exportData = data || editedScenario;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${editedScenario.name || 'nlj_scenario'}_edited.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // For image formats, this would be handled by the FlowViewer component
      console.log('Image export not implemented yet');
    }
    
    if (onExport) {
      onExport(editedScenario);
    }
  }, [editedScenario, onExport]);

  const handlePlayScenario = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Save before playing?');
      if (confirmed) {
        handleSave();
      }
    }
    
    if (onPlay) {
      onPlay(editedScenario);
    } else {
      // Load the scenario for immediate play
      loadScenario(editedScenario);
    }
  }, [editedScenario, isDirty, handleSave, onPlay, loadScenario]);

  const handleRestore = useCallback(() => {
    const confirmed = window.confirm('Are you sure you want to restore the original scenario? All changes will be lost.');
    if (confirmed) {
      setEditedScenario(scenario);
      setIsDirty(false);
    }
  }, [scenario]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to go back?');
      if (!confirmed) return;
    }
    onBack();
  }, [isDirty, onBack]);

  // Update header height when component mounts or resizes
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    
    updateHeaderHeight();
    
    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [editedScenario.name]); // Re-run when scenario name changes

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper 
        ref={headerRef}
        elevation={2} 
        sx={{ 
          p: 2,
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          zIndex: 1100,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={handleBack} color="primary">
            <BackIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1">
              Flow Editor: {editedScenario.name || 'Untitled Scenario'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<InfoIcon />}
                label={`${editedScenario.nodes.length} nodes`}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<InfoIcon />}
                label={`${editedScenario.links.length} connections`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={editedScenario.activityType ? editedScenario.activityType.charAt(0).toUpperCase() + editedScenario.activityType.slice(1) : 'Scenario'}
                size="small"
                color="primary"
                variant="outlined"
              />
              {isDirty && (
                <Chip
                  label="Unsaved Changes"
                  size="small"
                  color="warning"
                  variant="filled"
                />
              )}
            </Stack>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Activity & Flow Settings">
              <IconButton
                onClick={() => setShowSettings(true)}
                color={showSettings ? 'primary' : 'default'}
                size="large"
                sx={{
                  backgroundColor: showSettings ? 'primary.50' : 'transparent',
                  '&:hover': {
                    backgroundColor: showSettings ? 'primary.100' : 'action.hover',
                  },
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Flow Editor */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <FlowViewer
          scenario={editedScenario}
          onScenarioChange={handleScenarioChange}
          onActivitySettingsChange={handleActivitySettingsChange}
          onSave={handleSave}
          onExport={handleExport}
          theme={themeMode}
          headerHeight={headerHeight}
          readOnly={false}
          showMiniMap={false}
          showControls={true}
          showBackground={true}
          className="flow-editor"
          onAutoLayout={() => {
            // This callback enables the global window function
            console.log('Auto layout applied');
          }}
          onShowSettings={() => setShowSettings(true)}
          showSettings={showSettings}
          onCloseSettings={() => setShowSettings(false)}
        />
      </Box>

      {/* Floating Bottom Toolbar */}
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1300,
          borderRadius: 6,
          px: 2,
          py: 1.5,
          backgroundColor: 'background.paper',
          backdropFilter: 'blur(10px)',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Restore Original">
            <IconButton
              onClick={handleRestore}
              disabled={!isDirty}
              size="small"
              color={isDirty ? 'default' : 'inherit'}
            >
              <RestoreIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Auto Layout">
            <IconButton
              onClick={() => {
                // Trigger auto-layout via the global function
                if ((window as any).flowAutoLayout) {
                  (window as any).flowAutoLayout();
                }
              }}
              size="small"
            >
              <AutoLayoutIcon />
            </IconButton>
          </Tooltip>
          
          
          <Tooltip title="Export JSON">
            <IconButton
              onClick={() => handleExport('json')}
              size="small"
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Tooltip title="Play Scenario">
            <IconButton
              onClick={handlePlayScenario}
              size="small"
              color="success"
            >
              <PlayIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Save Changes">
            <IconButton
              onClick={handleSave}
              disabled={!isDirty}
              size="small"
              color={isDirty ? 'primary' : 'inherit'}
              sx={{
                backgroundColor: isDirty ? 'primary.main' : 'transparent',
                color: isDirty ? 'primary.contrastText' : 'text.disabled',
                '&:hover': {
                  backgroundColor: isDirty ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <SaveIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Save Success Snackbar */}
      <Snackbar
        open={showSaveSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setShowSaveSuccess(false)} 
          severity="success" 
          variant="filled"
          sx={{ width: '100%' }}
        >
          Scenario saved successfully!
        </Alert>
      </Snackbar>

    </Box>
  );
};