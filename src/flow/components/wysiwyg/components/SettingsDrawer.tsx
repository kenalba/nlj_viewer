/**
 * SettingsDrawer - Collapsible advanced settings section
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Chip,
  Collapse,
  Paper,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import { getFeedbackColors } from '../../../../utils/feedbackColors';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode } from '../../../../types/nlj';

interface SettingsDrawerProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  isExpanded: boolean;
  onToggle: () => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  node,
  onUpdate,
  isExpanded,
  onToggle,
  theme = 'unfiltered',
}) => {
  const muiTheme = useTheme();
  const themeColors = getFeedbackColors(muiTheme, theme === 'custom' ? 'unfiltered' : theme);
  const nljNode = node.data.nljNode as any; // Type assertion for flexible fields
  const nodeType = node.data.nodeType;

  // Handle tag operations
  const handleAddTag = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const target = event.currentTarget;
      const newTag = target.value.trim();
      if (newTag && !nljNode.tags?.includes(newTag)) {
        const newTags = [...(nljNode.tags || []), newTag];
        onUpdate({ tags: newTags });
        target.value = '';
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = nljNode.tags?.filter((tag: string) => tag !== tagToRemove) || [];
    onUpdate({ tags: newTags });
  };

  const renderContent = () => (
    <Stack spacing={3}>
      
      {/* Node Information */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Node Information
        </Typography>
        
        <Stack spacing={2}>
          <TextField
            label="Node ID"
            value={node.id}
            disabled
            size="small"
            fullWidth
            helperText="Unique identifier for this node"
          />
          
          <TextField
            label="Node Type"
            value={nodeType}
            disabled
            size="small"
            fullWidth
            helperText="Type of node (cannot be changed)"
          />
        </Stack>
      </Box>

      {/* Tags */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Tags
        </Typography>
        
        {/* Existing Tags */}
        {nljNode.tags && nljNode.tags.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            {nljNode.tags.map((tag: string, index: number) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                onDelete={() => handleRemoveTag(tag)}
                deleteIcon={<CloseIcon />}
              />
            ))}
          </Stack>
        )}
        
        {/* Add Tag Input */}
        <TextField
          label="Add Tag"
          size="small"
          fullWidth
          onKeyDown={handleAddTag}
          helperText="Press Enter to add a tag"
          placeholder="Type a tag and press Enter"
        />
      </Box>

      {/* Technical Properties */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Technical Properties
        </Typography>
        
        <Stack spacing={2}>
          {/* Position */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="X Position"
              type="number"
              value={node.position.x}
              disabled
              size="small"
              sx={{ width: '50%' }}
            />
            <TextField
              label="Y Position"
              type="number"
              value={node.position.y}
              disabled
              size="small"
              sx={{ width: '50%' }}
            />
          </Stack>

          {/* Dimensions */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Width"
              type="number"
              value={node.width || 'auto'}
              disabled
              size="small"
              sx={{ width: '50%' }}
            />
            <TextField
              label="Height"
              type="number"
              value={node.height || 'auto'}
              disabled
              size="small"
              sx={{ width: '50%' }}
            />
          </Stack>
        </Stack>
      </Box>

      {/* Node-specific Settings */}
      {nodeType === 'question' && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Question Settings
          </Typography>
          
          <TextField
            label="Question Weight"
            type="number"
            value={nljNode.weight || 1}
            onChange={(e) => onUpdate({ weight: parseInt(e.target.value) || 1 } as any)}
            size="small"
            helperText="Scoring weight for this question"
            sx={{ width: 120 }}
          />
        </Box>
      )}

      {/* Timing Settings */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Timing (Optional)
        </Typography>
        
        <Stack spacing={2}>
          <TextField
            label="Time Limit (seconds)"
            type="number"
            value={nljNode.timeLimit || ''}
            onChange={(e) => onUpdate({ timeLimit: parseInt(e.target.value) || undefined } as any)}
            size="small"
            helperText="Maximum time allowed for this node"
            sx={{ width: 200 }}
          />
          
          <TextField
            label="Minimum Time (seconds)"
            type="number"
            value={nljNode.minTime || ''}
            onChange={(e) => onUpdate({ minTime: parseInt(e.target.value) || undefined } as any)}
            size="small"
            helperText="Minimum time before user can proceed"
            sx={{ width: 200 }}
          />
        </Stack>
      </Box>

      {/* Debug Info */}
      <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Last modified: {new Date().toLocaleString()}
        </Typography>
      </Box>

    </Stack>
  );

  // If always expanded (tab mode), render content directly
  if (isExpanded && onToggle === (() => {})) {
    return renderContent();
  }

  // Otherwise render as collapsible drawer
  return (
    <Box>
      {/* Header */}
      <Button
        onClick={onToggle}
        startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        variant="outlined"
        fullWidth
        sx={{ 
          justifyContent: 'flex-start',
          textTransform: 'none',
          py: 1.5,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
          Advanced Settings
        </Typography>
      </Button>

      {/* Collapsible Content */}
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Paper 
          variant="outlined" 
          sx={{ 
            mt: 2, 
            p: 3,
            bgcolor: theme === 'unfiltered' ? `${themeColors.primary}10` : 'grey.50',
            borderStyle: 'dashed',
            borderColor: theme === 'unfiltered' ? `${themeColors.primary}50` : 'divider',
          }}
        >
          {renderContent()}
        </Paper>
      </Collapse>
    </Box>
  );
};