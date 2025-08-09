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
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Image as MediaIcon,
  PlayArrow as StartIcon,
  Flag as EndIcon,
} from '@mui/icons-material';

import type { FlowNodeProps, FlowNodeData } from '../../flow/types/flow';
// NODE_TYPE_INFO is now imported via getNodeTypeInfo utility
import { getNodeIcon, getNodeTypeInfo } from '../../flow/utils/nodeTypeUtils.tsx';
import { MarkdownRenderer } from '../../../shared/MarkdownRenderer';

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
      border: '2px solid currentColor',
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
  
  const nodeTypeInfo = getNodeTypeInfo(nodeData?.nodeType as any);
  
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

  // Get node icon using shared utility
  const nodeIcon = getNodeIcon(nodeData?.nodeType as any);

  // Get node color based on type and theme
  const getNodeColor = () => {
    if (nodeTypeInfo?.color) {
      return nodeTypeInfo.color;
    }
    return theme === 'hyundai' ? '#002c5f' : '#666';
  };

  // Use theme-appropriate text color for readability on colored backgrounds
  const muiTheme = useTheme();
  const getTextColor = () => {
    // Always use white text on colored node backgrounds for maximum readability
    return muiTheme.palette.common.white;
  };

  // Get node border color
  const getBorderColor = () => {
    if (selected) {
      return theme === 'hyundai' ? '#00aad2' : '#2196F3';
    }
    return muiTheme.palette.divider;
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
            backgroundColor: 'action.hover',
            borderRadius: theme === 'hyundai' ? '2px 2px 0 0' : '6px 6px 0 0',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {nodeIcon}
            </Box>
            <Typography variant="caption" fontWeight="bold" sx={{ color: getTextColor() }}>
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
          {/* Node Title */}
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 'bold',
              mb: 0.5,
              wordBreak: 'break-word',
              lineHeight: 1.3,
              color: getTextColor(),
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              fontSize: '0.8rem',
            }}
          >
            {nodeData?.label || nodeData?.nljNode?.title || 'Untitled'}
          </Typography>
          
          {/* Content Preview */}
          {(nodeData?.nljNode?.content || nodeData?.nljNode?.text) && (
            <Box 
              sx={{ 
                maxHeight: '60px',
                overflow: 'hidden',
                mb: 1,
                '& *': { 
                  fontSize: '0.7rem !important',
                  lineHeight: '1.2 !important',
                  color: getTextColor(),
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  margin: '0 !important',
                  padding: '0 !important',
                },
                WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
              }}
            >
              <MarkdownRenderer 
                content={nodeData.nljNode.content || nodeData.nljNode.text || ''}
                enableInterpolation={false}
                sx={{ 
                  '& p': { fontSize: '0.7rem', lineHeight: 1.2, margin: 0 },
                  '& h1, & h2, & h3, & h4, & h5, & h6': { fontSize: '0.75rem', margin: 0 },
                  '& ul, & ol': { margin: 0, paddingLeft: '12px' },
                  '& li': { fontSize: '0.7rem', lineHeight: 1.2 },
                }}
              />
            </Box>
          )}
          
          {/* Node Details */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {nodeData?.isInteractive && (
              <Chip
                label="Interactive"
                size="small"
                variant="outlined"
                sx={{ 
                  color: 'inherit',
                  borderColor: 'divider',
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
                  borderColor: 'divider',
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
                  borderColor: 'divider',
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
            <StartIcon sx={{ fontSize: 10, color: muiTheme.palette.common.white }} />
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
            <EndIcon sx={{ fontSize: 10, color: muiTheme.palette.common.white }} />
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