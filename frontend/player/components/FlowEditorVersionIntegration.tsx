/**
 * Flow Editor Version Integration Example
 * Shows how to integrate version management into the Flow Editor
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert
} from '@mui/material';
import {
  History as HistoryIcon,
  Compare as CompareIcon,
  Save as SaveIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';
import { VersionManagerTab } from './VersionManagerTab';
import { useVersionManagement } from '../../hooks/useVersionManagement';
import type { ContentItem } from '../../api/content';

interface FlowEditorVersionIntegrationProps {
  contentItem: ContentItem;
  currentNljData: any;
  onNljDataChange: (data: any) => void;
  canManageVersions?: boolean;
}

export const FlowEditorVersionIntegration: React.FC<FlowEditorVersionIntegrationProps> = ({
  contentItem,
  currentNljData,
  onNljDataChange,
  canManageVersions = false
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [versionManagerOpen, setVersionManagerOpen] = useState(false);
  
  const {
    versions,
    loading,
    currentVersion,
    publishedVersion,
    createVersion,
    restoreVersion,
    getVersionStats
  } = useVersionManagement({
    contentItem,
    onVersionChange: (version) => {
      // When a version changes, update the editor with the new data
      if (version.nlj_data) {
        onNljDataChange(version.nlj_data);
      }
    }
  });

  const versionStats = getVersionStats();

  const handleVersionRestore = useCallback(async (version: any) => {
    // Update the editor with the restored version's data
    if (version.nlj_data) {
      onNljDataChange(version.nlj_data);
    }
    setVersionManagerOpen(false);
  }, [onNljDataChange]);

  const handleVersionSave = useCallback(async (changeSummary: string) => {
    // Create a new version with the current editor data
    await createVersion(
      currentNljData,
      contentItem.title,
      contentItem.description,
      changeSummary
    );
  }, [createVersion, currentNljData, contentItem.title, contentItem.description]);

  const hasUnsavedChanges = useCallback(() => {
    // Compare current editor data with latest version
    if (!currentVersion?.nlj_data) return true;
    
    // Simple JSON comparison (in production, use a proper deep comparison)
    return JSON.stringify(currentNljData) !== JSON.stringify(currentVersion.nlj_data);
  }, [currentNljData, currentVersion]);

  return (
    <>
      {/* Version Controls in Flow Editor Toolbar */}
      <Box display="flex" alignItems="center" gap={1}>
        {/* Version Status */}
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="caption" color="text.secondary">
            {currentVersion ? `v${currentVersion.version_number}` : 'No version'}
          </Typography>
          {hasUnsavedChanges() && (
            <Badge variant="dot" color="warning">
              <SaveIcon fontSize="small" color="action" />
            </Badge>
          )}
        </Box>

        {/* Quick Save Button (if changes exist) */}
        {canManageVersions && hasUnsavedChanges() && (
          <Tooltip title="Save current changes as new version">
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                const changeSummary = prompt('Describe your changes:');
                if (changeSummary) {
                  handleVersionSave(changeSummary);
                }
              }}
            >
              <SaveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Version History Button */}
        <Tooltip title={`Version history (${versionStats.total} versions)`}>
          <IconButton
            size="small"
            onClick={() => setVersionManagerOpen(true)}
            disabled={loading}
          >
            <Badge badgeContent={versionStats.total} color="primary" max={99}>
              <HistoryIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Compare Button (if multiple versions exist) */}
        {versions.length > 1 && (
          <Tooltip title="Compare versions">
            <IconButton
              size="small"
              onClick={() => setVersionManagerOpen(true)}
            >
              <CompareIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Version Manager Dialog/Sidebar */}
      <Dialog
        open={versionManagerOpen}
        onClose={() => setVersionManagerOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <VersionManagerTab
          contentItem={contentItem}
          currentNljData={currentNljData}
          onVersionRestore={handleVersionRestore}
          onVersionSave={handleVersionSave}
          canManageVersions={canManageVersions}
          onClose={() => setVersionManagerOpen(false)}
        />
      </Dialog>

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges() && (
        <Alert 
          severity="warning" 
          variant="outlined"
          sx={{ mt: 1 }}
          action={
            canManageVersions ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  const changeSummary = prompt('Describe your changes:');
                  if (changeSummary) {
                    handleVersionSave(changeSummary);
                  }
                }}
              >
                Save
              </Button>
            ) : null
          }
        >
          You have unsaved changes that haven't been saved as a version.
        </Alert>
      )}
    </>
  );
};

// Example of how to integrate into Flow Editor sidebar
export const FlowEditorSidebarWithVersions: React.FC<{
  contentItem: ContentItem;
  currentNljData: any;
  onNljDataChange: (data: any) => void;
  canManageVersions?: boolean;
}> = (props) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Bar */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
        >
          <Tab label="Editor" icon={<SaveIcon />} />
          <Tab 
            label="Versions" 
            icon={
              <Badge badgeContent="!" color="error" variant="dot" invisible={!activeTab}>
                <HistoryIcon />
              </Badge>
            } 
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            {/* Regular Flow Editor content */}
            <Typography>Flow Editor Controls Here</Typography>
            <FlowEditorVersionIntegration {...props} />
          </Box>
        )}
        
        {activeTab === 1 && (
          <VersionManagerTab
            contentItem={props.contentItem}
            currentNljData={props.currentNljData}
            onVersionRestore={(version) => {
              if (version.nlj_data) {
                props.onNljDataChange(version.nlj_data);
              }
            }}
            onVersionSave={async (changeSummary: string) => {
              // Implementation would depend on your specific Flow Editor setup
              console.log('Save version with summary:', changeSummary);
            }}
            canManageVersions={props.canManageVersions}
          />
        )}
      </Box>
    </Box>
  );
};