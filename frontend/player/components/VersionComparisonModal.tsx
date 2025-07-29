/**
 * Version Comparison Modal Component
 * Provides side-by-side comparison of two content versions
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Tabs,
  Tab,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Compare as CompareIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ContentVersion, getVersionStatusColor, getVersionStatusLabel } from '../../types/workflow';

interface VersionComparisonModalProps {
  open: boolean;
  onClose: () => void;
  version1: ContentVersion;
  version2: ContentVersion;
  onRestoreVersion?: (version: ContentVersion) => void;
  onViewVersion?: (version: ContentVersion) => void;
  canManageVersions?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
  </div>
);

export const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({
  open,
  onClose,
  version1,
  version2,
  onRestoreVersion,
  onViewVersion,
  canManageVersions = false
}) => {
  const [activeTab, setActiveTab] = useState(0);

  // Sort versions by number (newer first)
  const [newerVersion, olderVersion] = useMemo(() => {
    return version1.version_number > version2.version_number 
      ? [version1, version2] 
      : [version2, version1];
  }, [version1, version2]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getDifferences = () => {
    const differences = [];
    
    if (newerVersion.title !== olderVersion.title) {
      differences.push({
        field: 'Title',
        older: olderVersion.title,
        newer: newerVersion.title
      });
    }
    
    if (newerVersion.description !== olderVersion.description) {
      differences.push({
        field: 'Description',
        older: olderVersion.description || 'No description',
        newer: newerVersion.description || 'No description'
      });
    }
    
    if (newerVersion.version_status !== olderVersion.version_status) {
      differences.push({
        field: 'Status',
        older: getVersionStatusLabel(olderVersion.version_status),
        newer: getVersionStatusLabel(newerVersion.version_status)
      });
    }
    
    // Compare NLJ data structure (high-level)
    if (newerVersion.nlj_data && olderVersion.nlj_data) {
      const newerNodeCount = newerVersion.nlj_data.nodes?.length || 0;
      const olderNodeCount = olderVersion.nlj_data.nodes?.length || 0;
      
      if (newerNodeCount !== olderNodeCount) {
        differences.push({
          field: 'Node Count',
          older: `${olderNodeCount} nodes`,
          newer: `${newerNodeCount} nodes`
        });
      }
      
      const newerLinkCount = newerVersion.nlj_data.links?.length || 0;
      const olderLinkCount = olderVersion.nlj_data.links?.length || 0;
      
      if (newerLinkCount !== olderLinkCount) {
        differences.push({
          field: 'Link Count',
          older: `${olderLinkCount} links`,
          newer: `${newerLinkCount} links`
        });
      }
    }
    
    return differences;
  };

  const differences = getDifferences();

  const VersionCard: React.FC<{ version: ContentVersion; isNewer?: boolean }> = ({ 
    version, 
    isNewer = false 
  }) => (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardHeader
        avatar={
          <Chip
            label={`v${version.version_number}`}
            sx={{
              backgroundColor: getVersionStatusColor(version.version_status),
              color: 'white',
              fontWeight: 'bold'
            }}
          />
        }
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6">{version.title}</Typography>
            {isNewer && (
              <Chip label="Newer" size="small" color="primary" />
            )}
          </Box>
        }
        action={
          <Box display="flex" gap={0.5}>
            {onViewVersion && (
              <Tooltip title="View this version">
                <IconButton size="small" onClick={() => onViewVersion(version)}>
                  <ViewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canManageVersions && onRestoreVersion && (
              <Tooltip title="Restore this version">
                <IconButton size="small" onClick={() => onRestoreVersion(version)}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        }
      />
      <CardContent>
        <List dense>
          <ListItem>
            <ListItemText
              primary="Status"
              secondary={
                <Chip
                  label={getVersionStatusLabel(version.version_status)}
                  size="small"
                  sx={{
                    backgroundColor: getVersionStatusColor(version.version_status),
                    color: 'white'
                  }}
                />
              }
            />
          </ListItem>
          
          <ListItem>
            <ListItemText
              primary="Created"
              secondary={
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {format(new Date(version.created_at), 'MMM d, yyyy at h:mm a')}
                  </Typography>
                </Box>
              }
            />
          </ListItem>
          
          <ListItem>
            <ListItemText
              primary="Created By"
              secondary={
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    User {version.created_by.slice(-4)}
                  </Typography>
                </Box>
              }
            />
          </ListItem>
          
          {version.description && (
            <ListItem>
              <ListItemText
                primary="Description"
                secondary={version.description}
              />
            </ListItem>
          )}
          
          {version.change_summary && (
            <ListItem>
              <ListItemText
                primary="Changes"
                secondary={version.change_summary}
              />
            </ListItem>
          )}
          
          {version.nlj_data && (
            <>
              <ListItem>
                <ListItemText
                  primary="Nodes"
                  secondary={`${version.nlj_data.nodes?.length || 0} nodes`}
                />
              </ListItem>
              
              <ListItem>
                <ListItemText
                  primary="Links"
                  secondary={`${version.nlj_data.links?.length || 0} links`}
                />
              </ListItem>
            </>
          )}
        </List>
      </CardContent>
    </Card>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CompareIcon color="primary" />
            <Typography variant="h6">
              Version Comparison
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Side by Side" />
            <Tab label={`Differences (${differences.length})`} />
            <Tab label="Content Details" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <VersionCard version={olderVersion} />
            </Grid>
            <Grid item xs={6}>
              <VersionCard version={newerVersion} isNewer />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {differences.length === 0 ? (
            <Alert severity="info">
              No differences detected between these versions.
            </Alert>
          ) : (
            <List>
              {differences.map((diff, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemText
                      primary={diff.field}
                      secondary={
                        <Box>
                          <Paper variant="outlined" sx={{ p: 1, mb: 1, bgcolor: 'error.50' }}>
                            <Typography variant="caption" color="error.main" fontWeight="bold">
                              Version {olderVersion.version_number}:
                            </Typography>
                            <Typography variant="body2">
                              {diff.older}
                            </Typography>
                          </Paper>
                          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'success.50' }}>
                            <Typography variant="caption" color="success.main" fontWeight="bold">
                              Version {newerVersion.version_number}:
                            </Typography>
                            <Typography variant="body2">
                              {diff.newer}
                            </Typography>
                          </Paper>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < differences.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>
                Version {olderVersion.version_number} Content
              </Typography>
              {olderVersion.nlj_data ? (
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                  <pre style={{ fontSize: '0.8rem', margin: 0 }}>
                    {JSON.stringify(olderVersion.nlj_data, null, 2)}
                  </pre>
                </Paper>
              ) : (
                <Alert severity="warning">No content data available</Alert>
              )}
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom>
                Version {newerVersion.version_number} Content
              </Typography>
              {newerVersion.nlj_data ? (
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                  <pre style={{ fontSize: '0.8rem', margin: 0 }}>
                    {JSON.stringify(newerVersion.nlj_data, null, 2)}
                  </pre>
                </Paper>
              ) : (
                <Alert severity="warning">No content data available</Alert>
              )}
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        {canManageVersions && onRestoreVersion && (
          <>
            <Button
              startIcon={<CopyIcon />}
              onClick={() => onRestoreVersion(olderVersion)}
            >
              Restore v{olderVersion.version_number}
            </Button>
            <Button
              variant="contained"
              startIcon={<CopyIcon />}
              onClick={() => onRestoreVersion(newerVersion)}
            >
              Restore v{newerVersion.version_number}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};