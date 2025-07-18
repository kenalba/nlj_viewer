/**
 * WYSIWYG Node Editor - Main component for visual node editing
 * Replaces the tab-based NodeEditSidebar with a unified editing experience
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Drawer,
  Box,
  Button,
  Stack,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Preview as PreviewIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../types/flow';
import type { NLJNode } from '../../../types/nlj';
import { NODE_TYPE_INFO } from '../../utils/flowUtils';
import { NodeHeader } from './components/NodeHeader';
import { MediaSection } from './components/MediaSection';
import { ContentSection } from './components/ContentSection';
import { InteractiveSection } from './components/InteractiveSection';
import { FeedbackSection } from './components/FeedbackSection';
import { SettingsDrawer } from './components/SettingsDrawer';
import { AssessmentPreview } from './previews/AssessmentPreview';

interface WYSIWYGNodeEditorProps {
  node: FlowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedNode: FlowNode) => void;
  onDelete?: (nodeId: string) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  headerHeight?: number;
  // For choice-based assessments
  allNodes?: FlowNode[];
  allEdges?: any[];
  // For handling unsaved changes
  onNodeSwitchRequest?: (newNodeId: string) => boolean;
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

export const WYSIWYGNodeEditor: React.FC<WYSIWYGNodeEditorProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
  onDelete,
  theme = 'unfiltered',
  headerHeight = 120,
  allNodes = [],
  allEdges = [],
  onNodeSwitchRequest,
  onUnsavedChanges,
}) => {
  const [editedNode, setEditedNode] = useState<FlowNode | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [_showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Initialize edited node when node changes
  useEffect(() => {
    if (node) {
      // Check if we have unsaved changes when switching nodes
      if (hasChanges && editedNode && editedNode.id !== node.id) {
        const confirmed = window.confirm('You have unsaved changes. Are you sure you want to switch nodes without saving?');
        if (!confirmed) {
          // Notify parent that the switch was cancelled
          if (onNodeSwitchRequest) {
            onNodeSwitchRequest(editedNode.id);
          }
          return;
        }
      }
      
      // Only update if the node ID is different to avoid infinite loops
      if (!editedNode || editedNode.id !== node.id) {
        setEditedNode(JSON.parse(JSON.stringify(node))); // Deep copy
        setHasChanges(false);
        setShowAdvancedSettings(false);
        setActiveTab(0); // Reset to edit tab for new nodes
      }
    }
  }, [node, hasChanges, editedNode?.id, onNodeSwitchRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle node updates
  const updateNLJNode = useCallback((updates: Partial<NLJNode>) => {
    if (!editedNode) return;
    
    setEditedNode(prev => prev ? {
      ...prev,
      data: {
        ...prev.data,
        nljNode: { ...prev.data.nljNode, ...updates } as NLJNode
      }
    } : null);
    setHasChanges(true);
    
    // Notify parent about unsaved changes
    if (onUnsavedChanges) {
      onUnsavedChanges(true);
    }
  }, [editedNode, onUnsavedChanges]);

  // Handle save
  const handleSave = useCallback(() => {
    if (editedNode) {
      onSave(editedNode);
      setHasChanges(false);
      if (onUnsavedChanges) {
        onUnsavedChanges(false);
      }
      onClose();
    }
  }, [editedNode, onSave, onClose, onUnsavedChanges]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (node && onDelete) {
      onDelete(node.id);
      onClose();
    }
  }, [node, onDelete, onClose]);

  // Handle close with unsaved changes
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  // Check if node uses choice nodes
  // const usesChoiceNodes = (nodeType: string): boolean => {
  //   return [
  //     'question',
  //     'multi_select', 
  //     'checkbox',
  //     'matching',
  //     'ordering'
  //   ].includes(nodeType);
  // };

  // Check if node supports media
  const supportsMedia = (nodeType: string): boolean => {
    const nodeTypeInfo = NODE_TYPE_INFO[nodeType as keyof typeof NODE_TYPE_INFO];
    return nodeTypeInfo?.supportsMedia || false;
  };

  // Check if node has interactive elements
  const hasInteractiveElements = (nodeType: string): boolean => {
    return [
      'question',
      'multi_select',
      'checkbox',
      'matching',
      'ordering',
      'true_false',
      'short_answer',
      'likert_scale',
      'rating',
      'matrix',
      'slider',
      'text_area',
      'connections',
      'wordle'
    ].includes(nodeType);
  };

  // Check if node has feedback
  const hasFeedback = (nodeType: string): boolean => {
    return [
      'question',
      'multi_select',
      'checkbox',
      'matching',
      'ordering',
      'true_false',
      'short_answer',
      'connections',
      'wordle'
    ].includes(nodeType);
  };

  if (!node || !editedNode) return null;

  const nodeType = editedNode.data.nodeType;

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      variant="persistent"
      PaperProps={{
        sx: { 
          width: 480, 
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          height: `calc(100vh - ${headerHeight}px)`, // Account for header height
          top: headerHeight, // Start below header
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Header */}
        <NodeHeader
          node={editedNode}
          onUpdate={updateNLJNode}
          onClose={handleClose}
          hasChanges={hasChanges}
          theme={theme}
        />

        {/* Tab Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTabs-indicator': {
                backgroundColor: 'primary.main',
              },
            }}
          >
            <Tab
              label="Edit"
              icon={<EditIcon />}
              iconPosition="start"
              sx={{ 
                textTransform: 'none', 
                minHeight: 40,
                fontSize: '0.875rem',
                '& .MuiTab-iconWrapper': {
                  fontSize: '1rem'
                }
              }}
            />
            <Tab
              label="Preview"
              icon={<PreviewIcon />}
              iconPosition="start"
              sx={{ 
                textTransform: 'none', 
                minHeight: 40,
                fontSize: '0.875rem',
                '& .MuiTab-iconWrapper': {
                  fontSize: '1rem'
                }
              }}
            />
            <Tab
              label="Settings"
              icon={<SettingsIcon />}
              iconPosition="start"
              sx={{ 
                textTransform: 'none', 
                minHeight: 40,
                fontSize: '0.875rem',
                '& .MuiTab-iconWrapper': {
                  fontSize: '1rem'
                }
              }}
            />
          </Tabs>
        </Box>

        {/* Main Content - Scrollable */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          
          {/* Edit Tab */}
          {activeTab === 0 && (
            <Stack spacing={3} sx={{ p: 3 }}>
              
              {/* Media Section */}
              {supportsMedia(nodeType) && (
                <MediaSection
                  node={editedNode}
                  onUpdate={updateNLJNode}
                  theme={theme}
                />
              )}

              {/* Content Section */}
              <ContentSection
                node={editedNode}
                onUpdate={updateNLJNode}
                theme={theme}
              />

              {/* Interactive Elements Section */}
              {hasInteractiveElements(nodeType) && (
                <InteractiveSection
                  node={editedNode}
                  onUpdate={updateNLJNode}
                  allNodes={allNodes}
                  allEdges={allEdges}
                  theme={theme}
                />
              )}

              {/* Feedback Section */}
              {hasFeedback(nodeType) && (
                <FeedbackSection
                  node={editedNode}
                  onUpdate={updateNLJNode}
                  theme={theme}
                />
              )}

            </Stack>
          )}

          {/* Preview Tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
                Node Preview
              </Typography>
              
              <Box sx={{ height: 'calc(100% - 60px)' }}>
                <AssessmentPreview
                  node={editedNode}
                  allNodes={allNodes}
                  allEdges={allEdges}
                />
              </Box>
            </Box>
          )}

          {/* Settings Tab */}
          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
                Node Settings
              </Typography>
              
              <SettingsDrawer
                node={editedNode}
                onUpdate={updateNLJNode}
                isExpanded={true}
                onToggle={() => {}}
                theme={theme}
              />
            </Box>
          )}

        </Box>

        {/* Footer - Save/Delete Actions */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!hasChanges}
              startIcon={<SaveIcon />}
              fullWidth
            >
              Save Changes
            </Button>
            
            {onDelete && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDelete}
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
            )}
          </Stack>
        </Box>

      </Box>
    </Drawer>
  );
};