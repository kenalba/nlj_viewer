/**
 * Custom React Flow node component for NLJ nodes
 */

import React, { memo, useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Stack,
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Quiz as QuizIcon,
  Info as InfoIcon,
  Games as GameIcon,
  Poll as PollIcon,
  PlayArrow as StartIcon,
  Flag as EndIcon,
  Image as MediaIcon,
} from '@mui/icons-material';

import type { FlowNodeProps, FlowNodeData } from '../types/flow';
import { NODE_TYPE_INFO } from '../utils/flowUtils';

// Custom handle component
const CustomHandle = memo(({ 
  type, 
  position, 
  id, 
  isConnectable = true 
}: {
  type: 'source' | 'target';
  position: Position;
  id?: string;
  isConnectable?: boolean;
}) => (
  <Handle
    type={type}
    position={position}
    id={id}
    isConnectable={isConnectable}
    style={{
      width: 8,
      height: 8,
      backgroundColor: type === 'source' ? '#4CAF50' : '#2196F3',
      border: '2px solid #fff',
      borderRadius: '50%',
    }}
  />
));

CustomHandle.displayName = 'CustomHandle';

export const FlowNode = memo(({ 
  data, 
  id, 
  selected, 
  onEdit, 
  onDelete, 
  isEditMode = false,
  theme = 'unfiltered' 
}: FlowNodeProps) => {
  // Type guard to ensure data is FlowNodeData
  const nodeData = data as FlowNodeData;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(anchorEl);
  
  const nodeTypeInfo = NODE_TYPE_INFO[nodeData?.nodeType as keyof typeof NODE_TYPE_INFO] || NODE_TYPE_INFO['question'];
  
  const handleMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(id as string);
    }
    handleMenuClose();
  }, [id, onEdit, handleMenuClose]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(id as string);
    }
    handleMenuClose();
  }, [id, onDelete, handleMenuClose]);

  // Get node icon based on type
  const getNodeIcon = () => {
    switch (nodeData?.nodeType) {
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
        return <QuizIcon />;
    }
  };

  // Get node color based on type and theme
  const getNodeColor = () => {
    if (nodeTypeInfo?.color) {
      return nodeTypeInfo.color;
    }
    return theme === 'hyundai' ? '#002c5f' : '#666';
  };

  // Get text color based on background color for readability
  const getTextColor = () => {
    const backgroundColor = getNodeColor();
    
    // Convert hex to RGB if it's a hex color
    const getRGBValues = (color: string) => {
      if (color.startsWith('#')) {
        const hex = color.slice(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return [r, g, b];
      }
      return [128, 128, 128]; // Default gray
    };
    
    // Calculate luminance to determine if text should be light or dark
    const [r, g, b] = getRGBValues(backgroundColor);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white text for dark backgrounds, black text for light backgrounds
    return luminance > 0.5 ? '#000' : '#fff';
  };

  // Get node border color
  const getBorderColor = () => {
    if (selected) {
      return theme === 'hyundai' ? '#00aad2' : '#2196F3';
    }
    return alpha(getNodeColor(), 0.3);
  };

  // Get connection handles configuration
  const getHandles = () => {
    const handles = [];
    
    // Input handle (except for start nodes)
    if (nodeData?.nodeType !== 'start') {
      handles.push(
        <CustomHandle
          key="input"
          type="target"
          position={Position.Top}
          isConnectable={true}
        />
      );
    }
    
    // Output handle (except for end nodes)
    if (nodeData?.nodeType !== 'end') {
      handles.push(
        <CustomHandle
          key="output"
          type="source"
          position={Position.Bottom}
          isConnectable={true}
        />
      );
    }
    
    // Choice nodes might have multiple outputs
    if (nodeData?.nodeType === 'choice') {
      handles.push(
        <CustomHandle
          key="choice-output"
          type="source"
          position={Position.Right}
          id="choice"
          isConnectable={true}
        />
      );
    }
    
    return handles;
  };

  return (
    <>
      <Paper
        elevation={selected ? 8 : 2}
        onDoubleClick={() => {
          if (isEditMode && onEdit) {
            onEdit(id as string);
          }
        }}
        sx={{
          minWidth: 200,
          maxWidth: 300,
          backgroundColor: getNodeColor(),
          color: getTextColor(),
          border: `2px solid ${getBorderColor()}`,
          borderRadius: theme === 'hyundai' ? '4px' : '8px',
          transition: 'all 0.2s ease-in-out',
          cursor: isEditMode ? 'grab' : 'default',
          '&:hover': {
            elevation: 4,
            transform: 'translateY(-1px)',
          },
        }}
      >
        {/* Node Header */}
        <Box
          sx={{
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: alpha('#000', 0.1),
            borderRadius: theme === 'hyundai' ? '2px 2px 0 0' : '6px 6px 0 0',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {getNodeIcon()}
            </Box>
            <Typography variant="caption" fontWeight="bold">
              {nodeTypeInfo?.label || nodeData?.nodeType || 'Unknown'}
            </Typography>
          </Stack>
          
          {isEditMode && (
            <IconButton
              size="small"
              onClick={handleMenuClick}
              sx={{ color: 'inherit', p: 0.5 }}
            >
              <MoreIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Node Content */}
        <Box sx={{ p: 1.5 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 'medium',
              mb: 1,
              wordBreak: 'break-word',
              lineHeight: 1.2,
            }}
          >
            {nodeData?.label || 'Untitled'}
          </Typography>
          
          {/* Node Details */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {nodeData?.isInteractive && (
              <Chip
                label="Interactive"
                size="small"
                variant="outlined"
                sx={{ 
                  color: 'inherit',
                  borderColor: alpha(getTextColor(), 0.3),
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            )}
            
            {nodeData?.choiceCount && nodeData.choiceCount > 0 && (
              <Chip
                label={`${nodeData.choiceCount} choices`}
                size="small"
                variant="outlined"
                sx={{ 
                  color: 'inherit',
                  borderColor: alpha(getTextColor(), 0.3),
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            )}
            
            {nodeData?.hasContent && (
              <Tooltip title="Has media content">
                <MediaIcon sx={{ fontSize: 16, opacity: 0.7, color: getTextColor() }} />
              </Tooltip>
            )}
            
            {nodeData?.gameType && (
              <Chip
                label={nodeData.gameType}
                size="small"
                variant="outlined"
                sx={{ 
                  color: 'inherit',
                  borderColor: alpha(getTextColor(), 0.3),
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            )}
          </Stack>
        </Box>

        {/* Special indicators */}
        {nodeData?.isStart && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              backgroundColor: '#4CAF50',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StartIcon sx={{ fontSize: 10, color: '#fff' }} />
          </Box>
        )}
        
        {nodeData?.isEnd && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              backgroundColor: '#F44336',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EndIcon sx={{ fontSize: 10, color: '#fff' }} />
          </Box>
        )}
      </Paper>

      {/* Connection Handles */}
      {getHandles()}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleEdit} disabled={!onEdit}>
          <EditIcon sx={{ mr: 1, fontSize: 16 }} />
          Edit Node
        </MenuItem>
        
        <MenuItem onClick={handleDelete} disabled={!onDelete}>
          <DeleteIcon sx={{ mr: 1, fontSize: 16 }} />
          Delete Node
        </MenuItem>
      </Menu>
    </>
  );
});

FlowNode.displayName = 'FlowNode';