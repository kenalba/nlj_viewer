/**
 * Custom React Flow edge component for NLJ links
 */

import React, { memo, useCallback, useState } from 'react';
import { 
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  TrendingUp as ProbabilityIcon,
} from '@mui/icons-material';

import type { FlowEdgeProps } from '../../flow/types/flow';

export const FlowEdge = memo(({ 
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  onEdit,
  onDelete,
  isEditMode = false,
  theme = 'unfiltered',
  style,
  markerEnd,
}: FlowEdgeProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(anchorEl);
  
  const handleMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(id);
    }
    handleMenuClose();
  }, [id, onEdit, handleMenuClose]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(id);
    }
    handleMenuClose();
  }, [id, onDelete, handleMenuClose]);

  // Calculate edge path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  // Get edge color based on probability and theme
  const getEdgeColor = () => {
    const probability = (data?.probability as number) || 1;
    const baseColor = theme === 'hyundai' ? '#002c5f' : '#666';
    
    if (selected) {
      return theme === 'hyundai' ? '#00aad2' : '#2196F3';
    }
    
    // Color intensity based on probability
    if (probability >= 0.8) return baseColor;
    if (probability >= 0.6) return alpha(baseColor, 0.8);
    if (probability >= 0.4) return alpha(baseColor, 0.6);
    if (probability >= 0.2) return alpha(baseColor, 0.4);
    return alpha(baseColor, 0.3);
  };

  // Get edge width based on probability
  const getEdgeWidth = () => {
    const probability = (data?.probability as number) || 1;
    const baseWidth = selected ? 4 : 2;
    
    if (probability >= 0.8) return baseWidth + 2;
    if (probability >= 0.6) return baseWidth + 1;
    if (probability >= 0.4) return baseWidth;
    if (probability >= 0.2) return Math.max(1, baseWidth - 1);
    return 1;
  };

  // Get edge style
  const getEdgeStyle = () => {
    const edgeColor = getEdgeColor();
    const edgeWidth = getEdgeWidth();
    
    return {
      stroke: edgeColor,
      strokeWidth: edgeWidth,
      strokeDasharray: (data?.nljLink as any)?.type === 'parent-child' ? '5,5' : undefined,
      ...style,
    };
  };

  // Get marker end configuration
  const getMarkerEnd = () => {
    if (markerEnd) return markerEnd;
    
    return `url(#marker-arrow-${getEdgeColor().replace('#', '')})`;
  };

  // Format probability as percentage
  const formatProbability = (probability: number) => {
    return `${Math.round(probability * 100)}%`;
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={getEdgeStyle()}
        markerEnd={getMarkerEnd()}
      />
      
      {/* Edge Label */}
      <EdgeLabelRenderer>
        <Box
          sx={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {/* Probability Label */}
          {data?.probability !== undefined && (data.probability as number) < 1 && (
            <Chip
              label={formatProbability(data.probability as number)}
              size="small"
              variant="filled"
              sx={{
                backgroundColor: alpha('#fff', 0.9),
                color: theme === 'hyundai' ? '#002c5f' : '#333',
                fontSize: '0.7rem',
                height: 20,
                fontWeight: 'bold',
                border: `1px solid ${getEdgeColor()}`,
                '&:hover': {
                  backgroundColor: '#fff',
                },
              }}
              icon={<ProbabilityIcon sx={{ fontSize: 12 }} />}
            />
          )}
          
          {/* Branch Condition Label */}
          {data?.label && (
            <Tooltip title={`Branch condition: ${data.label}`}>
              <Chip
                label={data.label}
                size="small"
                variant="filled"
                sx={{
                  backgroundColor: alpha('#4A148C', 0.9), // Dark purple for branch conditions
                  color: '#fff',
                  fontSize: '0.7rem',
                  height: 22,
                  maxWidth: 120,
                  fontWeight: 'bold',
                  '& .MuiChip-label': {
                    px: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                  '&:hover': {
                    backgroundColor: alpha('#4A148C', 1),
                  },
                }}
              />
            </Tooltip>
          )}

          {/* Link Type Indicator */}
          {(data?.nljLink as any)?.type === 'parent-child' && (
            <Tooltip title="Parent-Child Link">
              <Chip
                label="P-C"
                size="small"
                variant="outlined"
                sx={{
                  backgroundColor: alpha('#fff', 0.9),
                  color: theme === 'hyundai' ? '#002c5f' : '#333',
                  fontSize: '0.6rem',
                  height: 18,
                  minWidth: 18,
                  '& .MuiChip-label': {
                    px: 0.5,
                  },
                }}
              />
            </Tooltip>
          )}
          
          {/* Edit Menu Button */}
          {isEditMode && selected && (
            <IconButton
              size="small"
              onClick={handleMenuClick}
              sx={{
                backgroundColor: alpha('#fff', 0.9),
                color: theme === 'hyundai' ? '#002c5f' : '#333',
                width: 20,
                height: 20,
                '&:hover': {
                  backgroundColor: '#fff',
                },
              }}
            >
              <MoreIcon sx={{ fontSize: 12 }} />
            </IconButton>
          )}
        </Box>
      </EdgeLabelRenderer>
      
      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <MenuItem onClick={handleEdit} disabled={!onEdit}>
          <EditIcon sx={{ mr: 1, fontSize: 16 }} />
          Edit Connection
        </MenuItem>
        
        <MenuItem onClick={handleDelete} disabled={!onDelete}>
          <DeleteIcon sx={{ mr: 1, fontSize: 16 }} />
          Delete Connection
        </MenuItem>
      </Menu>
    </>
  );
});

FlowEdge.displayName = 'FlowEdge';