/**
 * Expression Validator Component
 * Provides real-time syntax validation and help for expression inputs
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  Alert,
  Typography,
  Chip,
  Stack,
  Collapse,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Check as CheckIcon,
  Error as ErrorIcon,
  Help as HelpIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Functions as FunctionIcon,
} from '@mui/icons-material';

import { 
  validateExpression, 
  extractVariables, 
  getExpressionDescription,
  type VariableContext 
} from '../utils/expressionEngine';

interface ExpressionValidatorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  availableVariables?: VariableContext;
  variableNames?: string[];
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  multiline?: boolean;
  rows?: number;
  showVariables?: boolean;
  showSyntaxHelp?: boolean;
  sx?: object;
}

export const ExpressionValidator: React.FC<ExpressionValidatorProps> = ({
  value,
  onChange,
  label = 'Expression',
  placeholder = 'Enter expression (e.g., score >= 80)',
  availableVariables = {},
  variableNames = [],
  helperText,
  required = false,
  disabled = false,
  size = 'medium',
  fullWidth = true,
  multiline = false,
  rows = 1,
  showVariables = true,
  showSyntaxHelp = true,
  sx = {},
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const [focused, setFocused] = useState(false);

  // Validate expression in real-time
  const validation = useMemo(() => {
    if (!value.trim()) {
      return { isValid: true, error: null }; // Empty is valid unless required
    }
    
    const result = validateExpression(value);
    return {
      isValid: result.success,
      error: result.error || null
    };
  }, [value]);

  // Extract variables used in expression
  const usedVariables = useMemo(() => {
    return extractVariables(value);
  }, [value]);

  // Get human-readable description
  const description = useMemo(() => {
    if (!value.trim() || !validation.isValid) return null;
    return getExpressionDescription(value);
  }, [value, validation.isValid]);

  // Check for undefined variables
  const undefinedVariables = useMemo(() => {
    const available = Array.from(new Set([...variableNames, ...Object.keys(availableVariables)]));
    return usedVariables.filter(varName => !available.includes(varName));
  }, [usedVariables, variableNames, availableVariables]);

  // Determine overall validation status
  const hasError = !validation.isValid || undefinedVariables.length > 0;
  const showError = hasError && value.trim() !== '';

  // Generate helpful error message
  const errorMessage = useMemo(() => {
    if (!value.trim()) return null;
    
    if (!validation.isValid) {
      return validation.error;
    }
    
    if (undefinedVariables.length > 0) {
      return `Undefined variables: ${undefinedVariables.join(', ')}`;
    }
    
    return null;
  }, [validation.isValid, validation.error, undefinedVariables, value]);

  return (
    <Box sx={sx}>
      {/* Main Input Field */}
      <TextField
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        error={showError}
        helperText={errorMessage || helperText}
        required={required}
        disabled={disabled}
        size={size}
        fullWidth={fullWidth}
        multiline={multiline}
        rows={multiline ? rows : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        InputProps={{
          endAdornment: (
            <Box display="flex" alignItems="center" gap={0.5}>
              {/* Validation Status Icon */}
              {value.trim() && (
                <Tooltip title={hasError ? 'Expression has errors' : 'Expression is valid'}>
                  {hasError ? (
                    <ErrorIcon color="error" fontSize="small" />
                  ) : (
                    <CheckIcon color="success" fontSize="small" />
                  )}
                </Tooltip>
              )}
              
              {/* Help Toggle */}
              {showSyntaxHelp && (
                <Tooltip title="Show expression help">
                  <IconButton
                    size="small"
                    onClick={() => setShowHelp(!showHelp)}
                    color={showHelp ? 'primary' : 'default'}
                  >
                    <HelpIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )
        }}
      />

      {/* Expression Description */}
      {description && !hasError && (
        <Alert severity="info" sx={{ mt: 1, fontSize: '0.875rem' }}>
          <Typography variant="body2">
            <strong>Expression:</strong> {description}
          </Typography>
        </Alert>
      )}

      {/* Used Variables */}
      {showVariables && usedVariables.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Variables used:
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {usedVariables.map((varName) => (
              <Chip
                key={varName}
                label={varName}
                size="small"
                color={undefinedVariables.includes(varName) ? 'error' : 'primary'}
                variant="outlined"
                icon={<FunctionIcon />}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Help Panel */}
      <Collapse in={showHelp}>
        <Paper sx={{ mt: 2, p: 2 }} variant="outlined">
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">Expression Help</Typography>
            <IconButton size="small" onClick={() => setShowHelp(false)}>
              <CollapseIcon />
            </IconButton>
          </Box>

          {/* Available Variables */}
          {(variableNames.length > 0 || Object.keys(availableVariables).length > 0) && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Available Variables:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5, mb: 2 }}>
                {Array.from(new Set([...variableNames, ...Object.keys(availableVariables)])).map((varName) => (
                  <Chip
                    key={varName}
                    label={varName}
                    size="small"
                    color="default"
                    variant="filled"
                    onClick={() => {
                      const newValue = value + (value.endsWith(' ') ? '' : ' ') + varName;
                      onChange(newValue);
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
              <Divider sx={{ mb: 2 }} />
            </>
          )}

          {/* Operators */}
          <Typography variant="subtitle2" gutterBottom>
            Operators:
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" component="div">
              <strong>Arithmetic:</strong> + - * / %
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Comparison:</strong> == != &lt; &lt;= &gt; &gt;=
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Logical:</strong> && (and) || (or) ! (not)
            </Typography>
          </Box>

          {/* Examples */}
          <Typography variant="subtitle2" gutterBottom>
            Examples:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="score >= 80"
                secondary="Check if score is 80 or higher"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary='userName == "admin"'
                secondary="Check if user is admin"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="attempts <= 3 && !isComplete"
                secondary="Check attempts and completion status"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="(score + bonus) / maxScore > 0.8"
                secondary="Calculate percentage with bonus"
              />
            </ListItem>
          </List>
        </Paper>
      </Collapse>
    </Box>
  );
};

export default ExpressionValidator;