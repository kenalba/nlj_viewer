/**
 * Slide-out sidebar for editing NLJ node properties
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Paper,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  AudioFile as AudioIcon,
} from '@mui/icons-material';

import type { FlowNode, FlowEdge } from '../../flow/types/flow';
import type { NLJNode } from '../../../types/nlj';
// NODE_TYPE_INFO is now imported via getNodeTypeInfo utility
import { getNodeIcon, getNodeTypeInfo } from '../../flow/utils/nodeTypeUtils.tsx';

interface NodeEditSidebarProps {
  node: FlowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedNode: FlowNode) => void;
  onDelete?: (nodeId: string) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  // Add scenario data for getting connected nodes
  allNodes?: FlowNode[];
  allEdges?: FlowEdge[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index, ...other }: TabPanelProps) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`simple-tabpanel-${index}`}
    aria-labelledby={`simple-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const NodeEditSidebar: React.FC<NodeEditSidebarProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
  onDelete,
  theme: _theme = 'unfiltered',
  allNodes = [],
  allEdges = [],
}) => {
  const [editedNode, setEditedNode] = useState<FlowNode | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edited node when node changes
  useEffect(() => {
    if (node) {
      setEditedNode(JSON.parse(JSON.stringify(node))); // Deep copy
      setHasChanges(false);
      setActiveTab(0);
    }
  }, [node]);

  const handleSave = useCallback(() => {
    if (editedNode) {
      onSave(editedNode);
      setHasChanges(false);
      onClose();
    }
  }, [editedNode, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (node && onDelete) {
      onDelete(node.id);
      onClose();
    }
  }, [node, onDelete, onClose]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  }, [hasChanges, onClose]);


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
  }, [editedNode]);

  if (!node || !editedNode) return null;

  const nodeTypeInfo = getNodeTypeInfo(editedNode.data.nodeType as any);
  const nljNode = editedNode.data.nljNode;

  // Get node icon using shared utility
  const nodeIcon = getNodeIcon(editedNode.data.nodeType as any);

  // Render basic properties tab
  const renderBasicProperties = () => (
    <Stack spacing={3}>
      <TextField
        label="Node Title"
        value={nljNode.title || ''}
        onChange={(e) => updateNLJNode({ title: e.target.value })}
        fullWidth
        helperText="Display title for the node"
      />

      {'text' in nljNode && (
        <TextField
          label="Question/Content Text"
          value={nljNode.text || ''}
          onChange={(e) => updateNLJNode({ text: e.target.value })}
          fullWidth
          multiline
          rows={3}
          helperText="Main text content for the node"
        />
      )}

      {'content' in nljNode && (
        <TextField
          label="Additional Content"
          value={nljNode.content || ''}
          onChange={(e) => updateNLJNode({ content: e.target.value })}
          fullWidth
          multiline
          rows={2}
          helperText="Additional Markdown content (optional)"
        />
      )}

      {nljNode.description && (
        <TextField
          label="Description"
          value={nljNode.description || ''}
          onChange={(e) => updateNLJNode({ description: e.target.value })}
          fullWidth
          multiline
          rows={2}
          helperText="Internal description for this node"
        />
      )}

    </Stack>
  );

  // Render question-specific properties
  const renderQuestionProperties = () => {
    if (!editedNode.data.isInteractive) return null;

    return (
      <Stack spacing={3}>
        {/* Multiple Choice Questions */}
        {editedNode.data.nodeType === 'question' && (
          <Stack spacing={2}>
            <Typography variant="h6" gutterBottom>
              Multiple Choice Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This question uses choice nodes connected via parent-child links.
            </Typography>
            
            {/* Show connected choice nodes */}
            {(() => {
              // Find choice nodes connected to this question via edges
              const connectedChoiceEdges = allEdges.filter((edge: FlowEdge) => 
                edge.source === editedNode.id
              );
              const choiceNodes = connectedChoiceEdges.map((edge: FlowEdge) => 
                allNodes.find((flowNode: FlowNode) => flowNode.id === edge.target && flowNode.data.nodeType === 'choice')
              ).filter(Boolean);
              
              return (
                <Stack spacing={1}>
                  <Typography variant="body2" fontWeight="medium">
                    Connected Choice Nodes: {choiceNodes.length}
                  </Typography>
                  {choiceNodes.length > 0 ? (
                    choiceNodes.map((choice: FlowNode | undefined, index: number) => choice ? (
                      <Paper key={choice.id} sx={{ p: 1, bgcolor: 'action.hover' }}>
                        <Typography variant="body2" fontWeight="medium">
                          Choice {index + 1}: {(choice.data.nljNode as any).isCorrect ? '✓' : '✗'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {(choice.data.nljNode as any).text || choice.data.label}
                        </Typography>
                      </Paper>
                    ) : null)
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No choice nodes connected. Add choice nodes from the node palette and connect them to this question.
                    </Typography>
                  )}
                </Stack>
              );
            })()}
            
            {'required' in nljNode && (
              <FormControlLabel
                control={
                  <Switch
                    checked={nljNode.required || false}
                    onChange={(e) => updateNLJNode({ required: e.target.checked })}
                  />
                }
                label="Required"
              />
            )}
          </Stack>
        )}
        
        {/* True/False Questions */}
        {editedNode.data.nodeType === 'true_false' && 'correctAnswer' in nljNode && (
          <FormControl fullWidth>
            <InputLabel>Correct Answer</InputLabel>
            <Select
              value={nljNode.correctAnswer ? 'true' : 'false'}
              onChange={(e) => updateNLJNode({ correctAnswer: e.target.value === 'true' })}
            >
              <MenuItem value="true">True</MenuItem>
              <MenuItem value="false">False</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Short Answer Questions */}
        {editedNode.data.nodeType === 'short_answer' && 'correctAnswers' in nljNode && (
          <>
            <Typography variant="h6" gutterBottom>
              Correct Answers
            </Typography>
            <Stack spacing={2}>
              {nljNode.correctAnswers.map((answer, index) => (
                <Stack key={index} direction="row" spacing={1}>
                  <TextField
                    label={`Answer ${index + 1}`}
                    value={answer}
                    onChange={(e) => {
                      const newAnswers = [...nljNode.correctAnswers];
                      newAnswers[index] = e.target.value;
                      updateNLJNode({ correctAnswers: newAnswers });
                    }}
                    fullWidth
                    size="small"
                  />
                  <IconButton
                    onClick={() => {
                      const newAnswers = nljNode.correctAnswers.filter((_, i) => i !== index);
                      updateNLJNode({ correctAnswers: newAnswers });
                    }}
                    color="error"
                    size="small"
                  >
                    <RemoveIcon />
                  </IconButton>
                </Stack>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={() => updateNLJNode({ 
                  correctAnswers: [...nljNode.correctAnswers, ''] 
                })}
                variant="outlined"
                size="small"
              >
                Add Answer
              </Button>
            </Stack>
            
            {'caseSensitive' in nljNode && (
              <FormControlLabel
                control={
                  <Switch
                    checked={nljNode.caseSensitive || false}
                    onChange={(e) => updateNLJNode({ caseSensitive: e.target.checked })}
                  />
                }
                label="Case Sensitive"
              />
            )}
          </>
        )}

        {/* Likert Scale Questions */}
        {editedNode.data.nodeType === 'likert_scale' && 'scale' in nljNode && (
          <Stack spacing={2}>
            <Typography variant="h6" gutterBottom>
              Scale Configuration
            </Typography>
            
            <Stack direction="row" spacing={2}>
              <TextField
                label="Min Value"
                type="number"
                value={nljNode.scale.min}
                onChange={(e) => updateNLJNode({
                  scale: { ...nljNode.scale, min: parseInt(e.target.value) || 1 }
                })}
                size="small"
              />
              <TextField
                label="Max Value"
                type="number"
                value={nljNode.scale.max}
                onChange={(e) => updateNLJNode({
                  scale: { ...nljNode.scale, max: parseInt(e.target.value) || 5 }
                })}
                size="small"
              />
            </Stack>
            
            <TextField
              label="Min Label"
              value={nljNode.scale.labels.min}
              onChange={(e) => updateNLJNode({
                scale: { 
                  ...nljNode.scale, 
                  labels: { ...nljNode.scale.labels, min: e.target.value }
                }
              })}
              size="small"
            />
            
            <TextField
              label="Max Label"
              value={nljNode.scale.labels.max}
              onChange={(e) => updateNLJNode({
                scale: { 
                  ...nljNode.scale, 
                  labels: { ...nljNode.scale.labels, max: e.target.value }
                }
              })}
              size="small"
            />
            
            {nljNode.scale.labels.middle !== undefined && (
              <TextField
                label="Middle Label"
                value={nljNode.scale.labels.middle || ''}
                onChange={(e) => updateNLJNode({
                  scale: { 
                    ...nljNode.scale, 
                    labels: { ...nljNode.scale.labels, middle: e.target.value }
                  }
                })}
                size="small"
              />
            )}
            
            {'defaultValue' in nljNode && (
              <TextField
                label="Default Value"
                type="number"
                value={nljNode.defaultValue || ''}
                onChange={(e) => updateNLJNode({ 
                  defaultValue: parseInt(e.target.value) || undefined 
                })}
                size="small"
              />
            )}
          </Stack>
        )}

        {/* Rating Questions */}
        {editedNode.data.nodeType === 'rating' && 'ratingType' in nljNode && (
          <Stack spacing={2}>
            <Typography variant="h6" gutterBottom>
              Rating Configuration
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Rating Type</InputLabel>
              <Select
                value={nljNode.ratingType}
                onChange={(e) => updateNLJNode({ 
                  ratingType: e.target.value as 'stars' | 'numeric' | 'categorical' 
                })}
              >
                <MenuItem value="stars">Stars</MenuItem>
                <MenuItem value="numeric">Numeric</MenuItem>
                <MenuItem value="categorical">Categorical</MenuItem>
              </Select>
            </FormControl>
            
            <Stack direction="row" spacing={2}>
              <TextField
                label="Min Value"
                type="number"
                value={nljNode.range.min}
                onChange={(e) => updateNLJNode({
                  range: { ...nljNode.range, min: parseInt(e.target.value) || 1 }
                })}
                size="small"
              />
              <TextField
                label="Max Value"
                type="number"
                value={nljNode.range.max}
                onChange={(e) => updateNLJNode({
                  range: { ...nljNode.range, max: parseInt(e.target.value) || 5 }
                })}
                size="small"
              />
            </Stack>
            
            {nljNode.ratingType === 'stars' && 'allowHalf' in nljNode && (
              <FormControlLabel
                control={
                  <Switch
                    checked={nljNode.allowHalf || false}
                    onChange={(e) => updateNLJNode({ allowHalf: e.target.checked })}
                  />
                }
                label="Allow Half Stars"
              />
            )}
          </Stack>
        )}

        {/* Common properties */}
        {'required' in nljNode && (
          <FormControlLabel
            control={
              <Switch
                checked={nljNode.required || false}
                onChange={(e) => updateNLJNode({ required: e.target.checked })}
              />
            }
            label="Required"
          />
        )}
      </Stack>
    );
  };

  // Render media properties
  const renderMediaProperties = () => (
    <Stack spacing={3}>
      <Typography variant="h6" gutterBottom>
        Media Content
      </Typography>
      
      {/* Single Media */}
      {'media' in nljNode && (
        <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" gutterBottom>
            Primary Media
          </Typography>
          {nljNode.media ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                {nljNode.media.type === 'IMAGE' && <ImageIcon />}
                {nljNode.media.type === 'VIDEO' && <VideoIcon />}
                {nljNode.media.type === 'AUDIO' && <AudioIcon />}
                <Typography variant="body2">
                  {nljNode.media.type}: {nljNode.media.title || 'Untitled'}
                </Typography>
              </Stack>
              
              <TextField
                label="Media Title"
                value={nljNode.media.title || ''}
                onChange={(e) => updateNLJNode({
                  media: { ...nljNode.media!, title: e.target.value }
                })}
                size="small"
                fullWidth
              />
              
              <TextField
                label="Media Path"
                value={nljNode.media.fullPath || ''}
                onChange={(e) => updateNLJNode({
                  media: { ...nljNode.media!, fullPath: e.target.value }
                })}
                size="small"
                fullWidth
              />
              
              <Button
                onClick={() => updateNLJNode({ media: undefined })}
                color="error"
                size="small"
              >
                Remove Media
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No primary media attached.
            </Typography>
          )}
        </Paper>
      )}
      
      {/* Additional Media List */}
      {'additionalMediaList' in nljNode && (
        <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" gutterBottom>
            Additional Media (Carousel)
          </Typography>
          {nljNode.additionalMediaList && nljNode.additionalMediaList.length > 0 ? (
            <Stack spacing={2}>
              {nljNode.additionalMediaList.map((mediaItem, index) => (
                <Stack key={index} spacing={1} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {mediaItem.media.type === 'IMAGE' && <ImageIcon />}
                    {mediaItem.media.type === 'VIDEO' && <VideoIcon />}
                    {mediaItem.media.type === 'AUDIO' && <AudioIcon />}
                    <Typography variant="body2">
                      {mediaItem.media.type}: {mediaItem.media.title || 'Untitled'}
                    </Typography>
                  </Stack>
                  
                  <TextField
                    label="Title"
                    value={mediaItem.media.title || ''}
                    onChange={(e) => {
                      const newMediaList = [...nljNode.additionalMediaList!];
                      newMediaList[index] = {
                        ...mediaItem,
                        media: { ...mediaItem.media, title: e.target.value }
                      };
                      updateNLJNode({ additionalMediaList: newMediaList });
                    }}
                    size="small"
                    fullWidth
                  />
                  
                  <TextField
                    label="Path"
                    value={mediaItem.media.fullPath || ''}
                    onChange={(e) => {
                      const newMediaList = [...nljNode.additionalMediaList!];
                      newMediaList[index] = {
                        ...mediaItem,
                        media: { ...mediaItem.media, fullPath: e.target.value }
                      };
                      updateNLJNode({ additionalMediaList: newMediaList });
                    }}
                    size="small"
                    fullWidth
                  />
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No additional media in carousel.
            </Typography>
          )}
        </Paper>
      )}
      
      {/* Show message if no media properties exist */}
      {!('media' in nljNode) && !('additionalMediaList' in nljNode) && (
        <Typography variant="body2" color="text.secondary">
          No media attached to this node. You can add media content using the node's properties.
        </Typography>
      )}
    </Stack>
  );

  // Render advanced properties
  const renderAdvancedProperties = () => (
    <Stack spacing={3}>
      <Typography variant="h6" gutterBottom>
        Advanced Settings
      </Typography>
      
      <TextField
        label="Node ID"
        value={editedNode.id}
        disabled
        size="small"
        fullWidth
        helperText="Unique identifier for this node"
      />
      
      <TextField
        label="Node Type"
        value={editedNode.data.nodeType}
        disabled
        size="small"
        fullWidth
        helperText="Type of node (cannot be changed)"
      />
      
      {nljNode.tags && (
        <Stack spacing={1}>
          <Typography variant="body2">Tags</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {nljNode.tags.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                onDelete={() => {
                  const newTags = nljNode.tags?.filter((_, i) => i !== index);
                  updateNLJNode({ tags: newTags });
                }}
              />
            ))}
          </Stack>
          <TextField
            label="Add Tag"
            size="small"
            onKeyDown={(e) => {
              const target = e.currentTarget as HTMLInputElement;
              if (e.key === 'Enter' && target.value.trim()) {
                const newTags = [...(nljNode.tags || []), target.value.trim()];
                updateNLJNode({ tags: newTags });
                target.value = '';
              }
            }}
            helperText="Press Enter to add a tag"
          />
        </Stack>
      )}
    </Stack>
  );

  // Render mobile game preview
  const renderMobilePreview = () => (
    <Stack spacing={3}>
      <Typography variant="h6" gutterBottom>
        Mobile Game Preview
      </Typography>
      
      <Paper 
        sx={{ 
          p: 2, 
          bgcolor: 'action.hover', 
          maxWidth: 300, 
          mx: 'auto',
          border: '2px solid', borderColor: 'divider',
          borderRadius: 3,
          position: 'relative'
        }}
      >
        {/* Mobile frame styling */}
        <Box sx={{ 
          bgcolor: 'white', 
          borderRadius: 2, 
          p: 2,
          minHeight: 200,
          position: 'relative'
        }}>
          {/* Node type indicator */}
          <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
            {nodeTypeInfo?.label || editedNode.data.nodeType}
          </Typography>
          
          {/* Main content */}
          <Stack spacing={1} sx={{ mt: 1 }}>
            {/* Title */}
            {nljNode.title && (
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
                {nljNode.title}
              </Typography>
            )}
            
            {/* Text content */}
            {'text' in nljNode && nljNode.text && (
              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                {nljNode.text.length > 100 ? nljNode.text.substring(0, 100) + '...' : nljNode.text}
              </Typography>
            )}
            
            {/* Media indicator */}
            {('media' in nljNode && nljNode.media) && (
              <Box sx={{ p: 1, bgcolor: 'action.selected', borderRadius: 1, textAlign: 'center' }}>
                <Typography variant="caption">
                  📷 {nljNode.media.type}: {nljNode.media.title || 'Media'}
                </Typography>
              </Box>
            )}
            
            {/* Carousel indicator */}
            {('additionalMediaList' in nljNode && nljNode.additionalMediaList && nljNode.additionalMediaList.length > 0) && (
              <Box sx={{ p: 1, bgcolor: 'action.selected', borderRadius: 1, textAlign: 'center' }}>
                <Typography variant="caption">
                  🎠 Carousel: {nljNode.additionalMediaList.length} items
                </Typography>
              </Box>
            )}
            
            {/* Interactive elements preview */}
            {editedNode.data.isInteractive && (
              <Box sx={{ mt: 2 }}>
                {editedNode.data.nodeType === 'true_false' && (
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" size="small" fullWidth disabled>True</Button>
                    <Button variant="outlined" size="small" fullWidth disabled>False</Button>
                  </Stack>
                )}
                
                {editedNode.data.nodeType === 'question' && (
                  <Stack spacing={0.5}>
                    <Button variant="outlined" size="small" fullWidth disabled>Choice 1</Button>
                    <Button variant="outlined" size="small" fullWidth disabled>Choice 2</Button>
                    <Button variant="outlined" size="small" fullWidth disabled>Choice 3</Button>
                  </Stack>
                )}
                
                {editedNode.data.nodeType === 'short_answer' && (
                  <TextField 
                    placeholder="Enter answer..." 
                    size="small" 
                    fullWidth 
                    disabled
                    sx={{ mt: 1 }}
                  />
                )}
                
                {editedNode.data.nodeType === 'likert_scale' && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    {[1, 2, 3, 4, 5].map(num => (
                      <Button key={num} variant="outlined" size="small" disabled>
                        {num}
                      </Button>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </Stack>
        </Box>
        
        {/* Mobile frame decoration */}
        <Box sx={{ 
          position: 'absolute', 
          top: -1, 
          left: '50%', 
          transform: 'translateX(-50%)',
          width: 60,
          height: 4,
          bgcolor: 'action.disabled',
          borderRadius: 2
        }} />
      </Paper>
      
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        This is a simplified preview. Actual rendering may vary.
      </Typography>
    </Stack>
  );

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      PaperProps={{
        sx: { width: 480, maxWidth: '90vw' }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {nodeIcon}
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" noWrap>
                {nodeTypeInfo?.label || editedNode.data.nodeType}
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
          
          {hasChanges && (
            <Alert severity="info" sx={{ mt: 2 }}>
              You have unsaved changes
            </Alert>
          )}
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="Basic" />
            {editedNode.data.isInteractive && <Tab label="Question" />}
            {nodeTypeInfo?.supportsMedia && <Tab label="Media" />}
            {(editedNode.data.isInteractive || editedNode.data.nodeType === 'interstitial_panel') && <Tab label="Preview" />}
            <Tab label="Advanced" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {(() => {
            let tabIndex = 0;
            const tabs = [];
            
            // Basic tab (always present)
            tabs.push(
              <TabPanel key="basic" value={activeTab} index={tabIndex}>
                {renderBasicProperties()}
              </TabPanel>
            );
            tabIndex++;
            
            // Question tab (only if interactive)
            if (editedNode.data.isInteractive) {
              tabs.push(
                <TabPanel key="question" value={activeTab} index={tabIndex}>
                  {renderQuestionProperties()}
                </TabPanel>
              );
              tabIndex++;
            }
            
            // Media tab (only if supports media)
            if (nodeTypeInfo?.supportsMedia) {
              tabs.push(
                <TabPanel key="media" value={activeTab} index={tabIndex}>
                  {renderMediaProperties()}
                </TabPanel>
              );
              tabIndex++;
            }
            
            // Preview tab (only if interactive or interstitial)
            if (editedNode.data.isInteractive || editedNode.data.nodeType === 'interstitial_panel') {
              tabs.push(
                <TabPanel key="preview" value={activeTab} index={tabIndex}>
                  {renderMobilePreview()}
                </TabPanel>
              );
              tabIndex++;
            }
            
            // Advanced tab (always present)
            tabs.push(
              <TabPanel key="advanced" value={activeTab} index={tabIndex}>
                {renderAdvancedProperties()}
              </TabPanel>
            );
            
            return tabs;
          })()}
        </Box>

        {/* Footer */}
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