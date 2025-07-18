/**
 * Node palette component for adding new nodes to the flow
 */

import React, { useState, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Stack,
  Badge,
  alpha,
  Tooltip,
  Button,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DragIndicator as DragIcon,
  Quiz as QuizIcon,
  Info as InfoIcon,
  Games as GameIcon,
  Poll as PollIcon,
  PlayArrow as StartIcon,
  Flag as EndIcon,
  Assessment as AssessmentIcon,
  Create as CreateIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import type { NodeTypeInfo, FlowNodeType } from '../types/flow';

interface NodePaletteProps {
  nodeTypes: Array<NodeTypeInfo & { type: FlowNodeType }>;
  onNodeAdd: (nodeType: FlowNodeType, position: { x: number; y: number }) => void;
  onClose: () => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
  headerHeight?: number;
  isOpen: boolean;
}

interface CategoryConfig {
  category: string;
  label: string;
  icon: React.ReactElement;
  color: string;
  expanded: boolean;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  structure: {
    category: 'structure',
    label: 'Structure',
    icon: <InfoIcon />,
    color: '#607D8B',
    expanded: true,
  },
  assessment: {
    category: 'assessment',
    label: 'Assessment',
    icon: <AssessmentIcon />,
    color: '#4CAF50',
    expanded: true,
  },
  survey: {
    category: 'survey',
    label: 'Survey',
    icon: <PollIcon />,
    color: '#FF9800',
    expanded: true,
  },
  game: {
    category: 'game',
    label: 'Games',
    icon: <GameIcon />,
    color: '#E91E63',
    expanded: true,
  },
};

export const NodePalette: React.FC<NodePaletteProps> = ({
  nodeTypes,
  onNodeAdd,
  onClose,
  headerHeight = 120,
  isOpen,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(CATEGORY_CONFIG))
  );
  const [_draggedNodeType, setDraggedNodeType] = useState<FlowNodeType | null>(null);

  // Filter node types based on search term
  const filteredNodeTypes = nodeTypes.filter(nodeType =>
    nodeType.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nodeType.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nodeType.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group node types by category
  const nodeTypesByCategory = filteredNodeTypes.reduce((acc, nodeType) => {
    const category = nodeType.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(nodeType);
    return acc;
  }, {} as Record<string, Array<NodeTypeInfo & { type: FlowNodeType }>>);

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  // Handle node drag start
  const handleDragStart = useCallback((event: React.DragEvent, nodeType: FlowNodeType) => {
    setDraggedNodeType(nodeType);
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    
    // Create a drag image
    const dragImage = document.createElement('div');
    dragImage.textContent = nodeTypes.find(n => n.type === nodeType)?.label || nodeType;
    dragImage.style.padding = '8px 12px';
    dragImage.style.backgroundColor = nodeTypes.find(n => n.type === nodeType)?.color || 'primary.main';
    dragImage.style.color = 'white';
    dragImage.style.borderRadius = '4px';
    dragImage.style.fontSize = '12px';
    dragImage.style.fontWeight = 'bold';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }, [nodeTypes]);

  // Handle node drag end
  const handleDragEnd = useCallback(() => {
    setDraggedNodeType(null);
  }, []);

  // Handle node click (for touch devices or click-to-add)
  const handleNodeClick = useCallback((nodeType: FlowNodeType) => {
    // For now, add the node at a default position
    // In a real implementation, this might show a placement cursor
    onNodeAdd(nodeType, { x: 100, y: 100 });
  }, [onNodeAdd]);

  // Get node icon
  const getNodeIcon = (nodeType: FlowNodeType) => {
    switch (nodeType) {
      case 'start':
        return <StartIcon />;
      case 'end':
        return <EndIcon />;
      case 'question':
      case 'true_false':
      case 'ordering':
      case 'matching':
      case 'short_answer':
      case 'multi_select':
      case 'checkbox':
        return <QuizIcon />;
      case 'interstitial_panel':
        return <InfoIcon />;
      case 'likert_scale':
      case 'rating':
      case 'matrix':
      case 'slider':
      case 'text_area':
        return <PollIcon />;
      case 'connections':
      case 'wordle':
        return <GameIcon />;
      default:
        return <CreateIcon />;
    }
  };

  return (
    <Drawer
      anchor="left"
      open={isOpen}
      onClose={onClose}
      variant="persistent"
      PaperProps={{
        sx: {
          width: 320,
          maxWidth: '25vw',
          backgroundColor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          height: `calc(100vh - ${headerHeight}px)`, // Account for header height
          top: headerHeight, // Start below header
        }
      }}
    >

      {/* Search */}
      <Box sx={{ p: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
          }}
        />
      </Box>

      {/* Categories and Nodes */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List dense>
          {Object.entries(CATEGORY_CONFIG).map(([categoryKey, categoryConfig]) => {
            const categoryNodes = nodeTypesByCategory[categoryKey] || [];
            const isExpanded = expandedCategories.has(categoryKey);
            
            if (categoryNodes.length === 0) return null;

            return (
              <Box key={categoryKey}>
                {/* Category Header */}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => toggleCategory(categoryKey)}
                    sx={{
                      py: 1,
                      backgroundColor: alpha(categoryConfig.color, 0.1),
                      '&:hover': {
                        backgroundColor: alpha(categoryConfig.color, 0.15),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Box sx={{ color: categoryConfig.color }}>
                        {categoryConfig.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={categoryConfig.label}
                      primaryTypographyProps={{
                        fontWeight: 'medium',
                        color: categoryConfig.color,
                      }}
                    />
                    <Badge
                      badgeContent={categoryNodes.length}
                      color="secondary"
                      sx={{ mr: 1 }}
                    />
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>
                </ListItem>

                {/* Category Nodes */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {categoryNodes.map((nodeType) => (
                      <ListItem key={nodeType.type} disablePadding>
                        <ListItemButton
                          draggable
                          onDragStart={(e) => handleDragStart(e, nodeType.type)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleNodeClick(nodeType.type)}
                          sx={{
                            pl: 4,
                            py: 1.5,
                            cursor: 'grab',
                            borderRadius: 1,
                            mx: 1,
                            mb: 0.5,
                            '&:active': {
                              cursor: 'grabbing',
                            },
                            '&:hover': {
                              backgroundColor: alpha(nodeType.color, 0.1),
                              borderLeft: `3px solid ${nodeType.color}`,
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Box 
                              sx={{ 
                                color: nodeType.color,
                                p: 0.5,
                                borderRadius: 1,
                                backgroundColor: alpha(nodeType.color, 0.1),
                              }}
                            >
                              {getNodeIcon(nodeType.type)}
                            </Box>
                          </ListItemIcon>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 'medium',
                                color: 'text.primary',
                                mb: 0.5,
                              }}
                            >
                              {nodeType.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                display: 'block',
                                lineHeight: 1.2,
                              }}
                            >
                              {nodeType.description}
                            </Typography>
                          </Box>
                          <Tooltip title="Drag to canvas or click to add">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <DragIcon sx={{ color: 'action.disabled', fontSize: 16 }} />
                              <AddIcon sx={{ color: 'action.disabled', fontSize: 16 }} />
                            </Box>
                          </Tooltip>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', mt: 'auto' }}>
        <Stack spacing={2}>
          <Divider />
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            💡 Drag nodes to canvas or click to add
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
            <Chip
              label={`${filteredNodeTypes.length} nodes`}
              size="small"
              variant="outlined"
              color="primary"
            />
            <Chip
              label={`${Object.keys(nodeTypesByCategory).length} categories`}
              size="small"
              variant="outlined"
              color="secondary"
            />
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
};