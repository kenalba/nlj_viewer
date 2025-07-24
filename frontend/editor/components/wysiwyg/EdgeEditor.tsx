/**
 * Edge Editor - Component for editing flow edges/connections in the sidebar
 * Follows the same pattern as the WYSIWYG Node Editor
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  Alert,
  Stack,
  Divider,
  Button,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Link as LinkIcon,
  AccountTree as ParentChildIcon,
  TrendingUp as ProbabilityIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

import type { FlowEdge, FlowNode } from '../../flow/types/flow';

interface EdgeEditorProps {
  edge: FlowEdge | null;
  allNodes: FlowNode[];
  onSave: (edgeId: string, updates: Partial<FlowEdge>) => void;
  onDelete?: (edgeId: string) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

export function EdgeEditor({
  edge,
  allNodes,
  onSave,
  onDelete,
  theme: _theme = 'unfiltered',
  onUnsavedChanges,
}: EdgeEditorProps) {
  const [probability, setProbability] = useState<number>(1.0);
  const [linkType, setLinkType] = useState<'link' | 'parent-child'>('link');
  const [linkId, setLinkId] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);

  // Get source and target node information
  const sourceNode = allNodes.find(n => n.id === edge?.source);
  const targetNode = allNodes.find(n => n.id === edge?.target);

  // Initialize form values when edge changes
  useEffect(() => {
    if (edge) {
      setProbability(edge.data?.probability || 1.0);
      setLinkType(edge.data?.nljLink?.type || 'link');
      setLinkId(edge.data?.nljLink?.id || edge.id);
      setHasChanges(false);
    }
  }, [edge]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(hasChanges);
  }, [hasChanges, onUnsavedChanges]);

  // Handle probability change
  const handleProbabilityChange = useCallback((_event: Event, newValue: number | number[]) => {
    const value = typeof newValue === 'number' ? newValue : newValue[0];
    setProbability(value);
    setHasChanges(true);
  }, []);

  // Handle link type change
  const handleLinkTypeChange = useCallback((event: any) => {
    setLinkType(event.target.value as 'link' | 'parent-child');
    setHasChanges(true);
  }, []);

  // Handle link ID change
  const handleLinkIdChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLinkId(event.target.value);
    setHasChanges(true);
  }, []);

  // Auto-save when values change
  useEffect(() => {
    if (!edge || !hasChanges) return;

    const updates: Partial<FlowEdge> = {
      data: {
        ...edge.data,
        probability,
        nljLink: {
          ...edge.data?.nljLink,
          id: linkId,
          type: linkType,
          probability,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          startPoint: edge.data?.nljLink?.startPoint || { x: 0, y: 0 },
          endPoint: edge.data?.nljLink?.endPoint || { x: 0, y: 0 },
          bendPoints: edge.data?.nljLink?.bendPoints || [],
        },
      },
      // Update visual style based on type
      style: {
        ...(edge.style || {}),
        strokeDasharray: linkType === 'parent-child' ? '5,5' : undefined,
        stroke: linkType === 'parent-child' ? '#9C27B0' : '#666',
      },
      // Update marker color
      markerEnd: edge.markerEnd && typeof edge.markerEnd === 'object' ? {
        ...edge.markerEnd,
        color: linkType === 'parent-child' ? '#9C27B0' : '#666',
      } : undefined,
    };

    // Auto-save after a delay
    const timeoutId = setTimeout(() => {
      onSave(edge.id, updates);
      setHasChanges(false);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [edge, probability, linkType, linkId, onSave, hasChanges]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!edge) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this connection?');
    if (confirmed) {
      onDelete?.(edge.id);
    }
  }, [edge, onDelete]);

  // Format probability as percentage
  const formatProbability = (value: number) => `${Math.round(value * 100)}%`;

  // Get node label for display
  const getNodeLabel = (node: FlowNode | undefined) => {
    if (!node) return 'Unknown Node';
    return node.data.label || node.data.nljNode.id;
  };

  if (!edge) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="body1" color="textSecondary">
          Select a connection to edit its properties
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Content */}
      <Box sx={{ p: 2, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <Stack spacing={3}>
          {/* Connection Overview */}
          <Card variant="outlined" sx={{ backgroundColor: 'background.default' }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Connection Overview
                </Typography>
                
                <Box display="flex" alignItems="center" gap={1}>
                  <VisibilityIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>From:</strong> {getNodeLabel(sourceNode)}
                  </Typography>
                </Box>
                
                <Box display="flex" alignItems="center" gap={1}>
                  <VisibilityIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>To:</strong> {getNodeLabel(targetNode)}
                  </Typography>
                </Box>
                
                <Box display="flex" flexWrap="wrap" gap={1}>
                  <Chip
                    label={linkType === 'parent-child' ? 'Parent-Child' : 'Navigation'}
                    size="small"
                    variant="outlined"
                    icon={linkType === 'parent-child' ? <ParentChildIcon /> : <LinkIcon />}
                  />
                  <Chip
                    label={formatProbability(probability)}
                    size="small"
                    variant="filled"
                    icon={<ProbabilityIcon />}
                    sx={{
                      backgroundColor: probability >= 0.8 ? 'success.main' : 
                                     probability >= 0.5 ? 'warning.main' : 'error.main',
                      color: 'white',
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Link ID */}
          <TextField
            label="Link ID"
            value={linkId}
            onChange={handleLinkIdChange}
            variant="outlined"
            fullWidth
            helperText="Unique identifier for this connection"
            size="small"
          />

          {/* Link Type */}
          <FormControl fullWidth size="small">
            <InputLabel>Connection Type</InputLabel>
            <Select
              value={linkType}
              onChange={handleLinkTypeChange}
              label="Connection Type"
            >
              <MenuItem value="link">
                <Box display="flex" alignItems="center" gap={1}>
                  <LinkIcon fontSize="small" />
                  <Box>
                    <Typography variant="body2">Navigation Link</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Standard flow connection
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
              <MenuItem value="parent-child">
                <Box display="flex" alignItems="center" gap={1}>
                  <ParentChildIcon fontSize="small" />
                  <Box>
                    <Typography variant="body2">Parent-Child Link</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Hierarchical relationship
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          {/* Probability Slider */}
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <ProbabilityIcon fontSize="small" />
              <Typography variant="subtitle2">
                Probability: {formatProbability(probability)}
              </Typography>
              <Tooltip title="Probability affects the visual weight of the connection and determines the likelihood of this path being taken in the scenario">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
            <Slider
              value={probability}
              onChange={handleProbabilityChange}
              min={0.1}
              max={1.0}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={formatProbability}
              sx={{
                color: 'primary.main',
                '& .MuiSlider-track': {
                  height: 6,
                },
                '& .MuiSlider-thumb': {
                  width: 20,
                  height: 20,
                },
              }}
              marks={[
                { value: 0.1, label: '10%' },
                { value: 0.5, label: '50%' },
                { value: 1.0, label: '100%' },
              ]}
            />
          </Box>

          <Divider />

          {/* Info Alerts */}
          {linkType === 'parent-child' && (
            <Alert
              severity="info"
              sx={{ fontSize: '0.875rem' }}
              icon={<ParentChildIcon fontSize="small" />}
            >
              Parent-child connections are displayed with dashed lines and purple color.
              They represent hierarchical relationships between nodes.
            </Alert>
          )}

          {probability < 0.5 && (
            <Alert
              severity="warning"
              sx={{ fontSize: '0.875rem' }}
              icon={<ProbabilityIcon fontSize="small" />}
            >
              Low probability connections ({formatProbability(probability)}) will appear
              fainter and may be less likely to be taken in the scenario flow.
            </Alert>
          )}

          {/* Auto-save indicator */}
          {hasChanges && (
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              Changes will be saved automatically when you click elsewhere or close the editor.
            </Alert>
          )}
        </Stack>
      </Box>

      {/* Footer - Delete Action and Autosave Status */}
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Autosave Status */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {hasChanges ? 'Autosaving...' : 'All changes saved'}
            </Typography>
          </Box>
          
          {/* Delete Button */}
          {onDelete && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleDelete}
              startIcon={<DeleteIcon />}
              size="small"
              sx={{ fontSize: '0.75rem' }}
            >
              Delete
            </Button>
          )}
        </Stack>
      </Box>
    </Box>
  );
}