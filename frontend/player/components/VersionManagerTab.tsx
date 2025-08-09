/**
 * Version Manager Tab Component
 * Integrates version management functionality into the Flow Editor sidebar
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  History as HistoryIcon,
  Compare as CompareIcon,
  Restore as RestoreIcon,
  Visibility as ViewIcon,
  Save as SaveIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { VersionHistoryViewer } from './VersionHistoryViewer';
import { VersionComparisonModal } from './VersionComparisonModal';
import { workflowApi } from '../../client/workflow';
import { ContentVersion } from '../../types/workflow';
import type { ContentItem } from '../../client/content';

interface VersionManagerTabProps {
  contentItem: ContentItem;
  currentNljData: any;
  onVersionRestore: (version: ContentVersion) => void;
  onVersionSave?: (changeSummary: string) => Promise<void>;
  canManageVersions?: boolean;
  onClose?: () => void;
}

export const VersionManagerTab: React.FC<VersionManagerTabProps> = ({
  contentItem,
  currentNljData,
  onVersionRestore,
  onVersionSave,
  canManageVersions = false,
  onClose
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[ContentVersion, ContentVersion] | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [saving, setSaving] = useState(false);

  // Load versions on mount
  useEffect(() => {
    loadVersions();
  }, [contentItem.id]);

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const versionList = await workflowApi.getContentVersions(contentItem.id);
      setVersions(versionList);
    } catch (error) {
      console.error('Failed to load versions:', error);
      enqueueSnackbar('Failed to load version history', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [contentItem.id, enqueueSnackbar]);

  const handleCompareVersions = useCallback((version1: ContentVersion, version2: ContentVersion) => {
    setCompareVersions([version1, version2]);
    setComparisonOpen(true);
  }, []);

  const handleViewVersion = useCallback(async (version: ContentVersion) => {
    try {
      // Load full version data if needed
      const fullVersion = await workflowApi.getVersion(version.id);
      if (fullVersion.nlj_data) {
        // Show version in a preview mode or restore it
        const confirmed = window.confirm(
          `Do you want to load version ${version.version_number} for viewing? This will replace your current editor content temporarily.`
        );
        if (confirmed) {
          onVersionRestore(fullVersion);
        }
      }
    } catch (error) {
      console.error('Failed to view version:', error);
      enqueueSnackbar('Failed to load version', { variant: 'error' });
    }
  }, [onVersionRestore, enqueueSnackbar]);

  const handleRestoreVersion = useCallback(async (version: ContentVersion) => {
    try {
      const confirmed = window.confirm(
        `Are you sure you want to restore to version ${version.version_number}? This will create a new version based on the selected version's content.`
      );
      
      if (!confirmed) return;

      // Restore the version (creates a new version)
      const restoredVersion = await workflowApi.restoreVersion(
        contentItem.id,
        version.id,
        `Restored from version ${version.version_number}`
      );

      // Update the UI with the restored version
      onVersionRestore(restoredVersion);
      
      // Reload versions to show the new restored version
      await loadVersions();
      
      enqueueSnackbar(`Successfully restored to version ${version.version_number}`, { 
        variant: 'success' 
      });
    } catch (error) {
      console.error('Failed to restore version:', error);
      enqueueSnackbar('Failed to restore version', { variant: 'error' });
    }
  }, [contentItem.id, onVersionRestore, loadVersions, enqueueSnackbar]);

  const handleSaveNewVersion = useCallback(() => {
    setSaveDialogOpen(true);
    setChangeSummary('');
  }, []);

  const handleSaveConfirm = useCallback(async () => {
    if (!onVersionSave || !changeSummary.trim()) {
      enqueueSnackbar('Please provide a change summary', { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);
      await onVersionSave(changeSummary.trim());
      await loadVersions();
      setSaveDialogOpen(false);
      setChangeSummary('');
      enqueueSnackbar('New version saved successfully', { variant: 'success' });
    } catch (error) {
      console.error('Failed to save version:', error);
      enqueueSnackbar('Failed to save new version', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [onVersionSave, changeSummary, loadVersions, enqueueSnackbar]);

  const currentVersion = versions.find(v => v.content_id === contentItem.id);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">Version Management</Typography>
          </Box>
          {onClose && (
            <IconButton size="small" onClick={onClose}>
              <Tooltip title="Close">
                <div>×</div>
              </Tooltip>
            </IconButton>
          )}
        </Box>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Manage versions and track changes to your content
        </Typography>

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {canManageVersions && onVersionSave && (
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSaveNewVersion}
              disabled={loading}
            >
              Save Version
            </Button>
          )}
          
          <Button
            variant="outlined"
            size="small"
            startIcon={<HistoryIcon />}
            onClick={loadVersions}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 3 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading versions...
            </Typography>
          </Box>
        ) : versions.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">
              No version history available. Save your first version to begin tracking changes.
            </Alert>
          </Box>
        ) : (
          <Box sx={{ p: 1 }}>
            <VersionHistoryViewer
              contentId={contentItem.id}
              versions={versions}
              currentVersionId={currentVersion?.id}
              onCompareVersions={handleCompareVersions}
              onRestoreVersion={handleRestoreVersion}
              onViewVersion={handleViewVersion}
              canManageVersions={canManageVersions}
              loading={loading}
            />
          </Box>
        )}
      </Box>

      {/* Current Status */}
      {currentVersion && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary">
            Current Version: v{currentVersion.version_number}
          </Typography>
          {currentVersion.change_summary && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {currentVersion.change_summary}
            </Typography>
          )}
        </Box>
      )}

      {/* Version Comparison Modal */}
      {comparisonOpen && compareVersions && (
        <VersionComparisonModal
          open={comparisonOpen}
          onClose={() => {
            setComparisonOpen(false);
            setCompareVersions(null);
          }}
          version1={compareVersions[0]}
          version2={compareVersions[1]}
          onRestoreVersion={handleRestoreVersion}
          onViewVersion={handleViewVersion}
          canManageVersions={canManageVersions}
        />
      )}

      {/* Save New Version Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SaveIcon color="primary" />
            Save New Version
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Create a new version of this content with your current changes.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Change Summary"
            placeholder="Describe what changes you made in this version..."
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            helperText="A brief description of the changes will help you and others understand this version."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveConfirm}
            variant="contained"
            disabled={saving || !changeSummary.trim()}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : 'Save Version'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};