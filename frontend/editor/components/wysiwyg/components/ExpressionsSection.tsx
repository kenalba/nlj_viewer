/**
 * ExpressionsSection - Variable manipulation settings for nodes
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Alert,
  Paper,
  Divider,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Functions as FunctionIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../flow/types/flow';
import type { NLJNode } from '../../../../../types/nlj';
import { generateId } from '../../../../utils/idGenerator';

interface ExpressionsSection {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  availableVariables?: Array<{ id: string; name: string; type: 'number' | 'string' | 'boolean' }>;
}

// Local interface for the builder UI - different from the actual VariableChange type
interface VariableChangeBuilder {
  id: string;
  variable: string;
  operation: 'set' | 'add' | 'subtract' | 'multiply' | 'divide';
  value: string;
}

// Available operations for variable changes
const OPERATIONS = [
  { value: 'set', label: 'Set to (=)' },
  { value: 'add', label: 'Add (+)' },
  { value: 'subtract', label: 'Subtract (-)' },
  { value: 'multiply', label: 'Multiply (×)' },
  { value: 'divide', label: 'Divide (÷)' },
];

export const ExpressionsSection: React.FC<ExpressionsSection> = ({
  node,
  onUpdate,
  availableVariables = [
    // Default variables - in the future, extract from scenario
    { id: 'score', name: 'score', type: 'number' },
    { id: 'attempts', name: 'attempts', type: 'number' },
    { id: 'completed', name: 'completed', type: 'boolean' },
    { id: 'currentLevel', name: 'currentLevel', type: 'string' },
  ],
}) => {
  const nljNode = node.data.nljNode;
  const [expanded, setExpanded] = useState(false);
  
  // Get variable changes from node data (will need to extend NLJ types)
  const variableChanges = (nljNode as any).variableChanges || [];

  const handleAddVariableChange = useCallback(() => {
    const newChange: VariableChangeBuilder = {
      id: generateId('var_change'),
      variable: '',
      operation: 'set',
      value: '',
    };

    const updatedChanges = [...variableChanges, newChange];
    onUpdate({ variableChanges: updatedChanges } as any);
    
    // Auto-expand when adding a new variable change
    setExpanded(true);
  }, [variableChanges, onUpdate]);

  const handleUpdateVariableChange = useCallback((
    changeId: string,
    field: keyof VariableChangeBuilder,
    value: string
  ) => {
    const updatedChanges = variableChanges.map((change: VariableChangeBuilder) =>
      change.id === changeId
        ? { ...change, [field]: value }
        : change
    );
    onUpdate({ variableChanges: updatedChanges } as any);
  }, [variableChanges, onUpdate]);

  const handleDeleteVariableChange = useCallback((changeId: string) => {
    const updatedChanges = variableChanges.filter((change: VariableChangeBuilder) => change.id !== changeId);
    onUpdate({ variableChanges: updatedChanges } as any);
  }, [variableChanges, onUpdate]);

  return (
    <Accordion 
      expanded={expanded} 
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      sx={{ 
        boxShadow: 'none',
        border: '1px solid',
        borderColor: 'divider',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 }
      }}
    >
      <AccordionSummary 
        expandIcon={<ExpandMoreIcon />}
        sx={{ 
          backgroundColor: 'grey.50',
          minHeight: 48,
          '&.Mui-expanded': { minHeight: 48 },
          '& .MuiAccordionSummary-content': { 
            margin: '12px 0',
            '&.Mui-expanded': { margin: '12px 0' }
          }
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <FunctionIcon color="primary" />
          <Box>
            <Typography variant="subtitle2" color="text.primary">
              Variable Changes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {variableChanges.length === 0 
                ? 'No variable changes defined'
                : `${variableChanges.length} variable change${variableChanges.length !== 1 ? 's' : ''} defined`
              }
            </Typography>
          </Box>
        </Stack>
      </AccordionSummary>
      
      <AccordionDetails sx={{ p: 0 }}>
        <Stack spacing={3} sx={{ p: 2 }}>
          {/* Description */}
          <Typography variant="body2" color="text.secondary">
            Define how variables should be modified when this choice is selected.
          </Typography>

          {/* Variable Changes List */}
          {variableChanges.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                No variable changes defined. Click "Add Variable Change" to get started.
              </Typography>
            </Box>
          ) : (
            <Paper variant="outlined">
              <Stack spacing={0} divider={<Divider />}>
                {variableChanges.map((change: VariableChangeBuilder, index: number) => (
                  <Box key={change.id} sx={{ p: 2 }}>
                    {/* Row 1: Priority and Actions */}
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                      <Chip 
                        label={index + 1} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                        sx={{ minWidth: 32 }}
                      />
                      
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        Variable Change
                      </Typography>
                      
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteVariableChange(change.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>

                    {/* Row 2: Variable Selection and Operation */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      {/* Variable Dropdown */}
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Variable</InputLabel>
                        <Select
                          value={change.variable || ''}
                          label="Variable"
                          onChange={(e) => handleUpdateVariableChange(change.id, 'variable', e.target.value)}
                        >
                          {availableVariables.map((variable) => (
                            <MenuItem key={variable.id} value={variable.name}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2">{variable.name}</Typography>
                                <Chip 
                                  label={variable.type} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Operation Dropdown */}
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Operation</InputLabel>
                        <Select
                          value={change.operation || 'set'}
                          label="Operation"
                          onChange={(e) => handleUpdateVariableChange(change.id, 'operation', e.target.value)}
                        >
                          {OPERATIONS.map((op) => (
                            <MenuItem key={op.value} value={op.value}>
                              {op.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Value Input */}
                      <TextField
                        value={change.value || ''}
                        onChange={(e) => handleUpdateVariableChange(change.id, 'value', e.target.value)}
                        placeholder="Value"
                        size="small"
                        sx={{ flex: 1 }}
                      />
                    </Stack>

                    {/* Row 3: Generated Expression Preview */}
                    {change.variable && change.operation && change.value && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {change.variable} {change.operation === 'set' ? '=' : 
                           change.operation === 'add' ? '+=' :
                           change.operation === 'subtract' ? '-=' :
                           change.operation === 'multiply' ? '*=' :
                           change.operation === 'divide' ? '/=' : '='} {change.value}
                        </Typography>
                      </Alert>
                    )}
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Add Variable Change Button */}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddVariableChange}
            sx={{ alignSelf: 'flex-start' }}
          >
            Add Variable Change
          </Button>

          {/* Available Variables Reference */}
          {expanded && (
            <>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Available Variables
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {availableVariables.map((variable) => (
                    <Chip
                      key={variable.id}
                      label={`${variable.name} (${variable.type})`}
                      size="small"
                      variant="outlined"
                      icon={<FunctionIcon />}
                    />
                  ))}
                </Stack>
              </Box>

              {/* Usage Instructions */}
              <Alert severity="info" icon={<FunctionIcon />}>
                <Typography variant="body2">
                  <strong>Variable Changes:</strong> These operations will be executed when this choice is selected.
                  Changes are applied immediately and will affect subsequent conditions and expressions in the scenario.
                </Typography>
              </Alert>
            </>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default ExpressionsSection;