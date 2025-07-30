/**
 * Unified Sidebar - Handles both node and edge editing in a single sidebar
 * Replaces separate node and edge editing dialogs
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Link as LinkIcon,
  AccountTree as NodeIcon,
  History as HistoryIcon,
} from '@mui/icons-material';

import type { FlowNode, FlowEdge } from '../../flow/types/flow';
import { WYSIWYGNodeEditorContent } from './WYSIWYGNodeEditorContent';
import { EdgeEditor } from './EdgeEditor';
import { getNodeIcon, getNodeTypeInfo } from '../../flow/utils/nodeTypeUtils';

interface UnifiedSidebarProps {
  // Node editing props
  node: FlowNode | null;
  onNodeSave: (updatedNode: FlowNode) => void;
  onNodeDelete?: (nodeId: string) => void;
  
  // Edge editing props
  edge: FlowEdge | null;
  onEdgeSave: (edgeId: string, updates: Partial<FlowEdge>) => void;
  onEdgeDelete?: (edgeId: string) => void;
  
  // Shared props
  allNodes: FlowNode[];
  allEdges: FlowEdge[];
  isOpen: boolean;
  onClose: () => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  headerHeight?: number;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  onAddNode?: (node: FlowNode) => void;
  onAddEdge?: (edge: FlowEdge) => void;
  activitySettings?: { shuffleAnswerOrder?: boolean; reinforcementEligible?: boolean };
  // Edge management functions for branch nodes
  onRemoveEdgeBySourceTarget?: (sourceNodeId: string, targetNodeId: string) => void;
  onUpdateEdgeBySourceTarget?: (sourceNodeId: string, targetNodeId: string, updates: { label?: string }) => void;
}

export function UnifiedSidebar({
  node,
  onNodeSave,
  onNodeDelete,
  edge,
  onEdgeSave,
  onEdgeDelete,
  allNodes,
  allEdges,
  isOpen,
  onClose,
  theme = 'unfiltered',
  headerHeight = 120,
  onUnsavedChanges,
  onAddNode,
  onAddEdge,
  activitySettings = {},
  onRemoveEdgeBySourceTarget,
  onUpdateEdgeBySourceTarget,
}: UnifiedSidebarProps) {
  const [_activeTab, setActiveTab] = useState(0);
  const [_hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Determine what to show based on what's selected
  const showNode = Boolean(node);
  const showEdge = Boolean(edge);

  // Auto-switch tabs based on selection - prioritize node > edge
  useEffect(() => {
    if (showNode) {
      setActiveTab(0); // Node tab
    } else if (showEdge) {
      setActiveTab(1); // Edge tab
    }
    // Reset unsaved changes when switching
    setHasUnsavedChanges(false);
  }, [showNode, showEdge]);

  // Auto-save when switching selections
  useEffect(() => {
    // This effect will trigger auto-save in the child components
    // since they watch for prop changes and auto-save on unmount
  }, [node?.id, edge?.id]);


  // Handle unsaved changes
  const handleUnsavedChanges = useCallback((hasChanges: boolean) => {
    setHasUnsavedChanges(hasChanges);
    onUnsavedChanges?.(hasChanges);
  }, [onUnsavedChanges]);

  // Handle close - removed confirmation, just auto-save
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);


  // Get sidebar title - prioritize node over edge
  const getSidebarTitle = () => {
    if (showNode) return 'Edit Node';
    if (showEdge) return 'Edit Connection';
    return 'Editor';
  };

  // Get header background color based on content type
  const getHeaderBackgroundColor = () => {
    if (showNode && node) {
      const nodeTypeInfo = getNodeTypeInfo(node.data.nodeType as any);
      // Use the actual color from NODE_TYPE_INFO, which matches the flow nodes
      return nodeTypeInfo?.color || '#666666';
    }
    
    // Default for edges or when no specific content is selected
    return '#1976d2'; // Default blue
  };

  // Get active content - prioritize node over edge
  const getActiveContent = () => {
    if (showNode) {
      return (
        <WYSIWYGNodeEditorContent
          node={node}
          onSave={onNodeSave}
          onDelete={onNodeDelete}
          theme={theme}
          allNodes={allNodes}
          allEdges={allEdges}
          onUnsavedChanges={handleUnsavedChanges}
          onAddNode={onAddNode}
          onAddEdge={onAddEdge}
          activitySettings={activitySettings}
          onRemoveEdge={onRemoveEdgeBySourceTarget}
          onUpdateEdge={onUpdateEdgeBySourceTarget}
        />
      );
    }
    
    if (showEdge) {
      return (
        <EdgeEditor
          edge={edge}
          allNodes={allNodes}
          onSave={onEdgeSave}
          onDelete={onEdgeDelete}
          theme={theme}
          onUnsavedChanges={handleUnsavedChanges}
        />
      );
    }
    
    return (
      <Box p={3} textAlign="center">
        <Typography variant="body1" color="textSecondary">
          Select a node, connection, or version to edit
        </Typography>
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      variant="persistent"
      PaperProps={{
        sx: {
          width: '640px',
          top: `${headerHeight}px`,
          height: `calc(100vh - ${headerHeight}px)`,
          borderLeft: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.default',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: getHeaderBackgroundColor(),
          color: 'primary.contrastText',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {showNode ? <NodeIcon sx={{ color: 'inherit' }} /> : 
           showEdge ? <LinkIcon sx={{ color: 'inherit' }} /> : 
           <NodeIcon sx={{ color: 'inherit' }} />}
          <Typography variant="subtitle1" sx={{ color: 'inherit', fontWeight: 600 }}>
            {getSidebarTitle()}
          </Typography>
          
          {/* Node Type Chip */}
          {showNode && node && (
            <Chip
              icon={getNodeIcon(node.data.nodeType as any)}
              label={getNodeTypeInfo(node.data.nodeType as any)?.label || node.data.nodeType}
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'inherit',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />
          )}
          
          {/* Connection Type Chip */}
          {showEdge && edge && (
            <Chip
              icon={edge.data?.nljLink?.type === 'parent-child' ? 
                <NodeIcon sx={{ color: 'inherit' }} /> : 
                <LinkIcon sx={{ color: 'inherit' }} />
              }
              label={edge.data?.nljLink?.type === 'parent-child' ? 'Parent-Child' : 'Navigation'}
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'inherit',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />
          )}
        </Stack>
        
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ color: 'primary.contrastText' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {getActiveContent()}
      </Box>
    </Drawer>
  );
}