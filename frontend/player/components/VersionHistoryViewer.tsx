/**
 * Version History Viewer Component
 * Displays the version history for a content item with comparison and rollback capabilities
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Avatar,
  Stack,
  Alert
} from '@mui/material';
import {
  History as HistoryIcon,
  Visibility as ViewIcon,
  Compare as CompareIcon,
  Restore as RestoreIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ContentVersion, VersionStatus, getVersionStatusColor, getVersionStatusLabel } from '../../types/workflow';

interface VersionHistoryViewerProps {
  contentId: string;
  versions: ContentVersion[];
  currentVersionId?: string;
  onCompareVersions?: (version1: ContentVersion, version2: ContentVersion) => void;
  onRestoreVersion?: (version: ContentVersion) => void;
  onViewVersion?: (version: ContentVersion) => void;
  canManageVersions?: boolean;
  loading?: boolean;
}

export const VersionHistoryViewer: React.FC<VersionHistoryViewerProps> = ({
  contentId,
  versions,
  currentVersionId,
  onCompareVersions,
  onRestoreVersion,
  onViewVersion,
  canManageVersions = false,
  loading = false
}) => {
  const [selectedVersions, setSelectedVersions] = useState<ContentVersion[]>([]);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<ContentVersion | null>(null);

  const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);
  const currentVersion = versions.find(v => v.id === currentVersionId);
  const publishedVersion = versions.find(v => v.version_status === VersionStatus.PUBLISHED);

  const handleVersionSelect = useCallback((version: ContentVersion) => {
    setSelectedVersions(prev => {
      const isSelected = prev.some(v => v.id === version.id);
      if (isSelected) {
        return prev.filter(v => v.id !== version.id);
      } else if (prev.length < 2) {
        return [...prev, version];
      } else {
        // Replace the oldest selection
        return [prev[1], version];
      }
    });
  }, []);

  const handleCompareVersions = useCallback(() => {
    if (selectedVersions.length === 2 && onCompareVersions) {
      onCompareVersions(selectedVersions[0], selectedVersions[1]);
    }
  }, [selectedVersions, onCompareVersions]);

  const handleRestoreClick = useCallback((version: ContentVersion) => {
    setVersionToRestore(version);
    setRestoreDialogOpen(true);
  }, []);

  const handleRestoreConfirm = useCallback(() => {
    if (versionToRestore && onRestoreVersion) {
      onRestoreVersion(versionToRestore);
      setRestoreDialogOpen(false);
      setVersionToRestore(null);
    }
  }, [versionToRestore, onRestoreVersion]);

  const handleRestoreCancel = useCallback(() => {
    setRestoreDialogOpen(false);
    setVersionToRestore(null);
  }, []);

  const isVersionSelected = useCallback((version: ContentVersion) => {
    return selectedVersions.some(v => v.id === version.id);
  }, [selectedVersions]);

  const getVersionBadges = (version: ContentVersion) => {
    const badges = [];
    
    if (version.id === currentVersionId) {
      badges.push(
        <Chip
          key="current"
          label="Current"
          size="small"
          color="primary"
          variant="filled"
        />
      );
    }
    
    if (version.version_status === VersionStatus.PUBLISHED) {
      badges.push(
        <Chip
          key="published"
          label="Published"
          size="small"
          sx={{
            backgroundColor: getVersionStatusColor(version.version_status),
            color: 'white'
          }}
        />
      );
    }
    
    return badges;
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading version history...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <HistoryIcon color="action" />
            <Typography variant="h6">Version History</Typography>
          </Box>
          <Alert severity="info">
            No version history available for this content.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <HistoryIcon color="action" />
              <Typography variant="h6">Version History</Typography>
              <Chip 
                label={`${versions.length} versions`} 
                size="small" 
                variant="outlined" 
              />
            </Box>
            
            {selectedVersions.length === 2 && onCompareVersions && (
              <Button
                variant="contained"
                size="small"
                startIcon={<CompareIcon />}
                onClick={handleCompareVersions}
              >
                Compare Selected
              </Button>
            )}
          </Box>

          {selectedVersions.length > 0 && (
            <Alert 
              severity="info" 
              sx={{ mb: 2 }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={() => setSelectedVersions([])}
                >
                  Clear
                </Button>
              }
            >
              {selectedVersions.length === 1 
                ? `1 version selected. Select another to compare.`
                : `2 versions selected for comparison.`
              }
            </Alert>
          )}

          <List>
            {sortedVersions.map((version, index) => (
              <React.Fragment key={version.id}>
                <ListItem
                  sx={{
                    border: isVersionSelected(version) ? 2 : 1,
                    borderColor: isVersionSelected(version) ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    cursor: onCompareVersions ? 'pointer' : 'default',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                  onClick={() => onCompareVersions && handleVersionSelect(version)}
                >
                  <Avatar
                    sx={{
                      bgcolor: getVersionStatusColor(version.version_status),
                      mr: 2,
                      width: 32,
                      height: 32
                    }}
                  >
                    <Typography variant="caption" fontWeight="bold">
                      v{version.version_number}
                    </Typography>
                  </Avatar>
                  
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="subtitle2" fontWeight="600">
                          {version.title}
                        </Typography>
                        {getVersionBadges(version).map(badge => badge)}
                      </Box>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        {version.change_summary && (
                          <Typography variant="body2" color="text.secondary">
                            {version.change_summary}
                          </Typography>
                        )}
                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <PersonIcon fontSize="small" color="action" />
                            <Typography variant="caption">
                              Created by User {version.created_by.slice(-4)}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <TimeIcon fontSize="small" color="action" />
                            <Typography variant="caption">
                              {format(new Date(version.created_at), 'MMM d, yyyy at h:mm a')}
                            </Typography>
                          </Box>
                          <Chip
                            label={getVersionStatusLabel(version.version_status)}
                            size="small"
                            sx={{
                              backgroundColor: getVersionStatusColor(version.version_status),
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      </Stack>
                    }
                  />
                  
                  <ListItemSecondaryAction>
                    <Box display="flex" gap={0.5}>
                      {onViewVersion && (
                        <Tooltip title="View this version">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewVersion(version);
                            }}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      {canManageVersions && onRestoreVersion && 
                       version.version_status !== VersionStatus.PUBLISHED && (
                        <Tooltip title="Restore this version">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreClick(version);
                            }}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                
                {index < sortedVersions.length - 1 && <Divider sx={{ my: 1 }} />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={restoreDialogOpen}
        onClose={handleRestoreCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <RestoreIcon color="warning" />
            Restore Version
          </Box>
        </DialogTitle>
        <DialogContent>
          {versionToRestore && (
            <>
              <Typography paragraph>
                Are you sure you want to restore to version {versionToRestore.version_number}?
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This will create a new version based on the selected version's content. 
                The current version will remain in history.
              </Alert>
              <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Version Details:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Title:</strong> {versionToRestore.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Version:</strong> {versionToRestore.version_number}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Created:</strong> {format(new Date(versionToRestore.created_at), 'MMM d, yyyy at h:mm a')}
                </Typography>
                {versionToRestore.change_summary && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Changes:</strong> {versionToRestore.change_summary}
                  </Typography>
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRestoreCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleRestoreConfirm} 
            variant="contained" 
            color="warning"
            startIcon={<RestoreIcon />}
          >
            Restore Version
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};