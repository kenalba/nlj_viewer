/**
 * Version Management Modal for Flow Editor
 * Provides version history, comparison, and restoration functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  Stack,
  Chip,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Menu,
  MenuItem,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Close as CloseIcon,
  History as HistoryIcon,
  Restore as RestoreIcon,
  Visibility as ViewIcon,
  Compare as CompareIcon,
  Save as SaveIcon,
  Schedule as DraftIcon,
  CheckCircle as PublishedIcon,
  Archive as ArchivedIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { ContentItem } from '../../api/content';
import type { ContentVersion } from '../../types/workflow';

interface VersionManagementModalProps {
  open: boolean;
  onClose: () => void;
  contentItem: ContentItem;
  currentNljData: any;
  versionManagement: any; // Return type of useVersionManagement hook
  onVersionSave?: (changeSummary: string) => Promise<void>;
  canManageVersions?: boolean;
}

export const VersionManagementModal: React.FC<VersionManagementModalProps> = ({
  open,
  onClose,
  contentItem,
  currentNljData,
  versionManagement,
  onVersionSave,
  canManageVersions = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuVersionId, setMenuVersionId] = useState<string | null>(null);

  const versions = versionManagement?.versions || [];
  const currentVersion = versionManagement?.currentVersion;
  const versionStats = versionManagement?.getVersionStats() || { total: 0, draft: 0, published: 0, archived: 0 };

  // Handle version restoration
  const handleRestoreVersion = useCallback(async (version: ContentVersion) => {
    if (!versionManagement?.restoreVersion) return;
    
    setLoading(true);
    try {
      await versionManagement.restoreVersion(version.id);
      enqueueSnackbar(`Restored to version ${version.version_number}`, { variant: 'success' });
      onClose();
    } catch (error) {
      console.error('Failed to restore version:', error);
      enqueueSnackbar('Failed to restore version', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [versionManagement, enqueueSnackbar, onClose]);

  // Handle saving new version
  const handleSaveVersion = useCallback(async () => {
    if (!onVersionSave || !changeSummary.trim()) return;
    
    setLoading(true);
    try {
      await onVersionSave(changeSummary);
      enqueueSnackbar('New version saved successfully', { variant: 'success' });
      setShowSaveDialog(false);
      setChangeSummary('');
    } catch (error) {
      console.error('Failed to save version:', error);
      enqueueSnackbar('Failed to save version', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [onVersionSave, changeSummary, enqueueSnackbar]);

  // Get version status icon and color
  const getVersionStatusInfo = (version: ContentVersion) => {
    switch (version.version_status) {
      case 'published':
        return { icon: <PublishedIcon />, color: 'success', label: 'Published' };
      case 'archived':
        return { icon: <ArchivedIcon />, color: 'default', label: 'Archived' };
      default:
        return { icon: <DraftIcon />, color: 'warning', label: 'Draft' };
    }
  };

  // Handle version menu
  const handleVersionMenuOpen = (event: React.MouseEvent<HTMLElement>, versionId: string) => {
    setAnchorEl(event.currentTarget);
    setMenuVersionId(versionId);
  };

  const handleVersionMenuClose = () => {
    setAnchorEl(null);
    setMenuVersionId(null);
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!currentVersion?.nlj_data) return true;
    
    try {
      return JSON.stringify(currentNljData) !== JSON.stringify(currentVersion.nlj_data);
    } catch {
      return true;
    }
  }, [currentNljData, currentVersion]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '70vh', maxHeight: '90vh' }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">Version Management</Typography>
            <Chip
              label={`${versionStats.total} versions`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Current Status */}
          <Box p={2} bgcolor="background.default">
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Current Activity: {contentItem.title}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              {currentVersion && (
                <Chip
                  icon={getVersionStatusInfo(currentVersion).icon}
                  label={`Version ${currentVersion.version_number} - ${getVersionStatusInfo(currentVersion).label}`}
                  color={getVersionStatusInfo(currentVersion).color as any}
                  variant="filled"
                />
              )}
              {hasUnsavedChanges() && (
                <Chip
                  label="Unsaved Changes"
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Action Buttons */}
          {canManageVersions && (
            <Box p={2} bgcolor="background.paper">
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => setShowSaveDialog(true)}
                  disabled={!hasUnsavedChanges() || loading}
                >
                  Save New Version
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CompareIcon />}
                  disabled={selectedVersions.length !== 2}
                >
                  Compare Versions
                </Button>
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Version List */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            )}
            
            {!loading && versions.length === 0 && (
              <Box p={4} textAlign="center">
                <Typography color="text.secondary">
                  No versions found for this activity.
                </Typography>
              </Box>
            )}

            {!loading && versions.length > 0 && (
              <List dense>
                {versions.map((version: ContentVersion) => {
                  const statusInfo = getVersionStatusInfo(version);
                  const isCurrentVersion = currentVersion?.id === version.id;
                  
                  return (
                    <ListItem
                      key={version.id}
                      divider
                      sx={{
                        bgcolor: isCurrentVersion ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <ListItemIcon>
                        {statusInfo.icon}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2">
                              Version {version.version_number}
                            </Typography>
                            {isCurrentVersion && (
                              <Chip label="Current" size="small" color="primary" variant="outlined" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="span">
                            <Typography variant="caption" color="text.secondary" component="span" display="block">
                              {version.change_summary || 'No description provided'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" component="span" display="block">
                              Created: {new Date(version.created_at).toLocaleString()}
                            </Typography>
                          </Box>
                        }
                      />
                      
                      <ListItemSecondaryAction>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="View Version">
                            <IconButton size="small" color="primary">
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {!isCurrentVersion && canManageVersions && (
                            <Tooltip title="Restore Version">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleRestoreVersion(version)}
                                disabled={loading}
                              >
                                <RestoreIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <IconButton
                            size="small"
                            onClick={(e) => handleVersionMenuOpen(e, version.id)}
                          >
                            <MoreIcon />
                          </IconButton>
                        </Stack>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Save Version Dialog */}
      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save New Version</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Describe your changes"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changes did you make to this activity?"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveVersion}
            variant="contained"
            disabled={!changeSummary.trim() || loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Save Version'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleVersionMenuClose}
      >
        <MenuItem onClick={handleVersionMenuClose}>
          <ViewIcon sx={{ mr: 1 }} /> View Details
        </MenuItem>
        <MenuItem onClick={handleVersionMenuClose}>
          <CompareIcon sx={{ mr: 1 }} /> Compare
        </MenuItem>
        {canManageVersions && (
          <MenuItem onClick={handleVersionMenuClose}>
            <ArchivedIcon sx={{ mr: 1 }} /> Archive
          </MenuItem>
        )}
      </Menu>
    </>
  );
};