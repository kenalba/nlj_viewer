/**
 * Main React Flow component for viewing and editing NLJ scenarios
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Node, NodeTypes, EdgeTypes, NodeProps, NodeChange, EdgeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Stack,
  Typography,
  Button,
} from '@mui/material';
import {
  CenterFocusStrong as CenterIcon,
  GridOn as GridIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import type { NLJScenario, NLJNode, ConnectionsGroup } from '../../types/nlj';
import type { ActivitySettings } from '../../types/settings';
import type { FlowNode, FlowEdge, FlowNodeData, FlowEdgeData, FlowValidationResult, LayoutConfig, FlowNodeType } from '../types/flow';
import { 
  nljScenarioToFlow, 
  validateFlow, 
  calculateAutoLayout, 
  NODE_TYPE_INFO,
  generateId 
} from '../utils/flowUtils';
import { FlowNode as FlowNodeComponent } from './FlowNode';
import { FlowEdge as FlowEdgeComponent } from './FlowEdge';
import { NodePalette } from './NodePalette';
import { UnifiedSidebar } from './wysiwyg/UnifiedSidebar';
import { ActivitySettingsPanel } from '../../components/ActivitySettingsPanel';

interface FlowViewerProps {
  scenario: NLJScenario;
  onScenarioChange?: (scenario: NLJScenario) => void;
  onActivitySettingsChange?: (settings: ActivitySettings) => void;
  onSave?: (scenario: NLJScenario) => void;
  onExport?: (format: 'png' | 'svg' | 'json', data: NLJScenario) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  headerHeight?: number;
  readOnly?: boolean;
  showMiniMap?: boolean;
  showControls?: boolean;
  showBackground?: boolean;
  className?: string;
  // Expose internal functions for external control
  onValidate?: (result: FlowValidationResult) => void;
  onAutoLayout?: () => void;
  onToggleEditMode?: () => void;
  onShowSettings?: () => void;
  showSettings?: boolean;
  onCloseSettings?: () => void;
}


const defaultLayoutConfig: LayoutConfig = {
  algorithm: 'hierarchical',
  direction: 'TB',
  spacing: {
    nodeSpacing: 350,
    levelSpacing: 250,
    minNodeDistance: 200,
  },
  alignment: 'center',
};

function FlowViewerContent({
  scenario,
  onScenarioChange,
  onActivitySettingsChange,
  onSave,
  onExport,
  theme = 'unfiltered',
  headerHeight = 120,
  readOnly = false,
  showMiniMap = false,
  showControls = true,
  showBackground = true,
  className,
  onValidate,
  onAutoLayout,
  onShowSettings,
  showSettings = false,
  onCloseSettings,
}: FlowViewerProps) {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  
  // UI State
  const [isEditMode] = useState(!readOnly);
  const [_selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [_pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [showValidation, setShowValidation] = useState(false);
  const [validationResult, setValidationResult] = useState<FlowValidationResult | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(defaultLayoutConfig);
  
  // Initialize flow from scenario
  useEffect(() => {
    if (scenario) {
      const { nodes: flowNodes, edges: flowEdges } = nljScenarioToFlow(scenario);
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [scenario, setNodes, setEdges]);

  // Handle node/edge changes
  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => {
      if (!isEditMode) return;
      
      const newEdge: FlowEdge = {
        ...params,
        id: `edge_${Date.now()}`,
        type: 'custom',
        data: {
          nljLink: {
            id: `link_${Date.now()}`,
            type: 'link' as const,
            sourceNodeId: params.source!,
            targetNodeId: params.target!,
            probability: 1.0,
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 0, y: 0 },
          },
          probability: 1.0,
          isSelected: false,
          isHovered: false,
        },
      } as FlowEdge;
      
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [isEditMode, setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    
    // Clear edge selection when a node is clicked
    setEditingEdgeId(null);
    
    // Switch to the new node (auto-save will handle any unsaved changes)
    setEditingNodeId(node.id);
    setHasUnsavedChanges(false); // Reset unsaved changes when switching
  }, []);

  // Handle node editing
  const onNodeEdit = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
    setPendingNodeId(null);
  }, []);

  // Handle node switch request from WYSIWYG editor
  // Note: handleNodeSwitchRequest removed - now using autosave instead of manual confirmation

  // Handle changes in the WYSIWYG editor
  const handleUnsavedChanges = useCallback((hasChanges: boolean) => {
    setHasUnsavedChanges(hasChanges);
  }, []);

  // Handle adding node from editor
  const handleAddNodeFromEditor = useCallback((newNode: FlowNode) => {
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // Handle adding edge from editor
  const handleAddEdgeFromEditor = useCallback((newEdge: FlowEdge) => {
    setEdges((eds) => [...eds, newEdge]);
  }, [setEdges]);


  // Handle node deletion
  const onNodeDelete = useCallback((nodeId: string) => {
    if (!isEditMode) return;
    
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [isEditMode, setNodes, setEdges]);

  // Handle node addition from palette
  const onNodeAdd = useCallback((nodeType: FlowNodeType, position: { x: number; y: number }) => {
    if (!isEditMode) return;
    
    const nodeId = generateId(nodeType);
    
    // Create base NLJ node structure
    const createBaseNode = () => ({
      id: nodeId,
      type: nodeType,
      x: position.x,
      y: position.y,
      width: 200,
      height: 100,
      title: NODE_TYPE_INFO[nodeType]?.label || nodeType,
      description: NODE_TYPE_INFO[nodeType]?.description || '',
    });
    
    // Create type-specific NLJ node
    let nljNode: NLJNode;
    switch (nodeType) {
      case 'start':
        nljNode = { ...createBaseNode(), type: 'start' };
        break;
      case 'end':
        nljNode = { ...createBaseNode(), type: 'end' };
        break;
      case 'question':
        nljNode = {
          ...createBaseNode(),
          type: 'question',
          text: 'New Question',
          content: 'Enter your question here...',
        };
        break;
      case 'true_false':
        nljNode = {
          ...createBaseNode(),
          type: 'true_false',
          text: 'True or False Question',
          content: 'Enter your true/false question here...',
          correctAnswer: true,
        };
        break;
      case 'ordering':
        nljNode = {
          ...createBaseNode(),
          type: 'ordering',
          text: 'Ordering Question',
          content: 'Enter your ordering question here...',
          items: [],
        };
        break;
      case 'matching':
        nljNode = {
          ...createBaseNode(),
          type: 'matching',
          text: 'Matching Question',
          content: 'Enter your matching question here...',
          leftItems: [],
          rightItems: [],
          correctMatches: [],
        };
        break;
      case 'short_answer':
        nljNode = {
          ...createBaseNode(),
          type: 'short_answer',
          text: 'Short Answer Question',
          content: 'Enter your short answer question here...',
          correctAnswers: [],
        };
        break;
      case 'interstitial_panel':
        nljNode = {
          ...createBaseNode(),
          type: 'interstitial_panel',
          text: 'Information Panel',
          content: 'Enter your information content here...',
        };
        break;
      case 'likert_scale':
        nljNode = {
          ...createBaseNode(),
          type: 'likert_scale',
          text: 'Likert Scale Question',
          content: 'Enter your likert scale question here...',
          scale: {
            min: 1,
            max: 5,
            labels: {
              min: 'Strongly Disagree',
              max: 'Strongly Agree',
            },
          },
        };
        break;
      case 'rating':
        nljNode = {
          ...createBaseNode(),
          type: 'rating',
          text: 'Rating Question',
          content: 'Enter your rating question here...',
          ratingType: 'stars',
          range: {
            min: 1,
            max: 5,
          },
        };
        break;
      case 'matrix':
        nljNode = {
          ...createBaseNode(),
          type: 'matrix',
          text: 'Matrix Question',
          content: 'Enter your matrix question here...',
          rows: [],
          columns: [],
          matrixType: 'single',
        };
        break;
      case 'slider':
        nljNode = {
          ...createBaseNode(),
          type: 'slider',
          text: 'Slider Question',
          content: 'Enter your slider question here...',
          range: {
            min: 0,
            max: 100,
            step: 1,
          },
          labels: {
            min: 'Min',
            max: 'Max',
          },
        };
        break;
      case 'text_area':
        nljNode = {
          ...createBaseNode(),
          type: 'text_area',
          text: 'Text Area Question',
          content: 'Enter your text area question here...',
          maxLength: 500,
        };
        break;
      case 'multi_select':
        nljNode = {
          ...createBaseNode(),
          type: 'multi_select',
          text: 'Multi-Select Question',
          content: 'Enter your multi-select question here...',
          options: [],
        };
        break;
      case 'checkbox':
        nljNode = {
          ...createBaseNode(),
          type: 'checkbox',
          text: 'Checkbox Question',
          content: 'Enter your checkbox question here...',
          options: [],
        };
        break;
      case 'connections':
        nljNode = {
          ...createBaseNode(),
          type: 'connections',
          text: 'Connections Game',
          content: 'Enter your connections game description here...',
          gameData: {
            title: 'Connections Game',
            instructions: 'Find groups of 4 related words',
            groups: [
              { category: 'FRUITS', words: ['APPLE', 'BANANA', 'CHERRY', 'GRAPE'] as [string, string, string, string], difficulty: 'yellow' },
              { category: 'COLORS', words: ['RED', 'BLUE', 'GREEN', 'YELLOW'] as [string, string, string, string], difficulty: 'green' },
              { category: 'CITRUS', words: ['ORANGE', 'PEACH', 'PLUM', 'BERRY'] as [string, string, string, string], difficulty: 'blue' },
              { category: 'SIZES', words: ['SMALL', 'LARGE', 'MEDIUM', 'HUGE'] as [string, string, string, string], difficulty: 'purple' }
            ] as [ConnectionsGroup, ConnectionsGroup, ConnectionsGroup, ConnectionsGroup]
          }
        };
        break;
      case 'wordle':
        nljNode = {
          ...createBaseNode(),
          type: 'wordle',
          text: 'Wordle Game',
          content: 'Enter your wordle game description here...',
          gameData: {
            targetWord: 'REACT',
            maxAttempts: 6,
            wordLength: 5
          },
          showKeyboard: true,
          allowHints: true
        };
        break;
      default:
        nljNode = {
          ...createBaseNode(),
          type: 'question',
          text: 'New Node',
          content: 'Enter content here...',
        };
    }
    
    // Create Flow node
    const flowNode: FlowNode = {
      id: nodeId,
      type: 'custom',
      position,
      data: {
        nljNode,
        label: NODE_TYPE_INFO[nodeType]?.label || nodeType,
        nodeType: nodeType,
        isStart: nodeType === 'start',
        isEnd: nodeType === 'end',
        hasContent: ['question', 'interstitial_panel', 'true_false', 'ordering', 'matching', 'short_answer', 'likert_scale', 'rating', 'matrix', 'slider', 'text_area', 'multi_select', 'checkbox', 'connections', 'wordle'].includes(nodeType),
        isInteractive: NODE_TYPE_INFO[nodeType]?.isInteractive || false,
        questionType: nodeType === 'question' ? 'multiple_choice' : nodeType,
        gameType: ['connections', 'wordle'].includes(nodeType) ? nodeType : undefined,
      },
    };
    
    setNodes((nds) => [...nds, flowNode]);
  }, [isEditMode, setNodes]);

  // Handle drag over canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop on canvas
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    
    const nodeType = event.dataTransfer.getData('application/reactflow');
    
    if (nodeType && reactFlowInstance) {
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      onNodeAdd(nodeType as FlowNodeType, position);
    }
  }, [reactFlowInstance, onNodeAdd]);

  // Handle edge editing
  const onEdgeEdit = useCallback((edgeId: string) => {
    if (!isEditMode) return;
    
    setEditingEdgeId(edgeId);
    // Don't close node editor if it's open - unified sidebar will handle both
  }, [isEditMode]);

  // Handle edge deletion
  const onEdgeDelete = useCallback((edgeId: string) => {
    if (!isEditMode) return;
    
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    setEditingEdgeId(null);
  }, [isEditMode, setEdges]);

  // Handle edge save
  const onEdgeSave = useCallback((edgeId: string, updates: Partial<FlowEdge>) => {
    setEdges((eds) => eds.map(edge => 
      edge.id === edgeId ? { ...edge, ...updates } : edge
    ));
  }, [setEdges]);

  // Handle edge click for selection
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: FlowEdge) => {
    if (!isEditMode) return;
    
    // Clear node selection when an edge is clicked
    setEditingNodeId(null);
    setSelectedNodeId(null);
    
    setEditingEdgeId(edge.id);
  }, [isEditMode]);

  // Auto-layout (exposed to parent)
  const handleAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = calculateAutoLayout(
      nodes,
      edges,
      layoutConfig
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    if (onAutoLayout) {
      onAutoLayout();
    }
  }, [nodes, edges, layoutConfig, setNodes, setEdges, onAutoLayout]);

  // Validation (exposed to parent)
  const handleValidate = useCallback(() => {
    const result = validateFlow(nodes, edges);
    setValidationResult(result);
    setShowValidation(true);
    if (onValidate) {
      onValidate(result);
    }
  }, [nodes, edges, onValidate]);

  // Fit view
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 });
  }, [reactFlowInstance]);

  // Node types for palette
  const nodeTypeOptions = useMemo(() => {
    return Object.values(NODE_TYPE_INFO).map(info => ({
      type: info.type,
      label: info.label,
      description: info.description,
      icon: info.icon,
      category: info.category,
      color: info.color,
      isInteractive: info.isInteractive,
      hasChoices: info.hasChoices,
      supportsMedia: info.supportsMedia,
    }));
  }, []);

  // Expose functions via useEffect to parent component
  useEffect(() => {
    // These functions are now accessible to parent via callbacks
    if (onAutoLayout) {
      (window as any).flowAutoLayout = handleAutoLayout;
    }
    if (onValidate) {
      (window as any).flowValidate = handleValidate;
    }
    
    return () => {
      delete (window as any).flowAutoLayout;
      delete (window as any).flowValidate;
    };
  }, [handleAutoLayout, handleValidate, onAutoLayout, onValidate]);

  // Node types with props passed from this component
  const nodeTypes: NodeTypes = useMemo(() => ({
    custom: (props: NodeProps) => (
      <FlowNodeComponent 
        {...props}
        data={props.data as FlowNodeData}
        onEdit={onNodeEdit}
        onDelete={onNodeDelete}
        isEditMode={isEditMode}
        theme={theme}
      />
    ),
  }), [onNodeEdit, onNodeDelete, isEditMode, theme]);

  // Edge types with props passed from this component
  const edgeTypes: EdgeTypes = useMemo(() => ({
    custom: (props: any) => (
      <FlowEdgeComponent 
        {...props}
        data={props.data as FlowEdgeData}
        onEdit={onEdgeEdit}
        onDelete={onEdgeDelete}
        isEditMode={isEditMode}
        theme={theme}
      />
    ),
  }), [onEdgeEdit, onEdgeDelete, isEditMode, theme]);

  return (
    <Box className={className} sx={{ width: '100%', height: '100%', position: 'relative', overflowX: 'hidden' }}>

      {/* React Flow Canvas */}
      <Box 
        sx={{ 
          width: '100%', 
          height: '100%', 
          transition: 'margin 0.3s ease',
          marginLeft: showPalette ? '320px' : '0px',
          marginRight: Boolean(editingNodeId || editingEdgeId) ? '480px' : '0px',
          overflow: 'hidden', // Prevent content from overflowing
        }}
      >
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={(_event, node) => {
          if (isEditMode) {
            onNodeEdit(node.id);
          }
        }}
        onEdgeClick={onEdgeClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid={true}
        snapGrid={[20, 20]}
        connectionLineStyle={{ stroke: 'text.secondary', strokeWidth: 2 }}
        deleteKeyCode={isEditMode ? 'Delete' : null}
        multiSelectionKeyCode={isEditMode ? 'Shift' : null}
        panOnScroll={true}
        panOnScrollSpeed={0.5}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        selectNodesOnDrag={isEditMode}
        nodesConnectable={isEditMode}
        nodesDraggable={isEditMode}
      >
        {showBackground && <Background color="action.hover" gap={20} />}
        
        {showControls && (
          <Box
            sx={{
              position: 'fixed',
              right: editingNodeId ? '490px' : '10px',
              bottom: '10px',
              zIndex: 9999,
              transition: 'right 0.3s ease',
              backgroundColor: 'background.paper',
              borderRadius: 1,
              padding: 1,
              boxShadow: 4,
              border: 1,
              borderColor: 'divider',
              '& .react-flow__controls': {
                backgroundColor: 'transparent',
                boxShadow: 'none',
                border: 'none',
              },
              '& .react-flow__controls button': {
                backgroundColor: 'background.default',
                color: 'text.primary',
                border: 1,
                borderColor: 'divider',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  color: 'text.primary',
                },
              },
            }}
          >
            <Controls 
              showZoom={true}
              showFitView={true}
              showInteractive={true}
              position="bottom-right"
            />
          </Box>
        )}
        
        {showMiniMap && (
          <MiniMap 
            position="bottom-left"
            nodeColor={(node) => {
              const nodeType = (node.data as FlowNodeData)?.nodeType || 'default';
              return NODE_TYPE_INFO[nodeType]?.color || 'text.secondary';
            }}
            maskColor="rgba(0,0,0,0.1)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              border: '1px solid', borderColor: 'divider',
              borderRadius: '4px',
            }}
          />
        )}

        {/* Additional Controls Panel */}
        <Panel position="top-right">
          <Stack 
            spacing={1}
            sx={{
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
            }}
          >
            <Tooltip title="Fit View">
              <IconButton onClick={handleFitView} size="small">
                <CenterIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Reset Zoom">
              <IconButton onClick={handleResetZoom} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            {isEditMode && (
              <>
                <Tooltip title="Node Palette">
                  <IconButton 
                    onClick={() => setShowPalette(!showPalette)} 
                    size="small"
                    color={showPalette ? 'primary' : 'default'}
                  >
                    <GridIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Flow Settings">
                  <IconButton 
                    onClick={() => onShowSettings?.() || console.log('Settings clicked')} 
                    size="small"
                    color={showSettings ? 'primary' : 'default'}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Panel>
      </ReactFlow>
      </Box>

      {/* Node Palette */}
      {isEditMode && (
        <NodePalette
          nodeTypes={nodeTypeOptions}
          onNodeAdd={onNodeAdd}
          onClose={() => setShowPalette(false)}
          theme={theme}
          headerHeight={headerHeight}
          isOpen={showPalette}
        />
      )}

      {/* Unified Sidebar for Node and Edge Editing */}
      <UnifiedSidebar
        node={editingNodeId ? nodes.find(n => n.id === editingNodeId) || null : null}
        onNodeSave={(updatedNode) => {
          // Only update node data, don't close editor (for autosave)
          setNodes(nodes.map(n => n.id === editingNodeId ? updatedNode : n));
          setHasUnsavedChanges(false);
        }}
        onNodeDelete={onNodeDelete}
        edge={editingEdgeId ? edges.find(e => e.id === editingEdgeId) || null : null}
        onEdgeSave={onEdgeSave}
        onEdgeDelete={onEdgeDelete}
        allNodes={nodes}
        allEdges={edges}
        isOpen={Boolean(editingNodeId || editingEdgeId)}
        onClose={() => {
          setEditingNodeId(null);
          setEditingEdgeId(null);
          setHasUnsavedChanges(false);
        }}
        theme={theme}
        headerHeight={headerHeight}
        onUnsavedChanges={handleUnsavedChanges}
        onAddNode={handleAddNodeFromEditor}
        onAddEdge={handleAddEdgeFromEditor}
        activitySettings={scenario.settings || {}}
      />

      {/* Validation Results Dialog */}
      <Dialog
        open={showValidation}
        onClose={() => setShowValidation(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Flow Validation Results</DialogTitle>
        <DialogContent>
          {validationResult && (
            <Stack spacing={2}>
              <Alert 
                severity={validationResult.isValid ? 'success' : 'error'}
                sx={{ mb: 2 }}
              >
                {validationResult.isValid 
                  ? 'Flow validation passed!' 
                  : `Found ${validationResult.errors.filter(e => e.type === 'error').length} errors and ${validationResult.errors.filter(e => e.type === 'warning').length} warnings`
                }
              </Alert>
              
              {validationResult.errors.map((error, index) => (
                <Alert 
                  key={index} 
                  severity={error.type === 'error' ? 'error' : 'warning'}
                  sx={{ mb: 1 }}
                >
                  <strong>{error.message}</strong>
                  {error.suggestion && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Suggestion: {error.suggestion}
                    </Typography>
                  )}
                </Alert>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowValidation(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={showSettings}
        onClose={onCloseSettings}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Scenario & Flow Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Activity Settings Panel */}
            <ActivitySettingsPanel
              scenario={scenario}
              onUpdate={onActivitySettingsChange || (() => {})}
              isExpanded={true}
            />
            
            {/* Flow Layout Settings */}
            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
              Flow Layout Settings
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Layout Algorithm</InputLabel>
              <Select
                value={layoutConfig.algorithm}
                onChange={(e) => setLayoutConfig({
                  ...layoutConfig,
                  algorithm: e.target.value as LayoutConfig['algorithm']
                })}
              >
                <MenuItem value="hierarchical">Hierarchical</MenuItem>
                <MenuItem value="force">Force-Directed</MenuItem>
                <MenuItem value="circular">Circular</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Direction</InputLabel>
              <Select
                value={layoutConfig.direction}
                onChange={(e) => setLayoutConfig({
                  ...layoutConfig,
                  direction: e.target.value as LayoutConfig['direction']
                })}
              >
                <MenuItem value="TB">Top to Bottom</MenuItem>
                <MenuItem value="BT">Bottom to Top</MenuItem>
                <MenuItem value="LR">Left to Right</MenuItem>
                <MenuItem value="RL">Right to Left</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Node Spacing"
              type="number"
              value={layoutConfig.spacing.nodeSpacing}
              onChange={(e) => setLayoutConfig({
                ...layoutConfig,
                spacing: {
                  ...layoutConfig.spacing,
                  nodeSpacing: parseInt(e.target.value) || 350
                }
              })}
              fullWidth
            />
            
            <TextField
              label="Level Spacing"
              type="number"
              value={layoutConfig.spacing.levelSpacing}
              onChange={(e) => setLayoutConfig({
                ...layoutConfig,
                spacing: {
                  ...layoutConfig.spacing,
                  levelSpacing: parseInt(e.target.value) || 250
                }
              })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseSettings}>Cancel</Button>
          <Button onClick={onCloseSettings} variant="contained">
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export function FlowViewer(props: FlowViewerProps) {
  return (
    <ReactFlowProvider>
      <FlowViewerContent {...props} />
    </ReactFlowProvider>
  );
}