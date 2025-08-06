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
  History as HistoryIcon,
  Functions as FunctionsIcon,
} from '@mui/icons-material';

import { FlowViewer } from './components/flow/FlowViewer';
import { VersionManagementModal } from './components/VersionManagementModal';
import { VariableBrowserModal } from './components/VariableBrowserModal';
import type { NLJScenario } from '../types/nlj';
import type { ActivitySettings } from '../types/settings';
import type { ContentItem } from '../api/content';
import { useTheme } from '../contexts/ThemeContext';
import { useGameContext } from '../contexts/GameContext';
import { useVersionManagement } from '../hooks/useVersionManagement';

interface FlowEditorProps {
  scenario: NLJScenario;
  contentItem?: ContentItem; // Optional for version management
  onBack: () => void;
  onPlay?: (scenario: NLJScenario) => void;
  onSave?: (scenario: NLJScenario) => void;
  onExport?: (scenario: NLJScenario) => void;
  onVersionSave?: (changeSummary: string) => Promise<void>; // Version-aware save
  canManageVersions?: boolean;
}

export const FlowEditor: React.FC<FlowEditorProps> = ({
  scenario,
  contentItem,
  onBack,
  onPlay,
  onSave,
  onExport,
  onVersionSave,
  canManageVersions = false,
}) => {
  // Guard against null/undefined scenario
  if (!scenario) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: 'background.default'
      }}>
        <Typography variant="h6" color="text.secondary">
          No scenario data available
        </Typography>
      </Box>
    );
  }

  const [editedScenario, setEditedScenario] = useState<NLJScenario>(scenario);
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(120);
  const headerRef = useRef<HTMLDivElement>(null);
  const { themeMode } = useTheme();
  const { loadScenario } = useGameContext();

  // Version management (only if contentItem is provided)
  const versionManagement = contentItem ? useVersionManagement({
    contentItem,
    onVersionChange: (version) => {
      // When a version changes, update the editor with the new data
      if (version.nlj_data) {
        setEditedScenario(version.nlj_data);
        setIsDirty(false); // Reset dirty state after version restore
      }
    },
    autoLoadVersions: true
  }) : null;

  // Update scenario when prop changes (e.g., from template selection)
  useEffect(() => {
    setEditedScenario(scenario);
    setIsDirty(false);
  }, [scenario]);

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

  // Version-aware save with change summary
  const handleVersionSave = useCallback(async (changeSummary: string) => {
    if (onVersionSave) {
      await onVersionSave(changeSummary);
    } else if (versionManagement) {
      // Create version using the version management hook
      await versionManagement.createVersion(
        editedScenario,
        contentItem!.title,
        contentItem!.description || '',
        changeSummary
      );
    }
    
    setIsDirty(false);
    setShowSaveSuccess(true);
  }, [editedScenario, onVersionSave, versionManagement, contentItem]);

  // Check if there are unsaved changes compared to latest version
  const hasUnsavedChanges = useCallback(() => {
    if (!versionManagement?.currentVersion?.nlj_data) return isDirty;
    
    // Compare current editor data with latest version
    try {
      return JSON.stringify(editedScenario) !== JSON.stringify(versionManagement.currentVersion.nlj_data);
    } catch {
      return isDirty;
    }
  }, [editedScenario, isDirty, versionManagement?.currentVersion]);

  // Get version statistics for display
  const versionStats = versionManagement?.getVersionStats() || { total: 0, draft: 0, published: 0, archived: 0 };
  
  // Debug: Log the conditions for History button visibility
  console.log('FlowEditor History Button Debug:', {
    contentItem: !!contentItem,
    canManageVersions,
    versionManagement: !!versionManagement,
    versionStats
  });

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
      // For image formats, show user feedback that feature isn't available yet
      // TODO: Implement image export functionality using FlowViewer component
      alert(`${format.toUpperCase()} export is not yet available. Use JSON export for now.`);
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
  }, [editedScenario?.name]); // Re-run when scenario name changes

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
              {contentItem && versionManagement?.currentVersion ? (
                <Chip
                  label={`v${versionManagement.currentVersion.version_number}`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              ) : (
                <Chip
                  label="v1.0"
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
              {(isDirty || hasUnsavedChanges()) && (
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
            {/* Version Management Button */}
            {contentItem && canManageVersions ? (
              <Tooltip title={`Version History (${versionStats.total} versions)`}>
                <IconButton
                  onClick={() => setShowVersionManager(true)}
                  color={showVersionManager ? 'primary' : 'default'}
                  size="large"
                  sx={{
                    backgroundColor: showVersionManager ? 'primary.50' : 'transparent',
                    '&:hover': {
                      backgroundColor: showVersionManager ? 'primary.100' : 'action.hover',
                    },
                  }}
                >
                  <HistoryIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Version History (Not available for this scenario)">
                <span>
                  <IconButton
                    disabled
                    size="large"
                    sx={{ opacity: 0.5 }}
                  >
                    <HistoryIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            
            <Tooltip title="Activity Variables & Parameters">
              <IconButton
                onClick={() => setShowVariables(true)}
                color={showVariables ? 'primary' : 'default'}
                size="large"
                sx={{
                  backgroundColor: showVariables ? 'primary.50' : 'transparent',
                  '&:hover': {
                    backgroundColor: showVariables ? 'primary.100' : 'action.hover',
                  },
                }}
              >
                <FunctionsIcon />
              </IconButton>
            </Tooltip>
            
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
            <span>
              <IconButton
                onClick={handleRestore}
                disabled={!isDirty}
                size="small"
                color={isDirty ? 'default' : 'inherit'}
              >
                <RestoreIcon />
              </IconButton>
            </span>
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
          
          {/* Version-aware save (if version management is available) */}
          {contentItem && canManageVersions ? (
            <Tooltip title="Save New Version">
              <IconButton
                onClick={() => {
                  const changeSummary = prompt('Describe your changes:');
                  if (changeSummary) {
                    handleVersionSave(changeSummary);
                  }
                }}
                disabled={!hasUnsavedChanges()}
                size="small"
                color={hasUnsavedChanges() ? 'primary' : 'inherit'}
                sx={{
                  backgroundColor: hasUnsavedChanges() ? 'primary.main' : 'transparent',
                  color: hasUnsavedChanges() ? 'primary.contrastText' : 'text.disabled',
                  '&:hover': {
                    backgroundColor: hasUnsavedChanges() ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <SaveIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Save Changes">
              <span>
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
              </span>
            </Tooltip>
          )}
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
          Draft saved successfully!
        </Alert>
      </Snackbar>

      {/* Version Management Modal */}
      {contentItem && versionManagement && (
        <VersionManagementModal
          open={showVersionManager}
          onClose={() => setShowVersionManager(false)}
          contentItem={contentItem}
          currentNljData={editedScenario}
          versionManagement={versionManagement}
          onVersionSave={handleVersionSave}
          canManageVersions={canManageVersions}
        />
      )}

      {/* Variables Browser Modal */}
      <VariableBrowserModal
        open={showVariables}
        onClose={() => setShowVariables(false)}
        scenario={editedScenario}
        onScenarioChange={handleScenarioChange}
      />

    </Box>
  );
};