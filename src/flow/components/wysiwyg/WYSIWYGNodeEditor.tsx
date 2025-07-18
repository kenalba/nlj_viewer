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
import { ChoiceNodeEditor } from './editors/ChoiceNodeEditor';

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
  onUnsavedChanges?: (hasChanges: boolean) => void;
  // For adding new nodes and edges
  onAddNode?: (node: FlowNode) => void;
  onAddEdge?: (edge: any) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
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
  onUnsavedChanges,
  onAddNode,
  onAddEdge,
  onUpdateNode,
}) => {
  const [editedNode, setEditedNode] = useState<FlowNode | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [_showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [autosaveTimeout, setAutosaveTimeout] = useState<number | null>(null);

  // Handle save (now only used internally for autosave)
  const handleSave = useCallback(() => {
    if (editedNode) {
      onSave(editedNode);
      setHasChanges(false);
      if (onUnsavedChanges) {
        onUnsavedChanges(false);
      }
      // Clear autosave timeout when saving
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
        setAutosaveTimeout(null);
      }
    }
  }, [editedNode, onSave, onUnsavedChanges, autosaveTimeout]);

  // Initialize edited node when node changes
  useEffect(() => {
    if (node) {
      // Autosave if we have unsaved changes when switching nodes
      if (hasChanges && editedNode && editedNode.id !== node.id) {
        console.log('Autosaving changes for node:', editedNode.id);
        handleSave();
      }
      
      // Only update if the node ID is different to avoid infinite loops
      if (!editedNode || editedNode.id !== node.id) {
        setEditedNode(JSON.parse(JSON.stringify(node))); // Deep copy
        setHasChanges(false);
        setShowAdvancedSettings(false);
        
        // Reset to edit tab for new nodes, but handle choice nodes differently
        const newNodeType = node.data.nodeType;
        if (newNodeType === 'choice') {
          // For choice nodes, only allow Edit (0) or Settings (1)
          setActiveTab(activeTab > 1 ? 0 : activeTab);
        } else {
          setActiveTab(0); // Reset to edit tab for new nodes
        }
      }
    }
  }, [node, hasChanges, editedNode?.id, handleSave, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup autosave timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
      }
    };
  }, [autosaveTimeout]);

  // Handle node updates
  const updateNLJNode = useCallback((updates: Partial<NLJNode>) => {
    if (!editedNode) return;
    
    const newEditedNode = {
      ...editedNode,
      data: {
        ...editedNode.data,
        nljNode: { ...editedNode.data.nljNode, ...updates } as NLJNode
      }
    };
    
    // Compare specific NLJNode properties instead of entire objects
    const originalNljNode = node?.data.nljNode || {};
    const newNljNode = newEditedNode.data.nljNode;
    
    // Check if there are actual changes in the NLJNode data
    const hasActualChanges = Object.keys(newNljNode).some(key => {
      const originalValue = originalNljNode[key as keyof typeof originalNljNode];
      const newValue = newNljNode[key as keyof typeof newNljNode];
      
      // Handle undefined/null comparisons
      if (originalValue === undefined && newValue === undefined) return false;
      if (originalValue === null && newValue === null) return false;
      if (originalValue === '' && newValue === '') return false;
      if (originalValue === undefined && newValue === '') return false;
      if (originalValue === '' && newValue === undefined) return false;
      
      return originalValue !== newValue;
    });
    
    setEditedNode(newEditedNode);
    setHasChanges(hasActualChanges);
    
    // Notify parent about unsaved changes
    if (onUnsavedChanges) {
      onUnsavedChanges(hasActualChanges);
    }
    
    // Set up autosave with a delay
    if (hasActualChanges) {
      // Clear existing timeout
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
      }
      
      // Set new timeout for autosave
      const timeout = setTimeout(() => {
        console.log('Autosaving after delay for node:', newEditedNode.id);
        handleSave();
      }, 1000); // 1 second delay
      
      setAutosaveTimeout(timeout);
    }
  }, [editedNode, node, onUnsavedChanges, autosaveTimeout, handleSave]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (node && onDelete) {
      // Clear autosave timeout when deleting
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
        setAutosaveTimeout(null);
      }
      onDelete(node.id);
      onClose();
    }
  }, [node, onDelete, onClose, autosaveTimeout]);

  // Handle close with autosave
  const handleClose = useCallback(() => {
    if (hasChanges && editedNode) {
      console.log('Autosaving changes before closing node:', editedNode.id);
      handleSave();
    }
    onClose();
  }, [hasChanges, editedNode, handleSave, onClose]);

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
          overflowX: 'hidden', // Disable horizontal scrolling
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Header */}
        <NodeHeader
          node={editedNode}
          onClose={handleClose}
          theme={theme}
        />

        {/* Tab Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              minHeight: 36,
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
                minHeight: 36,
                fontSize: '0.75rem',
                py: 0.5,
                '& .MuiTab-iconWrapper': {
                  fontSize: '0.875rem',
                  marginRight: '4px',
                }
              }}
            />
            {/* Hide Preview tab for choice nodes */}
            {nodeType !== 'choice' && (
              <Tab
                label="Preview"
                icon={<PreviewIcon />}
                iconPosition="start"
                sx={{ 
                  textTransform: 'none', 
                  minHeight: 36,
                  fontSize: '0.75rem',
                  py: 0.5,
                  '& .MuiTab-iconWrapper': {
                    fontSize: '0.875rem',
                    marginRight: '4px',
                  }
                }}
              />
            )}
            <Tab
              label="Settings"
              icon={<SettingsIcon />}
              iconPosition="start"
              sx={{ 
                textTransform: 'none', 
                minHeight: 36,
                fontSize: '0.75rem',
                py: 0.5,
                '& .MuiTab-iconWrapper': {
                  fontSize: '0.875rem',
                  marginRight: '4px',
                }
              }}
            />
          </Tabs>
        </Box>

        {/* Main Content - Scrollable */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          
          {/* Edit Tab */}
          {activeTab === 0 && (
            <Stack spacing={2} sx={{ p: 2 }}>
              
              {/* Media Section */}
              {supportsMedia(nodeType) && (
                <MediaSection
                  node={editedNode}
                  onUpdate={updateNLJNode}
                  theme={theme}
                />
              )}

              {/* Choice Node Editor */}
              {nodeType === 'choice' ? (
                <ChoiceNodeEditor
                  node={editedNode}
                  onUpdate={updateNLJNode}
                  theme={theme}
                />
              ) : (
                <>
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
                      onAddNode={onAddNode}
                      onAddEdge={onAddEdge}
                      onUpdateNode={onUpdateNode}
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
                </>
              )}

            </Stack>
          )}

          {/* Preview Tab - only show for non-choice nodes */}
          {nodeType !== 'choice' && activeTab === 1 && (
            <Box sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" color="text.primary" sx={{ mb: 1.5, fontSize: '0.875rem' }}>
                Node Preview
              </Typography>
              
              <Box sx={{ height: 'calc(100% - 40px)' }}>
                <AssessmentPreview
                  node={editedNode}
                  allNodes={allNodes}
                  allEdges={allEdges}
                />
              </Box>
            </Box>
          )}

          {/* Settings Tab - adjust index based on node type */}
          {((nodeType === 'choice' && activeTab === 1) || (nodeType !== 'choice' && activeTab === 2)) && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" color="text.primary" sx={{ mb: 1.5, fontSize: '0.875rem' }}>
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
    </Drawer>
  );
};