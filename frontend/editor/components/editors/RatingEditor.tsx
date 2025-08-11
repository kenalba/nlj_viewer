/**
 * RatingEditor - Editor for Rating questions
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Alert,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
} from '@mui/material';

import { FollowupEditor } from './FollowupEditor';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode, RatingNode } from '../../../../types/nlj';

interface RatingEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const RatingEditor: React.FC<RatingEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as RatingNode;
  
  // Default values
  const ratingType = nljNode.ratingType || 'stars';
  const range = nljNode.range || { min: 1, max: 5, step: 1 };
  const categories = nljNode.categories || [];
  const defaultValue = nljNode.defaultValue;
  const required = nljNode.required || false;
  const allowHalf = nljNode.allowHalf || false;
  const showValue = nljNode.showValue || false;
  const icons = nljNode.icons || { filled: 'star', empty: 'star_border' };

  const updateRatingType = (newType: 'stars' | 'numeric' | 'categorical') => {
    const updates: Partial<RatingNode> = { ratingType: newType };
    
    // Reset default value when changing type
    if (newType === 'categorical' && categories.length > 0) {
      updates.defaultValue = undefined;
    } else if (newType !== 'categorical') {
      updates.defaultValue = range.min;
    }
    
    onUpdate(updates);
  };

  const updateRange = (rangeUpdates: Partial<typeof range>) => {
    const newRange = { ...range, ...rangeUpdates };
    
    // Ensure min is less than max
    if (rangeUpdates.min !== undefined && rangeUpdates.min >= newRange.max) {
      newRange.max = rangeUpdates.min + 1;
    }
    if (rangeUpdates.max !== undefined && rangeUpdates.max <= newRange.min) {
      newRange.min = rangeUpdates.max - 1;
    }
    
    onUpdate({ range: newRange });
  };

  const addCategory = () => {
    const newCategory = `Category ${categories.length + 1}`;
    onUpdate({ categories: [...categories, newCategory] });
  };

  const updateCategory = (index: number, value: string) => {
    const newCategories = [...categories];
    newCategories[index] = value;
    onUpdate({ categories: newCategories });
  };

  const removeCategory = (index: number) => {
    const newCategories = categories.filter((_, i) => i !== index);
    onUpdate({ categories: newCategories });
  };

  const renderPreview = () => {
    switch (ratingType) {
      case 'stars':
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {Array.from({ length: range.max }, (_, i) => (
              <StarIcon
                key={i}
                sx={{ 
                  fontSize: 24,
                  color: i < (defaultValue || 0) ? 'warning.main' : 'grey.300'
                }}
              />
            ))}
            {showValue && defaultValue && (
              <Typography variant="body2" sx={{ ml: 1 }}>
                {defaultValue}/{range.max}
              </Typography>
            )}
          </Stack>
        );
      
      case 'numeric':
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {range.min}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {Array.from({ length: range.max - range.min + 1 }, (_, i) => {
                const num = range.min + i;
                return (
                  <Button
                    key={num}
                    variant={num === defaultValue ? "contained" : "outlined"}
                    size="small"
                    disabled
                    sx={{ minWidth: 40 }}
                  >
                    {num}
                  </Button>
                );
              })}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {range.max}
            </Typography>
          </Stack>
        );
      
      case 'categorical':
        return (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {categories.map((category, index) => (
              <Chip
                key={index}
                label={category}
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        );
      
      default:
        return null;
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Rating Configuration
      </Typography>

      {/* Rating Type */}
      <FormControl size="small" fullWidth>
        <InputLabel>Rating Type</InputLabel>
        <Select
          value={ratingType}
          onChange={(e) => updateRatingType(e.target.value as 'stars' | 'numeric' | 'categorical')}
          label="Rating Type"
        >
          <MenuItem value="stars">Stars Rating</MenuItem>
          <MenuItem value="numeric">Numeric Scale</MenuItem>
          <MenuItem value="categorical">Categorical Options</MenuItem>
        </Select>
      </FormControl>

      {/* Range Configuration - for stars and numeric */}
      {(ratingType === 'stars' || ratingType === 'numeric') && (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Scale Range
          </Typography>
          
          <Stack direction="row" spacing={2}>
            <TextField
              label="Min Value"
              type="number"
              value={range.min}
              onChange={(e) => updateRange({ min: parseInt(e.target.value) || 1 })}
              size="small"
              sx={{ width: 120 }}
            />
            
            <TextField
              label="Max Value"
              type="number"
              value={range.max}
              onChange={(e) => updateRange({ max: parseInt(e.target.value) || 5 })}
              size="small"
              sx={{ width: 120 }}
            />
            
            {ratingType === 'numeric' && (
              <TextField
                label="Step"
                type="number"
                value={range.step || 1}
                onChange={(e) => updateRange({ step: parseInt(e.target.value) || 1 })}
                size="small"
                sx={{ width: 120 }}
              />
            )}
          </Stack>
        </Stack>
      )}

      {/* Categories Configuration - for categorical */}
      {ratingType === 'categorical' && (
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" color="text.secondary">
              Categories
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addCategory}
            >
              Add Category
            </Button>
          </Stack>
          
          <Stack spacing={1}>
            {categories.map((category, index) => (
              <Stack key={index} direction="row" spacing={1} alignItems="center">
                <TextField
                  value={category}
                  onChange={(e) => updateCategory(index, e.target.value)}
                  size="small"
                  fullWidth
                  placeholder={`Category ${index + 1}`}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeCategory(index)}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          
          {categories.length === 0 && (
            <Alert severity="info">
              Add categories for users to select from
            </Alert>
          )}
        </Stack>
      )}

      {/* Preview */}
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Rating Preview:
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
          {renderPreview()}
        </Paper>
      </Box>

      {/* Default Value */}
      {ratingType !== 'categorical' && (
        <TextField
          label="Default Value"
          type="number"
          value={defaultValue || ''}
          onChange={(e) => onUpdate({ defaultValue: parseInt(e.target.value) || undefined })}
          size="small"
          sx={{ width: 120 }}
          helperText="Optional default selection"
        />
      )}

      {/* Additional Options */}
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
            />
          }
          label="Required Question"
        />

        {ratingType === 'stars' && (
          <FormControlLabel
            control={
              <Switch
                checked={allowHalf}
                onChange={(e) => onUpdate({ allowHalf: e.target.checked })}
              />
            }
            label="Allow Half Stars"
          />
        )}

        <FormControlLabel
          control={
            <Switch
              checked={showValue}
              onChange={(e) => onUpdate({ showValue: e.target.checked })}
            />
          }
          label="Show Numeric Value"
        />
      </Stack>

      {/* Follow-up Configuration */}
      <FollowupEditor
        followUp={nljNode.followUp}
        onUpdate={(followUp) => onUpdate({ followUp })}
      />

      {/* Instructions */}
      <Alert severity="info">
        <Typography variant="body2">
          Configure the rating type and scale. Stars are ideal for satisfaction, 
          numeric scales for precise measurement, and categorical for qualitative ratings.
        </Typography>
      </Alert>
    </Stack>
  );
};