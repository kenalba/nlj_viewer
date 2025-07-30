/**
 * WYSIWYG Node Editor Content - Just the content without the Drawer wrapper
 * Used by UnifiedSidebar to avoid double headers
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Stack,
  Tabs,
  Tab,
  Typography,
  Button,
} from '@mui/material';
import {
  Edit as EditIcon,
  Preview as PreviewIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode } from '../../../../types/nlj';
import { NODE_TYPE_INFO } from '../../flow/utils/flowUtils';
import { MediaSection } from './components/MediaSection';
import { ContentSection } from './components/ContentSection';
import { InteractiveSection } from './components/InteractiveSection';
import { FeedbackSection } from './components/FeedbackSection';
import { SettingsDrawer } from './components/SettingsDrawer';
import { AssessmentPreview } from '../previews/AssessmentPreview';
import { ChoiceNodeEditor } from '../editors/ChoiceNodeEditor';
import { ExpressionsSection } from './components/ExpressionsSection';

interface WYSIWYGNodeEditorContentProps {
  node: FlowNode | null;
  onSave: (updatedNode: FlowNode) => void;
  onDelete?: (nodeId: string) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  // For choice-based assessments
  allNodes?: FlowNode[];
  allEdges?: any[];
  // For handling unsaved changes
  onUnsavedChanges?: (hasChanges: boolean) => void;
  // For adding new nodes and edges
  onAddNode?: (node: FlowNode) => void;
  onAddEdge?: (edge: any) => void;
  activitySettings?: { shuffleAnswerOrder?: boolean; reinforcementEligible?: boolean };
  // Edge management functions for branch nodes
  onRemoveEdge?: (sourceNodeId: string, targetNodeId: string) => void;
  onUpdateEdge?: (sourceNodeId: string, targetNodeId: string, updates: { label?: string }) => void;
}

export function WYSIWYGNodeEditorContent({
  node,
  onSave,
  onDelete,
  theme = 'unfiltered',
  allNodes = [],
  allEdges = [],
  onUnsavedChanges,
  onAddNode,
  onAddEdge,
  activitySettings = {},
  onRemoveEdge,
  onUpdateEdge,
}: WYSIWYGNodeEditorContentProps) {
  const [editedNode, setEditedNode] = useState<FlowNode | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [, setShowAdvancedSettings] = useState(false);
  const autosaveTimeout = useRef<number | null>(null);

  // Get node type info
  const nodeType = editedNode?.data.nodeType || 'start';
  const nodeTypeInfo = NODE_TYPE_INFO[nodeType];

  // Auto-save functionality
  const handleSave = useCallback(() => {
    if (editedNode && hasChanges) {
      onSave(editedNode);
      setHasChanges(false);
      
      // Clear any pending autosave
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
        autosaveTimeout.current = null;
      }
    }
  }, [editedNode, hasChanges, onSave]);

  // Initialize edited node when node prop changes
  useEffect(() => {
    if (node) {
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
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
      }
    };
  }, []);

  // Handle node updates
  const updateNLJNode = useCallback((updates: Partial<NLJNode>) => {
    if (!editedNode) return;

    const updatedNode: FlowNode = {
      ...editedNode,
      data: {
        ...editedNode.data,
        nljNode: {
          ...editedNode.data.nljNode,
          ...updates,
        },
      },
    };

    setEditedNode(updatedNode);
    setHasChanges(true);
    
    // Set up autosave
    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }
    autosaveTimeout.current = setTimeout(() => {
      onSave(updatedNode);
      setHasChanges(false);
      autosaveTimeout.current = null;
    }, 1000);
  }, [editedNode, onSave]);

  // Notify parent about unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(hasChanges);
  }, [hasChanges, onUnsavedChanges]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (editedNode && onDelete) {
      onDelete(editedNode.id);
    }
  }, [editedNode, onDelete]);

  if (!editedNode) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="body1" color="textSecondary">
          Select a node to edit its properties
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
            {nodeTypeInfo?.supportsMedia && (
              <MediaSection
                node={editedNode}
                onUpdate={updateNLJNode}
                theme={theme}
              />
            )}

            {/* Content Section - Skip for choice nodes since ChoiceNodeEditor handles text */}
            {nodeType !== 'choice' && (
              <ContentSection
                node={editedNode}
                onUpdate={updateNLJNode}
                theme={theme}
              />
            )}

            {/* Interactive Elements Section */}
            {nodeTypeInfo?.isInteractive && (
              <InteractiveSection
                node={editedNode}
                onUpdate={updateNLJNode}
                theme={theme}
                allNodes={allNodes}
                allEdges={allEdges}
                onAddNode={onAddNode}
                onAddEdge={onAddEdge}
                onRemoveEdge={onRemoveEdge}
                onUpdateEdge={onUpdateEdge}
              />
            )}

            {/* Feedback Section */}
            <FeedbackSection
              node={editedNode}
              onUpdate={updateNLJNode}
              theme={theme}
            />

            {/* Choice Node Editor */}
            {nodeType === 'choice' && (
              <ChoiceNodeEditor
                node={editedNode}
                allNodes={allNodes}
                allEdges={allEdges}
                onUpdate={updateNLJNode}
                onAddNode={onAddNode}
                onAddEdge={onAddEdge}
                theme={theme}
              />
            )}

            {/* Expressions Section for Choice Nodes */}
            {nodeType === 'choice' && (
              <ExpressionsSection
                node={editedNode}
                onUpdate={updateNLJNode}
              />
            )}

          </Stack>
        )}

        {/* Preview Tab (Non-choice nodes only) */}
        {activeTab === 1 && nodeType !== 'choice' && (
          <Box sx={{ p: 2 }}>
            <AssessmentPreview
              node={editedNode}
              theme={theme}
              allNodes={allNodes}
              allEdges={allEdges}
            />
          </Box>
        )}

        {/* Settings Tab */}
        {activeTab === (nodeType === 'choice' ? 1 : 2) && (
          <Box sx={{ p: 2 }}>
            <SettingsDrawer
              node={editedNode}
              onUpdate={updateNLJNode}
              isExpanded={true}
              onToggle={() => {}}
              theme={theme}
              activitySettings={activitySettings}
              alwaysExpanded={true}
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
  );
}