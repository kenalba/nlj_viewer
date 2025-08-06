/**
 * InlineTextEditor - Click-to-edit text field component
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  ClickAwayListener,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

interface InlineTextEditorProps {
  value: string;
  onUpdate: (value: string) => void;
  placeholder?: string;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption';
  multiline?: boolean;
  rows?: number;
  sx?: object;
  disabled?: boolean;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  value,
  onUpdate,
  placeholder = 'Click to edit...',
  variant = 'body1',
  multiline = false,
  rows = 1,
  sx = {},
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLDivElement>(null);

  // Update local state when value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Find the actual input or textarea element inside the MUI TextField
      const inputElement = inputRef.current.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
      if (inputElement) {
        inputElement.focus();
        // Select all text for easy replacement (only available on input elements, not textarea)
        if (inputElement instanceof HTMLInputElement) {
          inputElement.select();
        }
      }
    }
  }, [isEditing]);

  // Handle starting edit
  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
  };

  // Handle saving edit
  const handleSave = () => {
    onUpdate(editValue);
    setIsEditing(false);
  };

  // Handle canceling edit
  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  // Handle key presses
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !multiline) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  };

  // Handle click away
  const handleClickAway = () => {
    if (isEditing) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <ClickAwayListener onClickAway={handleClickAway}>
        <TextField
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          multiline={multiline}
          rows={multiline ? rows : 1}
          variant="outlined"
          size="small"
          fullWidth
          sx={sx}
        />
      </ClickAwayListener>
    );
  }

  return (
    <Box
      onClick={handleStartEdit}
      sx={{
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative',
        minHeight: multiline ? `${rows * 1.5}rem` : 'auto',
        '&:hover': disabled ? {} : {
          '& .edit-icon': {
            opacity: 1,
          },
        },
        ...sx,
      }}
    >
      <Typography
        variant={variant}
        sx={{
          color: value ? 'text.primary' : 'text.secondary',
          whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value || placeholder}
      </Typography>
      
      {!disabled && (
        <EditIcon
          className="edit-icon"
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            fontSize: 16,
            color: 'action.active',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        />
      )}
    </Box>
  );
};